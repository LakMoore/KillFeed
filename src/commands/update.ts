import { CommandInteraction, Client } from "discord.js";
import { Command } from "../Command";
import { Config } from "../Config";
import { updateChannel } from "../Channels";

export const Update: Command = {
  name: "update",
  description: "KillFeed will check your pinned message for new settings",
  run: async (client: Client, interaction: CommandInteraction) => {
    let content = "Unable to find your Server ID!!!";

    if (interaction.channel) {
      await updateChannel(client, interaction.channel.id);

      let thisChannel = Config.getInstance().registeredChannels.get(
        interaction.channelId
      );

      if (!thisChannel) {
        content =
          "The channel settings were not updated correctly.  Please check the format on the pinned message";
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
