import {
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../Command";
import { canUseChannel } from "../helpers/DiscordHelper";
import { getWandererSetupUrl } from "../wanderer/WandererUrls";
import { WandererSetupSessions } from "../wanderer/WandererSetupSessions";
import { WandererConfig } from "../wanderer/WandererConfig";

const builder = new SlashCommandBuilder()
  .setName("wanderer")
  .setDescription("Manage Wanderer map integration for this channel")
  .addSubcommand((sub) =>
    sub
      .setName("connect")
      .setDescription("Start the Wanderer setup flow for this channel"),
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
  const setupToken = WandererSetupSessions.getInstance().create(
    channelId,
    interaction.user.id,
  );
  const setupUrl = getWandererSetupUrl(channelId, setupToken);

  await interaction.followUp({
    ephemeral: true,
    content:
      "Open the Wanderer setup page to finish connecting this channel.",
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("Open Wanderer setup")
          .setURL(setupUrl),
      ),
    ],
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
      "Use `/wanderer connect` to open the setup page for this channel.",
  });
}
