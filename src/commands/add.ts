import { CommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import { Config } from "../Config";
import { getConfigMessage } from "../helpers/DiscordHelper";
import { generateConfigMessage } from "../helpers/KillFeedHelpers";
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
import { updateChannel } from "../Channels";
import { consoleLog } from "../helpers/Logger";

const builder = new SlashCommandBuilder()
  .setName("add")
  .setDescription("Add a rule to KillFeed's filter")
  .addStringOption(FILTER_OPTION)
  .addStringOption(FILTER_NAME_OR_ID);

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

            if (!thisSubscription) {
              response =
                "Unable to find settings for this channel. Use /init to start.";
            } else {
              // create some breathing room for the server to catch up
              thisSubscription.PauseForChanges = true;

              let thisSetting = undefined;

              if (filterType === TYPE_CHAR) {
                thisSetting = thisSubscription?.Characters;
              } else if (filterType === TYPE_CORP) {
                thisSetting = thisSubscription?.Corporations;
              } else if (filterType === TYPE_ALLIANCE) {
                thisSetting = thisSubscription?.Alliances;
              } else if (filterType === TYPE_SHIP) {
                thisSetting = thisSubscription?.Ships;
              } else if (filterType === TYPE_REGION) {
                thisSetting = thisSubscription?.Regions;
              }

              // add the ID to the settings in memory
              if (thisSetting) {
                consoleLog("Adding the id");
                thisSetting.add(id);
              } else {
                consoleLog("Unable to find a filter of type " + filterType);
              }

              // re-generate the config message
              const message = await getConfigMessage(interaction.channel);

              if (message) {
                // save the config into the channel
                await message.edit(generateConfigMessage(thisSubscription));
                await updateChannel(
                  client,
                  interaction.channel.id,
                  interaction.guild.name
                );
                response = `Success! Added ${filterValue} (${id})`;
              } else {
                response = `No subscription found in channel. Use /init to start.`;
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
