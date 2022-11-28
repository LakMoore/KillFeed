import { CommandInteraction, Client } from "discord.js";
import { Command } from "../Command";
import { Config } from "../Config";
import { canUseChannel } from "../helpers/DiscordHelper";

export const Info: Command = {
  name: "info",
  description: "Output a list of what we are currently listening for.",
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = "KillFeed is not able to view this channel!";

    if (interaction.channel && canUseChannel(interaction.channel)) {
      let thisChannel = Config.getInstance().registeredChannels.get(
        interaction.channelId
      );

      if (!thisChannel) {
        response =
          "The channel settings were not found. Please use the /init command to get started.";
      } else {
        response = "";
        if (thisChannel.Alliances.size > 0) {
          response +=
            "Alliances: " +
            Array.from(thisChannel.Alliances)
              .map((v) => {
                return v.toString();
              })
              .join(", ") +
            "\n";
        }
        if (thisChannel.Corporations.size > 0) {
          response +=
            "Corporations: " +
            Array.from(thisChannel.Corporations)
              .map((v) => {
                return v.toString();
              })
              .join(", ") +
            "\n";
        }
        if (thisChannel.Characters.size > 0) {
          response +=
            "Characters: " +
            Array.from(thisChannel.Characters)
              .map((v) => {
                return v.toString();
              })
              .join(", ") +
            "\n";
        }
        if (thisChannel.Ships.size > 0) {
          response +=
            "Ships: " +
            Array.from(thisChannel.Ships)
              .map((v) => {
                return v.toString();
              })
              .join(", ") +
            "\n";
        }
        if (response.length > 0) {
          response = "Listening for:\n" + response;
        } else {
          response = "No filters set. Use /add command to set some filters.";
        }
        if (thisChannel.FullTest) {
          if (response.length > 0) {
            response += "\n";
          }
          response += "Full test mode is on";
        }
        response += "\nFormat is " + thisChannel.ResponseFormat;
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
