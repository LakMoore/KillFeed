import { Client, TextChannel } from "discord.js";
import { LOGGER } from "../helpers/Logger";
import { WandererMaps } from "./WandererMaps";
import { WandererEvent, WandererEventsSetupResult } from "./WandererTypes";
import {
  getWandererEventsStreamUrl,
  getWandererSystemsUrl,
  parseWandererMapUrl,
} from "./WandererApi";
import crypto from "node:crypto";
import { Config } from "../Config";

const STREAM_RETRY_DELAY_MS = 5000;

type FetchResponseBody = {
  data?: {
    systems?: Array<{
      solar_system_id?: number | string;
      id?: number | string;
    }>;
  };
  systems?: Array<{ solar_system_id?: number | string; id?: number | string }>;
};

type FatalError = Error & { fatal?: boolean };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFatalStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

function extractSystems(body: unknown): number[] {
  const payload = body as FetchResponseBody | undefined;
  const systems = payload?.data?.systems ?? payload?.systems ?? [];

  return systems
    .map((system) => Number(system.solar_system_id ?? system.id))
    .filter((solarSystemId) => Number.isFinite(solarSystemId));
}

function getEventPayload(
  event: Record<string, unknown>,
): Record<string, unknown> {
  const payload = event.payload ?? event.data ?? event.event_data ?? event;
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : {};
}

function getSolarSystemId(event: Record<string, unknown>): number | undefined {
  const payload = getEventPayload(event);
  const solarSystem = payload.solar_system;
  const solarSystemObject =
    solarSystem && typeof solarSystem === "object"
      ? (solarSystem as { id?: unknown })
      : undefined;
  const value =
    payload.solar_system_id ??
    event.solar_system_id ??
    solarSystemObject?.id ??
    (event.solar_system && typeof event.solar_system === "object"
      ? (event.solar_system as { id?: unknown }).id
      : undefined);

  const solarSystemId = Number(value);
  return Number.isFinite(solarSystemId) ? solarSystemId : undefined;
}

function isWandererEvent(value: unknown): value is WandererEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as WandererEvent;
  return typeof event.map_id === "string" && typeof event.type === "string";
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (body && typeof body === "object") {
    const response = body as {
      error?: unknown;
      message?: unknown;
      detail?: unknown;
    };

    for (const value of [response.error, response.message, response.detail]) {
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }

  return fallback;
}

class WandererEventsClient {
  private static instance: WandererEventsClient;
  private readonly controllers = new Map<string, AbortController>();

  public static client: Client;

  public static getInstance(): WandererEventsClient {
    if (!WandererEventsClient.instance) {
      WandererEventsClient.instance = new WandererEventsClient();
    }
    return WandererEventsClient.instance;
  }

