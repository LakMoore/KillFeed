import storage from "node-persist";
import { LOGGER } from "./helpers/Logger";
import { sleep } from "./listeners/ready";

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
    try {
      await storage.init();
      const temp: Statistics = await storage.getItem(Data.DATA_KEY);
      if (temp) {
        this._stats = temp;
      }
    } catch (error) {
      LOGGER.error("Failed to load data from disk. " + error);
    }
  }

  get stats() {
    return this._stats;
  }

  public async startAutoSaving() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Explicit infinite loop
      try {
        await this.save();
        await sleep(SAVE_DELAY_MS);
      } catch (error) {
        LOGGER.error("Failed to save data to disk. " + error);
        await sleep(SAVE_DELAY_MS * 10);
      }
    }
  }

  public async save() {
    try {
      LOGGER.debug("Persisting data to filesystem...");
      await storage.setItem(Data.DATA_KEY, this._stats);
    } catch (error) {
      LOGGER.error("Failed to save data to disk. " + error);
    }
  }

  public async clear() {
    await storage.clear();
    LOGGER.error("Cleared all persistent storage!!!");
  }
}
