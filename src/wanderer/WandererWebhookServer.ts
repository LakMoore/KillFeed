import express, { Request, Response } from "express";
import { Client } from "discord.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import rateLimit from "express-rate-limit";
import { LOGGER } from "../helpers/Logger";
import { WandererConfig } from "./WandererConfig";
import {
  WandererAddSystemPayload,
  WandererCreateWebhookResponse,
  WandererDeletedSystemPayload,
  WandererSystemMetadataPayload,
  WandererWebhookEvent,
  WandererWebhookSetupResult,
} from "./WandererTypes";
import {
  getWandererWebhookUrl,
  parseWandererMapUrl,
} from "./WandererUrls";

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const WEBHOOK_RATE_LIMIT = { windowMs: 60 * 1000, max: 120 };
const webhookLimiter = rateLimit({
  windowMs: WEBHOOK_RATE_LIMIT.windowMs,
  limit: WEBHOOK_RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
});
const webhookBuckets = new Map<string, { startAt: number; count: number }>();
const SETUP_EVENTS = [
  "add_system",
  "deleted_system",
  "system_metadata_changed",
  "map_kill",
];
type ResponseLike = {
  text(): Promise<string>;
};

function verifySignature(
  secret: string,
  rawBody: Buffer,
  signature: string,
  timestamp: string,
): boolean {
  try {
    const data = `${timestamp}.${rawBody.toString("utf8")}`;
    const expected = `sha256=${createHmac("sha256", secret).update(data).digest("hex")}`;
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    return (
      sigBuffer.length === expectedBuffer.length &&
      timingSafeEqual(sigBuffer, expectedBuffer)
    );
  } catch {
    return false;
  }
}

function isTimestampFresh(timestamp: string): boolean {
  const eventTime = new Date(timestamp).getTime();
  return (
    Number.isFinite(eventTime) &&
    Math.abs(Date.now() - eventTime) <= TIMESTAMP_TOLERANCE_MS
  );
}

function createRateLimitMiddleware(limit: { windowMs: number; max: number }) {
  const buckets = new Map<string, { startAt: number; count: number }>();

  return (req: Request, res: Response, next: () => void): void => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.startAt >= limit.windowMs) {
      buckets.set(key, { startAt: now, count: 1 });
      next();
      return;
    }

    bucket.count++;
    if (bucket.count > limit.max) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    next();
  };
}

function consumeRateLimit(
  buckets: Map<string, { startAt: number; count: number }>,
  key: string,
  limit: { windowMs: number; max: number },
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.startAt >= limit.windowMs) {
    buckets.set(key, { startAt: now, count: 1 });
    return true;
  }

  bucket.count++;
  return bucket.count <= limit.max;
}

async function readResponseBody(response: ResponseLike): Promise<unknown> {
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

function extractApiError(body: unknown, fallback: string): string {
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

export async function connectWandererMap(params: {
  channelId: string;
  mapUrl: string;
  apiKey: string;
}): Promise<WandererWebhookSetupResult> {
  const { domain, mapId } = parseWandererMapUrl(params.mapUrl);
  const webhookUrl = getWandererWebhookUrl(params.channelId);
  const headers = {
    Authorization: "Bearer " + params.apiKey,
    "Content-Type": "application/json",
  };

  const toggleResponse = await fetch(
    `${domain}/api/maps/${encodeURIComponent(mapId)}/webhooks/toggle`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ enabled: true }),
    },
  );
  const toggleBody = await readResponseBody(toggleResponse);
  if (!toggleResponse.ok) {
    throw new Error(
      extractApiError(
        toggleBody,
        `Failed to enable webhooks (${toggleResponse.status}).`,
      ),
    );
  }

  const createResponse = await fetch(
    `${domain}/api/maps/${encodeURIComponent(mapId)}/webhooks`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: webhookUrl,
        events: SETUP_EVENTS,
        active: true,
      }),
    },
  );
  const createBody = (await readResponseBody(createResponse)) as
    | (Partial<WandererCreateWebhookResponse> & {
        error?: unknown;
        message?: unknown;
        detail?: unknown;
      })
    | undefined;

  if (!createResponse.ok) {
    throw new Error(
      extractApiError(
        createBody,
        `Failed to create the webhook (${createResponse.status}).`,
      ),
    );
  }

  const webhookSecret = createBody?.data?.secret ?? createBody?.secret;
  if (!webhookSecret) {
    throw new Error("Wanderer did not return a shared secret.");
  }

  const connection: WandererWebhookSetupResult = {
    mapId,
    webhookSecret,
  };

  WandererConfig.getInstance().addConnection({
    channelId: params.channelId,
    mapId: connection.mapId,
    webhookSecret: connection.webhookSecret,
    createdAt: new Date().toISOString(),
  });
  await WandererConfig.getInstance().save();

  return connection;
}

export async function sendDiscordSuccessMessage(
  client: Client,
  channelId: string,
  mapId: string,
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !("send" in channel)) {
      LOGGER.warning(
        `Unable to post Wanderer success message on channel ${channelId}`,
      );
      return;
    }

    await channel.send(
      `✅ Wanderer connected for map \`${mapId}\`. This channel will now receive mapped killmails.`,
    );
  } catch (error) {
    LOGGER.warning(
      `Failed to send Wanderer success message for channel ${channelId}: ${error}`,
    );
  }
}

