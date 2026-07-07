import dotenv from 'dotenv';
import { Client, IntentsBitField } from 'discord.js';
import ready from './listeners/ready';
import interactionCreate from './listeners/interactionCreate';
import guild from './listeners/guild';
import channel from './listeners/channel';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { Data } from './Data';
import { LOGGER } from './helpers/Logger';
import errorListeners from './listeners/error';

dotenv.config();
export const savedData = new Data();

async function main() {
  LOGGER.info('Bot is starting...');

  await savedData.init();

  const stats = savedData.stats;
  if (!stats.StatsStarted) {
    stats.StatsStarted = new Date();
  }
  stats.BotStarted = new Date();

  // Start the auto-save loop in the background
  const autoSavePromise = savedData.startAutoSaving(); // don't await this

  const client = new Client({
    intents: [IntentsBitField.Flags.Guilds],
    rest: {
      invalidRequestWarningInterval: 1,
    },
  });

  // set this up once
  axiosRetry(axios, { retries: 9, retryDelay: axiosRetry.exponentialDelay });

  const errorPromise = errorListeners(client);
  const readyPromise = ready(client);
  interactionCreate(client);
  const guildPromise = guild(client);
  channel(client);

  const loginPromise = client.login(process.env.SECRET_TOKEN);

  LOGGER.info('===============');

  await Promise.all([
    readyPromise,
    autoSavePromise,
    errorPromise,
    loginPromise,
    guildPromise,
  ]);
}

process.on(
  'unhandledRejection',
  (reason) => {
    LOGGER.error('Unhandled promise rejection: ' + reason);
  }
);

process.on(
  'uncaughtException',
  (err) => {
    LOGGER.error('Uncaught exception: ' + err);
  }
);

main().catch((err) => {
  LOGGER.error('Fatal error in main(): ' + err);
  process.exit(1);
});
