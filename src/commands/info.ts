import { CommandInteraction, Client } from "discord.js";
import { fetchESINames } from "../esi/fetch";
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
            "**Alliances:**\n" +
            (await fetchESINames(Array.from(thisChannel.Alliances)).then(
              (names) => {
                return names
                  .map((n) => n.name)
                  .sort()
                  .join("\n");
              }
            )) +
            "\n";
        }
        if (thisChannel.Corporations.size > 0) {
          response +=
            "**Corporations:**\n" +
            (await fetchESINames(Array.from(thisChannel.Corporations)).then(
              (names) => {
                return names
                  .map((n) => n.name)
                  .sort()
                  .join("\n");
              }
            )) +
            "\n";
        }
        if (thisChannel.Characters.size > 0) {
          response +=
            "**Characters:**\n" +
            (await fetchESINames(Array.from(thisChannel.Characters)).then(
              (names) => {
                return names
                  .map((n) => n.name)
                  .sort()
                  .join("\n");
              }
            )) +
            "\n";
        }
        if (thisChannel.Ships.size > 0) {
          response +=
            "**Ships:**\n" +
            (await fetchESINames(Array.from(thisChannel.Ships)).then(
              (names) => {
                return names
                  .map((n) => n.name)
                  .sort()
                  .join("\n");
              }
            )) +
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
        response +=
          "\nBot is currently active in " +
          Config.getInstance().registeredChannels.size +
          " channels";
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
