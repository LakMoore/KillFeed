import {
  APIEmbed,
  Channel,
  Client,
  DiscordAPIError,
  EmbedBuilder,
  MessageCreateOptions,
  MessageMentionOptions,
  PermissionResolvable,
  PermissionsBitField,
  TextChannel,
} from 'discord.js';
import { savedData } from '../Bot';
import { TYPE_KILLS, TYPE_LOSSES } from '../commands/show';
import { Config, SubscriptionSettings } from '../Config';
import { InsightFormat } from '../feedformats/InsightFormat';
import { InsightWithAppraisalFormat } from '../feedformats/InsightWithAppraisalFormat';
import { InsightWithPLEXFormat } from '../feedformats/InsightWithPLEXFormat';
import { ZKMailType } from '../feedformats/Fomat';
import { ZKillLinkFormat } from '../feedformats/ZKillLinkFormat';
import { KillMail, ZkbOnly } from '../zKillboard/zKillboard';
import { LOGGER } from './Logger';
import { WandererMaps } from '../wanderer/WandererMaps';
import { CachedESI } from '../esi/cache';

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
      (timestamp) => now - timestamp < CHANNEL_MESSAGE_WINDOW_MS
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
      `Channel rate limit reached. Waiting ${waitMs}ms before sending next message.`
    );
    await sleep(Math.max(waitMs, 0));
  }
}

export function canUseChannel(
  channel?: Channel | null
): channel is TextChannel {
  if (channel && channel instanceof TextChannel) {
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
    canUseChannel(channel)
    && user
    && channel.permissionsFor(user).has(permissions)
  );
}

export function getBotUser(channel?: Channel | null) {
  if (channel && channel instanceof TextChannel && channel.guild.members.me) {
    return channel.guild.members.me;
  }
}

