import { Client, TextChannel } from "discord.js";
import { clearChannel } from "../Channels";
import { Config } from "../Config";
import { updateGuild } from "../Servers";
import { LOGGER } from "../helpers/Logger";

export default (client: Client): void => {
  //joined a server
  client.on("guildCreate", async (guild) => {
    LOGGER.info("Joined a new guild: " + guild.name);
    //Your other stuff like adding to guildArray
    await updateGuild(client, guild.id, guild.name);
  });

  //removed from a server
  client.on("guildDelete", (guild) => {
    LOGGER.info("Left a guild: " + guild.name);

    //go through all of the channels we were tracking on this server
    Array.from(Config.getInstance().allSubscriptions.values())
      .filter((channel) => channel.Channel.guildId === guild.id)
      .forEach((channelConfig) => {
        if (channelConfig.Channel instanceof TextChannel) {
          if (channelConfig) {
            // Remove all listeners for this channel
            clearChannel(channelConfig, channelConfig.Channel);

            //remove config for this channel
            Config.getInstance().allSubscriptions.delete(
              channelConfig.Channel.id
            );
          }
        }
      });
  });
};
