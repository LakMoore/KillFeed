import { TextChannel } from 'discord.js';
import { SpaceType } from './helpers/SpaceTypeHelpers';

export interface SubscriptionSettings {
  Channel: TextChannel;
  ResponseFormat:
    | 'Embed'
    | 'EmbedFormat'
    | 'InsightWithAppraisal'
    | 'InsightWithPLEX'
    | 'zKill';
  FullTest: boolean;
  Alliances: Set<number>;
  Corporations: Set<number>;
  Characters: Set<number>;
  Ships: Set<number>;
  Regions: Set<number>;
  Constellations: Set<number>;
  Systems: Set<number>;
  // Kinds of space this channel wants killmails from. Empty means every kind.
  SpaceTypes: Set<SpaceType>;
  WandererSettings?: {
    Slug: string;
    EncryptedDetails: string;
    Domain: string;
    createdAt?: string;
    ExcludeSystemIDs: Set<string>;
    PingRole?: string;
    // When set to a numeric threshold, killmails originating from map systems
    // whose `security_status` is greater than the configured value will be
    // ignored for this channel. Example: `0.1`, `-0.5`, `0.0`.
    ExcludeSecAbove?: number;
  };
  MinISK: number | undefined;
  RoleToPing: string | undefined;
  PauseForChanges: boolean;
  Show: string;
  RequireAllFilters: boolean;
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
  public matchedSystems = new Map<number, Set<string>>();
  public matchedSpaceTypes = new Map<SpaceType, Set<string>>();

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
