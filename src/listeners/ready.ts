import { Client } from "discord.js";
import { pollzKillboardOnce } from "../zKillboard/zKillboardService";
import { Commands } from "../Commands";
import { updateGuild } from "../Servers";
import { consoleLog } from "../helpers/Logger";

export default (client: Client): void => {
  client.on("ready", async () => {
    if (!client.user || !client.application) {
      return;
    }

    await client.application.commands.set(Commands);

    consoleLog(`${client.user.username} is online`);

    // fetch all guilds(servers) that KillFeed is a member of
    client.guilds
      .fetch()
      .then((guilds) => {
        return Promise.all(
          guilds.map((guild, guildId) => {
            consoleLog("Guild: " + guild.name);
            // update this guild
            return updateGuild(client, guildId, guild.name);
          })
        );
      })
      .then(() => consoleLog("Finished Looping Guilds"))
      .then(() => {
        consoleLog("Starting Poll");
        pollLoop(client, 0);
      });
  });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let firstMem: NodeJS.MemoryUsage;

async function pollLoop(client: Client, loopCount: number) {
  try {
    consoleLog("loop " + loopCount++);
    await pollzKillboardOnce(client);
  } catch (error) {
    consoleLog(error);
    // if there was an error, we can afford to slow things down a lot!
    await sleep(30000);
  }

  const DEBUG = false;

  if (DEBUG) {
    const err = new Error();
    if (err.stack) {
      consoleLog("Stack size: " + (err.stack.split("\n").length - 1));
    }

    if (!firstMem) firstMem = process.memoryUsage();

    const used = process.memoryUsage();
    for (const key in used) {
      consoleLog(
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
