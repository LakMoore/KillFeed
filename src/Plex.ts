import { getPLEXPrice } from "./esi/get";
import { LOGGER } from "./helpers/Logger";

export class PLEX {
  private static instance: PLEX;
  // 500 PLEX = $25
  // 1 PLEX = 0.05 USD
  private static readonly USD_PER_PLEX = 0.05;
  private static readonly PLEX_PRICE_UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour
  private static ISK_per_PLEX = -1;
  private static last_updated = new Date(
    new Date().getTime() + PLEX.PLEX_PRICE_UPDATE_INTERVAL
  );

  public static getInstance(): PLEX {
    if (!PLEX.instance) {
      PLEX.instance = new PLEX();
    }
    return PLEX.instance;
  }

  private constructor() {}

  public static async convertISKtoUSD(ISK_amount: number) {
    if (ISK_amount <= 0) {
      return "0 USD";
    }

    LOGGER.debug("Converting " + ISK_amount + " ISK to USD");

    if (
      PLEX.ISK_per_PLEX <= 0 ||
      PLEX.last_updated.getTime() <
        new Date().getTime() - PLEX.PLEX_PRICE_UPDATE_INTERVAL
    ) {
      const newPrice = await getPLEXPrice();
      if (newPrice > 0) {
        PLEX.ISK_per_PLEX = newPrice;
        PLEX.last_updated = new Date();
      }
    }

    if (PLEX.ISK_per_PLEX > 0) {
      return `${((ISK_amount / PLEX.ISK_per_PLEX) * PLEX.USD_PER_PLEX).toFixed(
        2
      )} USD`;
    }

    return "";
  }
}
