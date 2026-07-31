import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../Command';
import { canUseChannel, getConfigMessage } from '../helpers/DiscordHelper';
import {
  connectWandererMap,
  disconnectWandererMap,
  refreshWandererMap,
  getWandererSystemCount,
  restartWandererMap,
  isWandererConnected,
  getWandererConnectionState,
} from '../wanderer/WandererEventsClient';
import { updateChannel } from '../Channels';
import { generateConfigMessage } from '../helpers/KillFeedHelpers';
import { Config } from '../Config';
import { fetchESIIDs } from '../esi/fetch';
import { CachedESI } from '../esi/cache';
import type { SpaceType } from '../helpers/SpaceTypeHelpers';
import {
  SPACE_TYPE_ABYSSAL,
  SPACE_TYPE_HIGHSEC,
  SPACE_TYPE_LABELS,
  SPACE_TYPE_LOWSEC,
  SPACE_TYPE_NULLSEC,
  SPACE_TYPE_POCHVEN,
  SPACE_TYPE_WORMHOLE,
} from '../helpers/SpaceTypeHelpers';
import { NAME_TYPE, setSpaceTypeFilter } from './spaceType';

async function ensureChannelAvailable(
  interaction: ChatInputCommandInteraction
) {
  const chan = interaction.channel;
  if (!chan) {
    await interaction.followUp({
      ephemeral: true,
      content: 'Could not access channel.',
    });
    return null;
  }
  return chan;
}

