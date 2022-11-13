export interface GuildSettings {
  GuildID: string;
  Alliances: Set<number>;
  Corporations: Set<number>;
  Characters: Set<number>;
}

export class Config {
  private static instance: Config;

  public guildSettings = new Map<string, GuildSettings>();

  // in the following maps the keys are Eve IDs and the values are lists of
  // Discord Channel IDs that are listening for the match
  public matchedAlliances = new Map<number, Set<string>>();
  public matchedCorporations = new Map<number, Set<string>>();
  public matchedCharacters = new Map<number, Set<string>>();

  private constructor() {}

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
}
