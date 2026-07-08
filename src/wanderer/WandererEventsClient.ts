import type { Client } from 'discord.js';
import { TextChannel } from 'discord.js';
import { LOGGER } from '../helpers/Logger';
import { WandererMaps } from './WandererMaps';
import type {
  WandererEvent,
  WandererEventsSetupResult,
  WandererSystemsResponse,
} from './WandererTypes';
import {
  getWandererEventsStreamUrl,
  getWandererSystemsUrl,
  parseWandererMapUrl,
} from './WandererApi';
import crypto, { hkdfSync } from 'node:crypto';
import { Config } from '../Config';
import type { SSEOptions } from 'sse-events-2';
import { streamSSE } from 'sse-events-2';

type FatalError = Error & { fatal?: boolean };

function isFatalStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isWandererSystemsResponse(
  value: unknown
): value is WandererSystemsResponse {
  return (
    isRecord(value)
    && Array.isArray(value.systems)
    && Array.isArray(value.connections)
  );
}

function isWandererEvent(value: unknown): value is WandererEvent {
  return (
    isRecord(value)
    && typeof value.map_id === 'string'
    && typeof value.type === 'string'
  );
}

async function readResponseBody(
  response: Response
): Promise<WandererSystemsResponse | undefined> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text);
    if (isWandererSystemsResponse(parsed.data)) {
      return parsed.data;
    }
    if (isWandererSystemsResponse(parsed)) {
      return parsed;
    }
    return undefined;
  }
  catch {
    return undefined;
  }
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (body && typeof body === 'object') {
    const response = body as {
      error?: unknown;
      message?: unknown;
      detail?: unknown;
    };

    for (const value of [response.error, response.message, response.detail]) {
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  }

  return fallback;
}

class WandererEventsClient {
  private static instance: WandererEventsClient;
  private readonly controllers = new Map<string, AbortController>();
  // Track per-channel connection state
  // started: whether we attempted to start the stream at app startup or via connect
  // connected: whether the SSE stream is currently active
  // terminatedEarly: whether the stream terminated before app shutdown and needs manual restart
  private readonly connectionStates = new Map<
    string,
    { started: boolean; connected: boolean; terminatedEarly: boolean }
  >();
  private client?: Client;

  public static getInstance(): WandererEventsClient {
    if (!WandererEventsClient.instance) {
      WandererEventsClient.instance = new WandererEventsClient();
    }
    return WandererEventsClient.instance;
  }

  public async startAllConnections(client: Client): Promise<void> {
    this.client = client;
    WandererMaps.getInstance().forEachConnection((channelId) => {
      void this.startConnection(channelId);
    });
  }

  public async connectWandererMap(params: {
    channelId: string;
    mapUrl: string;
    apiKey: string;
  }): Promise<WandererEventsSetupResult> {
    const { domain, mapId } = parseWandererMapUrl(params.mapUrl);
    const slug = mapId;

    LOGGER.warning(
      `Connecting Wanderer map for channel ${params.channelId}: domain=${domain}, mapId=${mapId}`
    );

    // Encrypt the API key before persisting. Use WANDERER_SECRET env var
    // combined with the map path to derive an encryption key.
    // Use HKDF (SHA-256) + AES-256-GCM (AEAD) to provide confidentiality
    // and authenticity. Store as: saltB64:ivB64:cipherB64:tagB64
    const mapPath = domain + '/' + slug;
    const secret = process.env.WANDERER_SECRET || '';

    // Per-record random salt (16 bytes) and 12-byte IV for GCM
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);

