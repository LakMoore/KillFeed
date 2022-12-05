import { EmbedBuilder } from "@discordjs/builders";
import { getCharacterNames } from "../esi/get";
import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";
import { BaseFormat } from "./Fomat";

const colours = {
  kill: 0x00ff00,
  loss: 0xff0000,
};

export const InsightFormat: BaseFormat = {
  getMessage: (killmail: KillMail, zkb: ZkbOnly, kill: boolean) => {
    // not all Corps are in an Alliance!
    const badgeUrl = killmail.victim.alliance_id
      ? `https://images.evetech.net/alliances/${killmail.victim.alliance_id}/logo?size=64`
      : `https://images.evetech.net/corporations/${killmail.victim.corporation_id}/logo?size=64`;

    let value = "";
    if (zkb.zkb.totalValue >= 1000000000) {
      value = Math.round(zkb.zkb.totalValue / 100000000) / 10 + "B ISK";
    } else if (zkb.zkb.totalValue >= 1000000) {
      value = Math.round(zkb.zkb.totalValue / 100000) / 10 + "M ISK";
    } else if (zkb.zkb.totalValue >= 1000) {
      value = Math.round(zkb.zkb.totalValue / 100) / 10 + "k ISK";
    }

    let attacker = killmail.attackers.filter((char) => char.final_blow)[0];
    if (!attacker) attacker = killmail.attackers[0];

    return Promise.all([
      getCharacterNames(killmail.victim, killmail.solar_system_id),
      getCharacterNames(attacker, killmail.solar_system_id),
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
      const victimCorp = victimNames.alliance
        ? victimNames.alliance
        : victimNames.corporation;
      if (victimNames.character) {
        victimName = `**[${victimNames.character}](https://zkillboard.com/character/${killmail.victim.character_id}/) (${victimCorp})**`;
      } else {
        // structures don't have a character name!
        victimName = `**[${victimCorp}](https://zkillboard.com/character/${killmail.victim.corporation_id}/)**`;
      }

      let fleetPhrase = ", solo";
      if (killmail.attackers.length > 1) {
        fleetPhrase = ` and ${killmail.attackers.length - 1} other`;
        if (killmail.attackers.length > 2) {
          fleetPhrase += "s";
        }
      }
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
              text: `Value: ${value}`,
            }),
        ],
      };
    });
  },
};
