import { CommandInteraction, Client } from "discord.js";
import { Command } from "../Command";

export const Help: Command = {
  name: "help",
  description: "Provides some instructions",
  run: async (client: Client, interaction: CommandInteraction) => {
    const content =
      "In any channel where you'd like to see a kill feed, " +
      "make a new message and mention the KillFeed Bot (so it can see the message!).\n" +
      "Then add a line to that message for each alliance, corp or character " +
      "you want to see killmails for. Use the following format:\n" +
      "```@KillFeed\n" +
      "character/91218379/\n" +
      "corporation/98532165/\n" +
      "alliance/99010787/```\n" +
      "Add as many lines as you need then call the /update command to have KillFeed start using the new settings.";

    await interaction.followUp({
      ephemeral: true,
      content,
    });

    console.log("here");
  },
};
