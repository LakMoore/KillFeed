export interface WandererConnection {
  channelId: string;
  mapId: string;
  webhookId?: string;
  webhookSecret: string;
  createdAt: string;
}

export interface WandererSetupCompleteRequest {
  channelId: string;
  setupToken: string;
  mapId: string;
  webhookSecret: string;
  webhookId?: string;
}

export interface WandererCreateWebhookResponse {
  data?: {
    id?: string;
    secret?: string;
  };
  id?: string;
  secret?: string;
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

export interface WandererWebhookEvent {
  map_id: string;
  type: WandererEventType;
  payload:
    | WandererAddSystemPayload
    | WandererDeletedSystemPayload
    | WandererSystemMetadataPayload
    | WandererMapKillPayload;
}
