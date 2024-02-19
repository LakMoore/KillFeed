import { Client } from "discord.js";
import { pollzKillboardOnce } from "../zKillboard/zKillboardService";
import { Commands } from "../Commands";
import { updateGuild } from "../Servers";
import { LOGGER } from "../helpers/Logger";
import { savedData } from "../Bot";

export default (client: Client): void => {
  client.on("ready", async () => {
    if (!client.user || !client.application) {
      return;
    }

    await client.application.commands.set(Commands);

    LOGGER.error(`${client.user.username} is online`);

    savedData.stats.ServerCount = 0;

    // fetch all guilds(servers) that KillFeed is a member of
    client.guilds
      .fetch()
      .then((guilds) => {
        return Promise.all(
          guilds.map((guild, guildId) => {
            LOGGER.debug("Guild: " + guild.name);
            savedData.stats.ServerCount++;
            // update this guild
            return updateGuild(client, guildId, guild.name);
          })
        );
      })
      .then(() => LOGGER.error(`Imported all servers and now ready.`))
      .then(() => {
        LOGGER.debug("Starting Poll");
        pollLoop(client, 0);
      });
  });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let firstMem: NodeJS.MemoryUsage;

async function pollLoop(client: Client, loopCount: number) {
  try {
    LOGGER.debug("loop " + loopCount++);
    await pollzKillboardOnce(client);
  } catch (error) {
    if (error instanceof Error) {
      LOGGER.error(error);
    } else {
      LOGGER.error(error as string);
    }
    // if there was an error, we can afford to slow things down a lot!
    await sleep(30000);
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

  // infinite loop required
  setTimeout(() => pollLoop(client, loopCount), 1);
}
