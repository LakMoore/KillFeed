import {
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../Command";
import { canUseChannel } from "../helpers/DiscordHelper";
import { WandererConfig } from "../wanderer/WandererConfig";
import {
  connectWandererMap,
  sendDiscordSuccessMessage,
} from "../wanderer/WandererWebhookServer";

const builder = new SlashCommandBuilder()
  .setName("wanderer")
  .setDescription("Manage Wanderer map integration for this channel")
  .addSubcommand((sub) =>
    sub
      .setName("connect")
      .setDescription("Connect this channel to a Wanderer map")
      .addStringOption((option) =>
        option
          .setName("map_url")
          .setDescription("The Wanderer map URL to connect")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("api_key")
          .setDescription("The Wanderer API key for this map")
          .setRequired(true),
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
        await handleConnect(client, interaction, channel.id);
        break;
      case "disconnect":
        await handleDisconnect(interaction, channel.id);
        break;
      case "status":
        await handleStatus(interaction, channel.id);
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
  client: Client,
  interaction: ChatInputCommandInteraction,
  channelId: string,
): Promise<void> {
  const mapUrl = interaction.options.getString("map_url", true).trim();
  const apiKey = interaction.options.getString("api_key", true).trim();

  try {
    const connection = await connectWandererMap({
      channelId,
      mapUrl,
      apiKey,
    });

    await sendDiscordSuccessMessage(client, channelId, connection.mapId);
    await interaction.followUp({
      ephemeral: true,
      content:
        `✅ Wanderer connected for map \`${connection.mapId}\`.\n` +
        `This channel will now receive mapped killmails.`,
    });
  } catch (error) {
    await interaction.followUp({
      ephemeral: true,
      content:
        "❌ Failed to connect Wanderer: " +
        (error instanceof Error ? error.message : String(error)),
    });
  }
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

  await interaction.followUp({
    ephemeral: true,
    content:
      `**Wanderer Integration Active**\n` +
      `**Map ID:** \`${connection.mapId}\`\n` +
      `**Tracked systems:** ${systemCount}\n` +
      `**Connected since:** ${new Date(connection.createdAt).toUTCString()}`,
  });
}
