import { Package } from "../zKillboard";
import { BaseFormat } from "./Fomat";

export const ZKillLinkFormat: BaseFormat = {
  getMessage: (data: Package, kill: boolean) => {
    return {
      content: `https://zkillboard.com/kill/${data.package.killID}/`,
    };
  },
};
