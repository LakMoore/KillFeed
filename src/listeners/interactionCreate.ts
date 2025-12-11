import { Interaction, Client, ChatInputCommandInteraction } from "discord.js";
import { Commands } from "../Commands";
import { LOGGER } from "../helpers/Logger";

export default (client: Client): void => {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(client, interaction);
    }
  });
};

const handleSlashCommand = async (
  client: Client,
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const slashCommand = Commands.find((c) => c.name === interaction.commandName);
  if (!slashCommand) {
    await interaction.reply({
      content: "Did not find a command with that name!",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    LOGGER.info(`Running ${slashCommand.name} on ${interaction.guild?.name}`);
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
