import { CommandInteraction, Client } from "discord.js";
import { fetchESINames } from "../esi/fetch";
import { Command } from "../Command";
import { Config } from "../Config";
import { canUseChannel } from "../helpers/DiscordHelper";
import { formatISKValue } from "../helpers/JaniceHelper";

export const Info: Command = {
  name: "info",
  description: "Output a list of what we are currently listening for.",
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = "KillFeed is not able to view this channel!";

    if (interaction.channel && canUseChannel(interaction.channel)) {
      const thisSubscription = Config.getInstance().allSubscriptions.get(
        interaction.channelId
      );

      if (!thisSubscription) {
        response =
          "A subscription was not found for this channel. Please use the /init command to get started.";
      } else {
        response = "";
        if (thisSubscription.Alliances.size > 0) {
          response +=
            "**Alliances:**\n" +
            (await fetchESINames(Array.from(thisSubscription.Alliances)).then(
              (names) => {
                return names
                  .map((n) => n.name)
                  .sort()
                  .join("\n");
              }
            )) +
            "\n";
        }
        if (thisSubscription.Corporations.size > 0) {
          response +=
            "**Corporations:**\n" +
            (await fetchESINames(
              Array.from(thisSubscription.Corporations)
            ).then((names) => {
              return names
                .map((n) => n.name)
                .sort()
                .join("\n");
            })) +
            "\n";
        }
        if (thisSubscription.Characters.size > 0) {
          response +=
            "**Characters:**\n" +
            (await fetchESINames(Array.from(thisSubscription.Characters)).then(
              (names) => {
                return names
                  .map((n) => n.name)
                  .sort()
                  .join("\n");
              }
            )) +
            "\n";
        }
        if (thisSubscription.Ships.size > 0) {
          response +=
            "**Ships:**\n" +
            (await fetchESINames(Array.from(thisSubscription.Ships)).then(
              (names) => {
                return names
                  .map((n) => n.name)
                  .sort()
                  .join("\n");
              }
            )) +
            "\n";
        }
        if (thisSubscription.Regions.size > 0) {
          response +=
            "**Regions:**\n" +
            (await fetchESINames(Array.from(thisSubscription.Regions)).then(
              (names) => {
                return names
                  .map((n) => n.name)
                  .sort()
                  .join("\n");
              }
            )) +
            "\n";
        }
        if (thisSubscription.Constellations.size > 0) {
          response +=
            "**Constellations:**\n" +
            (await fetchESINames(
              Array.from(thisSubscription.Constellations)
            ).then((names) => {
              return names
                .map((n) => n.name)
                .sort()
                .join("\n");
            })) +
            "\n";
        }

        response += `\nShowing: ${thisSubscription.Show}\n`;

        if (thisSubscription.MinISK) {
          response += `Minimum ISK: ${formatISKValue(
            thisSubscription.MinISK
          )}\n`;
        }

        if (response.length > 0) {
          response = "Listening for:\n" + response;
        } else {
          response = "No filters set. Use /add command to set some filters.";
        }
        if (thisSubscription.FullTest) {
          if (response.length > 0) {
            response += "\n";
          }
          response += "Full test mode is on";
        }
        response += "\nFormat is " + thisSubscription.ResponseFormat;
        response +=
          "\nBot is currently active in " +
          Config.getInstance().allSubscriptions.size +
          " channels";
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
