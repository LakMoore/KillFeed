import { MessageCreateOptions } from "discord.js";
import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";

export interface BaseFormat {
  getMessage: (
    data: KillMail,
    zkb: ZkbOnly,
    kill: boolean
  ) => Promise<MessageCreateOptions>;
}
