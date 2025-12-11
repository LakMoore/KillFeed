import { CommandInteraction, Client, PermissionsBitField } from "discord.js";
import {
  generateConfigMessage,
  parseConfigMessage,
} from "../helpers/KillFeedHelpers";
import { Command } from "../Command";
import {
  canUseChannel,
  checkChannelPermissions,
  getConfigMessage,
} from "../helpers/DiscordHelper";
import { clearChannel, updateChannel } from "../Channels";
import { Config } from "../Config";

export const Init: Command = {
  name: "init",
  description: "Creates the initial config storage message",
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = "Missed branch!";

    const channel = interaction.channel;
    if (canUseChannel(channel) && interaction.guild) {
      // Get the config message
      const message = await getConfigMessage(channel);

      // if we have no config message
      if (!message) {
        const thisChannelConfig = Config.getInstance().allSubscriptions.get(
          channel.id
        );
        if (thisChannelConfig) {
          // Remove all listeners for this channel
          clearChannel(thisChannelConfig, channel);
        }

        //remove config for this channel
        Config.getInstance().allSubscriptions.delete(channel.id);

        // Add a new pinned message
        if (
          checkChannelPermissions(
            channel,
            PermissionsBitField.Flags.PinMessages
          )
        ) {
          const content = generateConfigMessage(
            parseConfigMessage("", channel)
          );
          const message = await channel.send(content);
          await message.pin();
          await updateChannel(client, channel.id, interaction.guild.name);
          response = "KillFeed initialised successfully!";
        } else {
          const content =
            "Please give KillFeed permission to pin messages OR pin this message to the channel and re-run /init";
          await channel.send(content);
          response =
            "KillFeed partially initialised! " +
            "Either pin the new message or add KillFeed to " +
            "a role with permission to Pin Messages.";
        }
      } else {
        // looks good
        response = "KillFeed is already initialised. Use /add to add filters.";
      }
    } else {
      response =
        "Please add KillFeed to a role with permission to post messages to this channel.";
    }
    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
