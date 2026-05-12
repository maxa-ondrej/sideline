---
'@sideline/bot': patch
'@sideline/server': patch
---

Trigger bot and server deploys to pick up `@sideline/domain@0.17.2`, which makes `is_community_enabled` optional in the `Guild/RegisterGuild` RPC payload (defaults to `false` when absent). Resolves the production `Missing key at ["is_community_enabled"]` decode errors caused by deploy-window skew between bot and server replicas.
