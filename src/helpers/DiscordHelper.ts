import {
  Channel,
  Client,
  DiscordAPIError,
  MessageCreateOptions,
  PermissionResolvable,
  PermissionsBitField,
  TextChannel,
} from "discord.js";
import { savedData } from "../Bot";
import { TYPE_KILLS, TYPE_LOSSES } from "../commands/show";
import { Config, SubscriptionSettings } from "../Config";
import { InsightFormat } from "../feedformats/InsightFormat";
import { InsightWithAppraisalFormat } from "../feedformats/InsightWithAppraisalFormat";
import { InsightWithPLEXFormat } from "../feedformats/InsightWithPLEXFormat";
import { ZKMailType } from "../feedformats/Fomat";
import { ZKillLinkFormat } from "../feedformats/ZKillLinkFormat";
import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";
import { LOGGER } from "./Logger";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CHANNEL_MESSAGE_WINDOW_MS = 5000;
const CHANNEL_MESSAGE_LIMIT = 5;

type ChannelRateLimitState = {
  history: number[];
  queue: Promise<void>;
};

const channelRateLimitStates = new Map<string, ChannelRateLimitState>();

function getChannelRateLimitState(channelId: string) {
  let state = channelRateLimitStates.get(channelId);
  if (!state) {
    state = {
      history: [],
      queue: Promise.resolve(),
    };
    channelRateLimitStates.set(channelId, state);
  }

  return state;
}

async function waitForChannelRateLimitSlot(state: ChannelRateLimitState) {
  while (true) {
    const now = Date.now();

    // clear out expired timestamps from the history
    state.history = state.history.filter(
      (timestamp) => now - timestamp < CHANNEL_MESSAGE_WINDOW_MS,
    );

    // if we have room in the history, add the current timestamp and allow the message to be sent
    if (state.history.length < CHANNEL_MESSAGE_LIMIT) {
      state.history.push(now);
      return;
    }

    // history is full, wait for the oldest timestamp to expire
    const oldestTimestamp = state.history[0];
    const waitMs = CHANNEL_MESSAGE_WINDOW_MS - (now - oldestTimestamp);
    LOGGER.debug(
      `Channel rate limit reached. Waiting ${waitMs}ms before sending next message.`,
    );
    await sleep(Math.max(waitMs, 0));
  }
}

export function canUseChannel(
  channel?: Channel | null,
): channel is TextChannel {
  if (channel && channel instanceof TextChannel) {
    return true;
  }
  return false;
}

