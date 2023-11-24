import dotenv from "dotenv";
import { Client, IntentsBitField } from "discord.js";
import ready from "./listeners/ready";
import interactionCreate from "./listeners/interactionCreate";
import guild from "./listeners/guild";
import channel from "./listeners/channel";
import axios from "axios";
import axiosRetry from "axios-retry";
import { consoleLog } from "./helpers/Logger";

function main() {
  dotenv.config();
  consoleLog("Bot is starting...");

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

  consoleLog("===============");
}

main();
