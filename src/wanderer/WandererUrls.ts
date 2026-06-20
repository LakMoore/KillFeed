const WEBHOOK_PATH_SLUG = "killfeed";

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed;
}

export function getWandererPublicBaseUrl(): string {
  const configured =
    process.env.WANDERER_PUBLIC_URL?.trim() ||
    process.env.WANDERER_WEBHOOK_URL?.trim();

  if (!configured) {
    return "http://localhost:3000";
  }

  try {
    const normalized = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(configured)
      ? normalizeBaseUrl(configured)
      : `https://${normalizeBaseUrl(configured)}`;
    return new URL(normalized).origin;
  } catch {
    return normalizeBaseUrl(configured);
  }
}

export function getWandererWebhookUrl(channelId: string): string {
  return new URL(
    `/api/wanderer/webhook/${WEBHOOK_PATH_SLUG}/${encodeURIComponent(channelId)}`,
    getWandererPublicBaseUrl(),
  ).toString();
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
