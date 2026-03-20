import axios from "axios";
import { Client, DiscordAPIError, PermissionsBitField } from "discord.js";
import { Config } from "../Config";
import { InsightWithAppraisalFormat } from "../feedformats/InsightWithAppraisalFormat";
import {
  canUseChannel,
  checkChannelPermissions,
} from "../helpers/DiscordHelper";
import {
  KillMail,
  R2Z2KillmailPayload,
  R2Z2Sequence,
  ZkbOnly,
} from "./zKillboard";
import { ZKMailType } from "../feedformats/Fomat";
import { getJaniceAppraisalValue } from "../Janice/Janice";
import { CachedESI } from "../esi/cache";
import { LOGGER, msToTimeSpan } from "../helpers/Logger";
import { savedData } from "../Bot";
import { TYPE_KILLS, TYPE_LOSSES } from "../commands/show";
import { sleep } from "../listeners/ready";
import https from "node:https";

const R2Z2_BASE_URL = "https://r2z2.zkillboard.com/ephemeral";
const R2Z2_SEQUENCE_DELAY_MS = 100;
const R2Z2_NO_NEW_DATA_DELAY_MS = 6000;
const R2Z2_RATE_LIMIT_DELAY_MS = 5000;
const R2Z2_FORBIDDEN_DELAY_MS = 60000;
const R2Z2_ERROR_DELAY_MS = 10000;
const DEDUPE_CACHE_MAX = 10000;
const seenKillmailIds = new Map<number, number>();

let nextSequenceId: number | null = null;

function rememberKillmail(killmailId: number) {
  seenKillmailIds.set(killmailId, Date.now());
  while (seenKillmailIds.size > DEDUPE_CACHE_MAX) {
    const oldest = seenKillmailIds.keys().next();
    if (oldest.done) {
      break;
    }
    seenKillmailIds.delete(oldest.value);
  }
}

function hasSeenKillmail(killmailId: number): boolean {
  return seenKillmailIds.has(killmailId);
}

async function getLatestSequence(localAgent?: https.Agent) {
  const { data } = await axios.get<R2Z2Sequence>(
    `${R2Z2_BASE_URL}/sequence.json`,
    {
      httpsAgent: localAgent,
    },
  );
  return data.sequence;
}

async function getSequencePayload(sequence: number, localAgent?: https.Agent) {
  const { data } = await axios.get<R2Z2KillmailPayload>(
    `${R2Z2_BASE_URL}/${sequence}.json`,
    {
      "axios-retry": {
        retries: 0,
      },
      httpsAgent: localAgent,
    },
  );
  return data;
}

export async function pollzKillboardOnce(client: Client) {
  savedData.stats.PollCount++;

  const localAgent = process.env.OUTBOUND_IP
    ? new https.Agent({
        localAddress: process.env.OUTBOUND_IP,
        family: 4,
      })
    : undefined;

  try {
    if (nextSequenceId === null) {
      if (savedData.stats.LastSequenceId > 0) {
        nextSequenceId = savedData.stats.LastSequenceId + 1;
        LOGGER.warning(`Resuming sequence stream from ${nextSequenceId}`);
      } else {
        nextSequenceId = await getLatestSequence(localAgent);
        LOGGER.warning(
          `Starting sequence stream from latest sequence ${nextSequenceId}`,
        );
      }
    }

    const payload = await getSequencePayload(nextSequenceId, localAgent);

    if (hasSeenKillmail(payload.killmail_id)) {
      LOGGER.debug(
        `Skipping duplicate killmail ${payload.killmail_id} from sequence ${payload.sequence_id}`,
      );
    } else {
      savedData.stats.KillMailCount++;
      await prepAndSend(client, payload.esi, {
        killmail_id: payload.killmail_id,
        zkb: payload.zkb,
      });
      rememberKillmail(payload.killmail_id);
    }

    savedData.stats.LastSequenceId = payload.sequence_id;
    savedData.stats.LastSequenceSeenAt = new Date(payload.uploaded_at * 1000);
    nextSequenceId = payload.sequence_id + 1;

    await sleep(R2Z2_SEQUENCE_DELAY_MS);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      if (nextSequenceId !== null) {
        try {
          const latestSequence = await getLatestSequence(localAgent);
          if (latestSequence > nextSequenceId) {
            LOGGER.warning(
              `Sequence ${nextSequenceId} no longer available. Fast-forwarding to ${latestSequence}`,
            );
            nextSequenceId = latestSequence;
          }
        } catch (sequenceError) {
          LOGGER.error(
            "Error fetching latest sequence after 404\n" + sequenceError,
          );
        }
      }

      await sleep(R2Z2_NO_NEW_DATA_DELAY_MS);
      return;
    }

    if (axios.isAxiosError(error) && error.response?.status === 429) {
      LOGGER.warning(
        "Rate limited by R2Z2 (429). Backing off before retrying.",
      );
      await sleep(R2Z2_RATE_LIMIT_DELAY_MS);
      return;
    }

    if (axios.isAxiosError(error) && error.response?.status === 403) {
      LOGGER.error(
        "Access forbidden by R2Z2 (403). Backing off before retrying.",
      );
      await sleep(R2Z2_FORBIDDEN_DELAY_MS);
      return;
    }

    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status >= 500 && error.response.status < 600) {
        // no ping for server-side errors
        LOGGER.warning(
          `AxiosError\n${error.response?.status}\n${error.response?.statusText}\n${error.config?.url}`,
        );
      } else {
        LOGGER.error(
          `AxiosError\n${error.response?.status}\n${error.response?.statusText}\n${error.config?.url}`,
        );
      }
    } else {
      LOGGER.error("Error fetching from zKillboard\n" + error);
    }

    // if there was an error then take a break
    await sleep(R2Z2_ERROR_DELAY_MS);
  }
}

