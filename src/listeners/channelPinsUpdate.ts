import { Client, Presence } from "discord.js";

export default (client: Client): void => {
  client.on(
    "presenceUpdate",
    async (oldPresence: Presence | null, newPresence: Presence) => {
      console.log(newPresence.userId);
    }
  );
};
