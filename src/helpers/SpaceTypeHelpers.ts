import { CachedESI } from '../esi/cache';
import { LOGGER } from './Logger';

export const SPACE_TYPE_WORMHOLE = 'wormhole';
export const SPACE_TYPE_HIGHSEC = 'highsec';
export const SPACE_TYPE_LOWSEC = 'lowsec';
export const SPACE_TYPE_NULLSEC = 'nullsec';
export const SPACE_TYPE_POCHVEN = 'pochven';
export const SPACE_TYPE_ABYSSAL = 'abyssal';

export const SPACE_TYPES = [
  SPACE_TYPE_WORMHOLE,
  SPACE_TYPE_HIGHSEC,
  SPACE_TYPE_LOWSEC,
  SPACE_TYPE_NULLSEC,
  SPACE_TYPE_POCHVEN,
  SPACE_TYPE_ABYSSAL,
] as const;

export type SpaceType = (typeof SPACE_TYPES)[number];

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  [SPACE_TYPE_WORMHOLE]: 'Wormhole (J-space)',
  [SPACE_TYPE_HIGHSEC]: 'High-Sec',
  [SPACE_TYPE_LOWSEC]: 'Low-Sec',
  [SPACE_TYPE_NULLSEC]: 'Null-Sec',
  [SPACE_TYPE_POCHVEN]: 'Pochven',
  [SPACE_TYPE_ABYSSAL]: 'Abyssal',
};

// J-space (including Thera and shattered systems) and Abyssal Deadspace sit in their own
// solar system ID ranges, so they are recognised without an ESI lookup.
const J_SPACE_MIN_SYSTEM_ID = 31000000;
const ABYSSAL_MIN_SYSTEM_ID = 32000000;

// Pochven shares the k-space ID range and has a negative security status, so it can only be
// told apart from null-sec by its region.
const POCHVEN_REGION_ID = 10000070;

// CCP rounds security status for display, so 0.45 and above is shown as 0.5 - High-Sec.
const HIGH_SEC_THRESHOLD = 0.45;

export function isSpaceType(value: string): value is SpaceType {
  return (SPACE_TYPES as readonly string[]).includes(value);
}

/**
 * Works out which kind of space a solar system belongs to.
 *
 * Returns undefined when the system cannot be classified (an ESI failure, for instance) so that
 * callers can fall through and send the killmail rather than swallowing it.
 */
export async function getSpaceType(
  solarSystemId: number
): Promise<SpaceType | undefined> {
  if (solarSystemId >= ABYSSAL_MIN_SYSTEM_ID) {
    return SPACE_TYPE_ABYSSAL;
  }

  if (solarSystemId >= J_SPACE_MIN_SYSTEM_ID) {
    return SPACE_TYPE_WORMHOLE;
  }

  try {
    const system = await CachedESI.getSystem(solarSystemId);
    const security = system?.security_status;

    if (typeof security !== 'number') {
      return undefined;
    }

    if (security >= HIGH_SEC_THRESHOLD) {
      return SPACE_TYPE_HIGHSEC;
    }

    if (security > 0) {
      return SPACE_TYPE_LOWSEC;
    }

    const region = await CachedESI.getRegionForSystem(solarSystemId);

    if (region?.region_id === POCHVEN_REGION_ID) {
      return SPACE_TYPE_POCHVEN;
    }

    return SPACE_TYPE_NULLSEC;
  }
  catch (error) {
    LOGGER.error(
      `Error while working out the space type for system ${solarSystemId}. ${error}`
    );
    return undefined;
  }
}
