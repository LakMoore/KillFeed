import { Client, TextChannel } from "discord.js";
import { clearChannel, updateChannel } from "../Channels";
import { Config } from "../Config";
import { LOGGER } from "../helpers/Logger";

export default (client: Client): void => {
  //joined a server
  client.on("channelCreate", async (channel) => {
    if (channel instanceof TextChannel) {
      LOGGER.debug("Joined a new channel: " + channel.name);
      //Your other stuff like adding to guildArray
      await updateChannel(client, channel.id, channel.guild.name);
    }
  });

  //removed from a server
  client.on("channelDelete", (channel) => {
    if (channel instanceof TextChannel) {
      LOGGER.debug("Left a channel: " + channel.name);

      const thisChannelConfig = Config.getInstance().allSubscriptions.get(
        channel.id
      );
      if (thisChannelConfig) {
        // Remove all listeners for this channel
        clearChannel(thisChannelConfig, channel);

        //remove config for this channel
        Config.getInstance().allSubscriptions.delete(channel.id);
      }
    }
  });
};
