import { CommandInteraction, Client } from "discord.js";
import { Command } from "../Command";
import { Config } from "../Config";
import { canUseChannel } from "../helpers/DiscordHelper";

export const Report: Command = {
  name: "report",
  description: "Output a list of what we are currently listening for.",
  run: async (client: Client, interaction: CommandInteraction) => {
    let content = "KillFeed is not able to view this channel!";

    if (interaction.channel && canUseChannel(interaction.channel)) {
      let thisChannel = Config.getInstance().registeredChannels.get(
        interaction.channelId
      );

      if (!thisChannel) {
        content =
          "The channel settings were not found. Please use the /init command to get started.";
      } else {
        content = "Updated settings. Listening for:\n";
        if (thisChannel.Alliances.size > 0) {
          content +=
            "Alliances: " +
            Array.from(thisChannel.Alliances)
              .map((v) => {
                return v.toString();
              })
              .join(", ") +
            "\n";
        }
        if (thisChannel.Corporations.size > 0) {
          content +=
            "Corporations: " +
            Array.from(thisChannel.Corporations)
              .map((v) => {
                return v.toString();
              })
              .join(", ") +
            "\n";
        }
        if (thisChannel.Characters.size > 0) {
          content +=
            "Characters: " +
            Array.from(thisChannel.Characters)
              .map((v) => {
                return v.toString();
              })
              .join(", ") +
            "\n";
        }
        if (thisChannel.Ships.size > 0) {
          content +=
            "Ships: " +
            Array.from(thisChannel.Ships)
              .map((v) => {
                return v.toString();
              })
              .join(", ") +
            "\n";
        }
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content,
    });
  },
};
