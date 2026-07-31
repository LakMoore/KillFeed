import type {
  GetUniverseConstellationsConstellationIdOk,
  GetUniverseRegionsRegionIdOk,
  GetUniverseSystemsSystemIdOk,
} from 'eve-client-ts';
import { StatusApiFactory, UniverseApiFactory } from 'eve-client-ts';
import { fetchESINames, type Name } from './fetch';
import { FancyMap } from './FancyMap';
import { LOGGER } from '../helpers/Logger';

export class CachedESI {
  private static instance: CachedESI;

  private readonly characters = new FancyMap<number, string>();
  private readonly corporations = new FancyMap<number, string>();
  private readonly alliances = new FancyMap<number, string>();
  private readonly systems = new FancyMap<
    number,
    GetUniverseSystemsSystemIdOk
  >();
  private readonly constellations = new FancyMap<
    number,
    GetUniverseConstellationsConstellationIdOk
  >();
  private readonly regions = new FancyMap<
    number,
    GetUniverseRegionsRegionIdOk
  >();
  private readonly items = new FancyMap<number, string>();

  private static readonly EVE_DOWNTIME_RETRY_MS = 2 * 60 * 1000;

  private constructor() {}

  public static getInstance(): CachedESI {
    if (!CachedESI.instance) {
      CachedESI.instance = new CachedESI();
    }
    return CachedESI.instance;
  }

  private static isHttpError(
    error: unknown
  ): error is Error & { status: number } {
    return (
      error instanceof Error
      && 'status' in error
      && typeof (error as { status: unknown }).status === 'number'
      && (error as { status: number }).status >= 400
    );
  }

  // call the fetcher
  // if we get an HTTP error, check if the Eve Server is available
  // if not, wait 2 mins and try again, continue to wait until the server is available
  // only return the result of the fetcher when we get a successful response
  // only throw if we get no response and the server is available
  public static async getFromESIWithDowntimeRetry<T, U>(
    id: U,
    fetcher: (id: U) => Promise<T>
  ): Promise<T> {
    let caughtError: unknown;

    try {
      return await fetcher(id);
    }
    catch (error) {
      caughtError = error;
    }

    if (!CachedESI.isHttpError(caughtError)) {
      throw caughtError;
    }

    // if the server is available, throw the error
    try {
      const serverStatus = await StatusApiFactory().getStatus();
      if (serverStatus.players > 0) {
        throw caughtError;
      }
    }
    catch (statusError) {
      if (CachedESI.isHttpError(statusError)) {
        LOGGER.info(
          'Failed to get server status; assuming downtime '
            + String(statusError)
        );
      }
      else {
        LOGGER.error('Failed to get Eve server status' + String(statusError));
      }
    }

    // eve is down, wait until it is back up and try again
    let players = 0;

    while (players === 0) {
      try {
        await new Promise((resolve) =>
          setTimeout(resolve, CachedESI.EVE_DOWNTIME_RETRY_MS)
        );
        const serverStatus = await StatusApiFactory().getStatus();
        players = serverStatus?.players ?? 0;
      }
      catch (statusError) {
        LOGGER.info(
          'Failed to get server status; assuming downtime '
            + String(statusError)
        );
      }
    }

    // eve is back up, try the fetcher again
    return CachedESI.getFromESIWithDowntimeRetry(id, fetcher);
  }

  public static getCharacterName(characterId: number) {
    return CachedESI.getInstance().characters.get(characterId);
  }

  public static hasCharacterName(characterId: number) {
    return CachedESI.getInstance().characters.has(characterId);
  }

  static async getCharacterNames(characterIds: number[]) {
    const missingIDs = characterIds.filter(
      (id) => !!id && !CachedESI.hasCharacterName(id)
    );

    if (missingIDs.length > 0) {
      const names = await CachedESI.getFromESIWithDowntimeRetry(
        missingIDs,
        fetchESINames
      );

      names.forEach((name) => {
        CachedESI.addItem(name);
      });
    }

    return characterIds
      .filter(Boolean)
      .map((id) => CachedESI.getInstance().characters.get(id));
  }

  public static getCorporationName(corporationId: number) {
    if (!corporationId) {
      return Promise.resolve('');
    }
    return CachedESI.getInstance().corporations.getOrDefault(
      corporationId,
      (corporationId) =>
        CachedESI
          .getFromESIWithDowntimeRetry([corporationId], fetchESINames)
          .then((names) => {
            if (names.length === 0) {
              throw new Error(
                `No name found for corporation ID ${corporationId}`
              );
            }
            CachedESI.addItem(names[0]);
            return names[0].name;
          })
    );
  }

