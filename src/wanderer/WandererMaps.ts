import { Config } from '../Config';

export class WandererMaps {
  private static instance: WandererMaps;

  // ChannelId → Map of solar system ID → metadata (createdAt)
  private readonly systems = new Map<
    string,
    Map<number, { createdAt: string }>
  >();

  private constructor() {}

  public static getInstance(): WandererMaps {
    if (!WandererMaps.instance) {
      WandererMaps.instance = new WandererMaps();
    }
    return WandererMaps.instance;
  }

  // Iterate active wanderer connections derived from SubscriptionSettings
  public forEachConnection(
    cb: (channelId: string, mapPath: string) => void
  ): void {
    const cfg = Config.getInstance();
    cfg.allSubscriptions.forEach((sub, channelId) => {
      const ws = sub?.WandererSettings;
      const mapPath =
        ws?.Domain && ws.Slug ? `${ws.Domain}/${ws.Slug}` : undefined;
      if (mapPath) cb(channelId, mapPath);
    });
  }

  // ---------------------------------------------------------------------------
  // System tracking
  // ---------------------------------------------------------------------------

  public addSystem(mapId: string, solarSystemId: number): void {
    let map = this.systems.get(mapId);
    if (!map) {
      map = new Map();
      this.systems.set(mapId, map);
    }
    if (!map.has(solarSystemId)) {
      map.set(solarSystemId, { createdAt: new Date().toISOString() });
    }
  }

  public removeSystem(mapId: string, solarSystemId: number): void {
    this.systems.get(mapId)?.delete(solarSystemId);
  }

  public setSystemsForMap(
    mapId: string,
    solarSystemIds: Iterable<number>
  ): void {
    const map = new Map<number, { createdAt: string }>();
    const now = new Date().toISOString();
    for (const id of solarSystemIds) {
      map.set(id, { createdAt: now });
    }
    this.systems.set(mapId, map);
  }

  public getSystemsForMap(
    mapId: string
  ): Map<number, { createdAt: string }> | undefined {
    return this.systems.get(mapId);
  }

  public isSystemOnMap(channelId: string, solarSystemId: number): boolean {
    const cfg = Config.getInstance();
    const sub = cfg.allSubscriptions.get(channelId);
    const ws = sub?.WandererSettings;
    const mapPath =
      ws?.Domain && ws.Slug ? `${ws.Domain}/${ws.Slug}` : undefined;
    if (!mapPath) return false;
    return this.systems.get(mapPath)?.has(solarSystemId) ?? false;
  }

  public getSystemCountForMap(mapId: string): number {
    return this.systems.get(mapId)?.size ?? 0;
  }
}
