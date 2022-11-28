import { CommandInteraction, Client } from "discord.js";
import { Command } from "../Command";

export const Help: Command = {
  name: "help",
  description: "Provides some instructions",
  run: async (client: Client, interaction: CommandInteraction) => {
    const content =
      "In any channel where you'd like to see a kill feed, " +
      "issue the /init command.\n" +
      "Then use the /add command for each alliance, corp, character or ship " +
      "you want to see killmails for.\n" +
      "KillFeed uses a single pinned message in the channel to store its settings.\n" +
      "Don't delete or unpin that message, KillFeed needs it to work.\n" +
      "Head over to the KillFeed Discord for support or more details: https://discord.gg/VNF7Dt43b8\n";
    // "\n" +
    // "\n" +
    // ""

    await interaction.followUp({
      ephemeral: true,
      content,
    });

    console.log("here");
  },
};
