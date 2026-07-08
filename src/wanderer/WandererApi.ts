// Core Wanderer URL and parsing utilities

export const WANDERER_EVENT_TYPES = [
  'add_system',
  'deleted_system',
  'system_metadata_changed',
  'connection_added',
  'connection_removed',
  'connection_updated',
] as const;

function normalizeBaseUrl(value: string): string {
  let s = value.trim();
  while (s.endsWith('/')) {
    s = s.slice(0, -1);
  }
  return s;
}

export function parseWandererMapUrl(input: string): {
  domain: string;
  mapId: string;
} {
  const trimmed = input.trim();
  const normalized = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, 'https://')
    : `https://${trimmed}`;

  const url = new URL(normalized);
  const pathSegments = url.pathname.split('/').filter(Boolean);

  const mapsIndex = pathSegments.findIndex(
    (segment) => segment === 'maps' || segment === 'map'
  );
  const mapId =
    mapsIndex >= 0 ? pathSegments[mapsIndex + 1] : pathSegments.at(-1);

  if (!mapId) {
    throw new Error('Could not find a map slug in that Wanderer URL.');
  }

  return {
    domain: url.origin,
    mapId: decodeURIComponent(mapId),
  };
}

export function getWandererSystemsUrl(domain: string, mapId: string): string {
  return new URL(
    `/api/maps/${encodeURIComponent(mapId)}/systems`,
    normalizeBaseUrl(domain)
  ).toString();
}

export function getWandererEventsStreamUrl(
  domain: string,
  mapId: string
): string {
  return new URL(
    `/api/maps/${encodeURIComponent(mapId)}/events/stream?events=${WANDERER_EVENT_TYPES.join(',')}`,
    normalizeBaseUrl(domain)
  ).toString();
}
