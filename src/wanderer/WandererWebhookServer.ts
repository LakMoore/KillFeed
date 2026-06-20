import express, { Request, Response } from "express";
import { Client } from "discord.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { LOGGER } from "../helpers/Logger";
import { WandererConfig } from "./WandererConfig";
import {
  WandererAddSystemPayload,
  WandererDeletedSystemPayload,
  WandererSetupCompleteRequest,
  WandererSystemMetadataPayload,
  WandererWebhookEvent,
} from "./WandererTypes";
import {
  getWandererPublicBaseUrl,
  getWandererWebhookUrl,
} from "./WandererUrls";
import { WandererSetupSessions } from "./WandererSetupSessions";

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const SETUP_EVENTS = [
  "add_system",
  "deleted_system",
  "system_metadata_changed",
  "map_kill",
];

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
  return Number.isFinite(eventTime) && Math.abs(Date.now() - eventTime) <= TIMESTAMP_TOLERANCE_MS;
}

function getSetupPageHtml(channelId: string, setupToken: string): string {
  const publicBase = getWandererPublicBaseUrl();
  const webhookUrl = getWandererWebhookUrl(channelId);
  const completeUrl = new URL("/api/wanderer/setup/complete", publicBase).toString();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wanderer Connection Setup</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 720px; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
      label { display: block; margin: 1rem 0 0.35rem; font-weight: 600; }
      input, button { font: inherit; }
      input { width: 100%; padding: 0.75rem; box-sizing: border-box; }
      button { margin-top: 1rem; padding: 0.75rem 1rem; }
      .status { margin-top: 1rem; white-space: pre-wrap; }
      .hint { color: #555; }
      code { word-break: break-all; }
    </style>
  </head>
  <body>
    <h1>Wanderer Connection Setup</h1>
    <p class="hint">Your Wanderer API key is only used in this page. KillFeed does not receive or store it.</p>
    <p><strong>Channel:</strong> <code>${channelId}</code></p>
    <p><strong>Webhook URL:</strong> <code>${webhookUrl}</code></p>
    <form id="setup-form">
      <label for="map-url">Wanderer map URL</label>
      <input id="map-url" name="map-url" type="url" placeholder="https://wanderer.ltd/maps/your-map-slug" required />
      <label for="api-key">Wanderer API key</label>
      <input id="api-key" name="api-key" type="password" autocomplete="off" required />
      <button type="submit">Enable Wanderer webhooks</button>
    </form>
    <p class="status" id="status">Complete the form to enable webhooks.</p>
    <script>
      const channelId = ${JSON.stringify(channelId)};
      const setupToken = ${JSON.stringify(setupToken)};
      const webhookUrl = ${JSON.stringify(webhookUrl)};
      const completeUrl = ${JSON.stringify(completeUrl)};
      const events = ${JSON.stringify(SETUP_EVENTS)};
      const statusEl = document.getElementById("status");
      const form = document.getElementById("setup-form");
      const mapUrlInput = document.getElementById("map-url");
      const apiKeyInput = document.getElementById("api-key");

      function setStatus(message) {
        statusEl.textContent = message;
      }

      function parseMapUrl(input) {
        const normalized = /^https?:\\/\\//i.test(input) ? input : "https://" + input;
        const url = new URL(normalized);
        const segments = url.pathname.split("/").filter(Boolean);
        const index = segments.findIndex((part) => part === "maps" || part === "map");
        const mapId = index >= 0 ? segments[index + 1] : segments.at(-1);
        if (!mapId) {
          throw new Error("Could not find a map slug in that URL.");
        }
        return { domain: url.origin, mapId };
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const mapUrl = mapUrlInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!mapUrl || !apiKey) {
          setStatus("Please provide both a Wanderer map URL and API key.");
          return;
        }

        try {
          const { domain, mapId } = parseMapUrl(mapUrl);
          const headers = {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
          };

          setStatus("Enabling webhooks in Wanderer...");
          const toggleResponse = await fetch(
            domain + "/api/maps/" + encodeURIComponent(mapId) + "/webhooks/toggle",
            {
              method: "PUT",
              headers,
              body: JSON.stringify({ enabled: true }),
            },
          );
          if (!toggleResponse.ok) {
            throw new Error("Failed to enable webhooks (" + toggleResponse.status + ").");
          }

          setStatus("Creating the webhook subscription...");
          const createResponse = await fetch(
            domain + "/api/maps/" + encodeURIComponent(mapId) + "/webhooks",
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                url: webhookUrl,
                events,
                active: true,
              }),
            },
          );

          const createResult = await createResponse.json().catch(() => ({}));
          if (!createResponse.ok) {
            throw new Error(
              createResult?.error ||
                "Failed to create the webhook (" + createResponse.status + ").",
            );
          }

          const webhookSecret = createResult?.data?.secret ?? createResult?.secret;
          if (!webhookSecret) {
            throw new Error("Wanderer did not return a shared secret.");
          }

          const webhookId = createResult?.data?.id ?? createResult?.id;
          setStatus("Saving the shared secret with KillFeed...");
          const completeResponse = await fetch(completeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channelId,
              setupToken,
              mapId,
              webhookSecret,
              webhookId,
            }),
          });

          const completeResult = await completeResponse.json().catch(() => ({}));
          if (!completeResponse.ok) {
            throw new Error(
              completeResult?.error ||
                "Failed to finish setup (" + completeResponse.status + ").",
            );
          }

          apiKeyInput.value = "";
          setStatus("Success! You can close this page now.");
        } catch (error) {
          setStatus(
            "Setup failed: " +
              (error instanceof Error ? error.message : String(error)) +
              "\nYou can close this page and try again.",
          );
        }
      });
    </script>
  </body>
