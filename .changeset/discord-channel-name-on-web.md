---
"@sideline/domain": patch
"@sideline/server": patch
"@sideline/bot": patch
---

Fix newly created Discord channels not showing their name on the web by upserting the channel into the discord_channels table immediately after creation.
