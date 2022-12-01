import {
  CommandInteraction,
  Client,
  SlashCommandStringOption,
} from "discord.js";
import { Config } from "../Config";
import { Command } from "../Command";
import { fetchKillmail } from "../esi/fetch";
import { getOneZKill, prepAndSend } from "../zKillboard/zKillboardService";

const KILLMAIL_ID = "killmail-id";

export const Test: Command = {
  name: "test",
  description:
    "Sends the next killmail to the feed. Optionally test specific kill against current channel config.",
  options: [
    new SlashCommandStringOption()
      .setName(KILLMAIL_ID)
      .setDescription("The Killmail ID to test"),
  ],
  run: async (client: Client, interaction: CommandInteraction) => {
    let content = "Test failed";

    if (interaction.isChatInputCommand()) {
      const kmId = interaction.options.getString(KILLMAIL_ID);

      if (kmId) {
        const zkb = await getOneZKill(kmId);

        console.log(zkb);

        if (zkb && zkb.zkb) {
          const { data } = await fetchKillmail(kmId, zkb.zkb.hash);

          prepAndSend(client, data, zkb);
          content = "Found the Killmail!";
        } else {
          content = `Failed to find kill ID ${kmId} on ZKillboard`;
        }
      } else {
        // Put this channel Id on the list
        Config.getInstance().testRequests.add(interaction.channelId);
        content = "Request received";
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content,
    });
  },
};
