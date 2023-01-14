import dotenv from "dotenv";
import { Client, IntentsBitField } from "discord.js";
import ready from "./listeners/ready";
import interactionCreate from "./listeners/interactionCreate";
import guild from "./listeners/guild";
import channel from "./listeners/channel";

function main() {
  dotenv.config();
  console.log("Bot is starting...");

  const client = new Client({
    intents: [IntentsBitField.Flags.Guilds],
  });

  Error.stackTraceLimit = Infinity;

  ready(client);
  interactionCreate(client);
  guild(client);
  channel(client);

  client.login(process.env.SECRET_TOKEN);

  console.log("===============");
}

main();
