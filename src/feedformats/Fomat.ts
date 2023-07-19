import { MessageCreateOptions } from "discord.js";
import { KillMail, ZkbOnly } from "../zKillboard/zKillboard";

export enum ZKMailType {
  Kill,
  Loss,
  Neutral,
}

export interface BaseFormat {
  getMessage: (
    data: KillMail,
    zkb: ZkbOnly,
    type: ZKMailType,
    appraisedValue: number
  ) => Promise<MessageCreateOptions>;
}
