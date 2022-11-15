import { Client, TextBasedChannel } from "discord.js";
import { updateChannel } from "../Channels";

export default (client: Client): void => {
  client.on(
    "channelPinsUpdate",
    async (channel: TextBasedChannel, date: Date) => {
      updateChannel(client, channel.id);
    }
  );
};
