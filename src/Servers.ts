import type { Client } from 'discord.js';
import { updateChannel } from './Channels';
import { canUseChannel } from './helpers/DiscordHelper';
import { Commands } from './Commands';

export async function updateGuild(
  client: Client<boolean>,
  guildId: string,
  guildName: string
) {
  // Fetch the guild/server by ID
  const g = await client.guilds.fetch(guildId);

  await g.commands.set(Commands); // Overwrite the commands for this guild to ensure it has latest

  // Fetch all channels from this guild/server
  const c = await g.channels.fetch();

  for (const chn of c.values()) {
    if (canUseChannel(chn)) {
      await updateChannel(client, chn.id, guildName);
    }
  }
}
