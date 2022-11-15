import { Client } from "discord.js";
import { updateChannel } from "./Channels";

export function updateGuild(client: Client<boolean>, guildId: string) {
  // Fetch the guild/server by ID
  return client.guilds.fetch(guildId).then((g) => {
    // Fetch all channels from this guild/server
    return g.channels.fetch().then((c) => {
      // This is an async "foreach"
      return Promise.all(
        c.map((chn) => {
          if (
            chn &&
            chn.isTextBased() &&
            !chn.isVoiceBased()
            //&& chn.viewable  // viewable doesn't quite work how we need it
          ) {
            return updateChannel(client, chn.id);
          }
        })
      );
    });
  });
}
