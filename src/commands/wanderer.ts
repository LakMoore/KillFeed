import {
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../Command";
import { WandererConfig } from "../wanderer/WandererConfig";
import { WandererConnection } from "../wanderer/WandererTypes";
import { canUseChannel } from "../helpers/DiscordHelper";
import { LOGGER } from "../helpers/Logger";

const WANDERER_WEBHOOK_URL =
  process.env.WANDERER_WEBHOOK_URL ?? "https://<your-domain>/api/wanderer/webhook";

const builder = new SlashCommandBuilder()
  .setName("wanderer")
  .setDescription("Manage Wanderer map integration for this channel")
  .addSubcommand((sub) =>
    sub
      .setName("connect")
      .setDescription(
        "Connect this channel to a Wanderer map (shows kills from mapped systems only)",
      )
      .addStringOption((opt) =>
        opt
          .setName("map_id")
          .setDescription("Your Wanderer map ID")
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("webhook_secret")
          .setDescription(
            "The web_secret from your Wanderer webhook (shown when you create the webhook)",
          )
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("webhook_id")
          .setDescription("Optional: the webhook ID from Wanderer for reference")
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("disconnect")
      .setDescription("Remove the Wanderer map integration from this channel"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription(
        "Show the current Wanderer connection and tracked system count for this channel",
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription(
        "Show instructions for setting up a Wanderer webhook",
      ),
  );

export const Wanderer: Command = {
  ...builder.toJSON(),
  run: async (client: Client, interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.channel;

    if (!canUseChannel(channel)) {
      await interaction.followUp({
        ephemeral: true,
        content:
          "KillFeed needs permission to send messages in this channel.",
      });
      return;
    }

    switch (subcommand) {
      case "connect":
        await handleConnect(interaction, channel.id);
        break;
      case "disconnect":
        await handleDisconnect(interaction, channel.id);
        break;
      case "status":
        await handleStatus(interaction, channel.id);
        break;
      case "setup":
        await handleSetup(interaction);
        break;
      default:
        await interaction.followUp({
          ephemeral: true,
          content: "Unknown subcommand.",
        });
    }
  },
};

async function handleConnect(
  interaction: ChatInputCommandInteraction,
  channelId: string,
): Promise<void> {
  const mapId = interaction.options.getString("map_id", true).trim();
  const webhookSecret = interaction.options.getString("webhook_secret", true).trim();
  const webhookId = interaction.options.getString("webhook_id") ?? undefined;

  if (!mapId || !webhookSecret) {
    await interaction.followUp({
      ephemeral: true,
      content: "Both `map_id` and `webhook_secret` are required.",
    });
    return;
  }

  const wandererConfig = WandererConfig.getInstance();
  const existing = wandererConfig.getConnectionByChannelId(channelId);

  const connection: WandererConnection = {
    channelId,
    mapId,
    webhookId,
    webhookSecret,
    createdAt: new Date().toISOString(),
  };

  wandererConfig.addConnection(connection);
  await wandererConfig.save();

  LOGGER.info(
    `Wanderer connected: channel ${channelId} → map ${mapId}` +
      (webhookId ? ` (webhook ${webhookId})` : ""),
  );

  const action = existing ? "updated" : "connected";
  await interaction.followUp({
    ephemeral: true,
    content:
      `✅ Wanderer ${action}! This channel will now receive killmails from systems on map \`${mapId}\`.\n` +
      (existing
        ? `Previous connection to map \`${existing.mapId}\` has been replaced.\n`
        : "") +
      `\nMake sure your Wanderer webhook is pointing to:\n\`${WANDERER_WEBHOOK_URL}\``,
  });
}

async function handleDisconnect(
  interaction: ChatInputCommandInteraction,
  channelId: string,
): Promise<void> {
  const wandererConfig = WandererConfig.getInstance();
  const removed = wandererConfig.removeConnection(channelId);

  if (!removed) {
    await interaction.followUp({
      ephemeral: true,
      content:
        "This channel has no Wanderer connection to remove.",
    });
    return;
  }

  await wandererConfig.save();

  LOGGER.info(
    `Wanderer disconnected: channel ${channelId} (was map ${removed.mapId})`,
  );

  await interaction.followUp({
    ephemeral: true,
    content:
      `✅ Wanderer disconnected. This channel will now use its normal kill filters again.\n` +
      `Map \`${removed.mapId}\` is no longer tracked for this channel.\n\n` +
      `Note: To fully remove the webhook, delete it from your Wanderer map settings.`,
  });
}

async function handleStatus(
  interaction: ChatInputCommandInteraction,
  channelId: string,
): Promise<void> {
  const wandererConfig = WandererConfig.getInstance();
  const connection = wandererConfig.getConnectionByChannelId(channelId);

  if (!connection) {
    await interaction.followUp({
      ephemeral: true,
      content:
        "This channel has no Wanderer integration. Use `/wanderer connect` to set one up.",
    });
    return;
  }

  const systemCount = wandererConfig.getSystemCountForMap(connection.mapId);
  const webhookIdInfo = connection.webhookId
    ? `\n**Webhook ID:** \`${connection.webhookId}\``
    : "";

  await interaction.followUp({
    ephemeral: true,
    content:
      `**Wanderer Integration Active**\n` +
      `**Map ID:** \`${connection.mapId}\`${webhookIdInfo}\n` +
      `**Tracked systems:** ${systemCount}\n` +
      `**Connected since:** ${new Date(connection.createdAt).toUTCString()}`,
  });
}

async function handleSetup(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.followUp({
    ephemeral: true,
    content:
      `**How to connect Wanderer to KillFeed:**\n\n` +
      `1. Open your Wanderer map settings at https://wanderer.ltd\n` +
      `2. Navigate to **Webhooks** and create a new webhook with URL:\n` +
      `   \`${WANDERER_WEBHOOK_URL}\`\n` +
      `3. Select events: \`add_system\`, \`deleted_system\`, \`system_metadata_changed\`, \`map_kill\`\n` +
      `4. Copy the **web_secret** shown after creation\n` +
      `5. Run this command in the channel you want to receive kills:\n` +
      `   \`/wanderer connect map_id:<your-map-id> webhook_secret:<web_secret>\`\n\n` +
      `⚠️ Your Wanderer API token is **never** sent to KillFeed — only the webhook secret is stored.`,
  });
}
