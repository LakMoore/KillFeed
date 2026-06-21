import { LOGGER } from "../helpers/Logger";
import { WandererConfig } from "./WandererConfig";
import {
  WandererConnection,
  WandererEvent,
  WandererEventsSetupResult,
} from "./WandererTypes";
import {
  getWandererEventsStreamUrl,
  getWandererSystemsUrl,
  parseWandererMapUrl,
} from "./WandererApi";

const STREAM_RETRY_DELAY_MS = 5000;

type FetchResponseBody = {
  data?: {
    systems?: Array<{ solar_system_id?: number | string }>;
  };
  systems?: Array<{ solar_system_id?: number | string }>;
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
    .map((system) => Number(system.solar_system_id))
    .filter((solarSystemId) => Number.isFinite(solarSystemId));
}

function getEventPayload(event: Record<string, unknown>): Record<string, unknown> {
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
  return (
    typeof event.map_id === "string" &&
    typeof event.type === "string"
  );
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

  private controllers = new Map<string, AbortController>();

  public static getInstance(): WandererEventsClient {
    if (!WandererEventsClient.instance) {
      WandererEventsClient.instance = new WandererEventsClient();
    }
    return WandererEventsClient.instance;
  }

  public async startAllConnections(): Promise<void> {
    WandererConfig.getInstance().forEachConnection((channelId) => {
      void this.startConnectionLoop(channelId);
    });
  }

  public async connectWandererMap(params: {
    channelId: string;
    mapUrl: string;
    apiKey: string;
  }): Promise<WandererEventsSetupResult> {
    const { domain, mapId } = parseWandererMapUrl(params.mapUrl);
    const connection: WandererConnection = {
      channelId: params.channelId,
      mapId,
      domain,
      apiKey: params.apiKey,
      createdAt: new Date().toISOString(),
    };

    await this.syncMapSystems(connection);

    WandererConfig.getInstance().addConnection(connection);
    await WandererConfig.getInstance().save();

    this.stopConnection(params.channelId);
    void this.startConnectionLoop(params.channelId);

    return { mapId, domain };
  }

  public async disconnectWandererMap(channelId: string): Promise<WandererConnection | undefined> {
    this.stopConnection(channelId);

    const wandererConfig = WandererConfig.getInstance();
    const removed = wandererConfig.removeConnection(channelId);
    if (removed) {
      await wandererConfig.save();
    }

    return removed;
  }

  public getConnection(channelId: string): WandererConnection | undefined {
    return WandererConfig.getInstance().getConnectionByChannelId(channelId);
  }

  public getSystemCount(mapId: string): number {
    return WandererConfig.getInstance().getSystemCountForMap(mapId);
  }

  private stopConnection(channelId: string): void {
    this.controllers.get(channelId)?.abort();
    this.controllers.delete(channelId);
  }

  private async startConnectionLoop(channelId: string): Promise<void> {
    if (this.controllers.has(channelId)) {
      return;
    }

    const connection = WandererConfig.getInstance().getConnectionByChannelId(
      channelId,
    );
    if (!connection) {
      return;
    }

    const controller = new AbortController();
    this.controllers.set(channelId, controller);

    try {
      while (!controller.signal.aborted) {
        const latestConnection =
          WandererConfig.getInstance().getConnectionByChannelId(channelId);
        if (!latestConnection) {
          break;
        }

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

  private async syncMapSystems(connection: WandererConnection): Promise<void> {
    const response = await fetch(
      getWandererSystemsUrl(connection.domain, connection.mapId),
      {
        headers: {
          Authorization: "Bearer " + connection.apiKey,
        },
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

    WandererConfig.getInstance().setSystemsForMap(
      connection.mapId,
      extractSystems(body),
    );
    await WandererConfig.getInstance().save();
  }

  private async streamMapEvents(
    connection: WandererConnection,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await fetch(
      getWandererEventsStreamUrl(connection.domain, connection.mapId),
      {
        headers: {
          Authorization: "Bearer " + connection.apiKey,
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
    connection: WandererConnection,
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

    const config = WandererConfig.getInstance();

    switch (event.type) {
      case "add_system":
      case "system_metadata_changed":
        config.addSystem(connection.mapId, solarSystemId);
        await config.save();
        break;
      case "deleted_system":
        config.removeSystem(connection.mapId, solarSystemId);
        await config.save();
        break;
      case "map_kill":
        break;
      default:
        LOGGER.debug(
          `Wanderer event ignored for channel ${connection.channelId}: ${event.type}`,
        );
    }
  }
}

const wandererEventsClient = WandererEventsClient.getInstance();

export async function startWandererEventStreams(): Promise<void> {
  await wandererEventsClient.startAllConnections();
}

export async function connectWandererMap(params: {
  channelId: string;
  mapUrl: string;
  apiKey: string;
}): Promise<WandererEventsSetupResult> {
  return wandererEventsClient.connectWandererMap(params);
}

export async function disconnectWandererMap(
  channelId: string,
): Promise<WandererConnection | undefined> {
  return wandererEventsClient.disconnectWandererMap(channelId);
}

export function getWandererSystemCount(mapId: string): number {
  return wandererEventsClient.getSystemCount(mapId);
}
