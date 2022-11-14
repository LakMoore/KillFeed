# KillFeed
Eve Online zKillboard Discord Bot

A complete re-write of the discontinued Insight Bot (https://github.com/EVEInsight/Insight)

Step 1:
Add the bot to your server using the following link:
https://discord.com/api/oauth2/authorize?client_id=1041057662432968745&permissions=2048&scope=bot%20applications.commands

Step 2:
Add a pinned message to the channel where you want the kill mails to appear, ensure you "mention" KillFeed in that pinned message

Step 3:
Add Corporations, Alliances or Characters to the filter for your channel by editting the pinned message using the following format (one row per ID)
```
@KillFeed
character/91218379/
corporation/98532165/
alliance/99010787/
```

Step 4:
Issue the ```/update``` command in the channel to have KillFeed read the settings from then pinned message

Optional:
```/test``` command will have the very next killmail sent to your channel
