import { Client } from "discord.js";
import { pollzKillboardOnce } from "../zKillboard/zKillboardService";
import { Commands } from "../Commands";
import { updateGuild } from "../Servers";
import { LOGGER } from "../helpers/Logger";
import { savedData } from "../Bot";

export default (client: Client): void => {
  client.on("clientReady", async () => {
    try {
      if (!client.user || !client.application) return;

      await client.application.commands.set(Commands);
      // ... rest of ready work, then pollLoop
      LOGGER.error(`${client.user.username} is online`);

      savedData.stats.ServerCount = 0;
      savedData.stats.ConfigCount = 0;
      savedData.stats.ChannelCount = 0;

      // fetch all guilds(servers) that KillFeed is a member of
      const guilds = await client.guilds.fetch();

      for (const [guildId, guild] of guilds) {
        LOGGER.info("Guild: " + guild.name);
        savedData.stats.ServerCount++;
        // update this guild
        await updateGuild(client, guildId, guild.name);
      }

        // Start Wanderer event streams
        // (must be done after all guilds are imported, so that we have all the channels to connect to)
        const wandererStreams = startWandererEventStreams(client);

      LOGGER.warning(`Imported all servers and now ready.`);
      LOGGER.info("Starting Poll");

        await Promise.all([pollLoop(client, 0), wandererStreams]);
      }
      catch (err) {
        LOGGER.error('Error in ready handler: ' + err);
      }
    }
  });
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let firstMem: NodeJS.MemoryUsage;

function logMemoryUsage() {
  if (!firstMem) firstMem = process.memoryUsage();
  const used = process.memoryUsage();
  for (const key in used) {
    LOGGER.debug(
      `Memory: ${key}   ${
        Math.round((used[key as keyof NodeJS.MemoryUsage] / 1024 / 1024) * 100)
        / 100
      } MB`
    );
  }
}

// main poll loop
async function pollLoop(client: Client, loopCount: number) {
  // Explicit infinite loop
  while (true) {
    try {
      LOGGER.debug("loop " + loopCount++);
      await pollzKillboardOnce(client);
    } catch (error) {
      if (error instanceof Error) {
        LOGGER.error(error);
      } else {
        LOGGER.error(error as string);
      }
      // if there was an error, we can afford to slow things down!
      await sleep(10000);
    }

    const DEBUG = false;

    if (DEBUG) {
      const err = new Error('debug-stack');
      if (err.stack) {
        LOGGER.debug("Stack size: " + (err.stack.split("\n").length - 1));
      }
      logMemoryUsage();
    }
  }
}
