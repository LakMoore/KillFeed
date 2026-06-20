import { formatISKValue } from "../helpers/JaniceHelper";
import { PLEX } from "../Plex";
import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";
import { BaseFormat, ZKMailType } from "./Fomat";
import { buildInsightFooterText, setInsightFooter } from "./InsightFormat";
import { InsightWithAppraisalFormat } from "./InsightWithAppraisalFormat";

async function formatISKWithUSD(value: number) {
  const usdValue = await PLEX.convertISKtoUSD(value);
  const formattedValue = formatISKValue(value);

  if (usdValue && usdValue !== "") {
    return `${formattedValue} (${usdValue})`;
  }

  return formattedValue;
}

export const InsightWithPLEXFormat: BaseFormat = {
  ...InsightWithAppraisalFormat,
  getMessage: async (
    killmail: KillMail,
    zkb: ZkbOnly,
    mailType: ZKMailType,
    appraisedValue: number,
  ) => {
    const message = await InsightWithAppraisalFormat.getMessage(
      killmail,
      zkb,
      mailType,
      appraisedValue,
    );

    const zKillValue = await formatISKWithUSD(zkb.zkb.totalValue);
    const janiceValue = await formatISKWithUSD(appraisedValue);

    return setInsightFooter(
      message,
      buildInsightFooterText(zKillValue, janiceValue),
    );
  },
};
