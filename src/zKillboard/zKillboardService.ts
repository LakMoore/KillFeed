import axios from "axios";
import { Client, DiscordAPIError, PermissionsBitField } from "discord.js";
import { Config } from "../Config";
import { EmbeddedFormat } from "../feedformats/EmbeddedFormat";
import { InsightFormat } from "../feedformats/InsightFormat";
import { ZKillLinkFormat } from "../feedformats/ZKillLinkFormat";
import {
  canUseChannel,
  checkChannelPermissions,
} from "../helpers/DiscordHelper";
import { KillMail, Package, ZkbOnly } from "./zKillboard";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function pollzKillboardOnce(client: Client) {
  try {
    // zKillboard could return immediately or could make us wait up to 10 seconds
    // don't need to use axios-retry as the queue is managed on the zk server
    const { data } = await axios.get<Package>(
      "https://redisq.zkillboard.com/listen.php",
      {
        "axios-retry": {
          retries: 0,
        },
      }
    );

    // null and empty packages are normal, if there is no kill feed activity
    // in the last 10 seconds
    if (data && data.package) {
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

    Config.getInstance().testRequests.forEach((v) => {
      lossmailChannelIDs.add(v);
    });
    Config.getInstance().testRequests.clear();

    Array.from(Config.getInstance().registeredChannels.values())
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
    temp = Config.getInstance().matchedShips.get(killmail.victim.ship_type_id);
    temp?.forEach((v) => lossmailChannelIDs.add(v));

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

    for (const channelId of lossmailChannelIDs) {
      let channel = client.channels.cache.find((c) => c.id === channelId);

      // TODO: Look up the desired message format for this channel

      // Generate the message
      await InsightFormat.getMessage(killmail, zkb, false).then((msg) => {
        if (
          canUseChannel(channel) &&
          checkChannelPermissions(
            channel,
            PermissionsBitField.Flags.SendMessages
          )
        ) {
          // send the message
          return channel.send(msg);
        } else {
          console.log("Couldn't send lossmail on this channel");
        }
      });
    }

    for (const channelId of killmailChannelIDs) {
      let channel = client.channels.cache.find((c) => c.id === channelId);

      // TODO: Look up the desired message format for this channel

      // Generate the message
      await InsightFormat.getMessage(killmail, zkb, true).then((msg) => {
        if (
          canUseChannel(channel) &&
          checkChannelPermissions(
            channel,
            PermissionsBitField.Flags.SendMessages
          )
        ) {
          // send the message
          return channel.send(msg);
        } else {
          console.log("Couldn't send killmail on this channel");
        }
      });
    }
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
