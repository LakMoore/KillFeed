import { Client } from "discord.js";
import { pollzKillboardOnce } from "../zKillboard/zKillboardService";
import { Commands } from "../Commands";
import { updateGuild } from "../Servers";
import { LOGGER } from "../helpers/Logger";
import { savedData } from "../Bot";

// 1 request per second limit
const RATE_LIMIT_MAX_REQUESTS = 1;
const RATE_LIMIT_WINDOW_MS = 1100;

export default (client: Client): void => {
  client.on("clientReady", async () => {
    try {
      if (!client.user || !client.application) return;

      await client.application.commands.set(Commands);
      // ... rest of ready work, then pollLoop
      LOGGER.error(`${client.user.username} is online`);

      savedData.stats.ServerCount = 0;

      // fetch all guilds(servers) that KillFeed is a member of
      const guilds = await client.guilds.fetch();

      await Promise.all(
        guilds.map(async (guild, guildId) => {
          LOGGER.info("Guild: " + guild.name);
          savedData.stats.ServerCount++;
          // update this guild
          await updateGuild(client, guildId, guild.name);
        })
      );

      LOGGER.warning(`Imported all servers and now ready.`);
      LOGGER.info("Starting Poll");
      await pollLoop(client, 0);
    } catch (err) {
      LOGGER.error("Error in ready handler: " + err);
    }
  });
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let firstMem: NodeJS.MemoryUsage;

async function pollLoop(client: Client, loopCount: number) {
  const requestTimestamps: number[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Explicit infinite loop
    try {
      LOGGER.info("loop " + loopCount++);
      const now = Date.now();
      while (
        requestTimestamps.length &&
        now - requestTimestamps[0] >= RATE_LIMIT_WINDOW_MS
      ) {
        requestTimestamps.shift();
      }
      if (requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
        const waitTime = Math.max(
          RATE_LIMIT_WINDOW_MS - (now - requestTimestamps[0]),
          0
        );
        LOGGER.info(`Rate limited, waiting ${waitTime}ms before next request`);
        await sleep(waitTime);
        continue;
      }
      requestTimestamps.push(now);
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
      const err = new Error();
      if (err.stack) {
        LOGGER.debug("Stack size: " + (err.stack.split("\n").length - 1));
      }

      if (!firstMem) firstMem = process.memoryUsage();

      const used = process.memoryUsage();
      for (const key in used) {
        LOGGER.debug(
          `Memory: ${key}   ${
            Math.round(
              (used[key as keyof NodeJS.MemoryUsage] / 1024 / 1024) * 100
            ) / 100
          } MB  Diff: ${
            Math.round(
              ((used[key as keyof NodeJS.MemoryUsage] -
                firstMem[key as keyof NodeJS.MemoryUsage]) /
                1024 /
                1024) *
                100
            ) / 100
          }`
        );
      }
    }
  }
}
