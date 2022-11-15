import dotenv from "dotenv";
import { Client } from "discord.js";
import ready from "./listeners/ready";
import interactionCreate from "./listeners/interactionCreate";
import channelPinsUpdate from "./listeners/channelPinsUpdate";
import presenceUpdate from "./listeners/presenceUpdate";

async function main() {
  dotenv.config();
  console.log("Bot is starting...");

  const client = new Client({
    intents: [],
  });

  ready(client);
  interactionCreate(client);
  channelPinsUpdate(client);
  presenceUpdate(client);

  client.login(process.env.SECRET_TOKEN);

  console.log("===============");
}

main();
