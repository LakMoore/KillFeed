import dotenv from "dotenv";
import { Client, IntentsBitField } from "discord.js";
import ready from "./listeners/ready";
import interactionCreate from "./listeners/interactionCreate";
import guild from "./listeners/guild";
import channel from "./listeners/channel";
import axios from "axios";
import axiosRetry from "axios-retry";
import { Data } from "./Data";
import { LOGGER } from "./helpers/Logger";

export const savedData = new Data();

async function main() {
  dotenv.config();
  LOGGER.info("Bot is starting...");

  await savedData.init();

  const stats = savedData.stats;
  if (!stats.StatsStarted) {
    stats.StatsStarted = new Date();
  }
  stats.BotStarted = new Date();
  await savedData.save();

  const client = new Client({
    intents: [IntentsBitField.Flags.Guilds],
  });

  // set this up once
  axiosRetry(axios, { retries: 99, retryDelay: axiosRetry.exponentialDelay });

  // Error.stackTraceLimit = Infinity;

  ready(client);
  interactionCreate(client);
  guild(client);
  channel(client);

  client.login(process.env.SECRET_TOKEN);

  LOGGER.info("===============");
}

main();
