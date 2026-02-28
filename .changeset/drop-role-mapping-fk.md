---
'@sideline/migrations': patch
---

Drop role_id foreign key from discord_role_mappings so role deletion is not blocked by existing mappings
