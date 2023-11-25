import { EmbedBuilder } from "@discordjs/builders";
import { getCharacterNames } from "../esi/get";
import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";
import { BaseFormat, ZKMailType } from "./Fomat";
import { formatISKValue } from "../helpers/JaniceHelper";
import { CachedESI } from "../esi/cache";

const colours = {
  kill: 0x00ff00,
  loss: 0xff0000,
  neutral: 0x0000ff,
};

export const InsightFormat: BaseFormat = {
  getMessage: async (
    killmail: KillMail,
    zkb: ZkbOnly,
    mailType: ZKMailType,
    appraisedValue: number
  ) => {
    // not all Corps are in an Alliance!
    const badgeUrl = killmail.victim.alliance_id
      ? `https://images.evetech.net/alliances/${killmail.victim.alliance_id}/logo?size=64`
      : `https://images.evetech.net/corporations/${killmail.victim.corporation_id}/logo?size=64`;

    const value = formatISKValue(zkb.zkb.totalValue);

    let attacker = killmail.attackers.filter((char) => char.final_blow)[0];
    if (!attacker) attacker = killmail.attackers[0];

    const system = await CachedESI.getSystem(killmail.solar_system_id);
    const region = await CachedESI.getRegionForSystem(killmail.solar_system_id);

    return Promise.all([
      getCharacterNames(killmail.victim),
      getCharacterNames(attacker),
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

      let nameText = "Neutral";
      let colour = colours.neutral;
      if (mailType == ZKMailType.Kill) {
        nameText = "Kill";
        colour = colours.kill;
      }
      if (mailType == ZKMailType.Loss) {
        nameText = "Loss";
        colour = colours.loss;
      }

      return {
        embeds: [
          new EmbedBuilder()
            .setColor(colour)
            .setTitle(
              `${victimNames.ship} destroyed in ${
                system.name
              } (${system.security_status.toFixed(1)}), ${region.name}`
            )
            .setURL(`https://zkillboard.com/kill/${killmail.killmail_id}/`)
            .setAuthor({
              name: nameText,
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
