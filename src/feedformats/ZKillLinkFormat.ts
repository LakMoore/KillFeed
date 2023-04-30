import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";
import { BaseFormat } from "./Fomat";

export const ZKillLinkFormat: BaseFormat = {
  getMessage: (
    killmail: KillMail,
    zkb: ZkbOnly,
    kill: boolean,
    evePraisal: number
  ) => {
    return Promise.resolve({
      content: `https://zkillboard.com/kill/${killmail.killmail_id}/`,
    });
  },
};
