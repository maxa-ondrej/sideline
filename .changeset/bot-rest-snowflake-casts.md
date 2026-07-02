---
"@sideline/bot": patch
---

Eliminate the `channel.id as Snowflake` / `role.id as Snowflake` casts across the bot's Discord REST helpers (`rest/channels/*`, `rest/roles/createGuildRole`) by using the sanctioned refinement-free brand constructor `Discord.Snowflake.makeUnsafe(...)` — the same pattern already used for `parent_id`. No behavior change (`makeUnsafe` produces the identical branded value the cast asserted).
