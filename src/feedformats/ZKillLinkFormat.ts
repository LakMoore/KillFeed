import type { KillMail, ZkbOnly } from '../zKillboard/zKillboard';
import type { BaseFormat, ZKMailType } from './Fomat';

export const ZKillLinkFormat: BaseFormat = {
  getMessage: (
    killmail: KillMail,
    _zkb: ZkbOnly,
    _mailType: ZKMailType,
    _appraisedValue: number
  ) => {
    return Promise.resolve({
      content: `https://zkillboard.com/kill/${killmail.killmail_id}/`,
    });
  },
};
