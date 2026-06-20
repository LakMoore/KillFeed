import express, { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { LOGGER } from "../helpers/Logger";
import { WandererConfig } from "./WandererConfig";
import {
  WandererAddSystemPayload,
  WandererDeletedSystemPayload,
  WandererSystemMetadataPayload,
  WandererWebhookEvent,
} from "./WandererTypes";

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

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

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function isTimestampFresh(timestamp: string): boolean {
  try {
    const eventTime = new Date(timestamp).getTime();
    return Math.abs(Date.now() - eventTime) <= TIMESTAMP_TOLERANCE_MS;
  } catch {
    return false;
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
  // Ensure the system is tracked; metadata changes don't affect presence on map
  WandererConfig.getInstance().addSystem(mapId, payload.solar_system_id);
  await WandererConfig.getInstance().save();
}

function webhookHandler(req: Request, res: Response): void {
  const signature = req.headers["x-wanderer-signature"] as string | undefined;
  const timestamp = req.headers["x-wanderer-timestamp"] as string | undefined;
  const rawBody: Buffer = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));

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

  const connections = WandererConfig.getInstance().getConnectionsByMapId(
    event.map_id,
  );
  if (connections.length === 0) {
    LOGGER.warning(
      `Wanderer webhook for unknown map_id: ${event.map_id}`,
    );
    res.status(404).json({ error: "Unknown map" });
    return;
  }

  // Verify signature against any matching connection's secret
  const verified = connections.some((connection) =>
    verifySignature(connection.webhookSecret, rawBody, signature, timestamp),
  );

  if (!verified) {
    LOGGER.warning(
      `Wanderer webhook signature verification failed for map ${event.map_id}`,
    );
    res.status(403).json({ error: "Invalid signature" });
    return;
  }

  // Acknowledge immediately, process asynchronously
  res.json({ received: true });

  processEvent(event).catch((err) => {
    LOGGER.error(`Error processing Wanderer event: ${err}`);
  });
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
      await handleSystemMetadataChanged(
        mapId,
        payload as WandererSystemMetadataPayload,
      );
      break;
    case "map_kill":
      LOGGER.debug(`Wanderer [${mapId}]: map_kill event received (handled via zKillboard feed)`);
      break;
    default:
      LOGGER.debug(`Wanderer [${mapId}]: unhandled event type "${type}"`);
  }
}

export function startWandererWebhookServer(): void {
  const port = parseInt(process.env.WANDERER_WEBHOOK_PORT ?? "3000", 10);

  const app = express();

  // Capture raw body for signature verification before JSON parsing
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  app.post("/api/wanderer/webhook", webhookHandler);

  app.listen(port, () => {
    LOGGER.info(`Wanderer webhook server listening on port ${port}`);
  });
}
