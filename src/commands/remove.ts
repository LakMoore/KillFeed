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
  FILTER_OPTION,
  FILTER_NAME_OR_ID,
  FILTER_TYPE,
  FILTER_NAME_ID,
  TYPE_ALLIANCE,
  TYPE_CHAR,
  TYPE_CORP,
  TYPE_SHIP,
  TYPE_REGION,
} from "../helpers/CommandHelpers";
import { consoleLog } from "../helpers/Logger";

const builder = new SlashCommandBuilder()
  .setName("remove")
  .setDescription("Remove a rule from KillFeed's filter")
  .addStringOption(FILTER_OPTION)
  .addStringOption(FILTER_NAME_OR_ID);

export const Remove: Command = {
  ...builder.toJSON(),
  run: async (client: Client, interaction: CommandInteraction) => {
    let response = "Something went wrong!";

    if (interaction.isChatInputCommand() && interaction.channel) {
      const filterType = interaction.options.getString(FILTER_TYPE);

      if (!filterType) {
        response = "You must specify a type";
      } else {
        const filterValue = interaction.options.getString(FILTER_NAME_ID);

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
              const tempId = IDs[myKey]?.[0].id;

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

            if (!thisSubscription) {
              consoleLog(`Failed to find a subscription for this channel!`);
              response = `Failed to find a subscription for this channel!`;
            } else {
              // create some breathing room for the server to catch up
              thisSubscription.PauseForChanges = true;

              let thisFilter = undefined;
              let listener = undefined;

              if (filterType === TYPE_CHAR) {
                thisFilter = thisSubscription.Characters;
                listener = Config.getInstance().matchedCharacters;
              } else if (filterType === TYPE_CORP) {
                thisFilter = thisSubscription.Corporations;
                listener = Config.getInstance().matchedCorporations;
              } else if (filterType === TYPE_ALLIANCE) {
                thisFilter = thisSubscription.Alliances;
                listener = Config.getInstance().matchedAlliances;
              } else if (filterType === TYPE_SHIP) {
                thisFilter = thisSubscription.Ships;
                listener = Config.getInstance().matchedShips;
              } else if (filterType === TYPE_REGION) {
                thisFilter = thisSubscription.Regions;
                listener = Config.getInstance().matchedRegions;
              }

              // remove the ID from the settings in memory
              if (!thisFilter) {
                consoleLog("Unable to find a filter called " + filterType);
                response = "Unable to find a filter called " + filterType;
              } else {
                consoleLog("Deleting the id");
                thisFilter.delete(id);

                // remove the ID from the current filters too
                removeListener(listener, id, interaction.channel.id);

                // re-generate the config message
                const message = await getConfigMessage(interaction.channel);

                if (message) {
                  // save the config into the channel
                  await message.edit(generateConfigMessage(thisSubscription));
                  response = `Success! Removed ${filterValue} (${id})`;
                }
              }
              thisSubscription.PauseForChanges = false;
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
