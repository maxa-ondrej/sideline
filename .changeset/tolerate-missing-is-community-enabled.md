---
'@sideline/domain': patch
---

Tolerate missing `is_community_enabled` in the `Guild/RegisterGuild` RPC payload by defaulting the key to `false` during decode. Prevents the server from erroring with `Missing key at ["is_community_enabled"]` when a stale pre-0.12.0 bot replica is still calling `RegisterGuild` mid-deploy. Once the upgraded bot boots, `Guild/SyncCommunityFlags` (fired on `READY`) overwrites the default with the real value from Discord's `guild.features`.