const builder = new SlashCommandBuilder()
  .setName('wanderer')
  .setDescription('Manage Wanderer map integration for this channel')
  .addSubcommand((sub) =>
    sub
      .setName('connect')
      .setDescription('Connect this channel to a Wanderer map')
      .addStringOption((option) =>
        option
          .setName('map_url')
          .setDescription('The Wanderer map URL to connect')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('api_key')
          .setDescription('The Wanderer API key for this map')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('disconnect')
      .setDescription('Remove the Wanderer map integration from this channel')
  )
  .addSubcommand((sub) =>
    sub
      .setName('status')
      .setDescription(
        'Show the current Wanderer connection and tracked system count for this channel'
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('restart')
      .setDescription('Restart the Wanderer stream for this channel')
  )
  .addSubcommand((sub) =>
    sub
      .setName('refresh')
      .setDescription('Replace this map\'s systems and connections with fresh data')
  )
  .addSubcommand((sub) =>
    sub
      .setName('set_ping')
      .setDescription(
        'Set a server role to ping for OnMap (map-origin) messages'
      )
      .addRoleOption((opt) =>
        opt
          .setName('role')
          .setDescription('Role to ping for OnMap messages')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('space_type_toggle')
      .setDescription("Apply this channel's space filter to OnMap killmails")
      .addStringOption((opt) =>
        opt
          .setName(NAME_TYPE)
          .setDescription('Kind of space to toggle for map kills')
          .setRequired(true)
          .addChoices(
            { name: 'Everywhere (clear the filter)', value: 'all' },
            {
              name: SPACE_TYPE_LABELS[SPACE_TYPE_WORMHOLE],
              value: SPACE_TYPE_WORMHOLE,
            },
            {
              name: SPACE_TYPE_LABELS[SPACE_TYPE_HIGHSEC],
              value: SPACE_TYPE_HIGHSEC,
            },
            {
              name: SPACE_TYPE_LABELS[SPACE_TYPE_LOWSEC],
              value: SPACE_TYPE_LOWSEC,
            },
            {
              name: SPACE_TYPE_LABELS[SPACE_TYPE_NULLSEC],
              value: SPACE_TYPE_NULLSEC,
            },
            {
              name: SPACE_TYPE_LABELS[SPACE_TYPE_POCHVEN],
              value: SPACE_TYPE_POCHVEN,
            },
            {
              name: SPACE_TYPE_LABELS[SPACE_TYPE_ABYSSAL],
              value: SPACE_TYPE_ABYSSAL,
            }
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('exclude')
      .setDescription(
        'Exclude a solar system from Wanderer notifications for this channel (e.g. Jita)'
      )
      .addStringOption((option) =>
        option
          .setName('system')
          .setDescription(
            'Name of the solar system to exclude (case sensitive)'
          )
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('unexclude')
      .setDescription(
        'Remove a system from the Wanderer exclusion list for this channel'
      )
      .addStringOption((option) =>
        option
          .setName('system')
          .setDescription('System name to remove')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('list-excludes')
      .setDescription(
        'List systems excluded from Wanderer notifications for this channel'
      )
  );

export const Wanderer: Command = {
  ...builder.toJSON(),
  run: async (client: Client, interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.channel;

    if (!canUseChannel(channel)) {
      await interaction.followUp({
        ephemeral: true,
        content: 'KillFeed needs permission to send messages in this channel.',
      });
      return;
    }

    switch (subcommand) {
    case 'connect':
      await handleConnect(client, interaction, channel.id);
      break;
    case 'exclude':
      await handleExclude(client, interaction, channel.id);
      break;
    case 'unexclude':
      await handleUnexclude(client, interaction, channel.id);
      break;
    case 'list-excludes':
      await handleListExcludes(client, interaction, channel.id);
      break;
    case 'disconnect':
      await handleDisconnect(interaction, channel.id);
      break;
    case 'status':
      await handleStatus(interaction, channel.id);
      break;
    case 'restart':
      await handleRestart(client, interaction, channel.id);
      break;
    case 'refresh':
      await handleRefresh(interaction, channel.id);
      break;
    case 'set_ping':
      await handleSetPing(client, interaction, channel.id);
      break;
    case 'space_type_toggle':
      await handleToggleSpaceFilter(client, interaction, channel.id);
      break;
    default:
      await interaction.followUp({
        ephemeral: true,
        content: 'Unknown subcommand.',
      });
    }
  },
};

async function handleSetPing(
  client: Client,
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<void> {
  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);
  if (!thisSubscription) {
    await interaction.followUp({
      ephemeral: true,
      content: 'No subscription found in channel. Use /init to start.',
    });
    return;
  }

  if (!thisSubscription.WandererSettings) {
    await interaction.followUp({
      ephemeral: true,
      content: 'Wanderer is not configured on this channel.',
    });
    return;
  }

  const role = interaction.options.getRole('role', true);
  thisSubscription.PauseForChanges = true;
  thisSubscription.WandererSettings.PingRole = role.id;

  const chan = await ensureChannelAvailable(interaction);
  if (chan) {
    const message = await getConfigMessage(chan);
    if (message) {
      await message.edit(generateConfigMessage(thisSubscription));
      await updateChannel(client, channelId, interaction.guild?.name ?? '');
    }
  }

  thisSubscription.PauseForChanges = false;

  await interaction.followUp({
    ephemeral: true,
    content: `✅ Set Wanderer ping role to ${role.name} for this channel.`,
  });
}

async function handleToggleSpaceFilter(
  client: Client,
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<void> {
  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);
  if (!thisSubscription) {
    await interaction.followUp({
      ephemeral: true,
      content: 'No subscription found in channel. Use /init to start.',
    });
    return;
  }

  if (!thisSubscription.WandererSettings) {
    await interaction.followUp({
      ephemeral: true,
      content: 'Wanderer is not configured on this channel.',
    });
    return;
  }

  const type = interaction.options.getString(NAME_TYPE, true);

  thisSubscription.PauseForChanges = true;

  const ws = thisSubscription.WandererSettings;

  // ensure SpaceTypes exists on WandererSettings
  ws.SpaceTypes ??= new Set<SpaceType>();
  const response = 'On Map: ' + setSpaceTypeFilter(ws.SpaceTypes, type);

  const chan = await ensureChannelAvailable(interaction);
  if (chan) {
    const message = await getConfigMessage(chan);
    if (message) {
      await message.edit(generateConfigMessage(thisSubscription));
      await updateChannel(client, channelId, interaction.guild?.name ?? '');
    }
  }

  thisSubscription.PauseForChanges = false;

  await interaction.followUp({
    ephemeral: true,
    content: response,
  });
}

async function handleRestart(
  client: Client,
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<void> {
  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);
  if (!thisSubscription?.WandererSettings) {
    await interaction.followUp({
      ephemeral: true,
      content: 'Wanderer is not configured on this channel.',
    });
    return;
  }

  // If already connected, inform user
  const already = isWandererConnected(channelId);
  if (already) {
    await interaction.followUp({
      ephemeral: true,
      content: 'Wanderer stream is already connected for this channel.',
    });
    return;
  }

  const restarted = await restartWandererMap(channelId);
  if (restarted) {
    await interaction.followUp({
      ephemeral: true,
      content:
        'Attempting to restart Wanderer stream. Check channel for status messages.',
    });
  }
  else {
    await interaction.followUp({
      ephemeral: true,
      content:
        'Wanderer stream could not be restarted. Ensure the map is configured.',
    });
  }
}

async function handleRefresh(
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<void> {
  try {
    const refreshed = await refreshWandererMap(channelId);
    await interaction.followUp({
      ephemeral: true,
      content:
        `✅ Refreshed Wanderer map \`${refreshed.mapPath}\`: `
        + `${refreshed.systemCount} systems and `
        + `${refreshed.connectionCount} connections loaded.`,
    });
  }
  catch (error) {
    await interaction.followUp({
      ephemeral: true,
      content:
        '❌ Failed to refresh Wanderer map: '
        + (error instanceof Error ? error.message : String(error)),
    });
  }
}

async function handleConnect(
  client: Client,
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<void> {
  const mapUrl = interaction.options.getString('map_url', true).trim();
  const apiKey = interaction.options.getString('api_key', true).trim();

  try {
    const connection = await connectWandererMap({
      channelId,
      mapUrl,
      apiKey,
    });

    // Persist connection metadata into the channel's subscription message
    const thisSubscription =
      Config.getInstance().allSubscriptions.get(channelId);
    if (thisSubscription) {
      thisSubscription.PauseForChanges = true;
      thisSubscription.WandererSettings
        ??= {
          Slug: '',
          EncryptedDetails: '',
          Domain: '',
          ExcludeSystemIDs: new Set<string>(),
          SpaceTypes: new Set<SpaceType>(),
        };

      const wsRef = thisSubscription.WandererSettings;
      wsRef.Slug = connection.slug || '';
      wsRef.EncryptedDetails = connection.EncryptedDetails || '';
      wsRef.Domain = connection.domain;
      wsRef.createdAt = connection.createdAt;

      const chan = await ensureChannelAvailable(interaction);
      if (chan) {
        const message = await getConfigMessage(chan);
        if (message) {
          await message.edit(generateConfigMessage(thisSubscription));
          await updateChannel(client, channelId, interaction.guild?.name ?? '');
        }
      }

      thisSubscription.PauseForChanges = false;
    }

    await interaction.followUp({
      ephemeral: true,
      content:
        `✅ Wanderer connected for map \`${connection.slug}\`.\n`
        + `This channel will now receive mapped killmails.`,
    });
  }
  catch (error) {
    await interaction.followUp({
      ephemeral: true,
      content:
        '❌ Failed to connect Wanderer: '
        + (error instanceof Error ? error.message : String(error)),
    });
  }
}

async function handleDisconnect(
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<void> {
  await disconnectWandererMap(channelId);

  // Remove WandererSettings from the channel's subscription and update pinned message
  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);
  if (thisSubscription?.WandererSettings) {
    thisSubscription.PauseForChanges = true;
    delete thisSubscription.WandererSettings;
    const chan = await ensureChannelAvailable(interaction);
    if (chan) {
      const message = await getConfigMessage(chan);
      if (message) {
        await message.edit(generateConfigMessage(thisSubscription));
        await updateChannel(
          interaction.client,
          channelId,
          interaction.guild?.name ?? ''
        );
      }
    }
    thisSubscription.PauseForChanges = false;
  }

  await interaction.followUp({
    ephemeral: true,
    content: `✅ Wanderer disconnected. This channel will now use its normal kill filters again.`,
  });
}

async function handleStatus(
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<void> {
  const sub = Config.getInstance().allSubscriptions.get(channelId);
  const ws = sub?.WandererSettings;

  if (!ws?.Slug || !ws.Domain) {
    await interaction.followUp({
      ephemeral: true,
      content:
        'This channel has no Wanderer integration. Use `/wanderer connect` to set one up.',
    });
    return;
  }
  const mapPath = ws.Domain + '/' + ws.Slug;
  const systemCount = getWandererSystemCount(mapPath);
  const state = getWandererConnectionState(channelId);
  const connectionStatus = state
    ? state.connected
      ? 'Connected'
      : state.terminatedEarly
        ? 'Disconnected (terminated early)'
        : 'Disconnected'
    : 'Unknown';

  await interaction.followUp({
    ephemeral: true,
    content:
      `**Wanderer Integration Active**\n`
      + `**Map Slug:** \`${ws.Slug}\`\n`
      + `**Tracked systems:** ${systemCount}\n`
      + `**Excluded systems:** ${ws.ExcludeSystemIDs && ws.ExcludeSystemIDs.size ? [...ws.ExcludeSystemIDs].join(', ') : 'none'}\n`
      + `**OnMap Space Types:** ${ws.SpaceTypes && ws.SpaceTypes.size ? [...ws.SpaceTypes].map((s) => SPACE_TYPE_LABELS[s]).join(', ') : 'all'}\n`
      + `**First connected:** ${ws.createdAt ? new Date(ws.createdAt).toUTCString() : 'unknown'}\n`
      + `**Connection status:** ${connectionStatus}\n`
      + `**Start attempted:** ${state?.started ? 'Yes' : 'No'}`,
  });
}

async function handleExclude(
  client: Client,
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<void> {
  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);
  if (!thisSubscription) {
    await interaction.followUp({
      ephemeral: true,
      content: 'No subscription found in channel. Use /init to start.',
    });
    return;
  }

  if (!thisSubscription?.WandererSettings) {
    await interaction.followUp({
      ephemeral: true,
      content: 'Wanderer is not configured on this channel.',
    });
    return;
  }

  const systemNameOrId = interaction.options.getString('system', true).trim();
  const wsRef = thisSubscription.WandererSettings;

  // If this was already stored as an ID string, check that first
  if (wsRef.ExcludeSystemIDs.has(systemNameOrId)) {
    await interaction.followUp({
      ephemeral: true,
      content: `System ${systemNameOrId} is already excluded.`,
    });
    return;
  }

  thisSubscription.PauseForChanges = true;

  // Add either the numeric ID (if provided) or resolve the name to an ID
  const numeric = Number(systemNameOrId);
  if (Number.isNaN(numeric)) {
    // resolve via ESI
    const ids = await fetchESIIDs([systemNameOrId]);
    if (!ids?.systems?.[0]) {
      thisSubscription.PauseForChanges = false;
      await interaction.followUp({
        ephemeral: true,
        content: `❌ Could not resolve system name '${systemNameOrId}' to an ESI ID.`,
      });
      return;
    }
    // add all matched systems as IDs (usually one)
    ids.systems.forEach((s) => wsRef.ExcludeSystemIDs.add(String(s.id)));
  }
  else {
    wsRef.ExcludeSystemIDs.add(String(numeric));
  }

  {
    const chan = await ensureChannelAvailable(interaction);
    if (chan) {
      const message = await getConfigMessage(chan);
      if (message) {
        await message.edit(generateConfigMessage(thisSubscription));
        await updateChannel(client, channelId, interaction.guild?.name ?? '');
      }
    }
  }

  thisSubscription.PauseForChanges = false;

  await interaction.followUp({
    ephemeral: true,
    content: `Excluded system ${systemNameOrId} for this channel.`,
  });
}

async function handleUnexclude(
  client: Client,
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<void> {
  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);

  if (!thisSubscription) {
    await interaction.followUp({
      ephemeral: true,
      content: `KillFeed is not configured on this channel.\nUse /init to begin.`,
    });
    return;
  }

  if (!thisSubscription?.WandererSettings) {
    await interaction.followUp({
      ephemeral: true,
      content: 'Wanderer is not configured on this channel.',
    });
    return;
  }

  const systemNameOrId = interaction.options.getString('system', true).trim();
  thisSubscription.PauseForChanges = true;

  // If user provided numeric ID, delete that; otherwise resolve name(s) and delete IDs
  const numeric = Number(systemNameOrId);
  if (Number.isNaN(numeric)) {
    const ids = await fetchESIIDs([systemNameOrId]);
    if (!ids?.systems?.[0]) {
      thisSubscription.PauseForChanges = false;
      await interaction.followUp({
        ephemeral: true,
        content: `❌ Could not resolve system name '${systemNameOrId}' to an ESI ID.`,
      });
      return;
    }
    ids.systems.forEach((s) =>
      thisSubscription.WandererSettings?.ExcludeSystemIDs.delete(String(s.id))
    );
  }
  else {
    thisSubscription.WandererSettings.ExcludeSystemIDs.delete(systemNameOrId);
  }

  const chan = await ensureChannelAvailable(interaction);
  if (chan) {
    const message = await getConfigMessage(chan);
    if (message) {
      await message.edit(generateConfigMessage(thisSubscription));
      await updateChannel(client, channelId, interaction.guild?.name ?? '');
    }
    else {
      await interaction.followUp({
        ephemeral: true,
        content: `Found no pinned configuration message.\nUse /init to begin.`,
      });
    }
  }

  thisSubscription.PauseForChanges = false;

  await interaction.followUp({
    ephemeral: true,
    content: `Removed exclusion ${systemNameOrId} for this channel.`,
  });
}

async function handleListExcludes(
  client: Client,
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<void> {
  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);

  if (!thisSubscription) {
    await interaction.followUp({
      ephemeral: true,
      content: `KillFeed is not configured on this channel.\nUse /init to begin.`,
    });
    return;
  }

  if (!thisSubscription?.WandererSettings) {
    await interaction.followUp({
      ephemeral: true,
      content: 'Wanderer not configured for this channel.',
    });
    return;
  }

  const ids = Array.from(
    thisSubscription.WandererSettings.ExcludeSystemIDs || []
  );

  const resolved = await Promise.all(
    ids.map(async (idStr) => {
      const id = Number(idStr);
      if (Number.isNaN(id)) return idStr;
      try {
        const sys = await CachedESI.getSystem(id);
        return sys?.name ?? idStr;
      }
      catch {
        return idStr;
      }
    })
  );

  await interaction.followUp({
    ephemeral: true,
    content: ids.length
      ? `Excluded systems:\n${resolved.join('\n')}`
      : 'No excluded systems.',
  });
}
