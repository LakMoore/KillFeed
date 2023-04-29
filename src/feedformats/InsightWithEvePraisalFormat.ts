import { EmbedBuilder } from "@discordjs/builders";
import axios from "axios";
import { EvePraisal } from "src/helpers/EvePraisal";
import { getCharacterNames } from "../esi/get";
import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";
import { BaseFormat } from "./Fomat";

const colours = {
  kill: 0x00ff00,
  loss: 0xff0000,
};

function formatISKValue(isk: number): string {
  let value = "";
  if (isk >= 1000000000) {
    value = Math.round(isk / 100000000) / 10 + "B ISK";
  } else if (isk >= 1000000) {
    value = Math.round(isk / 100000) / 10 + "M ISK";
  } else if (isk >= 1000) {
    value = Math.round(isk / 100) / 10 + "k ISK";
  }
  return value;
}

export const InsightWithEvePraisalFormat: BaseFormat = {
  getMessage: (killmail: KillMail, zkb: ZkbOnly, kill: boolean) => {
    // not all Corps are in an Alliance!
    const badgeUrl = killmail.victim.alliance_id
      ? `https://images.evetech.net/alliances/${killmail.victim.alliance_id}/logo?size=64`
      : `https://images.evetech.net/corporations/${killmail.victim.corporation_id}/logo?size=64`;

    let value = formatISKValue(zkb.zkb.totalValue);

    let attacker = killmail.attackers.filter((char) => char.final_blow)[0];
    if (!attacker) attacker = killmail.attackers[0];

    return Promise.all([
      getCharacterNames(killmail.victim, killmail.solar_system_id),
      getCharacterNames(attacker, killmail.solar_system_id),
    ]).then(async ([victimNames, attackerNames]) => {
      let attackerShipName = attackerNames.ship;
      if (
        attackerShipName &&
        ["a", "e", "i", "o", "u"].includes(attackerShipName.toLowerCase()[0])
      ) {
        attackerShipName = "an " + attackerShipName;
      } else {
        attackerShipName = "a " + attackerShipName;
      }
      let attackerName = "";
      if (attackerNames.character) {
        // not all Corps are in an Alliance!
        const attackerCorp = attackerNames.alliance
          ? attackerNames.alliance
          : attackerNames.corporation;
        attackerName = `**[${attackerNames.character}](https://zkillboard.com/character/${attacker.character_id}/) (${attackerCorp})**`;
      } else {
        if (attackerNames.corporation) {
          attackerName = `an NPC (${attackerNames.corporation})`;
        } else {
          attackerName = "an NPC";
        }
      }
      let victimName = "";
      // not all Corps are in an Alliance!
      if (victimNames.character) {
        const victimCorp = victimNames.alliance
          ? victimNames.alliance
          : victimNames.corporation;
        victimName = `**[${victimNames.character}](https://zkillboard.com/character/${killmail.victim.character_id}/) (${victimCorp})**`;
      } else {
        // structures don't have a character name!
        if (victimNames.alliance) {
          victimName = `**[${victimNames.alliance}](https://zkillboard.com/alliance/${killmail.victim.alliance_id}/)**`;
        } else {
          victimName = `**[${victimNames.corporation}](https://zkillboard.com/corporation/${killmail.victim.corporation_id}/)**`;
        }
      }

      let fleetPhrase = ", solo";
      if (killmail.attackers.length > 1) {
        fleetPhrase = ` and ${killmail.attackers.length - 1} other`;
        if (killmail.attackers.length > 2) {
          fleetPhrase += "s";
        }
      }

      let evePraisalItems: {
        type_id: number;
        quantity: number;
      }[] = [];
      if (killmail.victim.items.length > 0) {
        evePraisalItems = killmail.victim.items.map((item) => {
          return {
            type_id: item.item_type_id,
            quantity:
              (item.quantity_destroyed ? item.quantity_destroyed : 0) +
              (item.quantity_dropped ? item.quantity_dropped : 0),
          };
        });
      }

      evePraisalItems.push({
        type_id: killmail.victim.ship_type_id,
        quantity: 1,
      });
      const url = "https://evepraisal.com/appraisal/structured.json";
      const payload = {
        market_name: "jita",
        items: evePraisalItems,
      };

      const { data } = await axios.post<EvePraisal>(url, payload);

      // console.log(JSON.stringify(evePraisalItems));
      // console.log("-----------------");
      // console.log(JSON.stringify(data));

      let evePraisalValue = formatISKValue(data.appraisal.totals.sell);

      return {
        embeds: [
          new EmbedBuilder()
            .setColor(kill ? colours.kill : colours.loss)
            .setTitle(`${victimNames.ship} destroyed in ${victimNames.system}`)
            .setURL(`https://zkillboard.com/kill/${killmail.killmail_id}/`)
            .setAuthor({
              name: kill ? "Kill" : "Loss",
              iconURL: badgeUrl,
              url: `https://zkillboard.com/kill/${killmail.killmail_id}/`,
            })
            .setDescription(
              `${victimName} lost their ${victimNames.ship} to ${attackerName} flying ${attackerShipName}${fleetPhrase}.`
            )
            .setThumbnail(
              `https://images.evetech.net/types/${killmail.victim.ship_type_id}/render?size=64`
            )
            .setTimestamp(new Date(killmail.killmail_time))
            .setFooter({
              text: `ZKill Value: ${value}
EvePraisal: ${evePraisalValue}`,
            }),
        ],
      };
    });
  },
};
