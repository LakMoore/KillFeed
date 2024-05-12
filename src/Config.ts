import { TextChannel } from "discord.js";

export interface SubscriptionSettings {
  Channel: TextChannel;
  ResponseFormat: "Embed" | "zKill";
  FullTest: boolean;
  Alliances: Set<number>;
  Corporations: Set<number>;
  Characters: Set<number>;
  Ships: Set<number>;
  Regions: Set<number>;
  Constellations: Set<number>;
  MinISK: number | undefined;
  RoleToPing: string | undefined;
  PauseForChanges: boolean;
  Show: string;
}

export class Config {
  private static instance: Config;

  public allSubscriptions = new Map<string, SubscriptionSettings>();

  // in the following maps the keys are Eve IDs and the values are lists of
  // Discord Channel IDs that are listening for the match
  public matchedAlliances = new Map<number, Set<string>>();
  public matchedCorporations = new Map<number, Set<string>>();
  public matchedCharacters = new Map<number, Set<string>>();
  public matchedShips = new Map<number, Set<string>>();
  public matchedRegions = new Map<number, Set<string>>();
  public matchedConstellations = new Map<number, Set<string>>();

  // a set of channels that have requested a test killmail
  public testRequests = new Set<string>();

  private constructor() {}

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
}