  public async startAllConnections(): Promise<void> {
    WandererMaps.getInstance().forEachConnection((channelId) => {
      void this.startConnectionLoop(channelId);
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
      `Connecting Wanderer map for channel ${params.channelId}: domain=${domain}, mapId=${mapId}`,
    );

    // Encrypt the API key before persisting. Use WANDERER_SECRET env var
    // combined with the map path to derive an encryption key.
    // Use HKDF (SHA-256) + AES-256-GCM (AEAD) to provide confidentiality
    // and authenticity. Store as: saltB64:ivB64:cipherB64:tagB64
    const mapPath = domain + "/" + slug;
    const secret = process.env.WANDERER_SECRET || "";

    // Per-record random salt (16 bytes) and 12-byte IV for GCM
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);

    // Derive a 32-byte key with HKDF using mapPath as context/info
    const key = (crypto as any).hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      salt,
      Buffer.from(mapPath, "utf8"),
      32,
    );

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    // Bind the mapPath as AAD to tie ciphertext to this map context
    cipher.setAAD(Buffer.from(mapPath, "utf8"));
    const encryptedBuf = Buffer.concat([
      cipher.update(params.apiKey, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const encryptedBlob =
      salt.toString("base64") +
      ":" +
      iv.toString("base64") +
      ":" +
      encryptedBuf.toString("base64") +
      ":" +
      tag.toString("base64");

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
    void this.startConnectionLoop(params.channelId);

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

  private async startConnectionLoop(channelId: string): Promise<void> {
    if (this.controllers.has(channelId)) {
      return;
    }

    const cfg = Config.getInstance();
    const sub = cfg.allSubscriptions.get(channelId);
    const ws = sub?.WandererSettings;
    if (!ws?.Slug || !ws.EncryptedDetails || !ws.Domain) {
      return;
    }

    const controller = new AbortController();
    this.controllers.set(channelId, controller);

    try {
      while (!controller.signal.aborted) {
        const latestSub = Config.getInstance().allSubscriptions.get(channelId);
        const latestWs = latestSub?.WandererSettings;
        if (!latestWs?.Slug || !latestWs.EncryptedDetails || !latestWs.Domain) {
          break;
        }
        const latestConnection = {
          domain: latestWs.Domain,
          slug: latestWs.Slug,
          EncryptedDetails: latestWs.EncryptedDetails,
          channelId,
        };

        try {
          await this.syncMapSystems(latestConnection);
          await this.streamMapEvents(latestConnection, controller.signal);
        } catch (error) {
          const fatal = Boolean((error as FatalError | undefined)?.fatal);
          if (fatal) {
            LOGGER.error(
              `Wanderer events stream issue for channel ${channelId}: ${error}`,
            );
          } else {
            LOGGER.warning(
              `Wanderer events stream issue for channel ${channelId}: ${error}`,
            );
          }

          let channelMessage =
            "Unable to connect to the Wanderer events stream for this channel.";
          switch (error instanceof Error ? error.message : String(error)) {
            case "Server-Sent Events are disabled on this server":
              channelMessage +=
                "\n\nAsk the server owner to enable Server-Sent Events globally (WANDERER_SSE_ENABLED=true in .env) for Wanderer.";
              break;
            case "Server-Sent Events are disabled for this map":
              channelMessage +=
                "\n\nAsk the map owner to enable Server-Sent Events for this map in Wanderer. Only the Map Owner can do this.";
              break;
            case "Active subscription required for Server-Sent Events":
              channelMessage +=
                "\n\nActive subscription required for Server-Sent Events";
              break;
            default:
              channelMessage += "\n\nUnknown error occurred.";
              break;
          }

          await WandererEventsClient.client.channels
            .fetch(channelId)
            .then((channel) => {
              if (channel?.isTextBased()) {
                (channel as TextChannel).send({
                  content: channelMessage,
                  allowedMentions: { parse: [] },
                });
              }
            });

          if (fatal) {
            break;
          }
        }

        if (!controller.signal.aborted) {
          await sleep(STREAM_RETRY_DELAY_MS);
        }
      }
    } finally {
      this.controllers.delete(channelId);
    }
  }

  private async syncMapSystems(connection: {
    domain: string;
    slug: string;
    EncryptedDetails?: string;
    channelId?: string;
  }): Promise<void> {
    const mapPath = connection.domain + "/" + connection.slug;
    const apiKey = this.decryptApiKey(mapPath, connection.EncryptedDetails);
    const response = await fetch(
      getWandererSystemsUrl(connection.domain, connection.slug),
      {
        headers: { Authorization: "Bearer " + apiKey },
      },
    );
    const body = await readResponseBody(response);

    if (!response.ok) {
      const message = extractErrorMessage(
        body,
        `Failed to fetch map systems (${response.status}).`,
      );
      const error = new Error(message);
      if (isFatalStatus(response.status)) {
        (error as FatalError).fatal = true;
      }
      throw error;
    }

    // Update in-memory map systems for runtime filtering. Do not persist to disk; will be fetched on each startup.
    // Use MapPath (domain/mapId) as the canonical map key for systems
    WandererMaps.getInstance().setSystemsForMap(mapPath, extractSystems(body));
  }

  private async streamMapEvents(
    connection: {
      domain: string;
      slug: string;
      EncryptedDetails?: string;
      channelId?: string;
    },
    signal: AbortSignal,
  ): Promise<void> {
    const mapPath = connection.domain + "/" + connection.slug;
    const response = await fetch(
      getWandererEventsStreamUrl(connection.domain, connection.slug),
      {
        headers: {
          Authorization:
            "Bearer " +
            this.decryptApiKey(mapPath, connection.EncryptedDetails),
          Accept: "text/event-stream",
        },
        signal,
      },
    );

    if (!response.ok || !response.body) {
      const body = await readResponseBody(response);
      const message = extractErrorMessage(
        body,
        `Failed to open Wanderer events stream (${response.status}).`,
      );
      const error = new Error(message);
      if (isFatalStatus(response.status)) {
        (error as FatalError).fatal = true;
      }
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventName = "";
    let eventId = "";
    let dataLines: string[] = [];

    const dispatchEvent = async (): Promise<void> => {
      if (!eventName && dataLines.length === 0 && !eventId) {
        return;
      }

      const rawData = dataLines.join("\n");
      dataLines = [];

      if (!rawData) {
        eventName = "";
        eventId = "";
        return;
      }

      try {
        const parsed = JSON.parse(rawData) as unknown;
        if (isWandererEvent(parsed)) {
          await this.applyEvent(connection, parsed, eventName, eventId);
        }
      } catch (error) {
        LOGGER.warning(
          `Failed to parse Wanderer event for channel ${connection.channelId}: ${error}`,
        );
      }

      eventName = "";
      eventId = "";
    };

    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) {
          await dispatchEvent();
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) {
            await dispatchEvent();
          } else if (!line.startsWith(":")) {
            const separatorIndex = line.indexOf(":");
            const field =
              separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
            let valueText =
              separatorIndex >= 0 ? line.slice(separatorIndex + 1) : "";
            if (valueText.startsWith(" ")) {
              valueText = valueText.slice(1);
            }

            switch (field) {
              case "event":
                eventName = valueText;
                break;
              case "id":
                eventId = valueText;
                break;
              case "data":
                dataLines.push(valueText);
                break;
              default:
                break;
            }
          }

          newlineIndex = buffer.indexOf("\n");
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async applyEvent(
    connection: { channelId?: string; slug: string },
    event: WandererEvent,
    eventName: string,
    eventId: string,
  ): Promise<void> {
    if (eventName && eventName !== event.type) {
      LOGGER.debug(
        `Wanderer event name mismatch for channel ${connection.channelId}: ${eventName} !== ${event.type}`,
      );
    }

    if (eventId) {
      LOGGER.debug(
        `Wanderer event received for channel ${connection.channelId}: ${event.type} (${eventId})`,
      );
    }

    const solarSystemId = getSolarSystemId(
      event as unknown as Record<string, unknown>,
    );
    if (solarSystemId === undefined) {
      return;
    }

    const config = WandererMaps.getInstance();

    switch (event.type) {
      case "add_system":
      case "system_metadata_changed":
        config.addSystem(connection.slug, solarSystemId);
        break;
      case "deleted_system":
        config.removeSystem(connection.slug, solarSystemId);
        break;
      case "map_kill":
        break;
      default:
        LOGGER.debug(
          `Wanderer event ignored for channel ${connection.channelId}: ${event.type}`,
        );
    }
  }

  private decryptApiKey(mapPath?: string, encryptedDetails?: string): string {
    try {
      if (!encryptedDetails || !mapPath) return "";
      const secret = process.env.WANDERER_SECRET || "";

      // Expect new format: salt:iv:cipher:tag (4 parts)
      const parts = encryptedDetails.split(":");
      if (parts.length !== 4) {
        LOGGER.error("Invalid Wanderer encryptedDetails format");
        return "";
      }

      const [saltB64, ivB64, cipherB64, tagB64] = parts;
      const salt = Buffer.from(saltB64, "base64");
      const iv = Buffer.from(ivB64, "base64");
      const encrypted = Buffer.from(cipherB64, "base64");
      const tag = Buffer.from(tagB64, "base64");

      // Derive key with same parameters used for encryption
      const key = (crypto as any).hkdfSync(
        "sha256",
        Buffer.from(secret, "utf8"),
        salt,
        Buffer.from(mapPath, "utf8"),
        32,
      );

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(Buffer.from(mapPath, "utf8"));
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encrypted, undefined, "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      LOGGER.error("Failed to decrypt Wanderer API key: " + error);
      return "";
    }
  }
}

const wandererEventsClient = WandererEventsClient.getInstance();

export async function startWandererEventStreams(client: Client): Promise<void> {
  WandererEventsClient.client = client;
  await wandererEventsClient.startAllConnections();
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
