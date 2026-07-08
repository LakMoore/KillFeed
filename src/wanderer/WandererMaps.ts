import { Config } from '../Config';
import type { WandererSystem, WandererConnection } from './WandererTypes';

export class WandererMaps {
  private static instance: WandererMaps;

  // MapPath (domain/slug) → Map of solar system ID → full WandererSystem
  private readonly systems = new Map<string, Map<number, WandererSystem>>();

  // MapPath → list of connections returned by the Wanderer systems endpoint
  private readonly connections = new Map<string, WandererConnection[]>();

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

  public addSystem(mapId: string, system: WandererSystem): void {
    let map = this.systems.get(mapId);
    if (!map) {
      map = new Map();
      this.systems.set(mapId, map);
    }
    map.set(Number(system.solar_system_id), system);
  }

  public removeSystem(mapId: string, solarSystemId: number): void {
    this.systems.get(mapId)?.delete(solarSystemId);
  }

  public setSystemsForMap(mapId: string, systems: Iterable<WandererSystem>): void {
    const map = new Map<number, WandererSystem>();
    for (const s of systems) {
      map.set(Number(s.solar_system_id), s);
    }
    this.systems.set(mapId, map);
  }

  public getSystemsForMap(mapId: string): Map<number, WandererSystem> | undefined {
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

  // ---------------------------------------------------------------------------
  // Connections tracking
  // ---------------------------------------------------------------------------

  public setConnectionsForMap(mapId: string, conns: WandererConnection[]): void {
    this.connections.set(mapId, conns);
  }

  public getConnectionsForMap(mapId: string): WandererConnection[] | undefined {
    return this.connections.get(mapId);
  }
}
