import {
  CommandInteraction,
  Client,
  SlashCommandBuilder,
  SlashCommandBooleanOption,
} from "discord.js";
import { Config } from "../Config";
import { getConfigMessage } from "../helpers/DiscordHelper";
import { generateConfigMessage } from "../helpers/KillFeedHelpers";
import { Command } from "../Command";
import { updateChannel } from "../Channels";

const FULLTEST_ENABLED = "enabled";

const boolOption = new SlashCommandBooleanOption()
  .setName(FULLTEST_ENABLED)
  .setDescription("toggle on/off")
  .setRequired(true);

const builder = new SlashCommandBuilder()
  .setName("fulltest")
  .setDescription("Enable/disable FullTest mode")
  .addBooleanOption(boolOption);

export const FullTest: Command = {
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
        settings.FullTest = interaction.options.getBoolean(
          FULLTEST_ENABLED,
          true
        );

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
          response = `Success! Set Fulltest (${settings.FullTest})`;
        } else {
          response = `No settings found in channel. Use /init to start.`;
        }
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
