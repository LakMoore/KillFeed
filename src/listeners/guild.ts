import { Client, TextChannel } from "discord.js";
import { clearChannel } from "../Channels";
import { Config } from "../Config";
import { updateGuild } from "../Servers";

export default (client: Client): void => {
  //joined a server
  client.on("guildCreate", async (guild) => {
    console.log("Joined a new guild: " + guild.name);
    //Your other stuff like adding to guildArray
    await updateGuild(client, guild.id);
  });

  //removed from a server
  client.on("guildDelete", async (guild) => {
    console.log("Left a guild: " + guild.name);

    //go through all of the channels we were tracking on this server
    Array.from(Config.getInstance().registeredChannels.values())
      .filter((channel) => channel.Channel.guildId === guild.id)
      .forEach((channelConfig) => {
        if (channelConfig.Channel instanceof TextChannel) {
          if (channelConfig) {
            // Remove all listeners for this channel
            clearChannel(channelConfig, channelConfig.Channel);

            //remove config for this channel
            Config.getInstance().registeredChannels.delete(
              channelConfig.Channel.id
            );
          }
        }
      });
  });
};
