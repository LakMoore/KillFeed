import { Client } from "discord.js";
import { pollzKillboardOnce } from "../zKillboard/zKillboardService";
import { Commands } from "../Commands";
import { updateGuild } from "../Servers";

export default (client: Client): void => {
  client.on("ready", async () => {
    if (!client.user || !client.application) {
      return;
    }

    await client.application.commands.set(Commands);

    console.log(`${client.user.username} is online`);

    // fetch all guilds(servers) that KillFeed is a member of
    client.guilds
      .fetch()
      .then((guilds) => {
        return Promise.all(
          guilds.map((guild, guildId) => {
            console.log("Guild: " + guild.name);
            // update this guild
            return updateGuild(client, guildId, guild.name);
          })
        );
      })
      .then(() => console.log("Finished Looping Guilds"))
      .then(() => {
        console.log("Starting Poll");
        pollLoop(client, 0);
      });
  });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

var firstMem: NodeJS.MemoryUsage;

async function pollLoop(client: Client, loopCount: number) {
  try {
    console.log("loop " + loopCount++);
    await pollzKillboardOnce(client);
  } catch (error) {
    console.log(error);
    // if there was an error, we can afford to slow things down a lot!
    await sleep(30000);
  }

  const err = new Error();
  if (err.stack) {
    console.log("Stack size: " + (err.stack.split("\n").length - 1));
  }

  if (!firstMem) firstMem = process.memoryUsage();

  const used = process.memoryUsage();
  for (let key in used) {
    console.log(
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

  // infinite loop required
  setTimeout(() => pollLoop(client, loopCount), 1);
}
