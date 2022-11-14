import { EmbedBuilder } from "@discordjs/builders";
import { getCharacterNames } from "../esi/get";
import { fetchESINames } from "../esi/fetch";
import { Package } from "../zKillboard";
import { BaseFormat } from "./Fomat";

const colours = {
  kill: 0x00ff00,
  loss: 0xff0000,
};

export const InsightFormat: BaseFormat = {
  getMessage: (data: Package, kill: boolean) => {
    const badgeUrl = data.package.killmail.victim.alliance_id
      ? `https://images.evetech.net/alliances/${data.package.killmail.victim.alliance_id}/logo?size=64`
      : `https://images.evetech.net/corporations/${data.package.killmail.victim.corporation_id}/logo?size=64`;

    let value = "";
    if (data.package.zkb.totalValue >= 1000000000) {
      value =
        Math.round(data.package.zkb.totalValue / 100000000) / 10 + "B ISK";
    } else if (data.package.zkb.totalValue >= 1000000) {
      value = Math.round(data.package.zkb.totalValue / 100000) / 10 + "M ISK";
    } else if (data.package.zkb.totalValue >= 1000) {
      value = Math.round(data.package.zkb.totalValue / 100) / 10 + "k ISK";
    }

    let attacker = data.package.killmail.attackers.filter(
      (char) => char.final_blow
    )[0];
    if (!attacker) attacker = data.package.killmail.attackers[0];

    return Promise.all([
      getCharacterNames(
        data.package.killmail.victim,
        data.package.killmail.solar_system_id
      ),
      getCharacterNames(attacker, data.package.killmail.solar_system_id),
    ]).then(([victimNames, attackerNames]) => {
      let attackerShipName = attackerNames.ship;
      if (
        attackerShipName &&
        ["a", "e", "i", "o", "u"].includes(attackerShipName.toLowerCase()[0])
      ) {
        attackerShipName = "an " + attackerShipName;
      } else {
        attackerShipName = "a " + attackerShipName;
      }
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(kill ? colours.kill : colours.loss)
            .setTitle(`${victimNames.ship} destroyed in ${victimNames.system}`)
            .setURL(`https://zkillboard.com/kill/${data.package.killID}/`)
            .setAuthor({
              name: kill ? "Kill" : "Loss",
              iconURL: badgeUrl,
              url: `https://zkillboard.com/kill/${data.package.killID}/`,
            })
            .setDescription(
              `**[${victimNames.character}](https://zkillboard.com/character/${data.package.killmail.victim.character_id}/)(${victimNames.corporation})** lost their ${victimNames.ship} to **[${attackerNames.character}](https://zkillboard.com/character/${attacker.character_id}/)(${attackerNames.corporation})** flying ${attackerShipName} ` +
                (data.package.killmail.attackers.length === 1
                  ? "solo."
                  : ` and ${data.package.killmail.attackers.length - 1} other${
                      data.package.killmail.attackers.length > 2 ? "s" : ""
                    }.`)
            )
            .setThumbnail(
              `https://images.evetech.net/types/${data.package.killmail.victim.ship_type_id}/render?size=64`
            )
            .setTimestamp()
            .setFooter({
              text: `Value: ${value}`,
            }),
        ],
      };
    });
  },
};
