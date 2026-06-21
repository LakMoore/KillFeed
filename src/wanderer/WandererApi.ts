const EVENT_TYPES = [
  "add_system",
  "deleted_system",
  "system_metadata_changed",
  "map_kill",
] as const;

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function parseWandererMapUrl(input: string): {
  domain: string;
  mapId: string;
} {
  const trimmed = input.trim();
  const normalized = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, "https://")
    : `https://${trimmed}`;

  const url = new URL(normalized);
  const pathSegments = url.pathname.split("/").filter(Boolean);

  const mapsIndex = pathSegments.findIndex(
    (segment) => segment === "maps" || segment === "map",
  );
  const mapId =
    mapsIndex >= 0 ? pathSegments[mapsIndex + 1] : pathSegments.at(-1);

  if (!mapId) {
    throw new Error("Could not find a map slug in that Wanderer URL.");
  }

  return {
    domain: url.origin,
    mapId: decodeURIComponent(mapId),
  };
}

export function getWandererSystemsUrl(domain: string, mapId: string): string {
  return new URL(
    `/api/v1/maps/${encodeURIComponent(mapId)}/systems`,
    normalizeBaseUrl(domain),
  ).toString();
}

export function getWandererEventsStreamUrl(
  domain: string,
  mapId: string,
): string {
  return new URL(
    `/api/v1/maps/${encodeURIComponent(mapId)}/events/stream?events=${EVENT_TYPES.join(",")}&format=legacy`,
    normalizeBaseUrl(domain),
  ).toString();
}
