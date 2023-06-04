import { CommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import { Config } from "../Config";
import { getConfigMessage } from "../helpers/DiscordHelper";
import {
  generateConfigMessage,
  removeListener,
} from "../helpers/KillFeedHelpers";
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

const builder = new SlashCommandBuilder()
  .setName("remove")
  .setDescription("Remove a rule from KillFeed's filter")
  .addStringOption(filterOption)
  .addStringOption(filterValue);

export const Remove: Command = {
  ...builder.toJSON(),
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = "Something went wrong!";

    if (interaction.isChatInputCommand() && interaction.channel) {
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
            const thisSubscription = Config.getInstance().allSubscriptions.get(
              interaction.channel.id
            );

            let thisFilter = undefined;
            let listener = undefined;

            if (filterType === TYPE_CHAR) {
              thisFilter = thisSubscription?.Characters;
              listener = Config.getInstance().matchedCharacters;
            } else if (filterType === TYPE_CORP) {
              thisFilter = thisSubscription?.Corporations;
              listener = Config.getInstance().matchedCorporations;
            } else if (filterType === TYPE_ALLIANCE) {
              thisFilter = thisSubscription?.Alliances;
              listener = Config.getInstance().matchedAlliances;
            } else if (filterType === TYPE_SHIP) {
              thisFilter = thisSubscription?.Ships;
              listener = Config.getInstance().matchedShips;
            }

            // remove the ID from the settings in memory
            if (thisFilter) {
              console.log("Deleting the id");
              thisFilter?.delete(id);
            }

            // remove the ID from the current filters too
            removeListener(listener, id, interaction.channel.id);

            response = `Success! Removed ${filterValue} (${id})`;

            // re-generate the config message
            const message = await getConfigMessage(interaction.channel);

            if (message && thisSubscription) {
              // save the config into the channel
              await message.edit(generateConfigMessage(thisSubscription));
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
