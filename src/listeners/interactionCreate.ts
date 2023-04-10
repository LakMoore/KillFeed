import { Interaction, Client, CommandInteraction } from "discord.js";
import { Commands } from "../Commands";

export default (client: Client): void => {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (interaction.isCommand() || interaction.isContextMenuCommand()) {
      await handleSlashCommand(client, interaction);
    }
  });
};

const handleSlashCommand = async (
  client: Client,
  interaction: CommandInteraction
): Promise<void> => {
  const slashCommand = Commands.find((c) => c.name === interaction.commandName);
  if (!slashCommand) {
    interaction.followUp({ content: "An error has occurred" });
    return;
  }

  await interaction.deferReply();

  try {
    await slashCommand.run(client, interaction);
  } catch (error) {
    if (error instanceof Error) {
      await interaction.followUp({
        content: "An error has occurred (" + error.message + ")",
      });
    } else {
      await interaction.followUp({
        content: "An unknown error has occurred.",
      });
    }
  }
};
