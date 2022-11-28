import { Client, TextChannel } from "discord.js";
import { ChannelSettings, Config } from "./Config";
import { canUseChannel, getConfigMessage } from "./helpers/DiscordHelper";
import { addMatcherEntry, parseConfigMessage } from "./helpers/KillFeedHelpers";

export async function updateChannel(
  client: Client<boolean>,
  channelId: string
) {
  const channel = await client.channels.fetch(channelId, { cache: true });
  // If this is a purely text based channel that we can use
  if (canUseChannel(channel)) {
    console.log("Found a channel: " + channel.name);
    let thisChannel = Config.getInstance().registeredChannels.get(channel.id);
    if (thisChannel !== undefined) {
      // If we already had a config loaded for this channel
      // we need to clear this channel out of the all listeners
      clearChannel(thisChannel, channel);
    }

    // fetch the config message
    const message = await getConfigMessage(channel);
    if (message) {
      // found a pinned message in this channel
      // rework config for this channel
      thisChannel = parseConfigMessage(message.content, channel);

      Config.getInstance().registeredChannels.set(channel.id, thisChannel);

      thisChannel.Alliances.forEach((id) => {
        addMatcherEntry(Config.getInstance().matchedAlliances, id, channel.id);
      });

      thisChannel.Corporations.forEach((id) => {
        addMatcherEntry(
          Config.getInstance().matchedCorporations,
          id,
          channel.id
        );
      });

      thisChannel.Characters.forEach((id) => {
        addMatcherEntry(Config.getInstance().matchedCharacters, id, channel.id);
      });

      thisChannel.Ships.forEach((id) => {
        addMatcherEntry(Config.getInstance().matchedShips, id, channel.id);
      });
    }
  }
}

// Go through all listeners registered to this channel
// and remove that registration
export function clearChannel(
  thisChannelConfig: ChannelSettings,
  channel: TextChannel
) {
  thisChannelConfig.Alliances.forEach((allianceId) => {
    Config.getInstance().matchedAlliances.get(allianceId)?.delete(channel.id);
    console.log(`Deleted alliance ${allianceId} from server ${channel.id}`);
  });
  thisChannelConfig.Corporations.forEach((allianceId) => {
    Config.getInstance()
      .matchedCorporations.get(allianceId)
      ?.delete(channel.id);
    console.log(`Deleted corporation ${allianceId} from server ${channel.id}`);
  });
  thisChannelConfig.Characters.forEach((allianceId) => {
    Config.getInstance().matchedCharacters.get(allianceId)?.delete(channel.id);
    console.log(`Deleted character ${allianceId} from server ${channel.id}`);
  });
  thisChannelConfig.Ships.forEach((shipId) => {
    Config.getInstance().matchedShips.get(shipId)?.delete(channel.id);
    console.log(`Deleted ship ${shipId} from server ${channel.id}`);
  });
}