</html>`;
}

async function sendDiscordSuccessMessage(
  client: Client,
  channelId: string,
  mapId: string,
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !("send" in channel)) {
      LOGGER.warning(`Unable to post Wanderer success message on channel ${channelId}`);
      return;
    }

    await channel.send(
      `✅ Wanderer connected for map \`${mapId}\`. This channel will now receive mapped killmails.`,
    );
  } catch (error) {
    LOGGER.warning(`Failed to send Wanderer success message for channel ${channelId}: ${error}`);
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

  const connection = WandererConfig.getInstance().getConnectionByChannelId(channelId);
  const signature = req.headers["x-wanderer-signature"] as string | undefined;
  const timestamp = req.headers["x-wanderer-timestamp"] as string | undefined;
  const rawBody: Buffer =
    (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));

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
      LOGGER.debug(`Wanderer [${mapId}]: map_kill event received (handled via zKillboard feed)`);
      break;
    default:
      LOGGER.debug(`Wanderer [${mapId}]: unhandled event type "${type}"`);
  }
}

function setupPageHandler(req: Request, res: Response): void {
  const channelId = typeof req.query.channelId === "string" ? req.query.channelId : "";
  const setupToken = typeof req.query.setupToken === "string" ? req.query.setupToken : "";

  if (!channelId || !setupToken) {
    res.status(400).send("Missing setup parameters.");
    return;
  }

  if (!WandererSetupSessions.getInstance().validate(setupToken, channelId)) {
    LOGGER.warning(`Wanderer setup page requested with invalid session for channel ${channelId}`);
  }

  res.type("html").send(getSetupPageHtml(channelId, setupToken));
}

async function setupCompleteHandler(
  client: Client,
  req: Request,
  res: Response,
): Promise<void> {
  const payload = req.body as Partial<WandererSetupCompleteRequest>;

  if (
    typeof payload.channelId !== "string" ||
    typeof payload.setupToken !== "string" ||
    typeof payload.mapId !== "string" ||
    typeof payload.webhookSecret !== "string"
  ) {
    res.status(400).json({ error: "Invalid setup payload" });
    return;
  }

  const session = WandererSetupSessions.getInstance().consume(payload.setupToken);
  if (!session || session.channelId !== payload.channelId) {
    res.status(401).json({ error: "Expired or invalid setup session" });
    return;
  }

  WandererConfig.getInstance().addConnection({
    channelId: payload.channelId,
    mapId: payload.mapId,
    webhookId: payload.webhookId,
    webhookSecret: payload.webhookSecret,
    createdAt: new Date().toISOString(),
  });
  await WandererConfig.getInstance().save();

  res.json({ ok: true });
  void sendDiscordSuccessMessage(client, payload.channelId, payload.mapId);
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

  app.get("/wanderer/setup", setupPageHandler);
  app.post("/api/wanderer/setup/complete", (req, res) => {
    void setupCompleteHandler(client, req, res);
  });
  app.post("/api/wanderer/webhook/killfeed/:channelId", webhookHandler);

  app.listen(port, () => {
    LOGGER.info(`Wanderer webhook server listening on port ${port}`);
  });
}
