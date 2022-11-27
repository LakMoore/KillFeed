import {
  CommandInteraction,
  Client,
  TextChannel,
  PermissionsBitField,
} from "discord.js";
import { Config } from "../Config";
import { Command } from "../Command";

export const Init: Command = {
  name: "init",
  description: "Creates the initial config storage message",
  run: async (client: Client, interaction: CommandInteraction) => {
    let channel = interaction.channel;
    if (
      channel &&
      channel instanceof TextChannel &&
      channel.guild.members.me &&
      channel
        .permissionsFor(channel.guild.members.me)
        .has(PermissionsBitField.Flags.SendMessages)
    ) {
      if (
        channel
          .permissionsFor(channel.guild.members.me)
          .has(PermissionsBitField.Flags.ManageMessages)
      ) {
        const content = "This message has been pinned for future use";
        const message = await channel.send(content);
        await message.pin();
      } else {
        const content = "Please pin this message to the channel";
        await channel.send(content);
      }
      interaction.followUp({
        ephemeral: true,
        content: "KillFeed initialised!",
      });
    } else {
      interaction.followUp({
        ephemeral: true,
        content: "No permission to post messages to this channel.",
      });
    }
  },
};
