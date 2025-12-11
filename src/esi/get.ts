import { Character } from "../zKillboard/zKillboard";
import { CachedESI } from "./cache";
import { fetchESINames } from "./fetch";
import { MarketApi } from "eve-client-ts";
import { LOGGER } from "../helpers/Logger";

export interface Result {
  character?: string;
  corporation?: string;
  alliance?: string;
  ship?: string;
}

export async function getCharacterNames(characterIds: Character) {
  const missingIds: number[] = [];
  const result: Result = {
    character: CachedESI.getCharacterName(characterIds.character_id),
    corporation: CachedESI.getCorporationName(characterIds.corporation_id),
    alliance: CachedESI.getAllianceName(characterIds.alliance_id),
    ship: CachedESI.getItemName(characterIds.ship_type_id),
  };

  if (!result.character) {
    missingIds.push(characterIds.character_id);
  }
  if (!result.corporation) {
    missingIds.push(characterIds.corporation_id);
  }
  if (!result.alliance) {
    missingIds.push(characterIds.alliance_id);
  }
  if (!result.ship) {
    missingIds.push(characterIds.ship_type_id);
  }

  const missedIds = missingIds.filter((v) => v);

  if (missedIds.length === 0) {
    return result;
  }

  const names = await fetchESINames(missedIds);

  names.forEach((name) => {
    CachedESI.addItem(name);
  });

  return {
    character: CachedESI.getCharacterName(characterIds.character_id),
    corporation: CachedESI.getCorporationName(characterIds.corporation_id),
    alliance: CachedESI.getAllianceName(characterIds.alliance_id),
    ship: CachedESI.getItemName(characterIds.ship_type_id),
  } as Result;
}

export async function getPLEXPrice(): Promise<number> {
  try {
    const PLEX_ID = 44992;
    const GLOBAL_MARKET_ID = 19000001;

    LOGGER.debug("Fetching PLEX price from ESI");

    const marketApi = new MarketApi();

    const orders = await marketApi.getMarketsRegionIdOrders(
      "sell",
      GLOBAL_MARKET_ID,
      "tranquility",
      undefined,
      undefined,
      PLEX_ID
    );

    if (!orders || orders.length === 0) {
      LOGGER.warning("No PLEX sell orders found in global market");
      return 0;
    }

    const sellOrders = orders.filter((order) => !order.is_buy_order);

    if (sellOrders.length === 0) {
      LOGGER.warning("No PLEX sell orders found after filtering");
      return 0;
    }

    const lowestPrice = Math.min(...sellOrders.map((order) => order.price));

    LOGGER.debug(`Found PLEX price: ${lowestPrice}`);

    return lowestPrice;
  } catch (error) {
    LOGGER.error("ESI getPLEXPrice error: " + error);
    return 0;
  }
}