    // Derive a 32-byte key with HKDF using mapPath as context/info
    const key = hkdfSync(
      'sha256',
      Buffer.from(secret, 'utf8'),
      salt,
      Buffer.from(mapPath, 'utf8'),
      32
    );

    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
    // Bind the mapPath as AAD to tie ciphertext to this map context
    cipher.setAAD(Buffer.from(mapPath, 'utf8'));
    const encryptedBuf = Buffer.concat([
      cipher.update(params.apiKey, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const encryptedBlob =
      salt.toString('base64')
      + ':'
      + iv.toString('base64')
      + ':'
      + encryptedBuf.toString('base64')
      + ':'
      + tag.toString('base64');

    const createdAt = new Date().toISOString();
    const connectionMeta = {
      channelId: params.channelId,
      slug,
      domain,
      EncryptedDetails: encryptedBlob,
      createdAt,
    };

    await this.syncMapSystems(connectionMeta);

    this.stopConnection(params.channelId);
    void this.startConnection(params.channelId);

    return {
      slug,
      domain,
      EncryptedDetails: encryptedBlob,
      createdAt,
    };
  }

  public async disconnectWandererMap(channelId: string): Promise<void> {
    this.stopConnection(channelId);
  }

  public getConnection(channelId: string): { mapPath?: string } | undefined {
    const cfg = Config.getInstance();
    const sub = cfg.allSubscriptions.get(channelId);
    if (!sub) return undefined;
    const ws = sub.WandererSettings;
    const mapPath =
      ws?.Domain && ws.Slug ? `${ws.Domain}/${ws.Slug}` : undefined;
    return { mapPath };
  }

  public getSystemCount(mapId: string): number {
    return WandererMaps.getInstance().getSystemCountForMap(mapId);
  }

  private stopConnection(channelId: string): void {
    this.controllers.get(channelId)?.abort();
    this.controllers.delete(channelId);
  }

  private buildChannelErrorMessage(error: unknown): string {
    if (!error) return 'Wanderer stream error';

    if (error instanceof Error) {
      const anyErr = error as Error & { fatal?: boolean };
      return anyErr.fatal
        ? `Wanderer stream fatal error: ${anyErr.message}`
        : `Wanderer stream error: ${anyErr.message}`;
    }

    if (typeof error === 'object' && error !== null) {
      const e = error as { message?: unknown };
      if (typeof e.message === 'string' && e.message.trim()) return e.message;
      try {
        return JSON.stringify(error);
      }
      catch {
        return 'Wanderer stream error';
      }
    }

    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean') {
      return String(error);
    }
    return 'Wanderer stream error';
  }

  private async sendChannelMessage(
    channelId: string | undefined,
    message: string
  ): Promise<void> {
    if (!channelId || !this.client) return;

    try {
      const ch = await this.client.channels.fetch(channelId);
      if (!ch) return;
      if (ch instanceof TextChannel) {
        await ch.send({ content: message });
      }
    }
    catch (err) {
      LOGGER.warning(
        `Failed to send Wanderer stream message to ${channelId}: ${err}`
      );
    }
  }

  private async startConnection(channelId: string): Promise<void> {
    if (this.controllers.has(channelId)) return;
    // mark that we've attempted to start this connection
    this.connectionStates.set(
      channelId,
      {
        started: true,
        connected: false,
        terminatedEarly: false,
      }
    );
    const cfg = Config.getInstance();
    const sub = cfg.allSubscriptions.get(channelId);
    const ws = sub?.WandererSettings;
    if (!ws?.Slug || !ws.EncryptedDetails || !ws.Domain) return;

    const controller = new AbortController();
    this.controllers.set(channelId, controller);

    try {
      await this.processConnection(channelId, controller);
    }
    finally {
      this.controllers.delete(channelId);
    }
  }

  public async restartConnection(channelId: string): Promise<boolean> {
    // If already connected, nothing to do
    const state = this.connectionStates.get(channelId);
    if (state?.connected) return false;

    // Stop any existing controller just in case
    this.stopConnection(channelId);

    const cfg = Config.getInstance();
    const sub = cfg.allSubscriptions.get(channelId);
    const ws = sub?.WandererSettings;
    if (!ws?.Slug || !ws.EncryptedDetails || !ws.Domain) return false;

    const controller = new AbortController();
    this.controllers.set(channelId, controller);

    // mark that we attempted to start
    this.connectionStates.set(
      channelId,
      {
        started: true,
        connected: false,
        terminatedEarly: false,
      }
    );

    // Kick off processConnection but don't await here so the command can reply quickly.
    void (async () => {
      try {
        await this.processConnection(channelId, controller);
      }
      finally {
        this.controllers.delete(channelId);
      }
    })();

    return true;
  }

  public isConnected(channelId: string): boolean {
    return Boolean(this.connectionStates.get(channelId)?.connected);
  }

  public hasTerminatedEarly(channelId: string): boolean {
    return Boolean(this.connectionStates.get(channelId)?.terminatedEarly);
  }

  public getConnectionState(
    channelId: string
  ):
    | { started: boolean; connected: boolean; terminatedEarly: boolean }
    | undefined {
    return this.connectionStates.get(channelId);
  }

  private async processConnection(
    channelId: string,
    controller: AbortController
  ) {
    const latestSub = Config.getInstance().allSubscriptions.get(channelId);
    const latestWs = latestSub?.WandererSettings;
    if (!latestWs?.Slug || !latestWs.EncryptedDetails || !latestWs.Domain) {
      return;
    }
    const latestConnection = {
      domain: latestWs.Domain,
      slug: latestWs.Slug,
      EncryptedDetails: latestWs.EncryptedDetails,
      channelId,
    };

    try {
      await this.syncMapSystems(latestConnection);
      const thisState = {
        started: true,
        connected: false,
        terminatedEarly: false,
      };
      // mark connected before starting the SSE stream
      this.connectionStates.set(channelId, thisState);
      await this.streamMapEvents(
        latestConnection,
        thisState,
        controller.signal
      );
      // If stream ends normally, log a warning and exit
      LOGGER.error(`Wanderer events stream ended for channel ${channelId}.`);
      // mark disconnected and terminated early
      this.connectionStates.set(
        channelId,
        {
          started: true,
          connected: false,
          terminatedEarly: true,
        }
      );
      // post a message to the channel to notify users
      const channelMessage = `Wanderer events stream ended unexpectedly for this channel.
Check your mapper is still available at ${latestConnection.domain}/${latestConnection.slug}.
Issue the \`/wanderer restart\` command to attempt to restart the stream.`;
      await this.sendChannelMessage(channelId, channelMessage);
    }
    catch (error) {
      // mark disconnected and terminated early
      this.connectionStates.set(
        channelId,
        {
          started: true,
          connected: false,
          terminatedEarly: true,
        }
      );
      LOGGER.error(
        `Wanderer events stream issue for channel ${channelId}: ${error}`
      );

      const channelMessage = this.buildChannelErrorMessage(error);
      await this.sendChannelMessage(channelId, channelMessage);
    }
  }

  private async syncMapSystems(connection: {
    domain: string;
    slug: string;
    EncryptedDetails?: string;
    channelId?: string;
  }): Promise<void> {
    const mapPath = connection.domain + '/' + connection.slug;
    const apiKey = this.decryptApiKey(mapPath, connection.EncryptedDetails);
    const response = await fetch(
      getWandererSystemsUrl(connection.domain, connection.slug),
      {
        headers: { Authorization: 'Bearer ' + apiKey },
      }
    );

    if (!response.ok) {
      const message = extractErrorMessage(
        response,
        `Failed to fetch map systems (${response.status}).`
      );
      const error = new Error(message);
      if (isFatalStatus(response.status)) {
        (error as FatalError).fatal = true;
      }
      throw error;
    }

    const data = await readResponseBody(response);

    // Update in-memory map systems for runtime filtering. Do not persist to disk; will be fetched on each startup.
    // Use MapPath (domain/mapId) as the canonical map key for systems
    const maps = WandererMaps.getInstance();
    if (isWandererSystemsResponse(data)) {
      maps.setSystemsForMap(mapPath, data.systems);
      maps.setConnectionsForMap(mapPath, data.connections);
    }
    else {
      LOGGER.error(
        `Wanderer systems response for ${mapPath} did not contain expected data.`
      );
      maps.setSystemsForMap(mapPath, []);
      maps.setConnectionsForMap(mapPath, []);
    }
  }

  private async streamMapEvents(
    connection: {
      domain: string;
      slug: string;
      EncryptedDetails?: string;
      channelId?: string;
    },
    connectionState: {
      started: boolean;
      connected: boolean;
      terminatedEarly: boolean;
    },
    signal: AbortSignal
  ): Promise<void> {
    const mapPath = connection.domain + '/' + connection.slug;
    const url = getWandererEventsStreamUrl(connection.domain, connection.slug);

    const options = {
      headers: {
        Authorization:
          'Bearer ' + this.decryptApiKey(mapPath, connection.EncryptedDetails),
      },
      signal,
    } as SSEOptions;

    for await (const event of streamSSE(url, options)) {
      try {
        if (!event.data) return;
        if (event.event === 'connected') {
          connectionState.connected = true;
          LOGGER.debug(
            `Wanderer events stream connected for channel ${connection.channelId}.`
          );
          continue;
        }
        const parsed = JSON.parse(event.data) as WandererEvent;
        if (isWandererEvent(parsed)) {
          this.applyEvent(connection, parsed);
        }
      }
      catch (err) {
        LOGGER.error(
          `Failed to parse Wanderer event for channel ${connection.domain}/${connection.slug}: ${err}`
        );
      }
    }
  }

  private applyEvent(
    connection: { channelId?: string; slug: string; domain?: string },
    event: WandererEvent
  ) {
    const solarSystemId = event.payload.solar_system_id;
    if (solarSystemId === undefined) return;

    const config = WandererMaps.getInstance();

    const mapPath = connection.domain
      ? `${connection.domain}/${connection.slug}`
      : connection.slug;

    switch (event.type) {
    case 'add_system':
    // purposefully fall through
    case 'system_metadata_changed':
      config.addSystem(
        mapPath,
        { ...event.payload, timestamp: event.timestamp }
      );
      break;
    case 'deleted_system':
      config.removeSystem(mapPath, solarSystemId);
      break;
    case 'connection_added':
      break;
    case 'connection_removed':
      break;
    case 'connection_updated':
      break;
    default:
      LOGGER.debug(
        `Wanderer event ignored for channel ${connection.channelId}: ${event.type}`
      );
    }
  }

  private decryptApiKey(mapPath?: string, encryptedDetails?: string): string {
    try {
      if (!encryptedDetails || !mapPath) return '';
      const secret = process.env.WANDERER_SECRET || '';

      // Expect new format: salt:iv:cipher:tag (4 parts)
      const parts = encryptedDetails.split(':');
      if (parts.length !== 4) {
        LOGGER.error('Invalid Wanderer encryptedDetails format');
        return '';
      }

      const [saltB64, ivB64, cipherB64, tagB64] = parts;
      const salt = Buffer.from(saltB64, 'base64');
      const iv = Buffer.from(ivB64, 'base64');
      const encrypted = Buffer.from(cipherB64, 'base64');
      const tag = Buffer.from(tagB64, 'base64');

      // Derive key with same parameters used for encryption
      const key = hkdfSync(
        'sha256',
        Buffer.from(secret, 'utf8'),
        salt,
        Buffer.from(mapPath, 'utf8'),
        32
      );

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key),
        iv
      );
      decipher.setAAD(Buffer.from(mapPath, 'utf8'));
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    catch (error) {
      LOGGER.error('Failed to decrypt Wanderer API key: ' + error);
      return '';
    }
  }
}

const wandererEventsClient = WandererEventsClient.getInstance();

export async function startWandererEventStreams(client: Client): Promise<void> {
  await wandererEventsClient.startAllConnections(client);
}

export async function connectWandererMap(params: {
  channelId: string;
  mapUrl: string;
  apiKey: string;
}): Promise<WandererEventsSetupResult> {
  return wandererEventsClient.connectWandererMap(params);
}

export async function disconnectWandererMap(channelId: string): Promise<void> {
  return wandererEventsClient.disconnectWandererMap(channelId);
}

export function getWandererSystemCount(mapId: string): number {
  return wandererEventsClient.getSystemCount(mapId);
}

export async function restartWandererMap(channelId: string): Promise<boolean> {
  return wandererEventsClient.restartConnection(channelId);
}

export function isWandererConnected(channelId: string): boolean {
  return wandererEventsClient.isConnected(channelId);
}

export function hasWandererTerminatedEarly(channelId: string): boolean {
  return wandererEventsClient.hasTerminatedEarly(channelId);
}

export function getWandererConnectionState(
  channelId: string
):
  | { started: boolean; connected: boolean; terminatedEarly: boolean }
  | undefined {
  return wandererEventsClient.getConnectionState(channelId);
}
