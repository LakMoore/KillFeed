import { EmbedBuilder } from "@discordjs/builders";
import { MessageCreateOptions } from "discord.js";
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

type CharacterNames = Awaited<ReturnType<typeof getCharacterNames>>;
type Attacker = KillMail["attackers"][number];

function getAttackerShipName(shipName?: string) {
  if (
    shipName &&
    ["a", "e", "i", "o", "u"].includes(shipName.toLowerCase()[0])
  ) {
    return "an " + shipName;
  }

  return "a " + shipName;
}

function getAttackerName(attacker: Attacker, attackerNames: CharacterNames) {
  if (attackerNames.character) {
    const attackerCorp = attackerNames.alliance
      ? attackerNames.alliance
      : attackerNames.corporation;

    return `**[${attackerNames.character}](https://zkillboard.com/character/${attacker.character_id}/) (${attackerCorp})**`;
  }

  if (attackerNames.corporation) {
    return `an NPC (${attackerNames.corporation})`;
  }

  return "an NPC";
}

function getVictimName(killmail: KillMail, victimNames: CharacterNames) {
  if (victimNames.character) {
    const victimCorp = victimNames.alliance
      ? victimNames.alliance
      : victimNames.corporation;

    return `**[${victimNames.character}](https://zkillboard.com/character/${killmail.victim.character_id}/) (${victimCorp})**`;
  }

  if (victimNames.alliance) {
    return `**[${victimNames.alliance}](https://zkillboard.com/alliance/${killmail.victim.alliance_id}/)**`;
  }

  return `**[${victimNames.corporation}](https://zkillboard.com/corporation/${killmail.victim.corporation_id}/)**`;
}

function getFleetPhrase(killmail: KillMail) {
  if (killmail.attackers.length <= 1) {
    return ", solo";
  }

  let fleetPhrase = ` and ${killmail.attackers.length - 1} other`;
  if (killmail.attackers.length > 2) {
    fleetPhrase += "s";
  }

  return fleetPhrase;
}

function getMailVisuals(mailType: ZKMailType) {
  if (mailType == ZKMailType.Kill) {
    return {
      nameText: "Kill",
      colour: colours.kill,
    };
  }

  if (mailType == ZKMailType.Loss) {
    return {
      nameText: "Loss",
      colour: colours.loss,
    };
  }

  return {
    nameText: "Neutral Kill",
    colour: colours.neutral,
  };
}

export function buildInsightFooterText(
  zKillValueText: string,
  janiceValueText?: string,
) {
  let footerText = ` • ZKill Value: ${zKillValueText}\n`;

  if (janiceValueText) {
    footerText += `• Janice Value: ${janiceValueText}\n`;
  }

  return footerText;
}

export function setInsightFooter(
  message: MessageCreateOptions,
  footerText: string,
) {
  const [firstEmbed, ...restEmbeds] = message.embeds ?? [];

  if (!firstEmbed) {
    return message;
  }

  const embedData = "toJSON" in firstEmbed ? firstEmbed.toJSON() : firstEmbed;
  const embed =
    firstEmbed instanceof EmbedBuilder
      ? firstEmbed
      : new EmbedBuilder(embedData);

  embed.setFooter({ text: footerText });
  message.embeds = [embed, ...restEmbeds];

  return message;
}

export const InsightFormat: BaseFormat = {
  getMessage: async (
    killmail: KillMail,
    zkb: ZkbOnly,
    mailType: ZKMailType,
    appraisedValue: number,
  ) => {
    // not all Corps are in an Alliance!
    const badgeUrl = killmail.victim.alliance_id
      ? `https://images.evetech.net/alliances/${killmail.victim.alliance_id}/logo?size=64`
      : `https://images.evetech.net/corporations/${killmail.victim.corporation_id}/logo?size=64`;

    const value = formatISKValue(zkb.zkb.totalValue);

    let attacker = killmail.attackers.find((char) => char.final_blow);
    attacker ??= killmail.attackers[0];

    const system = await CachedESI.getSystem(killmail.solar_system_id);
    const region = await CachedESI.getRegionForSystem(killmail.solar_system_id);

    return Promise.all([
      getCharacterNames(killmail.victim),
      getCharacterNames(attacker),
    ]).then(([victimNames, attackerNames]) => {
      const attackerShipName = getAttackerShipName(attackerNames.ship);
      const attackerName = getAttackerName(attacker, attackerNames);
      const victimName = getVictimName(killmail, victimNames);
      const fleetPhrase = getFleetPhrase(killmail);

      const visuals = getMailVisuals(mailType);
      const nameText = `${visuals.nameText} in ${system.name} (${system.security_status.toFixed(1)}), ${region.name}`;

      return {
        embeds: [
          new EmbedBuilder()
            .setColor(visuals.colour)
            .setTitle(`${victimNames.ship} destroyed`)
            .setURL(`https://zkillboard.com/kill/${killmail.killmail_id}/`)
            .setAuthor({
              name: nameText,
              iconURL: badgeUrl,
              url: `https://zkillboard.com/kill/${killmail.killmail_id}/`,
            })
            .setDescription(
              `${victimName} lost their ${victimNames.ship} to ${attackerName} flying ${attackerShipName}${fleetPhrase}.`,
            )
            .setThumbnail(
              `https://images.evetech.net/types/${killmail.victim.ship_type_id}/render?size=64`,
            )
            .setTimestamp(new Date(killmail.killmail_time))
            .setFooter({
              text: buildInsightFooterText(value),
            }),
        ],
      };
    });
  },
};
