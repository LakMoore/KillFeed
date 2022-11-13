import { CommandInteraction, Client } from "discord.js";
import { updateGuild } from "../Servers";
import { Command } from "../Command";
import { Config } from "../Config";

export const Update: Command = {
  name: "update",
  description: "KillFeed will check your pinned message for new settings",
  run: async (client: Client, interaction: CommandInteraction) => {
    let content = "Unable to find your Server ID!!!";

    if (interaction.guildId) {
      updateGuild(client, interaction.guildId);

      let gs = Config.getInstance().guildSettings.get(interaction.guildId);

      if (!gs) {
        content =
          "The server was not updated correctly.  Please check the format on the pinned message";
      } else {
        content = "Updated settings. Listening for:\n";
        if (gs.Alliances.size > 0) {
          content +=
            "Alliances: " +
            Array.from(gs.Alliances)
              .map((v) => {
                return v.toString();
              })
              .join(", ") +
            "\n";
        }
        if (gs.Corporations.size > 0) {
          content +=
            "Corporations: " +
            Array.from(gs.Corporations)
              .map((v) => {
                return v.toString();
              })
              .join(", ") +
            "\n";
        }
        if (gs.Characters.size > 0) {
          content +=
            "Characters: " +
            Array.from(gs.Characters)
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
