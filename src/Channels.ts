import type { Client, TextChannel } from 'discord.js';
import type { SubscriptionSettings } from './Config';
import { Config } from './Config';
import { canUseChannel, getConfigMessage } from './helpers/DiscordHelper';
import {
  addListener,
  parseConfigMessage,
  removeListener,
} from './helpers/KillFeedHelpers';
import type { SpaceType } from './helpers/SpaceTypeHelpers';
import { savedData } from './Bot';
import { LOGGER } from './helpers/Logger';

export async function updateChannel(
  client: Client<boolean>,
  channelId: string,
  guildName: string
) {
  const channel = await client.channels.fetch(channelId, { cache: true });
  // If this is a purely text based channel that we can use
  if (canUseChannel(channel)) {
    LOGGER.info(`Server ${guildName}: Found a channel '${channel.name}'`);
    savedData.stats.ChannelCount++;

    let thisSubscription = Config.getInstance().allSubscriptions.get(
      channel.id
    );
    if (thisSubscription !== undefined) {
      // upgrade the config if necessary
      thisSubscription.SpaceTypes ??= new Set<SpaceType>();

      // If we already had a config loaded for this channel
      LOGGER.debug(`Clearing channel ${channel.name}`);
      // we need to clear this channel out of the all listeners
      clearChannel(thisSubscription, channel);
      if (savedData.stats.ConfigCount > 0) {
        savedData.stats.ConfigCount--;
      }
    }

    // fetch the config message
    const message = await getConfigMessage(channel);
    if (message) {
      LOGGER.debug(`Found config message in channel ${channel.name}`);
      // found a pinned message in this channel
      // rework config for this channel
      thisSubscription = parseConfigMessage(message.content, channel);

      // Ensure WandererSettings.ExcludeSystemIDs exists (no legacy handling)
      try {
        if (
          thisSubscription?.WandererSettings
          && !thisSubscription.WandererSettings.ExcludeSystemIDs
        ) {
          thisSubscription.WandererSettings.ExcludeSystemIDs =
            new Set<string>();
        }
      }
      catch (err) {
        LOGGER.debug(`Error initializing Wanderer exclusions: ${err}`);
      }

      const config = Config.getInstance();
      config.allSubscriptions.set(channel.id, thisSubscription);
      savedData.stats.ConfigCount++;

      thisSubscription.Alliances.forEach((id) => {
        addListener(config.matchedAlliances, id, channel.id);
      });

      thisSubscription.Corporations.forEach((id) => {
        addListener(config.matchedCorporations, id, channel.id);
      });

      thisSubscription.Characters.forEach((id) => {
        addListener(config.matchedCharacters, id, channel.id);
      });

      thisSubscription.Ships.forEach((id) => {
        addListener(config.matchedShips, id, channel.id);
      });

      thisSubscription.Regions.forEach((id) => {
        addListener(config.matchedRegions, id, channel.id);
      });

      thisSubscription.Constellations.forEach((id) => {
        addListener(config.matchedConstellations, id, channel.id);
      });

      thisSubscription.Systems.forEach((id) => {
        addListener(config.matchedSystems, id, channel.id);
      });

      thisSubscription.SpaceTypes.forEach((spaceType) => {
        addListener(config.matchedSpaceTypes, spaceType, channel.id);
      });
    }
    else {
      LOGGER.debug(`No config message found in channel ${channel.name}`);
    }
  }
}

// Go through all listeners registered to this channel
// and remove that registration
export function clearChannel(
  subscription: SubscriptionSettings,
  channel: TextChannel
) {
  const config = Config.getInstance();
  subscription.Alliances.forEach((allianceId) => {
    if (removeListener(config.matchedAlliances, allianceId, channel.id)) {
      LOGGER.info(`Deleted alliance ${allianceId} from server ${channel.id}`);
    }
  });
  subscription.Corporations.forEach((allianceId) => {
    if (removeListener(config.matchedCorporations, allianceId, channel.id)) {
      LOGGER.info(
        `Deleted corporation ${allianceId} from server ${channel.id}`
      );
    }
  });
  subscription.Characters.forEach((allianceId) => {
    if (removeListener(config.matchedCharacters, allianceId, channel.id)) {
      LOGGER.info(`Deleted character ${allianceId} from server ${channel.id}`);
    }
  });
  subscription.Ships.forEach((shipId) => {
    if (removeListener(config.matchedShips, shipId, channel.id)) {
      LOGGER.info(`Deleted ship ${shipId} from server ${channel.id}`);
    }
  });
  subscription.Regions.forEach((regionId) => {
    if (removeListener(config.matchedRegions, regionId, channel.id)) {
      LOGGER.info(`Deleted region ${regionId} from server ${channel.id}`);
    }
  });
  subscription.Constellations.forEach((constellationId) => {
    if (
      removeListener(config.matchedConstellations, constellationId, channel.id)
    ) {
      LOGGER.info(
        `Deleted constellation ${constellationId} from server ${channel.id}`
      );
    }
  });
  subscription.Systems.forEach((systemId) => {
    if (removeListener(config.matchedSystems, systemId, channel.id)) {
      LOGGER.info(`Deleted system ${systemId} from server ${channel.id}`);
    }
  });

  for (const spaceType of config.matchedSpaceTypes.keys()) {
    if (removeListener(config.matchedSpaceTypes, spaceType, channel.id)) {
      LOGGER.info(`Deleted space type ${spaceType} from server ${channel.id}`);
    }
  }
}
