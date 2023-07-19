import { EmbedBuilder } from "@discordjs/builders";
import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";
import { BaseFormat, ZKMailType } from "./Fomat";

const colours = {
  kill: 0x00ff00,
  loss: 0xff0000,
  neutral: 0x0000ff,
};

export const EmbeddedFormat: BaseFormat = {
  getMessage: async (
    killmail: KillMail,
    zkb: ZkbOnly,
    mailType: ZKMailType,
    appraisedValue: number
  ) => {
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
          .setTitle("Ship destroyed somewhere")
          .setURL(`https://zkillboard.com/kill/${killmail.killmail_id}/`)
          .setAuthor({
            name: nameText,
            iconURL: "https://i.imgur.com/AfFp7pu.png",
            url: `https://zkillboard.com/kill/${killmail.killmail_id}/`,
          })
          .setDescription("Some description here")
          .setThumbnail("https://i.imgur.com/AfFp7pu.png")
          .addFields(
            { name: "Regular field title", value: "Some value here" },
            { name: "\u200B", value: "\u200B" },
            {
              name: "Inline field title",
              value: "Some value here",
              inline: true,
            },
            {
              name: "Inline field title",
              value: "Some value here",
              inline: true,
            }
          )
          .addFields({
            name: "Inline field title",
            value: "Some value here",
            inline: true,
          })
          // .setImage("https://i.imgur.com/AfFp7pu.png")
          .setTimestamp()
          .setFooter({
            text: `Value: ${zkb.zkb.totalValue}`,
            iconURL: "https://i.imgur.com/AfFp7pu.png",
          }),
      ],
    };
  },
};
