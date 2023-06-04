# KillFeed

Eve Online zKillboard Discord Bot

A complete re-write of the discontinued Insight Bot (https://github.com/EVEInsight/Insight)

Join the Discord server for community, feedback, support and to see some test feeds.
https://discord.gg/VNF7Dt43b8

## Changelog

v1.0.2 [June 2023]
Added the `/min_isk` command to add a filter to a channel. Killmails with a zKill value less than the value provided will not be shown in your channel. Use a value of 0 to remove this filter.

v1.0.1 [April 2023]
Added an EvePraisal value to the output. Valuations from ZKill were getting very stale. KillFeed will now show you the current Jita sell value for the hull, fittings and cargo. Data provided by https://evepraisal.com/

## Installation and use

Step 1:
Add the live, hosted, bot to your server using the following link:
https://discord.com/api/oauth2/authorize?client_id=1041057662432968745&permissions=2048&scope=bot%20applications.commands

Step 2:
Issue the `/init` command to create the in channel config message

Step 3:
Use the `/add` and `/remove` commands to add/remove Corporations, Alliances, Characters or Ship types to the filter for your channel

Optional Commands:

- `/help` shows the above information
- `/info` shows the current settings for the bot
- `/test` command will have the very next killmail sent to your channel (ignoring filters)
- `/min_isk` filter out low value killmails
