import { EmbedBuilder } from "@discordjs/builders";
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

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(kill ? colours.kill : colours.loss)
          .setTitle("Ship destroyed somewhere")
          .setURL(`https://zkillboard.com/kill/${data.package.killID}/`)
          .setAuthor({
            name: kill ? "Kill" : "Loss",
            iconURL: badgeUrl,
            url: `https://zkillboard.com/kill/${data.package.killID}/`,
          })
          .setDescription("Some description here")
          .setThumbnail(
            `https://images.evetech.net/types/${data.package.killmail.victim.ship_type_id}/render?size=64`
          )
          .setTimestamp()
          .setFooter({
            text: `Value: ${value}`,
          }),
      ],
    };
  },
};
