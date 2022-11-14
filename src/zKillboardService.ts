import axios from "axios";
import { Client } from "discord.js";
import { Config } from "./Config";
import { EmbeddedFormat } from "./feedformats/EmbeddedFormat";
import { InsightFormat } from "./feedformats/InsightFormat";
import { ZKillLinkFormat } from "./feedformats/ZKillLinkFormat";
import { Package } from "./zKillboard";

export async function pollzKillboardOnce(client: Client) {
  try {
    // zKillboard could return immediately or could make us wait up to 10 seconds
    const { data } = await axios.get<Package>(
      "https://redisq.zkillboard.com/listen.php"
    );

    // null and empty packages are normal, if there is no kill feed activity
    // in the last 10 seconds
    if (data && data.package) {
      // We have a non-null response from zk

      const lossmailChannelIDs = new Set<string>();
      const killmailChannelIDs = new Set<string>();

      Config.getInstance().testRequests.forEach((v) => {
        lossmailChannelIDs.add(v);
      });
      Config.getInstance().testRequests.clear();

      let temp = Config.getInstance().matchedAlliances.get(
        data.package.killmail.victim.alliance_id
      );
      if (temp) {
        temp.forEach((v) => lossmailChannelIDs.add(v));
      }
      temp = Config.getInstance().matchedCorporations.get(
        data.package.killmail.victim.corporation_id
      );
      if (temp) {
        temp.forEach((v) => lossmailChannelIDs.add(v));
      }
      temp = Config.getInstance().matchedCharacters.get(
        data.package.killmail.victim.character_id
      );
      if (temp) {
        temp.forEach((v) => lossmailChannelIDs.add(v));
      }

      data.package.killmail.attackers.forEach((attacker) => {
        temp = Config.getInstance().matchedAlliances.get(attacker.alliance_id);
        if (temp) {
          temp.forEach((v) => {
            if (!lossmailChannelIDs.has(v)) killmailChannelIDs.add(v);
          });
        }
        temp = Config.getInstance().matchedCorporations.get(
          attacker.corporation_id
        );
        if (temp) {
          temp.forEach((v) => {
            if (!lossmailChannelIDs.has(v)) killmailChannelIDs.add(v);
          });
        }
        temp = Config.getInstance().matchedCharacters.get(
          attacker.character_id
        );
        if (temp) {
          temp.forEach((v) => {
            if (!lossmailChannelIDs.has(v)) killmailChannelIDs.add(v);
          });
        }
      });

      lossmailChannelIDs.forEach((channelId) => {
        let channel = client.channels.cache.find((c) => c.id === channelId);
        if (channel && channel.isTextBased()) {
          // TODO: Look up the desired message format for this channel

          // Generate the message
          InsightFormat.getMessage(data, false).then((msg) => {
            if (channel && channel.isTextBased()) {
              // send the message
              channel.send(msg);
            }
          });
        }
      });

      killmailChannelIDs.forEach((channelId) => {
        let channel = client.channels.cache.find((c) => c.id === channelId);
        if (channel?.isTextBased()) {
          // TODO: Look up the desired message format for this channel

          // Generate the message
          InsightFormat.getMessage(data, true).then((msg) => {
            if (channel && channel.isTextBased()) {
              // send the message
              channel.send(msg);
            }
          });
        }
      });
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log("AxiosError");
    }
    console.log(error);
  }
}
