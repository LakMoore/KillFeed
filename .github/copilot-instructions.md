# KillFeed Copilot Instructions

## Project Overview

KillFeed is a Discord bot that streams EVE-Online killmails from zKillboard and Janice, with channel-based filtering. It's a TypeScript/Node.js application using discord.js v14 and persistent storage via node-persist.

## Architecture

### Core Components

**Data Layer** (`src/Data.ts`): Singleton that manages bot statistics (server count, channel count, kill count, etc.) with auto-save every 30 seconds using node-persist. Statistics persist across restarts.

**Config Layer** (`src/Config.ts`): Singleton storing channel subscriptions and filter mappings. Structure:

- `allSubscriptions`: Map of Discord channel IDs → SubscriptionSettings (filters, format, display mode)
- `matched*`: Maps of EVE entity IDs → Set of Discord channel IDs listening for them (for O(1) filtering)

**Command System** (`src/Commands.ts`): Array of Command objects extending discord.js SlashCommandBuilder. Each command must implement `run(client, interaction)` and be added to the Commands array.

**Event Listeners** (`src/listeners/`): Discord.js event handlers registered in Bot.ts. `ready.ts` launches the main poll loop after registering slash commands.

### Data Flow

1. **Poll Loop** (`listeners/ready.ts`): Infinite loop calls the zKillboard service poller, which controls pacing/backoff and sequence iteration
2. **Fetch** (`zKillboard/zKillboardService.ts`): Poller reads R2Z2 `sequence.json`, fetches sequence files, and processes `esi` + `zkb` payload blocks
3. **Filter** (`zKillboardService.ts`, `prepAndSend()`): Match killmail against all subscription filters using O(1) lookups
4. **Format** (`feedformats/`): Convert killmail to Discord embed/message based on channel's ResponseFormat setting
5. **Send**: Post to matching Discord channels with permission/rate limit handling

### Key Files

- **Bot.ts**: Entry point; initializes Data, registers listeners, configures axios retry
- **zKillboardService.ts**: Core polling and filtering logic; `prepAndSend()` evaluates filters and sends
- **Config.ts**: In-memory subscription registry; `matched*` maps enable efficient filtering
- **Channels.ts, Servers.ts**: Load/sync Discord state to Config on startup and guild events

## Development Patterns

### Commands

All commands follow this pattern:

```typescript
const builder = new SlashCommandBuilder().setName('cmd').setDescription('...');
export const CommandName: Command = {
  ...builder.toJSON(),
  run: async (client, interaction) => {
    /* handler */
  },
};
```

Commands are deferred in `interactionCreate.ts` before execution to allow long-running operations. Errors automatically post to interaction reply (or log if token expires).

### Filtering

Filters use boolean OR by default; `RequireAllFilters=true` switches to AND. Killmail matches if:

- Victim or attacker alliance/corp/character in filter lists, OR
- Ship type matches, OR
- Solar system/constellation/region matches

Filters defined in `SubscriptionSettings` as Sets for efficient lookup.

### ESI Integration

Use `fetchESIIDs()` to resolve EVE entity names to IDs (characters, corporations, alliances, ships, regions, etc.). Responses are cached by `CachedESI`.

### Logging

Use `LOGGER` singleton (helpers/Logger.ts):

- `info()`: Always logged
- `debug()`: Only in NODE_ENV=development
- `warning()`: Logged + posted to error channel on support Discord
- `error()`: Logged + posted to error channel

## Build & Run

```bash
npm run build      # Compile TypeScript to dist/
npm start          # Run dist/Bot.js
npm run prod-build-run  # Compile and run (used in Docker)
```

Requires `.env` with:

- `SECRET_TOKEN`: Discord bot token
- Optional: `OUTBOUND_IP` for multi-NIC deployments, `NODE_ENV=development` for debug logging

## Key Integrations

