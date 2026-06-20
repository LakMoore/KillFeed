import {
  CommandInteraction,
  Client,
  SlashCommandBuilder,
  SlashCommandStringOption,
} from "discord.js";
import { Config } from "../Config";
import { getConfigMessage } from "../helpers/DiscordHelper";
import { generateConfigMessage } from "../helpers/KillFeedHelpers";
import { Command } from "../Command";
import { updateChannel } from "../Channels";

const FORMAT_NAME = "type";

export const FORMAT_EMBED = "Embed";
export const FORMAT_INSIGHT_WITH_APPRAISAL = "InsightWithAppraisal";
export const FORMAT_INSIGHT_WITH_PLEX = "InsightWithPLEX";
export const FORMAT_ZKILL = "zKill";

const formatOptions = new SlashCommandStringOption()
  .setName(FORMAT_NAME)
  .setDescription("How KillFeed should post to this channel")
  .setRequired(true)
  .addChoices(
    { name: "Insight (default embed)", value: FORMAT_EMBED },
    {
      name: "Insight with Janice appraisal",
      value: FORMAT_INSIGHT_WITH_APPRAISAL,
    },
    {
      name: "Insight with Janice + PLEX/USD",
      value: FORMAT_INSIGHT_WITH_PLEX,
    },
    { name: "zKill link (plain text)", value: FORMAT_ZKILL },
  );

const builder = new SlashCommandBuilder()
  .setName("set_format")
  .setDescription(
    "Choose whether killmails are posted as embeds or simple zKill links.",
  )
  .addStringOption(formatOptions);

export const SetFormat: Command = {
  ...builder.toJSON(),
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = "Something went wrong!";

    if (
      interaction.isChatInputCommand() &&
      interaction.channel &&
      interaction.guild
    ) {
      const settings = Config.getInstance().allSubscriptions.get(
        interaction.channel.id,
      );

      if (settings) {
        settings.PauseForChanges = true;

        const format = interaction.options.getString(FORMAT_NAME, true) as
          | "Embed"
          | "InsightWithAppraisal"
          | "InsightWithPLEX"
          | "zKill";
        settings.ResponseFormat = format;

        const message = await getConfigMessage(interaction.channel);

        if (message) {
          await message.edit(generateConfigMessage(settings));
          await updateChannel(
            client,
            interaction.channel.id,
            interaction.guild.name,
          );

          response =
            format === FORMAT_ZKILL
              ? "Success! Format set to zKill link. This works even when the bot does not have the Discord Embed Links permission in this channel."
              : format === FORMAT_INSIGHT_WITH_PLEX
                ? "Success! Format set to Insight with Janice + PLEX/USD. Make sure the bot has the Discord Embed Links permission in this channel."
                : format === FORMAT_INSIGHT_WITH_APPRAISAL
                  ? "Success! Format set to Insight with Janice appraisal. Make sure the bot has the Discord Embed Links permission in this channel."
                  : "Success! Format set to the default Insight embed. Make sure the bot has the Discord Embed Links permission in this channel.";
        } else {
          response = "No settings found in channel. Use /init to start.";
        }

        settings.PauseForChanges = false;
      } else {
        response =
          "Unable to find settings for this channel. Use /init to start.";
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
