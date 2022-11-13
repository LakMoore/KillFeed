import axios from "axios";
import { Client } from "discord.js";
import { Config } from "./Config";
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

      const interestedChannelIDs = new Set<string>();
      let temp = Config.getInstance().matchedAlliances.get(
        data.package.killmail.victim.alliance_id
      );
      if (temp) {
        temp.forEach((v) => interestedChannelIDs.add(v));
      }
      data.package.killmail.attackers.forEach((attacker) => {
        temp = Config.getInstance().matchedAlliances.get(attacker.alliance_id);
        if (temp) {
          temp.forEach((v) => interestedChannelIDs.add(v));
        }
        temp = Config.getInstance().matchedCorporations.get(
          attacker.corporation_id
        );
        if (temp) {
          temp.forEach((v) => interestedChannelIDs.add(v));
        }
        temp = Config.getInstance().matchedCharacters.get(
          attacker.character_id
        );
        if (temp) {
          temp.forEach((v) => interestedChannelIDs.add(v));
        }
      });

      interestedChannelIDs.forEach((channelId) => {
        let channel = client.channels.cache.find((c) => c.id === channelId);
        if (channel?.isTextBased()) {
          channel.send(`https://zkillboard.com/kill/${data.package.killID}/`);
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
