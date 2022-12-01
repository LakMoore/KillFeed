import {
  Channel,
  PermissionResolvable,
  PermissionsBitField,
  TextChannel,
} from "discord.js";

export function canUseChannel(
  channel?: Channel | null
): channel is TextChannel {
  const user = getBotUser(channel);
  if (
    channel &&
    channel instanceof TextChannel &&
    user &&
    channel.permissionsFor(user).has(PermissionsBitField.Flags.SendMessages)
  ) {
    return true;
  }
  return false;
}

export function checkChannelPermissions(
  channel: Channel | undefined,
  permissions: PermissionResolvable
) {
  if (!channel) return false;
  const user = getBotUser(channel);
  return (
    canUseChannel(channel) &&
    user &&
    channel.permissionsFor(user).has(permissions)
  );
}

export function getBotUser(channel?: Channel | null) {
  if (channel && channel instanceof TextChannel && channel.guild.members.me) {
    return channel.guild.members.me;
  }
}

export async function getConfigMessage(channel?: Channel | null) {
  if (
    canUseChannel(channel) &&
    checkChannelPermissions(channel, PermissionsBitField.Flags.ManageMessages)
  ) {
    // Get all pinned messages
    const pinned = await channel.messages.fetchPinned();

    // Filter for those authored by this bot
    const myPinned = pinned.filter(
      (m) => m.author.id === channel.guild.members.me?.id
    );

    return myPinned.first();
  }
}
