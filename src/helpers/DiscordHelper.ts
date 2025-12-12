import {
  Channel,
  PermissionResolvable,
  PermissionsBitField,
  TextChannel,
} from "discord.js";
import { LOGGER } from "./Logger";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    checkChannelPermissions(channel, PermissionsBitField.Flags.ViewChannel) &&
    checkChannelPermissions(
      channel,
      PermissionsBitField.Flags.ReadMessageHistory
    ) &&
    (checkChannelPermissions(
      channel,
      PermissionsBitField.Flags.ManageMessages
    ) ||
      checkChannelPermissions(channel, PermissionsBitField.Flags.PinMessages))
  ) {
    try {
      LOGGER.debug(
        `Fetching pinned messages on channel ${channel?.name} on ${channel?.guild.name}`
      );
      // Get pinned messages
      const pinned = await channel.messages.fetchPins();
      await sleep(1100);

      // Filter for those authored by this bo
      const myPinned = pinned.items
        .flatMap((p) => p.message)
        .filter((m) => m.author.id === channel.guild.members.me?.id);

      LOGGER.debug(`Found ${myPinned.length} pinned messages for this bot`);

      return myPinned[0];
    } catch (error) {
      // We probably don't have sufficient permission to read pinned messages
      LOGGER.debug(
        `Insufficient Permissions to fetch Pinned Messages on channel ${channel?.name} on ${channel?.guild.name}`
      );
    }
  }
}
