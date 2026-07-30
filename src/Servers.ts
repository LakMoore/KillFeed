import type { Client } from 'discord.js';
import { updateChannel } from './Channels';
import { canUseChannel } from './helpers/DiscordHelper';
import { Commands } from './Commands';
import { LOGGER } from './helpers/Logger';

export async function updateGuild(
  client: Client<boolean>,
  guildId: string,
  guildName: string
) {
  // Fetch the guild/server by ID
  const g = await client.guilds.fetch(guildId);

  // Overwrite the commands for this guild to ensure it has latest. Wrap in
  // try/catch to surface detailed error information from the Discord REST layer.
  try {
    await g.commands.set(Commands);
    // eslint-disable-next-line no-console
    LOGGER.info(`Registered commands for guild ${guildName} (${guildId})`);
  }
  catch (err) {
    try {
      const anyErr: any = err;
      let bodyPreview = '';
      if (anyErr?.body) {
        try {
          bodyPreview =
            typeof anyErr.body === 'string'
              ? anyErr.body
              : JSON.stringify(anyErr.body);
        }
        catch {
          bodyPreview = String(anyErr.body);
        }
      }
      LOGGER.error(
        `Failed to register commands for guild ${guildName} (${guildId}). Error: ${anyErr?.message ?? String(err)}. Body: ${bodyPreview}`
      );
    }
    catch {
      LOGGER.error(
        `Failed to register commands for guild ${guildName} (${guildId}). Error: ${String(err)}`
      );
    }
    // rethrow so caller can handle as before
    throw err;
  }

  // Fetch all channels from this guild/server
  try {
    const c = await g.channels.fetch();
    for (const chn of c.values()) {
      if (canUseChannel(chn)) {
        try {
          await updateChannel(client, chn.id, guildName);
        }
        catch {
          // updateChannel already logs errors; keep looping
        }
      }
    }
  }
  catch (err) {
    // Channels fetch failed — surface but do not throw to avoid crashing startup
    // eslint-disable-next-line no-console
    LOGGER.error(
      `Failed to fetch channels for guild ${guildName} (${guildId}): ${err}`
    );
  }
}
