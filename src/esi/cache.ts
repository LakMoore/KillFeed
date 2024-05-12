import {
  GetUniverseConstellationsConstellationIdOk,
  GetUniverseRegionsRegionIdOk,
  GetUniverseSystemsSystemIdOk,
  UniverseApiFactory,
} from "eve-client-ts";
import { Name } from "./fetch";
import { FancyMap } from "./FancyMap";

export class CachedESI {
  private static instance: CachedESI;

  private characters = new FancyMap<number, string>();
  private corporations = new FancyMap<number, string>();
  private alliances = new FancyMap<number, string>();
  private systems = new FancyMap<number, GetUniverseSystemsSystemIdOk>();
  private constellations = new FancyMap<
    number,
    GetUniverseConstellationsConstellationIdOk
  >();
  private regions = new FancyMap<number, GetUniverseRegionsRegionIdOk>();
  private items = new FancyMap<number, string>();

  private constructor() {}

  public static getInstance(): CachedESI {
    if (!CachedESI.instance) {
      CachedESI.instance = new CachedESI();
    }
    return CachedESI.instance;
  }

  public static getCharacterName(characterId: number) {
    return CachedESI.getInstance().characters.get(characterId);
  }

  public static getCorporationName(corporationId: number) {
    return CachedESI.getInstance().corporations.get(corporationId);
  }

  public static getAllianceName(allianceId: number) {
    return CachedESI.getInstance().alliances.get(allianceId);
  }

  public static getSystem(systemId: number) {
    return CachedESI.getInstance().systems.getOrDefault(systemId, (systemId) =>
      UniverseApiFactory().getUniverseSystemsSystemId(systemId)
    );
  }

  public static getConstellation(constellationId: number) {
    return CachedESI.getInstance().constellations.getOrDefault(
      constellationId,
      (constellationId) =>
        UniverseApiFactory().getUniverseConstellationsConstellationId(
          constellationId
        )
    );
  }

  public static getRegion(regionId: number) {
    return CachedESI.getInstance().regions.getOrDefault(regionId, (regionId) =>
      UniverseApiFactory().getUniverseRegionsRegionId(regionId)
    );
  }

  public static async getRegionForSystem(solar_system_id: number) {
    const constellation = await CachedESI.getConstellationForSystem(
      solar_system_id
    );
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
      case "character":
        this.setCharacterName(item.id, item.name);
        break;
      case "corporation":
        this.setCorporationName(item.id, item.name);
        break;
      case "alliance":
        this.setAllianceName(item.id, item.name);
        break;
      case "inventory_type":
        this.setItemName(item.id, item.name);
        break;
    }
  }
}
