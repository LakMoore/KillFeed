import * as dotenv from 'dotenv';
import { Client } from "discord.js";

dotenv.config()
console.log("Bot is starting...");

const client = new Client({
    intents: []
});
client.login(process.env.SECRET_TOKEN);

console.log(client);