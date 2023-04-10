import { CommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import { Config } from "../Config";
import { getConfigMessage } from "../helpers/DiscordHelper";
import { generateConfigMessage } from "../helpers/KillFeedHelpers";
import { Command } from "../Command";
import { fetchESIIDs } from "../esi/fetch";
import {
  filterOption,
  filterValue,
  FILTER_TYPE,
  FILTER_VALUE,
  TYPE_ALLIANCE,
  TYPE_CHAR,
  TYPE_CORP,
  TYPE_SHIP,
} from "../helpers/CommandHelpers";
import { updateChannel } from "../Channels";

const builder = new SlashCommandBuilder()
  .setName("add")
  .setDescription("Add a rule to KillFeed's filter")
  .addStringOption(filterOption)
  .addStringOption(filterValue);

export const Add: Command = {
  ...builder.toJSON(),
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = "Something went wrong!";

    if (
      interaction.isChatInputCommand() &&
      interaction.channel &&
      interaction.guild
    ) {
      const filterType = interaction.options.getString(FILTER_TYPE);

      if (!filterType) {
        response = "You must specify a type";
      } else {
        const filterValue = interaction.options.getString(FILTER_VALUE);

        if (!filterValue) {
          response = "You must specify a value";
        } else {
          // value could be an Eve name or an Eve ID
          let id = parseInt(filterValue);
          const isInteger = id.toString() === filterValue;

          if (!isInteger) {
            // if it wasn't an ID!

            // perhaps need to sanitise the user's input?
            const IDs = await fetchESIIDs([filterValue]);

            if (!IDs) {
              response = `Failed to find ${filterValue} in Eve`;
            } else {
              type ObjectKey = keyof typeof IDs;
              const myKey = filterType as ObjectKey;
              let tempId = IDs[myKey]?.[0].id;

              if (!tempId) {
                response = `Failed to get the ID for ${filterValue} from Eve`;
              } else {
                id = tempId;
              }
            }
          }

          // now the ID should exist
          if (id) {
            const settings = Config.getInstance().registeredChannels.get(
              interaction.channel.id
            );

            if (!settings) {
              response =
                "Unable to find settings for this channel. Use /init to start.";
            } else {
              let thisSetting = undefined;

              if (filterType === TYPE_CHAR) {
                thisSetting = settings?.Characters;
              } else if (filterType === TYPE_CORP) {
                thisSetting = settings?.Corporations;
              } else if (filterType === TYPE_ALLIANCE) {
                thisSetting = settings?.Alliances;
              } else if (filterType === TYPE_SHIP) {
                thisSetting = settings?.Ships;
              }

              // add the ID to the settings in memory
              if (thisSetting) {
                console.log("Adding the id");
                thisSetting?.add(id);
              }

              // re-generate the config message
              const message = await getConfigMessage(interaction.channel);

              if (message) {
                // save the config into the channel
                await message.edit(generateConfigMessage(settings));
                await updateChannel(
                  client,
                  interaction.channel.id,
                  interaction.guild.name
                );
                response = `Success! Added ${filterValue} (${id})`;
              } else {
                response = `No settings found in channel. Use /init to start.`;
              }
            }
          }
        }
      }
    }

    await interaction.followUp({
      ephemeral: true,
      content: response,
    });
  },
};
