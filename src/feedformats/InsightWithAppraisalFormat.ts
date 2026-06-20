import { formatISKValue } from "../helpers/JaniceHelper";
import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";
import { BaseFormat, ZKMailType } from "./Fomat";
import {
  buildInsightFooterText,
  InsightFormat,
  setInsightFooter,
} from "./InsightFormat";

export const InsightWithAppraisalFormat: BaseFormat = {
  ...InsightFormat,
  getMessage: async (
    killmail: KillMail,
    zkb: ZkbOnly,
    mailType: ZKMailType,
    appraisedValue: number,
  ) => {
    const message = await InsightFormat.getMessage(
      killmail,
      zkb,
      mailType,
      appraisedValue,
    );

    return setInsightFooter(
      message,
      buildInsightFooterText(
        formatISKValue(zkb.zkb.totalValue),
        formatISKValue(appraisedValue),
      ),
    );
  },
};
