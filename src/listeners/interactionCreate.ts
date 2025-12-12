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
    try {
      const content =
        error instanceof Error
          ? "An error has occurred (" + error.message + ")"
          : "An unknown error has occurred.";

      // We deferred above, so edit the deferred reply. Using followUp here can
      // throw DiscordAPIError[50027] if the interaction token has expired.
      await interaction.editReply({ content });
    } catch (replyError) {
      // If the interaction token is invalid/expired, there's nothing we can do.
      // Avoid surfacing a secondary error that masks the original failure.
      LOGGER.warning(
        `Failed to respond to interaction for ${interaction.commandName}: ${replyError}`
      );
    }
  }
};