export async function getOneZKill(killmailId: string) {
  if (!killmailId) {
    return null;
  }

  const { data } = await axios.get<ZkbOnly[]>(
    `https://zkillboard.com/api/killID/${killmailId}/`,
  );

  return data[0];
}

export async function prepAndSend(
  client: Client,
  killmail: KillMail,
  zkb: ZkbOnly,
) {
  try {
    LOGGER.info(
      `Kill ID: ${killmail.killmail_id} from ${
        killmail.killmail_time
      } (${msToTimeSpan(
        Date.now() - new Date(killmail.killmail_time).getTime(),
      )} ago)`,
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
        killmail.solar_system_id,
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
        `Error while fetching region from system ${killmail.solar_system_id}. ${error}`,
      );
    }

    // Handle Matched Constellations
    try {
      const constellation = await CachedESI.getConstellationForSystem(
        killmail.solar_system_id,
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
        `Error while fetching constellation from system ${killmail.solar_system_id}. ${error}`,
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
          matchedFilterTypes.has(filterType),
        );

        if (!allFiltersMatched) {
          channelsToRemove.push(channelId);
          LOGGER.debug(
            `Removing channel ${channelId} - RequireAllFilters enabled but not all filter types matched. ` +
              `Configured: [${configuredFilterTypes.join(
                ", ",
              )}], Matched: [${Array.from(matchedFilterTypes).join(", ")}]`,
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
      ...Array.from(lossmailChannelIDs).map((channelId) =>
        send(client, channelId, killmail, zkb, appraisalValue, ZKMailType.Loss),
      ),
      ...Array.from(killmailChannelIDs).map((channelId) =>
        send(client, channelId, killmail, zkb, appraisalValue, ZKMailType.Kill),
      ),
      ...Array.from(neutralmailChannelIDs).map((channelId) =>
        send(
          client,
          channelId,
          killmail,
          zkb,
          appraisalValue,
          ZKMailType.Neutral,
        ),
      ),
    ]);
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      LOGGER.error(
        `Discord Error while sending message [${error.code}]${error.message}`,
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
  type: ZKMailType,
) {
  const channel = client.channels.cache.find((c) => c.id === channelId);

  const thisSubscription = Config.getInstance().allSubscriptions.get(channelId);

  if (thisSubscription == undefined) {
    LOGGER.error(`No subscription found for ${channelId}`);
    return;
  }

  while (thisSubscription.PauseForChanges) {
    LOGGER.info(
      `Pausing for changes on ${thisSubscription.Channel.guild.name} : ${thisSubscription.Channel.name}`,
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
    appraisalValue,
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
      `Unable to send the ${ZKMailType[type]} mail on channel ${channelId}`,
    );
  }
}
