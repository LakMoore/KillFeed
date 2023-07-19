import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";
import { BaseFormat, ZKMailType } from "./Fomat";

export const ZKillLinkFormat: BaseFormat = {
  getMessage: (
    killmail: KillMail,
    zkb: ZkbOnly,
    mailType: ZKMailType,
    appraisedValue: number
  ) => {
    return Promise.resolve({
      content: `https://zkillboard.com/kill/${killmail.killmail_id}/`,
    });
  },
};
