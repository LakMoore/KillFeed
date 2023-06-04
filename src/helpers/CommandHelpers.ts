import { SlashCommandStringOption } from "discord.js";

export const FILTER_TYPE = "type";
export const FILTER_NAME_ID = "name-or-id";

export const TYPE_CHAR = "characters";
export const TYPE_CORP = "corporations";
export const TYPE_ALLIANCE = "alliances";
export const TYPE_SHIP = "inventory_types";

export const FILTER_OPTION = new SlashCommandStringOption()
  .setName(FILTER_TYPE)
  .setDescription("What do you want to filter on?")
  .setRequired(true)
  .addChoices(
    { name: "Character", value: TYPE_CHAR },
    { name: "Corporation", value: TYPE_CORP },
    { name: "Alliance", value: TYPE_ALLIANCE },
    { name: "Ship", value: TYPE_SHIP }
  );

export const FILTER_NAME_OR_ID = new SlashCommandStringOption()
  .setName(FILTER_NAME_ID)
  .setDescription("Type the name or ID of the thing you want to filter on.")
  .setRequired(true);
