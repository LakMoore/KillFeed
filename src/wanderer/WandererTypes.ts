import type { WANDERER_EVENT_TYPES } from './WandererApi';

export interface WandererEventsSetupResult {
  slug: string;
  domain: string;
  EncryptedDetails?: string;
  createdAt?: string;
}

export interface WandererBasePayload {
  solar_system_id: number;
  timestamp: string;
}

export interface WandererAddSystemPayload extends WandererBasePayload {
  position_x: number;
  position_y: number;
}

export type WandererDeletedSystemPayload = WandererBasePayload;

export interface WandererSystemMetadataPayload extends WandererBasePayload {
  // UUID string for the system in Wanderer (may be present as `system_id`)
  system_id?: string;
  // Human-friendly name (may be null)
  name: string | null;
  // Optional temporary/custom naming fields
  temporary_name?: string | null;
  // Textual description assigned in the map (may be null)
  description?: string | null;
  // JSON-encoded labels blob as a string (example: '{"customLabel":"","labels":[]}')
  labels?: string | null;
  // Whether the system is locked on the map
  locked?: boolean;
  // Map coordinates
  position_x?: number;
  position_y?: number;
  // Numeric status flag (map-specific meaning)
  status?: number;
}

export interface WandererMapKillPayload extends WandererBasePayload {
  killmail_id: string;
}

export interface WandererEvent {
  id: string;
  timestamp: string;
  map_id: string;
  type: (typeof WANDERER_EVENT_TYPES)[number];
  payload:
    | WandererAddSystemPayload
    | WandererDeletedSystemPayload
    | WandererSystemMetadataPayload
    | WandererMapKillPayload;
}

// Types for full system & connection responses from the Wanderer API
export interface WandererConnection {
  id: string;
  type: number;
  inserted_at: string;
  updated_at: string;
  locked: boolean;
  map_id: string;
  solar_system_source: number;
  solar_system_target: number;
  mass_status: number;
  time_status: number;
  ship_size_type: number;
  wormhole_type: string | null;
}

export interface WandererSystem {
  solar_system_id: number;
  id?: string;
  name?: string | null;
  status?: number;
  tag?: string | null;
  visible?: boolean;
  description?: string | null;
  labels?: string | null;
  inserted_at?: string;
  updated_at?: string;
  locked?: boolean;
  map_id?: string;
  temporary_name?: string | null;
  custom_name?: string | null;
  position_x?: number;
  position_y?: number;
  original_name?: string | null;
  timestamp: string;
}

export interface WandererSystemsResponse {
  connections: WandererConnection[];
  systems: WandererSystem[];
}
