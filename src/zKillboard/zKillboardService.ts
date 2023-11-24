import axios from "axios";
import {
  Client,
  DiscordAPIError,
  MessageMentionOptions,
  PermissionsBitField,
} from "discord.js";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function pollzKillboardOnce(client: Client) {
  try {
    // zKillboard could return immediately or could make us wait up to 10 seconds
    // don't need to use axios-retry as the queue is managed on the zk server
    const { data } = await axios.get<Package>(
      "https://redisq.zkillboard.com/listen.php?queueID=LakMooresKillFeed",
      {
        "axios-retry": {
          retries: 0,
        },
      }
    );

    // null and empty packages are normal, if there is no kill feed activity
    // in the last 10 seconds
    if (data?.package) {
      // We have a non-null response from zk
      await prepAndSend(client, data.package.killmail, {
        killmail_id: data.package.killID,
        zkb: data.package.zkb,
      });
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log(
        `AxiosError ${error.response?.status} ${error.response?.statusText} ${error.config?.url}`
      );
    } else {
      console.log("Error fetching from zKillboard");
      console.log(error);
    }

    // if there was an error then take a break
    await sleep(30000);
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
    console.log(`Kill ID: ${killmail.killmail_id}`);

    const lossmailChannelIDs = new Set<string>();
    const killmailChannelIDs = new Set<string>();
    const neutralmailChannelIDs = new Set<string>();

    Config.getInstance().testRequests.forEach((v) => {
      lossmailChannelIDs.add(v);
    });
    Config.getInstance().testRequests.clear();

    Array.from(Config.getInstance().allSubscriptions.values())
      .filter((chan) => chan.FullTest)
      .forEach((chan) => {
        lossmailChannelIDs.add(chan.Channel.id);
      });

    let temp = Config.getInstance().matchedAlliances.get(
      killmail.victim.alliance_id
    );
    temp?.forEach((v) => lossmailChannelIDs.add(v));
    temp = Config.getInstance().matchedCorporations.get(
      killmail.victim.corporation_id
    );
    temp?.forEach((v) => lossmailChannelIDs.add(v));
    temp = Config.getInstance().matchedCharacters.get(
      killmail.victim.character_id
    );
    temp?.forEach((v) => lossmailChannelIDs.add(v));
    //--
    temp = Config.getInstance().matchedShips.get(killmail.victim.ship_type_id);
    temp?.forEach((v) => lossmailChannelIDs.add(v));
    //--

    killmail.attackers.forEach((attacker) => {
      temp = Config.getInstance().matchedAlliances.get(attacker.alliance_id);
      temp?.forEach((v) => {
        if (!lossmailChannelIDs.has(v)) killmailChannelIDs.add(v);
      });
      temp = Config.getInstance().matchedCorporations.get(
        attacker.corporation_id
      );
      temp?.forEach((v) => {
        if (!lossmailChannelIDs.has(v)) killmailChannelIDs.add(v);
      });
      temp = Config.getInstance().matchedCharacters.get(attacker.character_id);
      temp?.forEach((v) => {
        if (!lossmailChannelIDs.has(v)) killmailChannelIDs.add(v);
      });
      temp = Config.getInstance().matchedShips.get(attacker.ship_type_id);
      temp?.forEach((v) => {
        if (!lossmailChannelIDs.has(v)) killmailChannelIDs.add(v);
      });
    });

    // Handle Matched Regions
    try {
      const region = await CachedESI.getRegionForSystem(
        killmail.solar_system_id
      );
      if (region) {
        temp = Config.getInstance().matchedRegions.get(region.region_id);

        // If we match on region and we haven't already matched on
        // anything else then the event is neither a kill nor a loss
        temp?.forEach((v) => {
          if (!lossmailChannelIDs.has(v) && !killmailChannelIDs.has(v)) {
            neutralmailChannelIDs.add(v);
          }
        });
      }
    } catch (error) {
      console.log(`Error while fetching region from system`, error);
    }

    const appraisalValue = await getJaniceAppraisalValue(killmail);

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
      console.log(
        `Discord Error while sending message [${error.code}]${error.message}`
      );
    } else {
      console.log("Error sending message");
      console.log(error);
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

  // check the minISK value filter
  let thisSubscription;

  while (thisSubscription == undefined || thisSubscription.PauseForChanges) {
    thisSubscription = Config.getInstance().allSubscriptions.get(channelId);
    if (thisSubscription?.PauseForChanges) {
      console.log("Pausing for changes");
      await sleep(1000);
    }
  }

  if (zkb.zkb.totalValue <= (thisSubscription?.MinISK ?? 0)) {
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
    // send the message
    return channel.send(msg);
  } else {
    console.log(
      `Unable to send the ${ZKMailType[type]} mail on channel ${channelId}`
    );
  }
}