  public static hasCorporation(corporation_id: number) {
    return CachedESI.getInstance().corporations.has(corporation_id);
  }

  static async getCorporationNames(corporationIds: number[]) {
    const missingIDs = corporationIds.filter(
      (id) => !!id && !CachedESI.hasCorporation(id)
    );

    if (missingIDs.length > 0) {
      const names = await CachedESI.getFromESIWithDowntimeRetry(
        missingIDs,
        fetchESINames
      );

      names.forEach((name) => {
        CachedESI.addItem(name);
      });
    }

    return corporationIds
      .filter(Boolean)
      .map((id) => CachedESI.getInstance().corporations.get(id));
  }

  public static getAllianceName(allianceId: number): Promise<string> {
    if (!allianceId) {
      return Promise.resolve('');
    }
    return CachedESI.getInstance().alliances.getOrDefault(
      allianceId,
      (allianceId) =>
        CachedESI
          .getFromESIWithDowntimeRetry([allianceId], fetchESINames)
          .then((names) => {
            if (names.length === 0) {
              throw new Error(`No name found for alliance ID ${allianceId}`);
            }
            CachedESI.addItem(names[0]);
            return names[0].name;
          })
    );
  }

  public static hasAlliance(alliance_id: number) {
    return CachedESI.getInstance().alliances.has(alliance_id);
  }

  public static async getAllianceNames(
    allianceIds: number[]
  ): Promise<string[]> {
    const missingIDs = allianceIds.filter(
      (id) => !!id && !CachedESI.hasAlliance(id)
    );

    if (missingIDs.length > 0) {
      const names = await CachedESI.getFromESIWithDowntimeRetry(
        missingIDs,
        fetchESINames
      );

      names.forEach((name) => {
        CachedESI.addItem(name);
      });
    }

    return allianceIds
      .filter(Boolean)
      .map((id) => CachedESI.getInstance().alliances.get(id));
  }

  public static getSystem(systemId: number) {
    return CachedESI.getInstance().systems.getOrDefault(
      systemId,
      (systemId) =>
        CachedESI.getFromESIWithDowntimeRetry(
          systemId,
          UniverseApiFactory().getUniverseSystemsSystemId
        )
    );
  }

  public static getConstellation(constellationId: number) {
    return CachedESI.getInstance().constellations.getOrDefault(
      constellationId,
      (constellationId) =>
        CachedESI.getFromESIWithDowntimeRetry(
          constellationId,
          UniverseApiFactory().getUniverseConstellationsConstellationId
        )
    );
  }

  public static getRegion(regionId: number) {
    return CachedESI.getInstance().regions.getOrDefault(
      regionId,
      (regionId) =>
        CachedESI.getFromESIWithDowntimeRetry(
          regionId,
          UniverseApiFactory().getUniverseRegionsRegionId
        )
    );
  }

  public static async getRegionForSystem(solar_system_id: number) {
    const constellation =
      await CachedESI.getConstellationForSystem(solar_system_id);
    return await CachedESI.getRegion(constellation.region_id);
  }

  public static async getConstellationForSystem(solar_system_id: number) {
    const system = await CachedESI.getSystem(solar_system_id);
    return await CachedESI.getConstellation(system.constellation_id);
  }

  public static getItemName(itemId: number) {
    return CachedESI.getInstance().items.get(itemId);
  }

  public static setCharacterName(characterId: number, characterName: string) {
    return CachedESI.getInstance().characters.set(characterId, characterName);
  }

  public static setCorporationName(
    corporationId: number,
    corporationName: string
  ) {
    return CachedESI.getInstance().corporations.set(
      corporationId,
      corporationName
    );
  }

  public static setAllianceName(allianceId: number, allianceName: string) {
    return CachedESI.getInstance().alliances.set(allianceId, allianceName);
  }

  public static setItemName(itemId: number, itemName: string) {
    return CachedESI.getInstance().items.set(itemId, itemName);
  }

  public static addItem(item: Name) {
    switch (item.category) {
    case 'character':
      this.setCharacterName(item.id, item.name);
      break;
    case 'corporation':
      this.setCorporationName(item.id, item.name);
      break;
    case 'alliance':
      this.setAllianceName(item.id, item.name);
      break;
    case 'inventory_type':
      this.setItemName(item.id, item.name);
      break;
    }
  }
}
