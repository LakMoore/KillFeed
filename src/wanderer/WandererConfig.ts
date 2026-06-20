import storage from "node-persist";
import { LOGGER } from "../helpers/Logger";
import { WandererConnection } from "./WandererTypes";

const CONNECTIONS_KEY = "wandererConnections";
const SYSTEMS_KEY = "wandererSystems";

export class WandererConfig {
  private static instance: WandererConfig;

  // channelId → connection
  private connections = new Map<string, WandererConnection>();
  // mapId → Set of solar system IDs currently on the map
  private systems = new Map<string, Set<number>>();

  private constructor() {}

  public static getInstance(): WandererConfig {
    if (!WandererConfig.instance) {
      WandererConfig.instance = new WandererConfig();
    }
    return WandererConfig.instance;
  }

  public async init(): Promise<void> {
    try {
      const savedConnections: [string, WandererConnection][] | undefined =
        await storage.getItem(CONNECTIONS_KEY);
      if (savedConnections) {
        this.connections = new Map(savedConnections);
      }

      const savedSystems: [string, number[]][] | undefined =
        await storage.getItem(SYSTEMS_KEY);
      if (savedSystems) {
        this.systems = new Map(
          savedSystems.map(([mapId, ids]) => [mapId, new Set(ids)]),
        );
      }

      LOGGER.info(
        `WandererConfig loaded: ${this.connections.size} connections, ` +
          `${this.systems.size} maps tracked`,
      );
    } catch (error) {
      LOGGER.error("Failed to load WandererConfig from disk. " + error);
    }
  }

  public async save(): Promise<void> {
    try {
      await storage.setItem(CONNECTIONS_KEY, [...this.connections.entries()]);
      await storage.setItem(
        SYSTEMS_KEY,
        [...this.systems.entries()].map(([mapId, ids]) => [
          mapId,
          [...ids],
        ]),
      );
    } catch (error) {
      LOGGER.error("Failed to save WandererConfig to disk. " + error);
    }
  }

  // ---------------------------------------------------------------------------
  // Connection management
  // ---------------------------------------------------------------------------

  public addConnection(connection: WandererConnection): void {
    this.connections.set(connection.channelId, connection);
  }

  public removeConnection(channelId: string): WandererConnection | undefined {
    const connection = this.connections.get(channelId);
    if (connection) {
      this.connections.delete(channelId);
      // Clean up systems if no other channel uses this map
      if (!this.hasConnectionForMap(connection.mapId)) {
        this.systems.delete(connection.mapId);
      }
    }
    return connection;
  }

  public getConnectionByChannelId(
    channelId: string,
  ): WandererConnection | undefined {
    return this.connections.get(channelId);
  }

  public getConnectionsByMapId(mapId: string): WandererConnection[] {
    return [...this.connections.values()].filter((c) => c.mapId === mapId);
  }

  public hasConnections(): boolean {
    return this.connections.size > 0;
  }

  public hasConnectionForMap(mapId: string): boolean {
    return [...this.connections.values()].some((c) => c.mapId === mapId);
  }

  public forEachConnection(
    cb: (channelId: string, connection: WandererConnection) => void,
  ): void {
    this.connections.forEach((connection, channelId) => cb(channelId, connection));
  }

  // ---------------------------------------------------------------------------
  // System tracking
  // ---------------------------------------------------------------------------

  public addSystem(mapId: string, solarSystemId: number): void {
    let systems = this.systems.get(mapId);
    if (!systems) {
      systems = new Set();
      this.systems.set(mapId, systems);
    }
    systems.add(solarSystemId);
  }

  public removeSystem(mapId: string, solarSystemId: number): void {
    this.systems.get(mapId)?.delete(solarSystemId);
  }

  public getSystemsForMap(mapId: string): Set<number> | undefined {
    return this.systems.get(mapId);
  }

  public isSystemOnMap(channelId: string, solarSystemId: number): boolean {
    const connection = this.connections.get(channelId);
    if (!connection) return false;
    return this.systems.get(connection.mapId)?.has(solarSystemId) ?? false;
  }

  public getSystemCountForMap(mapId: string): number {
    return this.systems.get(mapId)?.size ?? 0;
  }
}
