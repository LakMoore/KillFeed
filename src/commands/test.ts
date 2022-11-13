import { CommandInteraction, Client } from "discord.js";
import { Config } from "../Config";
import { Command } from "../Command";

export const Test: Command = {
  name: "test",
  description: "Sends the next killmail to the feed",
  run: async (client: Client, interaction: CommandInteraction) => {
    // Put this channel Id on the list
    Config.getInstance().testRequests.add(interaction.channelId);

    const content = "Request received";

    await interaction.followUp({
      ephemeral: true,
      content,
    });
  },
};
