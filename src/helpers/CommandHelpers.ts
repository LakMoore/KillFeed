import { SlashCommandStringOption } from "discord.js";

export const FILTER_TYPE = "type";
export const FILTER_VALUE = "name-or-id";

export const TYPE_CHAR = "characters";
export const TYPE_CORP = "corporations";
export const TYPE_ALLIANCE = "alliances";
export const TYPE_SHIP = "inventory_types";

export const filterOption = new SlashCommandStringOption()
  .setName(FILTER_TYPE)
  .setDescription("What do you want to filter on?")
  .setRequired(true)
  .addChoices(
    { name: "Character", value: TYPE_CHAR },
    { name: "Corporation", value: TYPE_CORP },
    { name: "Alliance", value: TYPE_ALLIANCE },
    { name: "Ship", value: TYPE_SHIP }
  );

export const filterValue = new SlashCommandStringOption()
  .setName(FILTER_VALUE)
  .setDescription("Type the name or ID of the thing you want to filter on.")
  .setRequired(true);
