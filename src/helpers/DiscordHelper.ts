import {
  Channel,
  PermissionResolvable,
  PermissionsBitField,
  TextChannel,
} from "discord.js";
import { LOGGER } from "./Logger";

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
    try {
      LOGGER.debug(
        `Fetching pinned messages on channel ${channel?.name} on ${channel?.guild.name}`
      );
      // Get 10 pinned messages, but don't wait too long
      // TODO: fix this!
      const pinned = await timeout(
        5000,
        channel.messages.fetchPins({
          limit: 10,
        })
      );

      // Filter for those authored by this bot
      const myPinned = pinned.items
        .flatMap((p) => p.message)
        .filter((m) => m.author.id === channel.guild.members.me?.id);

      LOGGER.debug(`Found ${myPinned.length} pinned messages for this bot`);

      return myPinned[0];
    } catch {
      // We probably don't have sufficient permission to read pinned messages
      LOGGER.debug(
        `Insufficient Permissions to fetch Pinned Messages on channel ${channel?.name} on ${channel?.guild.name}`
      );
    }
  }
}

function timeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Timeout")), ms);
    promise
      .then((res) => {
        clearTimeout(id);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(id);
        reject(err);
      });
  });
}
