import {
  CommandInteraction,
  Client,
  SlashCommandBuilder,
  SlashCommandRoleOption,
} from "discord.js";
import { Config } from "../Config";
import { getConfigMessage } from "../helpers/DiscordHelper";
import { generateConfigMessage } from "../helpers/KillFeedHelpers";
import { Command } from "../Command";
import { updateChannel } from "../Channels";

export const NAME_VALUE = "ping-target-value";

const OPTION_VALUE = new SlashCommandRoleOption()
  .setName(NAME_VALUE)
  .setDescription("Discord Role to ping")
  .setRequired(false);

const builder = new SlashCommandBuilder()
  .setName("ping_target")
  .setDescription(
    "Set the Discord Role to Ping on every kill posted (use '' to clear)."
  )
  .addRoleOption(OPTION_VALUE);

export const SetPingTarget: Command = {
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
        thisSubscription.PauseForChanges = true;

        const roleToPing = interaction.options.getRole(NAME_VALUE);

        if (!roleToPing) {
          thisSubscription.RoleToPing = undefined;
          response =
            "Cleared the Role. Kills will be posted with no specific ping.";
        } else {
          thisSubscription.RoleToPing = roleToPing.id;
          response = `${roleToPing.name} will be pinged on every kill posted to this channel.`;
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
        thisSubscription.PauseForChanges = false;
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
