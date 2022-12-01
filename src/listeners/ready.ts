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
            return updateGuild(client, guildId);
          })
        );
      })
      .then(() => console.log("Finished Looping Guilds"))
      .then(() => {
        console.log("Starting Poll");
        pollLoop(client);
      });
  });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollLoop(client: Client) {
  let i = 0;
  while (true) {
    try {
      console.log("loop " + i++);
      await pollzKillboardOnce(client);
    } catch (error) {
      console.log(error);
      // if there was an error, we can afford to slow things down a lot!
      await sleep(30000);
    }
  }
}
