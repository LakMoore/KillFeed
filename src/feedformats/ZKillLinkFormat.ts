import { KillMail } from "../zKillboard/zKillboard";
import { BaseFormat } from "./Fomat";

export const ZKillLinkFormat: BaseFormat = {
  getMessage: (killmail: KillMail, kill: boolean) => {
    return Promise.resolve({
      content: `https://zkillboard.com/kill/${killmail.killmail_id}/`,
    });
  },
};
