# KillFeed by Lak Moore

Discord bot to post filtered killmails from the Massive Multiplayer Online Role Playing Game (MMORPG) EVE-Online using data from zKillboard (https://zkillboard.com/) using Janice (https://janice.e-351.com/) for a second opinion on prices and optionally integrating with the popular mapping system, Wanderer (https://wanderer.ltd/).

This project began as a complete re-write of the discontinued Insight Bot (https://github.com/EVEInsight/Insight)

Join the Discord server for community, feedback, support and to see some test feeds.
https://discord.gg/VNF7Dt43b8

See the section below the Changelog for installation instructions.

## Changelog

v1.0.16 [11th July 2026]

- Wanderer system names are applied to ANY Killmails or Lossmails, not just those from the map.
- `/wanderer exclude_sec_above` will accept values as low as -2. This will have the effect of muting ALL Killmails from the map in this channel. (incase you want the system names without the extra alerts).
- Wanderer system now maintains a single server-server connection per map, instead of per channel. A Discord server can connect multiple channels to Wanderer without increasing load on either Wanderer or KillFeed servers.
- Added 'None' as an option to the `/show` command. This will filter out any mails that match your filter. Use this if you have a Wanderer subscription in the channel but don't want to see your own kills and losses from the map.

v1.0.15 [8th July 2026]

- Adapt the Wanderer Killmails to also show custom system names from the map.

v1.0.14 [July 2026]

- Add per-channel Wanderer security threshold: `/wanderer exclude_sec_above <threshold>` — set a numeric `security_status` threshold (e.g. `0.1`, `-0.5`, `0.0`) and KillFeed will ignore OnMap killmails from systems whose `security_status` is greater than the configured value.
- `/wanderer status` now reports the configured security threshold for the channel.

v1.0.13 [July 2026]

- Wanderer (https://wanderer.ltd/) integration for KillFeed. If you run the mapper, you can now get notified about any kills that occur in the systems on your map. If you don't run this mapper then this isn't going to help you, sorry.
  - `/wanderer connect` Add a new connection to a Wanderer map to this channel. You need the URL and the API Key for the map. Only the map owner can generate the API Key.
  - `/wanderer disconnect` Delete the Wanderer connection for this channel
  - `/wanderer status` Display info about the Wanderer connection in this channel.
  - `/wanderer restart` If your Wanderer map goes down the connection will fail, use this command when you map is available again.
  - `/wanderer set_ping` If you want a ping when the kill is from systems on your map, set the role here.
  - `/wanderer exclude` Provide systems that might be on the map that you don't want to track (e.g. Jita)
  - `/wanderer unexclude` Remove a system from the exclude list.
  - `/wanderer list-excludes` See the current systems in the exclude list.

v1.0.12 [June 2026]

- add `/set_format` command to change the format of the message sent to Discord for each kill mail
- Discord fixed their rate limits for pinned message, so we can remove out delay during startup
- Add per-channel Discord send rate-limiter
- update eslint and associated packages to latest

v1.0.11 [March 2026]

- Migrate zKill from old RedisQ to new R2Z2 server

v1.0.10 [December 2025]

- Discord changed permissions for pinned messages

v1.0.9 [November 2025]

- KillMail data no longer served by zKill. Must be fetched separately from ESI.

v1.0.8 [October 2025]

- added `/filter_mode` command to enable filters to be ANDed together. PR from Val. Thank you.
- Re-worked the rate limiter to catch up on backlogs more quickly

v1.0.7 [October 2025]

- added `/add system <name>` command. Feature request from Kaeda Maxwell. Thank you.

v1.0.6 [November 2024]

- Appraisal values additionally shown in USD

v1.0.5 [May 2024]

- added `/add Constellation <name>` command
- added `/show kills/losses/all` command
- improved `/info`

v1.0.4 [Sept 2023]

- added `/ping_target` command
- v1.0.3 [Sept 2023]
- Added `/add region <RegionName>` command
- Added System Sec Status and Region name to the embedded report.

v1.0.2 [June 2023]

- Added the `/min_isk` command to add a filter to a channel. Killmails with a zKill value less than the value provided will not be shown in your channel. Use a value of 0 to remove this filter.

v1.0.1 [April 2023]

- Added an EvePraisal value to the output. Valuations from ZKill were getting very stale. KillFeed will now show you the current Jita sell value for the hull, fittings and cargo. Data provided by https://evepraisal.com/

## Installation and use

Step 1:
Add the live, hosted, bot to your server using the following link:
https://discord.com/api/oauth2/authorize?client_id=1041057662432968745&permissions=2048&scope=bot%20applications.commands

Step 2:
Issue the `/init` command to create the in channel config message

Step 3:
Use the `/add` and `/remove` commands to add/remove Corporations, Alliances, Characters, Ship types, etc. to the filter for your channel.

## Commands

| Command      | Description                                                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| /init        | Intialise the channel and set up the bot, needs Send Message and Manage Message permissions. Note: the bot does not have Read Permissions on messages so cannot read any messages in any channel on your server. |
| /add         | Add a rule to the filter in this channel.                                                                                                                                                                        |
| /remove      | Remove a rule from the filter in this channel.                                                                                                                                                                   |
| /show        | Choose whether to show Killmails, Lossmails or both.                                                                                                                                                             |
| /filter_mode | Choose whether to apply boolean OR or AND to the filters in this channel.                                                                                                                                        |
| /min_isk     | Only show results above a minimum value in ISK.                                                                                                                                                                  |
| /space_type  | Only show killmails from certain kinds of space (wormhole, high-sec, low-sec, null-sec, Pochven, abyssal). Use `Everywhere` to clear it.                                                                                                                                                                  |
| /help        | Show this information                                                                                                                                                                                            |
| /info        | Shows details of the current filter in this channel.                                                                                                                                                             |
| /test        | The very next killmail from zKill will be sent to the channel (ignoring filters). Note: this might not be instantaneous!                                                                                         |

Join the [KillFeed by Lak Moore Discord](https://discord.gg/m4pyj2q8X9) for support and feature requests.