- **zKillboard R2Z2**: Ephemeral sequence-based killmail stream
- **EVE ESI API**: Fetch killmail details and entity name↔ID mappings
- **Janice API**: Get appraisal values for kills
- **discord.js v14**: Client API, slash commands, intents
- **node-persist**: Local JSON storage (default ~/.local/share/node-persist/)

## Common Tasks

**Add new command**: Create file in `src/commands/`, implement Command interface, add to Commands array.

**Add new filter type**: Add Set to SubscriptionSettings, add matched\* map to Config, update CommandHelpers with type constants, add ESI fetch logic in add.ts.

**Update message format**: Implement BaseFormat interface in `feedformats/`, add to format options in commands (add.ts, init.ts).

**Modify filter logic**: Edit `zKillboardService.ts` `shouldSendToChannel()` or `prepAndSend()` filter evaluation.

## Wanderer Mapper Integration

KillFeed now integrates with the third-party Wanderer mapper to receive map system lists and real-time map events (SSE). This enables "OnMap" filtering and notifications for channels connected to a Wanderer map.

- **Files:** `src/wanderer/WandererApi.ts`, `src/wanderer/WandererEventsClient.ts`, `src/wanderer/WandererMaps.ts`, `src/wanderer/WandererTypes.ts`, `src/commands/wanderer.ts`, plus hooks in `src/listeners/ready.ts` and usage in `src/zKillboard/zKillboardService.ts`.
- **How it works:**
  - `/wanderer connect <map_url> <api_key>` calls `connectWandererMap()` which:
    - Parses the provided Wanderer URL and derives a canonical `mapPath` (domain/slug).
    - Encrypts the provided API key using HKDF-SHA256 + AES-256-GCM, binding the ciphertext to the `mapPath`. The encrypted blob is stored on the channel subscription as `EncryptedDetails`.
    - Calls `syncMapSystems()` to fetch `/api/maps/{map}/systems` and populate `WandererMaps` (in-memory) for fast runtime lookups.
  - On startup `startWandererEventStreams()` (invoked from `listeners/ready.ts`) starts SSE streams for each connected channel via `WandererEventsClient`, subscribing to event types: `add_system`, `deleted_system`, `system_metadata_changed`, and `map_kill`.
  - Incoming SSE events are parsed and applied via `WandererMaps` (`addSystem`, `removeSystem`) so the bot maintains an up-to-date, in-memory set of systems for each map.
  - `zKillboardService` consults `WandererMaps.isSystemOnMap()` when evaluating whether a killmail is "OnMap" and to apply the channel's Wanderer-related behavior (pings, OnMap message formatting, exclusions).
- **Runtime behavior & state:**
  - Systems are stored in-memory only (not persisted to disk); `syncMapSystems()` is called on connect and at startup to repopulate state.
  - Per-channel settings are stored on the channel subscription under `WandererSettings` (fields include `Slug`, `Domain`, `EncryptedDetails`, `createdAt`, `PingRole`, `ExcludeSystemIDs`).
  - Channels can maintain an exclusion list of systems (`ExcludeSystemIDs`) to suppress Wanderer notifications per-channel.
- **Commands:** The `Wanderer` command exposes these subcommands in `src/commands/wanderer.ts`:
  - `connect` — connect channel to a Wanderer map (`map_url`, `api_key`)
  - `disconnect` — remove integration for this channel
  - `status` — show current connection and tracked system count
  - `restart` — attempt to restart the SSE stream for this channel
  - `set_ping` — set a server role to ping for OnMap messages
  - `exclude` / `unexclude` / `list-excludes` — manage per-channel excluded systems
- **Security:**
  - The integration uses a `WANDERER_SECRET` env var to derive encryption keys via HKDF. Ensure `WANDERER_SECRET` is set in production; otherwise encrypted data cannot be decrypted reliably.
  - Encrypted API keys are stored in the channel subscription as a four-part `salt:iv:cipher:tag` base64 blob.
- **Errors & recovery:**
  - Non-fatal stream errors are logged and the channel receives a message describing the issue. If the stream terminates unexpectedly it is marked `terminatedEarly` and users can call `/wanderer restart` to re-establish it.
