import { Client } from "discord.js";
import { updateChannel } from "./Channels";
import { canUseChannel } from "./helpers/DiscordHelper";

export async function updateGuild(
  client: Client<boolean>,
  guildId: string,
  guildName: string
) {
  // Fetch the guild/server by ID
  const g = await client.guilds.fetch(guildId);

  // Fetch all channels from this guild/server
  const c = await g.channels.fetch();

  await Promise.all(
    c.map(async (chn) => {
      if (canUseChannel(chn)) {
        await updateChannel(client, chn.id, guildName);
      }
    })
  );
}
