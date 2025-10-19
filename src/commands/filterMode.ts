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

const FILTER_MODE = "mode";

export const MODE_OR = "or";
export const MODE_AND = "and";

const modeOptions = new SlashCommandStringOption()
  .setName(FILTER_MODE)
  .setDescription("Filter mode")
  .setRequired(true)
  .addChoices(
    { name: "OR (any filter matches)", value: MODE_OR },
    { name: "AND (all filter types must match)", value: MODE_AND }
  );

const builder = new SlashCommandBuilder()
  .setName("filter_mode")
  .setDescription(
    "Set filter mode: OR (any match) or AND (all filter types must match)."
  )
  .addStringOption(modeOptions);

export const FilterMode: Command = {
  ...builder.toJSON(),
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = "Something went wrong!";

    if (
      interaction.isChatInputCommand() &&
      interaction.channel &&
      interaction.guild
    ) {
      const settings = Config.getInstance().allSubscriptions.get(
        interaction.channel.id
      );

      if (!settings) {
        response =
          "Unable to find settings for this channel. Use /init to start.";
      } else {
        // create some breathing room for the server to catch up
        settings.PauseForChanges = true;

        const mode = interaction.options.getString(FILTER_MODE, true);
        settings.RequireAllFilters = mode === MODE_AND;

        // re-generate the config message
        const message = await getConfigMessage(interaction.channel);

        if (message) {
          // save the config into the channel
          await message.edit(generateConfigMessage(settings));
          await updateChannel(
            client,
            interaction.channel.id,
            interaction.guild.name
          );

          if (settings.RequireAllFilters) {
            response =
              "Success! Filter mode set to AND. Killmails will only be sent if ALL configured filter types match.";
          } else {
            response =
              "Success! Filter mode set to OR. Killmails will be sent if ANY filter matches.";
          }
        } else {
          response = `No settings found in channel. Use /init to start.`;
        }
        settings.PauseForChanges = false;
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
