export interface WandererConnection {
  channelId: string;
  mapId: string;
  domain: string;
  apiKey: string;
  createdAt: string;
}

export interface WandererEventsSetupResult {
  mapId: string;
  domain: string;
}

export interface WandererAddSystemPayload {
  solar_system_id: number;
  name: string;
}

export interface WandererDeletedSystemPayload {
  solar_system_id: number;
}

export interface WandererSystemMetadataPayload {
  solar_system_id: number;
  name: string;
}

export interface WandererMapKillPayload {
  solar_system_id: number;
  killmail_id: string;
}

export type WandererEventType =
  | "add_system"
  | "map_kill"
  | "deleted_system"
  | "system_metadata_changed";

export interface WandererEvent {
  map_id: string;
  type: WandererEventType;
  payload:
    | WandererAddSystemPayload
    | WandererDeletedSystemPayload
    | WandererSystemMetadataPayload
    | WandererMapKillPayload;
}
