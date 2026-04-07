---
"@sideline/server": patch
---

Fix SQL error when updating event series with null end_time. Added explicit `::time` cast in CASE WHEN clause so PostgreSQL can determine the parameter type.