async function handleAddSystem(
  mapId: string,
  payload: WandererAddSystemPayload,
): Promise<void> {
  LOGGER.info(
    `Wanderer [${mapId}]: add_system ${payload.solar_system_id} (${payload.name})`,
  );
  WandererConfig.getInstance().addSystem(mapId, payload.solar_system_id);
  await WandererConfig.getInstance().save();
}

async function handleDeletedSystem(
  mapId: string,
  payload: WandererDeletedSystemPayload,
): Promise<void> {
  LOGGER.info(
    `Wanderer [${mapId}]: deleted_system ${payload.solar_system_id}`,
  );
  WandererConfig.getInstance().removeSystem(mapId, payload.solar_system_id);
  await WandererConfig.getInstance().save();
}

async function handleSystemMetadataChanged(
  mapId: string,
  payload: WandererSystemMetadataPayload,
): Promise<void> {
  LOGGER.info(
    `Wanderer [${mapId}]: system_metadata_changed ${payload.solar_system_id} (${payload.name})`,
  );
  WandererConfig.getInstance().addSystem(mapId, payload.solar_system_id);
  await WandererConfig.getInstance().save();
}

function webhookHandler(req: Request, res: Response): void {
  const channelId =
    typeof req.params.channelId === "string"
      ? req.params.channelId
      : Array.isArray(req.params.channelId)
        ? req.params.channelId[0]
        : "";

  if (!channelId) {
    res.status(400).json({ error: "Missing channel id" });
    return;
  }

  if (
    !consumeRateLimit(
      webhookBuckets,
      `${req.ip ?? "unknown"}:${channelId}`,
      WEBHOOK_RATE_LIMIT,
    )
  ) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const connection = WandererConfig.getInstance().getConnectionByChannelId(
    channelId,
  );
  const signature = req.headers["x-wanderer-signature"] as string | undefined;
  const timestamp = req.headers["x-wanderer-timestamp"] as string | undefined;
  const rawBody: Buffer =
    (req as Request & { rawBody?: Buffer }).rawBody ??
    Buffer.from(JSON.stringify(req.body));

  if (!connection) {
    res.status(404).json({ error: "Unknown channel" });
    return;
  }

  if (!signature || !timestamp) {
    LOGGER.warning("Wanderer webhook received without signature or timestamp");
    res.status(400).json({ error: "Missing signature headers" });
    return;
  }

  if (!isTimestampFresh(timestamp)) {
    LOGGER.warning(
      `Wanderer webhook rejected: timestamp out of tolerance (${timestamp})`,
    );
    res.status(403).json({ error: "Timestamp out of tolerance" });
    return;
  }

  const event = req.body as WandererWebhookEvent;
  if (!event || typeof event.map_id !== "string" || typeof event.type !== "string") {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  if (connection.mapId !== event.map_id) {
    LOGGER.warning(
      `Wanderer webhook map mismatch for channel ${channelId}: expected ${connection.mapId}, got ${event.map_id}`,
    );
    res.status(404).json({ error: "Unknown map" });
    return;
  }

  if (!verifySignature(connection.webhookSecret, rawBody, signature, timestamp)) {
    LOGGER.warning(
      `Wanderer webhook signature verification failed for channel ${channelId}`,
    );
    res.status(403).json({ error: "Invalid signature" });
    return;
  }

  res.json({ received: true });

  processEvent(event).catch((err) => {
    LOGGER.error(`Error processing Wanderer event: ${err}`);
  });
}

function webhookRouteHandler(req: Request, res: Response): void {
  const channelId = typeof req.params.channelId === "string" ? req.params.channelId : "";
  if (
    !consumeRateLimit(
      webhookBuckets,
      `${req.ip ?? "unknown"}:${channelId}`,
      WEBHOOK_RATE_LIMIT,
    )
  ) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  webhookHandler(req, res);
}

async function processEvent(event: WandererWebhookEvent): Promise<void> {
  const { map_id: mapId, type, payload } = event;

  switch (type) {
    case "add_system":
      await handleAddSystem(mapId, payload as WandererAddSystemPayload);
      break;
    case "deleted_system":
      await handleDeletedSystem(mapId, payload as WandererDeletedSystemPayload);
      break;
    case "system_metadata_changed":
      await handleSystemMetadataChanged(mapId, payload as WandererSystemMetadataPayload);
      break;
    case "map_kill":
      LOGGER.debug(
        `Wanderer [${mapId}]: map_kill event received (handled via zKillboard feed)`,
      );
      break;
    default:
      LOGGER.debug(`Wanderer [${mapId}]: unhandled event type "${type}"`);
  }
}

export function startWandererWebhookServer(client: Client): void {
  const port = parseInt(process.env.WANDERER_WEBHOOK_PORT ?? "3000", 10);
  const app = express();

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  app.post("/api/wanderer/webhook/killfeed/:channelId", webhookLimiter, webhookRouteHandler);

  app.listen(port, () => {
    LOGGER.info(`Wanderer webhook server listening on port ${port}`);
  });
}
