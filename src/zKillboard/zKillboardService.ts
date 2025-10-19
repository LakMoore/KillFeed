import axios from "axios";
import { Client, DiscordAPIError, PermissionsBitField } from "discord.js";
import { Config } from "../Config";
import { EmbeddedFormat } from "../feedformats/EmbeddedFormat";
import { InsightFormat } from "../feedformats/InsightFormat";
import { InsightWithAppraisalFormat } from "../feedformats/InsightWithAppraisalFormat";
import { ZKillLinkFormat } from "../feedformats/ZKillLinkFormat";
import {
  canUseChannel,
  checkChannelPermissions,
} from "../helpers/DiscordHelper";
import { KillMail, Package, ZkbOnly } from "./zKillboard";
import { ZKMailType } from "../feedformats/Fomat";
import { getJaniceAppraisalValue } from "../Janice/Janice";
import { CachedESI } from "../esi/cache";
import { LOGGER, msToTimeSpan } from "../helpers/Logger";
import { savedData } from "../Bot";
import { TYPE_KILLS, TYPE_LOSSES } from "../commands/show";
import { sleep } from "../listeners/ready";

export async function pollzKillboardOnce(client: Client) {
  try {
    savedData.stats.PollCount++;

    // zKillboard could return immediately or could make us wait up to 10 seconds
    // don't need to use axios-retry as the queue is managed on the zk server
    const { data } = await axios.get<Package>(
      `https://zkillredisq.stream/listen.php?queueID=${
        process.env.QUEUE_ID ?? "NoQueueIDProvided"
      }`,
      {
        "axios-retry": {
          retries: 0,
        },
      }
    );

    // null and empty packages are normal, if there is no kill feed activity
    // in the last 10 seconds
    if (data?.package) {
      savedData.stats.KillMailCount++;
      // We have a non-null response from zk
      await prepAndSend(client, data.package.killmail, {
        killmail_id: data.package.killID,
        zkb: data.package.zkb,
      });
    } else {
      // No killmails
      await sleep(2000); // sleep for a couple of seconds to save spamming zKillboard during quiet times
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status >= 500 && error.response.status < 600) {
        // no ping for server-side errors
        LOGGER.warning(
          `AxiosError\n${error.response?.status}\n${error.response?.statusText}\n${error.config?.url}`
        );
      } else {
        LOGGER.error(
          `AxiosError\n${error.response?.status}\n${error.response?.statusText}\n${error.config?.url}`
        );
      }
    } else {
      LOGGER.error("Error fetching from zKillboard\n" + error);
    }

    // if there was an error then take a break
    await sleep(10000);
  }
}

export async function getOneZKill(killmailId: string) {
  if (!killmailId) {
    return null;
  }

  const { data } = await axios.get<ZkbOnly[]>(
    `https://zkillboard.com/api/killID/${killmailId}/`
  );

  return data[0];
}

