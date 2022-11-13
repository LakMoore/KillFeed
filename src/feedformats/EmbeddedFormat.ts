import { EmbedBuilder } from "@discordjs/builders";
import { Package } from "../zKillboard";
import { BaseFormat } from "./Fomat";

const colours = {
  kill: 0x00ff00,
  loss: 0xff0000,
};

export const EmbeddedFormat: BaseFormat = {
  getMessage: (data: Package, kill: boolean) => {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(kill ? colours.kill : colours.loss)
          .setTitle("Ship destroyed somewhere")
          .setURL(`https://zkillboard.com/kill/${data.package.killID}/`)
          .setAuthor({
            name: kill ? "Kill" : "Loss",
            iconURL: "https://i.imgur.com/AfFp7pu.png",
            url: `https://zkillboard.com/kill/${data.package.killID}/`,
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
            text: `Value: ${data.package.zkb.totalValue}`,
            iconURL: "https://i.imgur.com/AfFp7pu.png",
          }),
      ],
    };
  },
};