export function checkChannelPermissions(
  channel: Channel | undefined,
  permissions: PermissionResolvable,
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
      PermissionsBitField.Flags.ReadMessageHistory,
    ) &&
    (checkChannelPermissions(
      channel,
      PermissionsBitField.Flags.ManageMessages,
    ) ||
      checkChannelPermissions(channel, PermissionsBitField.Flags.PinMessages))
  ) {
    try {
      LOGGER.debug(
        `Fetching pinned messages on channel ${channel?.name} on ${channel?.guild.name}`,
      );
      // Get pinned messages
      const pinned = await channel.messages.fetchPins();

      // Filter for those authored by this bo
      const myPinned = pinned.items
        .flatMap((p) => p.message)
        .filter((m) => m.author.id === channel.guild.members.me?.id);

      LOGGER.debug(`Found ${myPinned.length} pinned messages for this bot`);

      return myPinned[0];
    } catch (error: unknown) {
      if (error instanceof DiscordAPIError && error.code === 50013) {
        LOGGER.debug(
          `Discord rejected fetchPins on channel ${channel?.name} on ${channel?.guild.name} with Missing Permissions (50013). Check channel overrides, view channel, and read message history permissions.`,
        );
        // check for 429 rate limit error from discord
      } else if (
        error instanceof DiscordAPIError &&
        (error.code === 429 || error.status === 429)
      ) {
        LOGGER.error(
          `Rate limit exceeded while fetching pinned messages on channel ${channel?.name} on ${channel?.guild.name}.`,
        );
      } else {
        LOGGER.debug(
          `Unknown error while fetching pinned messages on channel ${channel?.name} on ${channel?.guild.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}

function getRequiredPermissions(hasFiles: boolean) {
  const requiredPermissions: Array<{
    permission: bigint;
    name: string;
  }> = [
    {
      permission: PermissionsBitField.Flags.ViewChannel,
      name: "ViewChannel",
    },
    {
      permission: PermissionsBitField.Flags.SendMessages,
      name: "SendMessages",
    },
  ];

  if (hasFiles) {
    requiredPermissions.push({
      permission: PermissionsBitField.Flags.AttachFiles,
      name: "AttachFiles",
    });
  }

  return requiredPermissions;
}

function getMissingPermissions(
  channel: Channel,
  requiredPermissions: Array<{
    permission: bigint;
    name: string;
  }>,
) {
  return requiredPermissions
    .filter(({ permission }) => !checkChannelPermissions(channel, permission))
    .map(({ name }) => name);
}

function createEmbedPermissionGuidance(killmail: KillMail) {
  return {
    content:
      "KillFeed has a killmail to post here and this channel is configured for the Embed format.  The bot is missing the Discord Embed Links permission.\n" +
      "Either grant the bot the Embed Links permission, or switch this channel to plain text links with `/set_format` and choose `zKill`.\n" +
      `Killmail: https://zkillboard.com/kill/${killmail.killmail_id}/`,
  };
}

function getFormatterForSubscription(
  responseFormat: SubscriptionSettings["ResponseFormat"],
) {
  switch (responseFormat) {
    case "zKill":
      return ZKillLinkFormat;
    case "InsightWithPLEX":
      return InsightWithPLEXFormat;
    case "InsightWithAppraisal":
      return InsightWithAppraisalFormat;
    default:
      return InsightFormat;
  }
}

async function waitForChannelChanges(thisSubscription: SubscriptionSettings) {
  while (thisSubscription.PauseForChanges) {
    LOGGER.info(
      `Pausing for changes on ${thisSubscription.Channel.guild.name} : ${thisSubscription.Channel.name}`,
    );
    await sleep(5000);
  }
}

function shouldSkipKillmail(
  thisSubscription: SubscriptionSettings,
  zkb: ZkbOnly,
  type: ZKMailType,
) {
  if (zkb.zkb.totalValue <= (thisSubscription.MinISK ?? 0)) {
    return true;
  }

  return (
    (thisSubscription.Show == TYPE_LOSSES && type != ZKMailType.Loss) ||
    (thisSubscription.Show == TYPE_KILLS && type != ZKMailType.Kill)
  );
}

function addRolePingToMessage(
  channel: TextChannel,
  thisSubscription: SubscriptionSettings,
  msg: MessageCreateOptions,
) {
  if (!thisSubscription.RoleToPing) {
    return;
  }

  const targetRole = channel.guild.roles.cache.get(thisSubscription.RoleToPing);
  const canMentionRole =
    targetRole?.mentionable ||
    checkChannelPermissions(channel, PermissionsBitField.Flags.MentionEveryone);

  if (!canMentionRole) {
    msg.content = msg.content
      ? `KillFeed could not ping the configured role (${targetRole?.name ?? "unknown role"}) because it is not mentionable and the bot lacks MentionEveryone.\n${msg.content}`
      : `KillFeed could not ping the configured role (${targetRole?.name ?? "unknown role"}) because it is not mentionable and the bot lacks MentionEveryone.`;

    LOGGER.warning(
      `Unable to ping role ${thisSubscription.RoleToPing} for channel ${channel.name ?? "unknown channel"} on ${channel.guild.name ?? "unknown guild"}. The role is not mentionable and the bot is missing MentionEveryone.`,
    );
    return;
  }

  const roleMention = `<@&${thisSubscription.RoleToPing}>`;
  msg.content = msg.content ? `${roleMention}\n${msg.content}` : roleMention;
  msg.allowedMentions = {
    roles: [thisSubscription.RoleToPing],
  };
}

async function sendMessageWithFallback(
  channel: TextChannel,
  killmail: KillMail,
  msg: MessageCreateOptions,
  type: ZKMailType,
) {
  // respect Discord rate limits for sending messages

  const state = getChannelRateLimitState(channel.id);
  await waitForChannelRateLimitSlot(state);

  const missingEmbedPermission =
    !!msg.embeds?.length &&
    !checkChannelPermissions(channel, PermissionsBitField.Flags.EmbedLinks);

  const sentMessage = missingEmbedPermission
    ? await channel.send(createEmbedPermissionGuidance(killmail))
    : await channel.send(msg);

  if (missingEmbedPermission) {
    LOGGER.warning(
      `Unable to send the ${ZKMailType[type]} mail as an embed on channel ${channel.name ?? "unknown channel"} on ${channel.guild.name ?? "unknown guild"}. Sent guidance message instead because EmbedLinks is missing.`,
    );
  }

  savedData.stats.PostedCount++;
  return sentMessage;
}

export async function sendKillmailMessage(
  client: Client,
  channelId: string,
  killmail: KillMail,
  zkb: ZkbOnly,
  appraisalValue: number,
  type: ZKMailType,
) {
  const channel = client.channels.cache.get(channelId);

  if (!canUseChannel(channel)) {
    LOGGER.error(
      `Unable to send the ${ZKMailType[type]} mail on channel ${channelId} - channel unavailable`,
    );
    return;
  }

  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);

  if (!thisSubscription) {
    LOGGER.error(
      `No subscription found for ${channel.name ?? "unknown channel"} on ${channel.guild.name ?? "unknown guild"}`,
    );
    return;
  }

  await waitForChannelChanges(thisSubscription);

  if (shouldSkipKillmail(thisSubscription, zkb, type)) {
    return;
  }

  const formatter = getFormatterForSubscription(
    thisSubscription.ResponseFormat,
  );

  const msg = await formatter.getMessage(killmail, zkb, type, appraisalValue);
  addRolePingToMessage(channel, thisSubscription, msg);

  const missingPermissions = getMissingPermissions(
    channel,
    getRequiredPermissions(!!msg.files?.length),
  );

  if (missingPermissions.length > 0) {
    LOGGER.warning(
      `Unable to send the ${ZKMailType[type]} mail on channel ${channel.name ?? "unknown channel"} on ${channel.guild.name ?? "unknown guild"}. Missing permissions: ${missingPermissions.join(", ")}`,
    );
    return;
  }

  try {
    return await sendMessageWithFallback(channel, killmail, msg, type);
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === 50013) {
      LOGGER.error(
        `Discord rejected send on channel ${channel.name ?? "unknown channel"} on ${channel.guild.name ?? "unknown guild"} with Missing Permissions (50013). Check channel overrides, embed links, and role mention permissions.`,
      );
      return;
    }

    if (error instanceof DiscordAPIError) {
      LOGGER.error(
        `Non permission based Discord Error while sending message [${error.code}]${error.message}`,
      );
    }

    throw error;
  }
}
