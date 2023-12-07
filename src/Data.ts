import storage from "node-persist";
import { consoleLog } from "./helpers/Logger";
import { sleep } from "./zKillboard/zKillboardService";

export interface Statistics {
  ServerCount: number;
  ChannelCount: number;
  PollCount: number;
  KillMailCount: number;
  PostedCount: number;
  StatsStarted: Date;
  BotStarted: Date;
  ISKAppraised: number;
}

const SAVE_DELAY_MS = 30 * 1000; // 30 seconds in milliseconds

export class Data {
  private static DATA_KEY = "statistics";
  private _stats: Statistics = {
    ServerCount: 0,
    ChannelCount: 0,
    PollCount: 0,
    KillMailCount: 0,
    PostedCount: 0,
    StatsStarted: new Date(),
    BotStarted: new Date(),
    ISKAppraised: 0,
  };

  public async init() {
    await storage.init();
    const temp: Statistics = await storage.getItem(Data.DATA_KEY);
    if (temp) {
      this._stats = temp;
    }

    // save in a little while
    setTimeout((data) => Data.autoSave(data), SAVE_DELAY_MS, this);
  }

  get stats() {
    return this._stats;
  }

  public static async autoSave(that: Data) {
    await that.save();
    await sleep(SAVE_DELAY_MS);
    // infinite loop required
    setTimeout((data) => Data.autoSave(data), 1, that);
  }

  public async save() {
    consoleLog("Persisting data to filesystem...");
    await storage.setItem(Data.DATA_KEY, this._stats);
  }

  public async clear() {
    await storage.clear();
    consoleLog("Cleared all persistent storage!!!");
  }
}
