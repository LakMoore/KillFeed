import { Name } from "./fetch";

export class CachedESI {
  private static instance: CachedESI;

  private characters = new Map<number, string>();
  private corporations = new Map<number, string>();
  private alliances = new Map<number, string>();
  private systems = new Map<number, string>();
  private items = new Map<number, string>();

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

  public static getSystemName(systemId: number) {
    return CachedESI.getInstance().systems.get(systemId);
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

  public static setSystemName(systemId: number, systemName: string) {
    return CachedESI.getInstance().systems.set(systemId, systemName);
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
      case "solar_system":
        this.setSystemName(item.id, item.name);
        break;
      case "inventory_type":
        this.setItemName(item.id, item.name);
        break;
    }
  }
}
