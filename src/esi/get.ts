import { UniverseApiFactory } from "eve-client-ts";
import { Character } from "../zKillboard/zKillboard";
import { CachedESI } from "./cache";
import { fetchESINames } from "./fetch";

export interface Result {
  character?: string;
  corporation?: string;
  alliance?: string;
  ship?: string;
  system?: string;
}

export function getCharacterNames(
  characterIds: Character,
  system: number
): Promise<Result> {
  const missingIds: number[] = [];
  const result: Result = {
    character: CachedESI.getCharacterName(characterIds.character_id),
    corporation: CachedESI.getCorporationName(characterIds.corporation_id),
    alliance: CachedESI.getAllianceName(characterIds.alliance_id),
    ship: CachedESI.getItemName(characterIds.ship_type_id),
    system: CachedESI.getSystemName(system),
  };

  if (!result.character) {
    missingIds.push(characterIds.character_id);
  }
  if (!result.corporation) {
    missingIds.push(characterIds.corporation_id);
  }
  if (!result.alliance) {
    missingIds.push(characterIds.alliance_id);
  }
  if (!result.ship) {
    missingIds.push(characterIds.ship_type_id);
  }
  if (!result.system && system) {
    missingIds.push(system);
  }

  const missedIds = missingIds.filter((v) => v);

  if (missedIds.length === 0) {
    return Promise.resolve(result);
  }

  return fetchESINames(missedIds)
    .then((names) => {
      names.forEach((name) => {
        CachedESI.addItem(name);
      });
    })
    .then(() => {
      return {
        character: CachedESI.getCharacterName(characterIds.character_id),
        corporation: CachedESI.getCorporationName(characterIds.corporation_id),
        alliance: CachedESI.getAllianceName(characterIds.alliance_id),
        ship: CachedESI.getItemName(characterIds.ship_type_id),
        system: CachedESI.getSystemName(system),
      };
    });
}

export async function getRegionForSystem(solar_system_id: number) {
  const system = await UniverseApiFactory().getUniverseSystemsSystemId(
    solar_system_id
  );

  const constellation =
    await UniverseApiFactory().getUniverseConstellationsConstellationId(
      system.constellation_id
    );

  const region = await UniverseApiFactory().getUniverseRegionsRegionId(
    constellation.region_id
  );

  return region.region_id;
}
