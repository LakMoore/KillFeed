import {
  CommandInteraction,
  Client,
  SlashCommandBuilder,
  SlashCommandNumberOption,
} from "discord.js";
import { Config } from "../Config";
import { getConfigMessage } from "../helpers/DiscordHelper";
import { generateConfigMessage } from "../helpers/KillFeedHelpers";
import { Command } from "../Command";
import { updateChannel } from "../Channels";
import { formatISKValue } from "../feedformats/InsightWithEvePraisalFormat";

export const NAME_VALUE = "min-isk-value";

const OPTION_VALUE = new SlashCommandNumberOption()
  .setName(NAME_VALUE)
  .setDescription("Minimum KillMail value for filter")
  .setRequired(true);

const builder = new SlashCommandBuilder()
  .setName("min_isk")
  .setDescription(
    "Set the minimum ISK value for the channel subscription (use 0 to clear)."
  )
  .addNumberOption(OPTION_VALUE);

export const SetMinISK: Command = {
  ...builder.toJSON(),
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = "Something went wrong!";

    if (
      interaction.isChatInputCommand() &&
      interaction.channel &&
      interaction.guild
    ) {
      const thisSubscription = Config.getInstance().allSubscriptions.get(
        interaction.channel.id
      );

      if (!thisSubscription) {
        response = "No subscription found in channel. Use /init to start.";
      } else {
        const minISKValue = interaction.options.getNumber(NAME_VALUE);

        if (!minISKValue) {
          thisSubscription.MinISK = 0;
          response =
            "Cleared minimum ISK value. Now showing Killmails of any value.";
        } else {
          thisSubscription.MinISK = minISKValue;
          response = `Channel will now only show KillMails worth more than ${formatISKValue(
            minISKValue
          )}.`;
        }

        // re-generate the config message
        const message = await getConfigMessage(interaction.channel);

        if (message) {
          // save the config into the channel
          await message.edit(generateConfigMessage(thisSubscription));
          await updateChannel(
            client,
            interaction.channel.id,
            interaction.guild.name
          );
        } else {
          response = `No subscription found in channel. Use /init to start.`;
        }
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
