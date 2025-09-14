import axios, { AxiosRequestConfig } from "axios";
import { PricerItem } from "../helpers/JaniceHelper";
import { KillMail } from "../zKillboard/zKillboard";
import { LOGGER } from "../helpers/Logger";

const URL = "https://janice.e-351.com/api/rest/v2/pricer";
const PARAMS = {
  market: "2",
};

/**
 * Get the appraised value of the lossmail from a service
 * EvePraisal is dead, going to use Janice
 * https://janice.e-351.com/api/rest/docs/index.html
 */
export async function getJaniceAppraisalValue(killmail: KillMail) {
  try {
    let janiceItems: {
      id: number;
      amount: number;
    }[] = [];
    if (killmail.victim.items.length > 0) {
      janiceItems = killmail.victim.items.map((item) => {
        return {
          id: item.item_type_id,
          amount:
            (item.quantity_destroyed ? item.quantity_destroyed : 0) +
            (item.quantity_dropped ? item.quantity_dropped : 0),
        };
      });
    }

    janiceItems.push({
      id: killmail.victim.ship_type_id,
      amount: 1,
    });

    const query = new URLSearchParams(PARAMS).toString();

    const payload = janiceItems.map((i) => i.id).join("\n");

    const janiceConfig: AxiosRequestConfig = {
      headers: {
        "X-ApiKey": process.env.JANICE_KEY,
        accept: "application/json",
        "Content-Type": "text/plain",
      },
    };

    // Need an API Key and lots of testing before this will work
    const { data } = await axios.post<PricerItem[]>(
      URL + "?" + query,
      payload,
      janiceConfig
    );

    return janiceItems
      .map((ji) => {
        const price = data.find((d) => d.itemType.eid === ji.id)
          ?.immediatePrices.sellPrice;
        return (price ?? 0) * ji.amount;
      })
      .reduce((a, b) => a + b, 0);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status >= 500 && error.response.status < 600) {
        // if this is a 5xx, just raise a warning
        LOGGER.warning("Janice Appraisal server-side error.\n" + error.message);
      } else if (error.response.status >= 400 && error.response.status < 500) {
        // Bad request!?
        LOGGER.error(
          `Janice Appraisal bad request.\n${error.message
          }\nRequest: ${JSON.stringify(error.request)}`
        );
      }
    } else {
      LOGGER.error("Janice Appraisal error.\n" + error);
    }
  }

  return 0;
}
