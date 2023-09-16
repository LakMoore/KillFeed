import axios, { AxiosRequestConfig } from "axios";
import { KillMail } from "src/zKillboard/zKillboard";

interface PricerItem {
  immediatePrices: {
    buyPrice: number;
    splitPrice: number;
    sellPrice: number;
  };
  itemType: {
    eid: number;
    name: string;
  };
}

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

    const url = "https://janice.e-351.com/api/rest/v2/pricer";
    const params = {
      market: "2",
    };
    const query = new URLSearchParams(params).toString();

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
      url + "?" + query,
      payload,
      janiceConfig
    );

    return janiceItems
      .map((ji) => {
        const price = data.find((d) => d.itemType.eid === ji.id)
          ?.immediatePrices.sellPrice;
        return (price ?? 0) * ji.amount;
      })
      .reduce((a, b) => a + b);

    // console.log(JSON.stringify(evePraisalItems));
    // console.log("-----------------");
    // console.log(JSON.stringify(data));
  } catch (error) {
    console.log("Janice Appraisal error", error);
  }

  return 0;
}