export async function getConfigMessage(channel?: Channel | null) {
  if (
    canUseChannel(channel)
    && checkChannelPermissions(channel, PermissionsBitField.Flags.ViewChannel)
    && checkChannelPermissions(
      channel,
      PermissionsBitField.Flags.ReadMessageHistory
    )
    && (
      checkChannelPermissions(channel, PermissionsBitField.Flags.ManageMessages)
      || checkChannelPermissions(channel, PermissionsBitField.Flags.PinMessages)
    )
  ) {
    try {
      LOGGER.debug(
        `Fetching pinned messages on channel ${channel?.name} on ${channel?.guild.name}`
      );
      // Get pinned messages
      const pinned = await channel.messages.fetchPins();

      // Filter for those authored by this bo
      const myPinned = pinned.items
        .flatMap((p) => p.message)
        .filter((m) => m.author.id === channel.guild.members.me?.id);

      LOGGER.debug(`Found ${myPinned.length} pinned messages for this bot`);

      return myPinned[0];
    }
    catch (error: unknown) {
      if (error instanceof DiscordAPIError && error.code === 50013) {
        LOGGER.debug(
          `Discord rejected fetchPins on channel ${channel?.name} on ${channel?.guild.name} with Missing Permissions (50013). Check channel overrides, view channel, and read message history permissions.`
        );
        // check for 429 rate limit error from discord
      }
      else if (
        error instanceof DiscordAPIError
        && (error.code === 429 || error.status === 429)
      ) {
        LOGGER.error(
          `Rate limit exceeded while fetching pinned messages on channel ${channel?.name} on ${channel?.guild.name}.`
        );
      }
      else {
        LOGGER.debug(
          `Unknown error while fetching pinned messages on channel ${channel?.name} on ${channel?.guild.name}: ${
            error instanceof Error ? error.message : String(error)
          }`
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
      name: 'ViewChannel',
    },
    {
      permission: PermissionsBitField.Flags.SendMessages,
      name: 'SendMessages',
    },
  ];

  if (hasFiles) {
    requiredPermissions.push({
      permission: PermissionsBitField.Flags.AttachFiles,
      name: 'AttachFiles',
    });
  }

  return requiredPermissions;
}

function getMissingPermissions(
  channel: Channel,
  requiredPermissions: Array<{
    permission: bigint;
    name: string;
  }>
) {
  return requiredPermissions
    .filter(({ permission }) => !checkChannelPermissions(channel, permission))
    .map(({ name }) => name);
}

function createEmbedPermissionGuidance(killmail: KillMail) {
  return {
    content:
      'KillFeed has a killmail to post here and this channel is configured for the Embed format.  The bot is missing the Discord Embed Links permission.\n'
      + 'Either grant the bot the Embed Links permission, or switch this channel to plain text links with `/set_format` and choose `zKill`.\n'
      + `Killmail: https://zkillboard.com/kill/${killmail.killmail_id}/`,
  };
}

function getFormatterForSubscription(
  responseFormat: SubscriptionSettings['ResponseFormat']
) {
  switch (responseFormat) {
  case 'zKill':
    return ZKillLinkFormat;
  case 'InsightWithPLEX':
    return InsightWithPLEXFormat;
  case 'InsightWithAppraisal':
    return InsightWithAppraisalFormat;
  default:
    return InsightFormat;
  }
}

async function waitForChannelChanges(thisSubscription: SubscriptionSettings) {
  while (thisSubscription.PauseForChanges) {
    LOGGER.info(
      `Pausing for changes on ${thisSubscription.Channel.guild.name} : ${thisSubscription.Channel.name}`
    );
    await sleep(5000);
  }
}

function shouldSkipKillmail(
  thisSubscription: SubscriptionSettings,
  zkb: ZkbOnly,
  type: ZKMailType
) {
  if (zkb.zkb.totalValue <= (thisSubscription.MinISK ?? 0)) {
    return true;
  }

  return (
    (thisSubscription.Show == TYPE_LOSSES && type != ZKMailType.Loss)
    || (thisSubscription.Show == TYPE_KILLS && type != ZKMailType.Kill)
  );
}

function addRolePingToMessage(
  channel: TextChannel,
  thisSubscription: SubscriptionSettings,
  msg: MessageCreateOptions
) {
  // Backwards-compatible wrapper: add only the general RoleToPing
  addConfiguredRolePings(channel, thisSubscription, msg, false);
}

function addWandererRolePingToMessage(
  channel: TextChannel,
  thisSubscription: SubscriptionSettings,
  msg: MessageCreateOptions
) {
  // Backwards-compatible wrapper: add Wanderer ping (and also include general RoleToPing if present)
  addConfiguredRolePings(channel, thisSubscription, msg, true);
}

function addConfiguredRolePings(
  channel: TextChannel,
  thisSubscription: SubscriptionSettings,
  msg: MessageCreateOptions,
  includeWandererRole = false
) {
  const roleIds: string[] = [];
  if (thisSubscription.RoleToPing) roleIds.push(thisSubscription.RoleToPing);
  if (includeWandererRole) {
    const pr = thisSubscription.WandererSettings?.PingRole;
    if (pr) roleIds.push(pr);
  }

  // Deduplicate while preserving order
  const uniqueRoleIds = Array.from(new Set(roleIds));
  if (uniqueRoleIds.length === 0) return;

  const failedPings: string[] = [];
  const mentions: string[] = [];

  for (const roleId of uniqueRoleIds) {
    const role = channel.guild.roles.cache.get(roleId);
    const canMention =
      role?.mentionable
      || checkChannelPermissions(
        channel,
        PermissionsBitField.Flags.MentionEveryone
      );
    if (!canMention) {
      failedPings.push(role?.name ?? roleId);
      continue;
    }
    mentions.push(`<@&${roleId}>`);
  }

  if (mentions.length > 0) {
    const mentionPrefix = mentions.join('\n');
    msg.content = msg.content
      ? `${mentionPrefix}\n${msg.content}`
      : mentionPrefix;
    // merge allowedMentions.roles
    const existing = msg.allowedMentions?.roles ?? [];
    const merged = Array.from(new Set([...existing, ...uniqueRoleIds]));
    msg.allowedMentions = {
      ...(msg.allowedMentions ?? ({} as MessageMentionOptions)),
      roles: merged,
    };
  }

  if (failedPings.length > 0) {
    const failedText = `KillFeed could not ping the configured role(s): ${failedPings.join(', ')} because they are not mentionable and the bot lacks MentionEveryone.`;
    msg.content = msg.content ? `${failedText}\n${msg.content}` : failedText;
    LOGGER.warning(
      `Unable to ping roles [${failedPings.join(', ')}] for channel ${channel.name ?? 'unknown channel'} on ${channel.guild.name ?? 'unknown guild'}. Roles not mentionable and bot missing MentionEveryone.`
    );
  }
}

async function sendMessageWithFallback(
  channel: TextChannel,
  killmail: KillMail,
  msg: MessageCreateOptions,
  type: ZKMailType
) {
  // respect Discord rate limits for sending messages

  const state = getChannelRateLimitState(channel.id);
  await waitForChannelRateLimitSlot(state);

  const missingEmbedPermission =
    !!msg.embeds?.length
    && !checkChannelPermissions(channel, PermissionsBitField.Flags.EmbedLinks);

  const sentMessage = missingEmbedPermission
    ? await channel.send(createEmbedPermissionGuidance(killmail))
    : await channel.send(msg);

  if (missingEmbedPermission) {
    LOGGER.warning(
      `Unable to send the ${ZKMailType[type]} mail as an embed on channel ${channel.name ?? 'unknown channel'} on ${channel.guild.name ?? 'unknown guild'}. Sent guidance message instead because EmbedLinks is missing.`
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
  type: ZKMailType
) {
  const channel = client.channels.cache.get(channelId);

  if (!canUseChannel(channel)) {
    LOGGER.error(
      `Unable to send the ${ZKMailType[type]} mail on channel ${channelId} - channel unavailable`
    );
    return;
  }

  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);

  if (!thisSubscription) {
    LOGGER.error(
      `No subscription found for ${channel.name ?? 'unknown channel'} on ${channel.guild.name ?? 'unknown guild'}`
    );
    return;
  }

  await waitForChannelChanges(thisSubscription);

  if (shouldSkipKillmail(thisSubscription, zkb, type)) {
    return;
  }

  const formatter = getFormatterForSubscription(
    thisSubscription.ResponseFormat
  );

  const msg = await formatter.getMessage(killmail, zkb, type, appraisalValue);

  if (type === ZKMailType.OnMap) {
    // get the Wanderer map object for this channel, if any
    try {
      const wandererSettings = thisSubscription.WandererSettings;
      if (!wandererSettings) {
        LOGGER.warning(
          `WandererSettings not found for ${channel.name ?? 'unknown channel'} on ${channel.guild.name ?? 'unknown guild'} despite receiving an OnMap killmail.`
        );
        return;
      }
      const mapId = `${wandererSettings.Domain}/${wandererSettings.Slug}`;
      const wandererMap = WandererMaps.getInstance().getSystemsForMap(mapId);
      const wandererSystem = wandererMap?.get(killmail.solar_system_id);
      const esiSystem = await CachedESI.getSystem(killmail.solar_system_id);
      if (esiSystem?.name && wandererSystem?.temporary_name) {
        const embed = msg.embeds?.[0] as EmbedBuilder;
        const author = embed.toJSON().author;
        if (author?.name) {
          embed.setAuthor({
            ...author,
            name: author.name.replace(
              esiSystem.name,
              `${wandererSystem.temporary_name} [${esiSystem.name}]`
            ),
          });
        }
      }
    }
    catch (error) {
      LOGGER.error(
        `Error while updating embed author for OnMap killmail in ${channel.name ?? 'unknown channel'} on ${channel.guild.name ?? 'unknown guild'}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // If this mail originated from a Wanderer map (OnMap), add the Wanderer-specific ping role if configured
    addWandererRolePingToMessage(channel, thisSubscription, msg);
  }
  else {
    addRolePingToMessage(channel, thisSubscription, msg);
  }

  const missingPermissions = getMissingPermissions(
    channel,
    getRequiredPermissions(!!msg.files?.length)
  );

  if (missingPermissions.length > 0) {
    LOGGER.warning(
      `Unable to send the ${ZKMailType[type]} mail on channel ${channel.name ?? 'unknown channel'} on ${channel.guild.name ?? 'unknown guild'}. Missing permissions: ${missingPermissions.join(', ')}`
    );
    return;
  }

  try {
    return await sendMessageWithFallback(channel, killmail, msg, type);
  }
  catch (error) {
    if (error instanceof DiscordAPIError && error.code === 50013) {
      LOGGER.error(
        `Discord rejected send on channel ${channel.name ?? 'unknown channel'} on ${channel.guild.name ?? 'unknown guild'} with Missing Permissions (50013). Check channel overrides, embed links, and role mention permissions.`
      );
      return;
    }

    if (error instanceof DiscordAPIError) {
      LOGGER.error(
        `Non permission based Discord Error while sending message [${error.code}]${error.message}`
      );
    }

    throw error;
  }
}
