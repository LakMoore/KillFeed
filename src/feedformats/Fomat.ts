import type { MessageCreateOptions } from 'discord.js';
import type { KillMail, ZkbOnly } from '../zKillboard/zKillboard';

export enum ZKMailType {
  Kill,
  Loss,
  Neutral,
  OnMap,
}

export interface BaseFormat {
  getMessage: (
    data: KillMail,
    zkb: ZkbOnly,
    type: ZKMailType,
    appraisedValue: number
  ) => Promise<MessageCreateOptions>;
}
