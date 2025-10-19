# KillFeed by Lak Moore

Discord bot to post filtered killmails from the Massively Multiplayer Online Role Playing Game (MMORPG) EVE-Online using data from zKillboard and Janice.

This project began as a complete re-write of the discontinued Insight Bot (https://github.com/EVEInsight/Insight)

Join the Discord server for community, feedback, support and to see some test feeds.
https://discord.gg/VNF7Dt43b8

## Changelog

v1.0.8 [October 2025]
 - added `/filter_mode` command to enable filters to be ANDed together.  PR from Val. Thank you.
 - Re-worked the rate limiter to catch up on backlogs more quickly

v1.0.7 [October 2025]
 - added `/add system <name>` command.  Feature request from Kaeda Maxwell. Thank you.
 
v1.0.6 [November 2024]
 - Appraisal values additionally shown in USD

v1.0.5 [May 2024]
 - added `/add Constellation <name>` command
 - added `/show kills/losses/all` command
 - improved `/info`

v1.0.4 [Sept 2023]
 - added `/ping_target` command
 - 
v1.0.3 [Sept 2023]
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

| Command | Description |
| ------------- | ------------- |
| /init | Intialise the channel and set up the bot, needs Send Message and Manage Message permissions.  Note: the bot does not have Read Permissions on messages so cannot read any messages in any channel on your server. | 
| /add | Add a rule to the filter in this channel. |
| /remove | Remove a rule from the filter in this channel. |
| /show | Choose whether to show Killmails, Lossmails or both. |
| /filter_mode | Choose whether to apply boolean OR or AND to the filters in this channel. |
| /min_isk | Only show results above a minimum value in ISK. |
| /help | Show this information |
| /info | Shows details of the current filter in this channel. |
| /test | The very next killmail from zKill will be sent to the channel (ignoring filters). Note: this might not be instantaneous! |

Join the [KillFeed by Lak Moore Discord](https://discord.gg/m4pyj2q8X9) for support and feature requests.

