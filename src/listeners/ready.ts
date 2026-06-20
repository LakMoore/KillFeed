import { Client, TextChannel } from "discord.js";
import { pollzKillboardOnce } from "../zKillboard/zKillboardService";
import { Commands } from "../Commands";
import { updateGuild } from "../Servers";
import { DEV_ROLE, LOGGER } from "../helpers/Logger";
import { savedData } from "../Bot";

export default (client: Client): void => {
  client.on("clientReady", async () => {
    try {
      if (!client.user || !client.application) return;

      await client.application.commands.set(Commands);

      let errorChannel: TextChannel | null = null;

      // get the error channnel
      const errorChannelId = process.env.ERROR_CHANNEL_ID;
      if (errorChannelId) {
        const channel = await client.channels.fetch(errorChannelId, {
          cache: true,
        });
        if (
          channel &&
          channel.isTextBased() &&
          channel instanceof TextChannel
        ) {
          errorChannel = channel;
          LOGGER.setErrorChannel(channel);

          const devRole = channel.guild.roles.cache.find(
            (r) => r.name === DEV_ROLE,
          );
          if (devRole) {
            LOGGER.setDevRole(devRole.id);
          } else {
            LOGGER.error(
              `Developer role with name ${DEV_ROLE} not found in guild ${channel.guild.name}.`,
            );
          }
        } else {
          LOGGER.error(
            `Error channel with ID ${errorChannelId} is not a text-based channel.`,
          );
        }
      }

      // ... rest of ready work, then pollLoop
      LOGGER.warning(`---\n${client.user.username} is online\n---`);

      let message = null;
      if (errorChannel) {
        message = await errorChannel.send(
          "Enumerating Servers and Channels for KillFeed...",
        );
      }

      savedData.stats.ServerCount = 0;
      savedData.stats.ConfigCount = 0;
      savedData.stats.ChannelCount = 0;

      // fetch all guilds(servers) that KillFeed is a member of
      const guilds = await client.guilds.fetch();
      const guildCount = guilds.size;
      const startTime = new Date();

      for (const [guildId, guild] of guilds) {
        LOGGER.info("Guild: " + guild.name);
        savedData.stats.ServerCount++;
        // update this guild
        await updateGuild(client, guildId, guild.name);
        await message?.edit(
          `Enumerating Servers and Channels for KillFeed...\nProcessed ${savedData.stats.ServerCount} of ${guildCount} servers so far...`,
        );
      }

      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;
      LOGGER.warning(
        `Imported all servers and now ready. Startup took ${duration} seconds.`,
      );
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
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Explicit infinite loop
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
              (used[key as keyof NodeJS.MemoryUsage] / 1024 / 1024) * 100,
            ) / 100
          } MB  Diff: ${
            Math.round(
              ((used[key as keyof NodeJS.MemoryUsage] -
                firstMem[key as keyof NodeJS.MemoryUsage]) /
                1024 /
                1024) *
                100,
            ) / 100
          }`,
        );
      }
    }
  }
}
