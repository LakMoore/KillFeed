import axios from "axios";
import { Client, DiscordAPIError } from "discord.js";
import { Config } from "./Config";
import { EmbeddedFormat } from "./feedformats/EmbeddedFormat";
import { InsightFormat } from "./feedformats/InsightFormat";
import { ZKillLinkFormat } from "./feedformats/ZKillLinkFormat";
import { Package } from "./zKillboard";

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

      console.log(
        `Kill ID: ${data.package.killID} data: ${data.package.zkb.labels.join(
          ","
        )}`
      );

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
        data.package.killmail.victim.alliance_id
      );
      temp?.forEach((v) => lossmailChannelIDs.add(v));
      temp = Config.getInstance().matchedCorporations.get(
        data.package.killmail.victim.corporation_id
      );
      temp?.forEach((v) => lossmailChannelIDs.add(v));
      temp = Config.getInstance().matchedCharacters.get(
        data.package.killmail.victim.character_id
      );
      temp?.forEach((v) => lossmailChannelIDs.add(v));
      temp = Config.getInstance().matchedShips.get(
        data.package.killmail.victim.ship_type_id
      );
      temp?.forEach((v) => lossmailChannelIDs.add(v));

      data.package.killmail.attackers.forEach((attacker) => {
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
        temp = Config.getInstance().matchedCharacters.get(
          attacker.character_id
        );
        temp?.forEach((v) => {
          if (!lossmailChannelIDs.has(v)) killmailChannelIDs.add(v);
        });
        temp = Config.getInstance().matchedShips.get(attacker.ship_type_id);
        temp?.forEach((v) => {
          if (!lossmailChannelIDs.has(v)) killmailChannelIDs.add(v);
        });
      });

      lossmailChannelIDs.forEach(async (channelId) => {
        let channel = client.channels.cache.find((c) => c.id === channelId);
        if (channel && channel.isTextBased()) {
          // TODO: Look up the desired message format for this channel

          // Generate the message
          await InsightFormat.getMessage(data, false).then(async (msg) => {
            if (channel?.isTextBased()) {
              // send the message
              await channel.send(msg);
            }
          });
        } else {
          console.log("Couldn't find the channel for lossmail");
        }
      });

      killmailChannelIDs.forEach(async (channelId) => {
        let channel = client.channels.cache.find((c) => c.id === channelId);
        if (channel?.isTextBased()) {
          // TODO: Look up the desired message format for this channel

          // Generate the message
          await InsightFormat.getMessage(data, true).then(async (msg) => {
            if (channel?.isTextBased()) {
              // send the message
              await channel.send(msg);
            }
          });
        } else {
          console.log("Couldn't find the channel for killmail");
        }
      });
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log(
        `AxiosError ${error.response?.status} ${error.response?.statusText} ${error.config?.url}`
      );
    } else if (error instanceof DiscordAPIError) {
      console.log(
        `Discord Error while sending message [${error.code}]${error.message}`
      );
    } else {
      console.log("Error sending message");
      console.log(error);
    }

    // if there was an error then take a break
    await sleep(30000);
  }
}
