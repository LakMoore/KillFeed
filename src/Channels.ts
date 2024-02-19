import { Client, TextChannel } from "discord.js";
import { SubscriptionSettings, Config } from "./Config";
import { canUseChannel, getConfigMessage } from "./helpers/DiscordHelper";
import { addListener, parseConfigMessage } from "./helpers/KillFeedHelpers";
import { savedData } from "./Bot";
import { DEV_ROLE, ERROR_CHANNEL, LOGGER, OUR_GUILD } from "./helpers/Logger";

export async function updateChannel(
  client: Client<boolean>,
  channelId: string,
  guildName: string
) {
  const channel = await client.channels.fetch(channelId, { cache: true });
  // If this is a purely text based channel that we can use
  if (canUseChannel(channel)) {
    LOGGER.info(`Server ${guildName}: Found a channel '${channel.name}'`);

    if (OUR_GUILD == guildName && ERROR_CHANNEL == channel.name) {
      // this is the KillFeed Errors channel
      LOGGER.debug(`Server ${guildName}: Found our channel '${channel.name}'`);
      LOGGER.setErrorChannel(channel);

      const devRole = channel.guild.roles.cache.find(
        (r) => r.name === DEV_ROLE
      );
      if (devRole) {
        LOGGER.setDevRole(devRole.id);
      }
    }

    let thisSubscription = Config.getInstance().allSubscriptions.get(
      channel.id
    );
    if (thisSubscription !== undefined) {
      // If we already had a config loaded for this channel
      // we need to clear this channel out of the all listeners
      clearChannel(thisSubscription, channel);
      if (savedData.stats.ChannelCount > 0) {
        savedData.stats.ChannelCount--;
      }
    }

    // fetch the config message
    const message = await getConfigMessage(channel);
    if (message) {
      // found a pinned message in this channel
      // rework config for this channel
      thisSubscription = parseConfigMessage(message.content, channel);

      Config.getInstance().allSubscriptions.set(channel.id, thisSubscription);
      savedData.stats.ChannelCount++;

      thisSubscription.Alliances.forEach((id) => {
        addListener(Config.getInstance().matchedAlliances, id, channel.id);
      });

      thisSubscription.Corporations.forEach((id) => {
        addListener(Config.getInstance().matchedCorporations, id, channel.id);
      });

      thisSubscription.Characters.forEach((id) => {
        addListener(Config.getInstance().matchedCharacters, id, channel.id);
      });

      thisSubscription.Ships.forEach((id) => {
        addListener(Config.getInstance().matchedShips, id, channel.id);
      });

      thisSubscription.Regions.forEach((id) => {
        addListener(Config.getInstance().matchedRegions, id, channel.id);
      });
    }
  }
}

// Go through all listeners registered to this channel
// and remove that registration
export function clearChannel(
  subscription: SubscriptionSettings,
  channel: TextChannel
) {
  subscription.Alliances.forEach((allianceId) => {
    Config.getInstance().matchedAlliances.get(allianceId)?.delete(channel.id);
    LOGGER.debug(`Deleted alliance ${allianceId} from server ${channel.id}`);
  });
  subscription.Corporations.forEach((allianceId) => {
    Config.getInstance()
      .matchedCorporations.get(allianceId)
      ?.delete(channel.id);
    LOGGER.debug(`Deleted corporation ${allianceId} from server ${channel.id}`);
  });
  subscription.Characters.forEach((allianceId) => {
    Config.getInstance().matchedCharacters.get(allianceId)?.delete(channel.id);
    LOGGER.debug(`Deleted character ${allianceId} from server ${channel.id}`);
  });
  subscription.Ships.forEach((shipId) => {
    Config.getInstance().matchedShips.get(shipId)?.delete(channel.id);
    LOGGER.debug(`Deleted ship ${shipId} from server ${channel.id}`);
  });
  subscription.Regions.forEach((regionId) => {
    Config.getInstance().matchedRegions.get(regionId)?.delete(channel.id);
    LOGGER.debug(`Deleted region ${regionId} from server ${channel.id}`);
  });
}