export async function prepAndSend(
  client: Client,
  killmail: KillMail,
  zkb: ZkbOnly
) {
  try {
    LOGGER.info(
      `Kill ID: ${killmail.killmail_id} from ${
        killmail.killmail_time
      } (${msToTimeSpan(
        Date.now() - new Date(killmail.killmail_time).getTime()
      )} ago)`
    );

    const lossmailChannelIDs = new Set<string>();
    const killmailChannelIDs = new Set<string>();
    const neutralmailChannelIDs = new Set<string>();

    // For AND filter logic: track which filter types matched for each channel
    const channelMatchedFilters = new Map<string, Set<string>>();

    const trackMatch = (channelId: string, filterType: string) => {
      if (!channelMatchedFilters.has(channelId)) {
        channelMatchedFilters.set(channelId, new Set());
      }
      channelMatchedFilters.get(channelId)!.add(filterType);
    };

    const config = Config.getInstance();

    config.matchedAlliances.get(killmail.victim.alliance_id)?.forEach((v) => {
      lossmailChannelIDs.add(v);
      trackMatch(v, "Alliances");
    });

    config.matchedCorporations
      .get(killmail.victim.corporation_id)
      ?.forEach((v) => {
        lossmailChannelIDs.add(v);
        trackMatch(v, "Corporations");
      });

    config.matchedCharacters.get(killmail.victim.character_id)?.forEach((v) => {
      lossmailChannelIDs.add(v);
      trackMatch(v, "Characters");
    });

    config.matchedShips.get(killmail.victim.ship_type_id)?.forEach((v) => {
      lossmailChannelIDs.add(v);
      trackMatch(v, "Ships");
    });

    killmail.attackers.forEach((attacker) => {
      config.matchedAlliances.get(attacker.alliance_id)?.forEach((v) => {
        if (!lossmailChannelIDs.has(v)) {
          killmailChannelIDs.add(v);
          trackMatch(v, "Alliances");
        }
      });
      config.matchedCorporations.get(attacker.corporation_id)?.forEach((v) => {
        if (!lossmailChannelIDs.has(v)) {
          killmailChannelIDs.add(v);
          trackMatch(v, "Corporations");
        }
      });
      config.matchedCharacters.get(attacker.character_id)?.forEach((v) => {
        if (!lossmailChannelIDs.has(v)) {
          killmailChannelIDs.add(v);
          trackMatch(v, "Characters");
        }
      });
      config.matchedShips.get(attacker.ship_type_id)?.forEach((v) => {
        if (!lossmailChannelIDs.has(v)) {
          killmailChannelIDs.add(v);
          trackMatch(v, "Ships");
        }
      });
    });

    // Handle Matched System
    // If we match on system and we haven't already matched on
    // anything else then the event is neither a kill nor a loss
    config.matchedSystems.get(killmail.solar_system_id)?.forEach((v) => {
      if (!lossmailChannelIDs.has(v) && !killmailChannelIDs.has(v)) {
        neutralmailChannelIDs.add(v);
      }
      trackMatch(v, "Systems");
    });

    // Handle Matched Regions
    try {
      const region = await CachedESI.getRegionForSystem(
        killmail.solar_system_id
      );
      if (region) {
        // If we match on region and we haven't already matched on
        // anything else then the event is neither a kill nor a loss
        config.matchedRegions.get(region.region_id)?.forEach((v) => {
          if (!lossmailChannelIDs.has(v) && !killmailChannelIDs.has(v)) {
            neutralmailChannelIDs.add(v);
          }
          trackMatch(v, "Regions");
        });
      }
    } catch (error) {
      LOGGER.error(
        `Error while fetching region from system ${killmail.solar_system_id}. ${error}`
      );
    }

    // Handle Matched Constellations
    try {
      const constellation = await CachedESI.getConstellationForSystem(
        killmail.solar_system_id
      );
      if (constellation) {
        config.matchedConstellations
          .get(constellation.constellation_id)
          ?.forEach((v) => {
            if (!lossmailChannelIDs.has(v) && !killmailChannelIDs.has(v)) {
              neutralmailChannelIDs.add(v);
            }
            trackMatch(v, "Constellations");
          });
      }
    } catch (error) {
      LOGGER.error(
        `Error while fetching constellation from system ${killmail.solar_system_id}. ${error}`
      );
    }

    // TESTS

    config.testRequests.forEach((v) => {
      if (!lossmailChannelIDs.has(v) && !killmailChannelIDs.has(v)) {
        neutralmailChannelIDs.add(v);
      }
    });
    config.testRequests.clear();

    Array.from(config.allSubscriptions.values())
      .filter((chan) => chan.FullTest)
      .forEach((chan) => {
        if (
          !lossmailChannelIDs.has(chan.Channel.id) &&
          !killmailChannelIDs.has(chan.Channel.id)
        ) {
          neutralmailChannelIDs.add(chan.Channel.id);
        }
      });

    // END TESTS

    // Apply AND filter logic: remove channels that don't match ALL configured filter types
    const applyAndFilterLogic = (channelIds: Set<string>) => {
      const channelsToRemove: string[] = [];

      channelIds.forEach((channelId) => {
        const subscription = config.allSubscriptions.get(channelId);

        // Skip if subscription not found or AND filtering not enabled
        if (!subscription || !subscription.RequireAllFilters) {
          return;
        }

        // Determine which filter types are configured (have at least one entry)
        const configuredFilterTypes: string[] = [];
        if (subscription.Alliances.size > 0)
          configuredFilterTypes.push("Alliances");
        if (subscription.Corporations.size > 0)
          configuredFilterTypes.push("Corporations");
        if (subscription.Characters.size > 0)
          configuredFilterTypes.push("Characters");
        if (subscription.Ships.size > 0) configuredFilterTypes.push("Ships");
        if (subscription.Regions.size > 0)
          configuredFilterTypes.push("Regions");
        if (subscription.Constellations.size > 0)
          configuredFilterTypes.push("Constellations");
        if (subscription.Systems.size > 0)
          configuredFilterTypes.push("Systems");

        // Skip if no filters configured
        if (configuredFilterTypes.length === 0) {
          return;
        }

        // Check if all configured filter types matched
        const matchedFilterTypes =
          channelMatchedFilters.get(channelId) || new Set();
        const allFiltersMatched = configuredFilterTypes.every((filterType) =>
          matchedFilterTypes.has(filterType)
        );

        if (!allFiltersMatched) {
          channelsToRemove.push(channelId);
          LOGGER.debug(
            `Removing channel ${channelId} - RequireAllFilters enabled but not all filter types matched. ` +
              `Configured: [${configuredFilterTypes.join(
                ", "
              )}], Matched: [${Array.from(matchedFilterTypes).join(", ")}]`
          );
        }
      });

      // Remove channels that didn't pass the AND filter
      channelsToRemove.forEach((channelId) => channelIds.delete(channelId));
    };

    applyAndFilterLogic(lossmailChannelIDs);
    applyAndFilterLogic(killmailChannelIDs);
    applyAndFilterLogic(neutralmailChannelIDs);

    const appraisalValue = await getJaniceAppraisalValue(killmail);

    savedData.stats.ISKAppraised += appraisalValue;

    await Promise.all([
      Array.from(lossmailChannelIDs).map((channelId) =>
        send(client, channelId, killmail, zkb, appraisalValue, ZKMailType.Loss)
      ),
      Array.from(killmailChannelIDs).map((channelId) =>
        send(client, channelId, killmail, zkb, appraisalValue, ZKMailType.Kill)
      ),
      Array.from(neutralmailChannelIDs).map((channelId) =>
        send(
          client,
          channelId,
          killmail,
          zkb,
          appraisalValue,
          ZKMailType.Neutral
        )
      ),
    ]);
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      LOGGER.error(
        `Discord Error while sending message [${error.code}]${error.message}`
      );
    } else {
      LOGGER.error("Error sending message. " + error);
    }
  }
}

