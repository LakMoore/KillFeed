import { Client } from "discord.js";
import { updateChannel } from "./Channels";
import { canUseChannel } from "./helpers/DiscordHelper";

export function updateGuild(client: Client<boolean>, guildId: string) {
  // Fetch the guild/server by ID
  return client.guilds.fetch(guildId).then((g) => {
    // Fetch all channels from this guild/server
    return g.channels.fetch().then((c) => {
      // This is an async "foreach"
      return Promise.all(
        c.map((chn) => {
          if (canUseChannel(chn)) {
            return updateChannel(client, chn.id);
          }
        })
      );
    });
  });
}
