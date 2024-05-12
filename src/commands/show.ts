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

const SHOW_TYPE = "type";

export const TYPE_ALL = "all";
export const TYPE_KILLS = "kills";
export const TYPE_LOSSES = "losses";

const showOptions = new SlashCommandStringOption()
  .setName(SHOW_TYPE)
  .setDescription("Type to show")
  .setRequired(true)
  .addChoices(
    { name: "All", value: TYPE_ALL },
    { name: "Kills", value: TYPE_KILLS },
    { name: "Losses", value: TYPE_LOSSES }
  );

const builder = new SlashCommandBuilder()
  .setName("show")
  .setDescription(
    "Select which type(s) of notifications to show (Kills, Losses or All)."
  )
  .addStringOption(showOptions);

export const Show: Command = {
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

        settings.Show = interaction.options.getString(SHOW_TYPE, true);

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
          response = `Success! Set Show to ${settings.Show}.`;
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
