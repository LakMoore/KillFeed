import { CommandInteraction, Client } from "discord.js";
import { Command } from "../Command";
import { savedData } from "../Bot";
import { formatISKValue } from "../helpers/JaniceHelper";

export const Stats: Command = {
  name: "stats",
  description: "Output some global statistics about this bot",
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = "Found no stats";

    const stats = savedData.stats;

    if (stats) {
      response =
        `Serving KillMails on ${stats.ChannelCount} Discord channels for ${stats.ServerCount} servers.\n` +
        `First server stats recorded ${getRelativeDiscordTime(
          stats.StatsStarted
        )}\n` +
        `Bot started ${getRelativeDiscordTime(stats.BotStarted)}\n` +
        `Polled zKill ${stats.PollCount} times\n` +
        `Received ${stats.KillMailCount} killmails from zKill\n` +
        `Posted ${stats.PostedCount} killmails into Discord\n` +
        `Appraised ${formatISKValue(stats.ISKAppraised)} with Janice\n`;
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};

export function getRelativeDiscordTime(time: Date): string {
  return `<t:${Math.round(new Date(time).getTime() / 1000)}:R>`;
}
