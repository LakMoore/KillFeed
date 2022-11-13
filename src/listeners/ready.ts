import { Client } from "discord.js";
import { pollzKillboardOnce } from "../zKillboardService";
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
            // run the /update command on this guild
            return updateGuild(client, guildId);
          })
        );
      })
      .then(() =>
        console.log("Finished Looping Guilds")
      )
      .then(() => {
        console.log("Starting Poll");
        pollLoop(client);
      });
  });
};

async function pollLoop(client: Client) {
  let i = 0;
  try {
    while (true) {
      await pollzKillboardOnce(client);
      console.log("loop " + i++);
    }
  } catch (error) {
    console.log(error);
  }
}
