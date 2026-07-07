import {
  Client,
  TextChannel,
  PermissionsBitField,
  DiscordAPIError,
} from 'discord.js';
import { pollzKillboardOnce } from '../zKillboard/zKillboardService';
import { Commands } from '../Commands';
import { updateGuild } from '../Servers';
import { DEV_ROLE, LOGGER } from '../helpers/Logger';
import { savedData } from '../Bot';
import { startWandererEventStreams } from '../wanderer/WandererEventsClient';
import { Config } from '../Config';
import { checkChannelPermissions } from '../helpers/DiscordHelper';
import { readFileSync } from 'fs';
import { join } from 'path';

const pkgVersion: string = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
).version as string;

export default function ready(client: Client): void {
  client.on(
    'clientReady',
    async () => {
      try {
        if (!client.user || !client.application) return;

        await client.application.commands.set(Commands);

        let errorChannel: TextChannel | null = null;

        // get the error channnel
        const errorChannelId = process.env.ERROR_CHANNEL_ID;
        if (errorChannelId) {
          const channel = await client.channels.fetch(
            errorChannelId,
            {
              cache: true,
            }
          );
          if (
            channel
            && channel.isTextBased()
            && channel instanceof TextChannel
          ) {
            errorChannel = channel;
            LOGGER.setErrorChannel(channel);

            const devRole = channel.guild.roles.cache.find(
              (r) => r.name === DEV_ROLE
            );
            if (devRole) {
              LOGGER.setDevRole(devRole.id);
            }
            else {
              LOGGER.error(
                `Developer role with name ${DEV_ROLE} not found in guild ${channel.guild.name}.`
              );
            }
          }
          else {
            LOGGER.error(
              `Error channel with ID ${errorChannelId} is not a text-based channel.`
            );
          }
        }

        // ... rest of ready work, then pollLoop
        LOGGER.warning(`---\n${client.user.username} is online\n---`);

        let message = null;
        if (errorChannel) {
          message = await errorChannel.send(
            'Enumerating Servers and Channels for KillFeed...'
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
          LOGGER.info('Guild: ' + guild.name);
          savedData.stats.ServerCount++;
          // update this guild
          await updateGuild(client, guildId, guild.name);
          await message?.edit(
            `Enumerating Servers and Channels for KillFeed...\nProcessed ${savedData.stats.ServerCount} of ${guildCount} servers so far...`
          );
        }

        const endTime = new Date();
        const duration = (endTime.getTime() - startTime.getTime()) / 1000;

        // Start Wanderer event streams
        // (must be done after all guilds are imported, so that we have all the channels to connect to)
        const wandererStreams = startWandererEventStreams(client);

        LOGGER.warning(
          `Imported all servers and now ready. Startup took ${duration} seconds.`
        );

        const currentVersion = pkgVersion;
        if (savedData.stats.LastVersion !== currentVersion) {
          LOGGER.info(
            `Bot updated from v${savedData.stats.LastVersion} to v${currentVersion}. Posting update notice to all channels.`
          );
          await postUpdateMessage();
          savedData.stats.LastVersion = currentVersion;
          await savedData.save();
        }

        LOGGER.info('Starting Poll');
        await Promise.all([pollLoop(client, 0), wandererStreams]);
      }
      catch (err) {
        LOGGER.error('Error in ready handler: ' + err);
      }
    }
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const UPDATE_MESSAGE =
  'KillFeed has been updated! Join the Eve Apps by Lak Moore Discord for news and support: https://discord.gg/9xgRvQf5A';

async function postUpdateMessage() {
  const config = Config.getInstance();
  for (const [, subscription] of config.allSubscriptions) {
    const channel = subscription.Channel;
    try {
      if (
        !checkChannelPermissions(channel, PermissionsBitField.Flags.ViewChannel)
        || !checkChannelPermissions(
          channel,
          PermissionsBitField.Flags.SendMessages
        )
      ) {
        continue;
      }
      await channel.send(UPDATE_MESSAGE);
    }
    catch (err) {
      if (err instanceof DiscordAPIError) {
        LOGGER.debug(
          `Could not post update notice to ${channel.name} on ${channel.guild.name}: ${err.message}`
        );
      }
      else {
        LOGGER.debug(`Could not post update notice to ${channel.name}: ${err}`);
      }
    }
  }
}

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
      LOGGER.debug('loop ' + loopCount++);
      await pollzKillboardOnce(client);
    }
    catch (error) {
      if (error instanceof Error) LOGGER.error(error);
      else LOGGER.error(error as string);
      // if there was an error, wait a bit longer before retrying
      await sleep(10000);
    }

    const DEBUG = false;
    if (DEBUG) {
      const err = new Error('debug-stack');
      if (err.stack) {
        LOGGER.debug('Stack size: ' + (err.stack.split('\n').length - 1));
      }
      logMemoryUsage();
    }
  }
}