async function send(
  client: Client,
  channelId: string,
  killmail: KillMail,
  zkb: ZkbOnly,
  appraisalValue: number,
  type: ZKMailType
) {
  const channel = client.channels.cache.find((c) => c.id === channelId);

  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);

  if (thisSubscription == undefined) {
    LOGGER.error(`No subscription found for ${channelId}`);
    return;
  }

  while (thisSubscription.PauseForChanges) {
    LOGGER.info(
      `Pausing for changes on ${thisSubscription.Channel.guild.name} : ${thisSubscription.Channel.name}`
    );
    await sleep(5000);
  }

  // check the minISK value filter
  if (zkb.zkb.totalValue <= (thisSubscription?.MinISK ?? 0)) {
    return;
  }

  // Don't send the mail if we don't want its type on this channel
  if (
    (thisSubscription.Show == TYPE_LOSSES && type != ZKMailType.Loss) ||
    (thisSubscription.Show == TYPE_KILLS && type != ZKMailType.Kill)
  ) {
    return;
  }

  // TODO: Look up the desired message format for this channel

  // Generate the message
  const msg = await InsightWithAppraisalFormat.getMessage(
    killmail,
    zkb,
    type,
    appraisalValue
  );

  // check if we have a role to ping
  if (thisSubscription?.RoleToPing) {
    msg.content = `<@&${thisSubscription.RoleToPing}>`;
    msg.allowedMentions = {
      roles: [thisSubscription.RoleToPing],
    };
  }

  if (
    canUseChannel(channel) &&
    checkChannelPermissions(channel, PermissionsBitField.Flags.SendMessages)
  ) {
    savedData.stats.PostedCount++;
    // send the message
    return channel.send(msg);
  } else {
    LOGGER.error(
      `Unable to send the ${ZKMailType[type]} mail on channel ${channelId}`
    );
  }
}
