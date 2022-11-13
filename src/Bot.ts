import dotenv from 'dotenv';
import { Client } from "discord.js";
import ready from "./listeners/ready";
import interactionCreate from './listeners/interactionCreate';

async function main() {
    dotenv.config()
    console.log("Bot is starting...");
    
    const client = new Client({
        intents: []
    });
    
    ready(client);
    interactionCreate(client);
    
    client.login(process.env.SECRET_TOKEN);
    
    console.log ("===============");
    
}

main();
