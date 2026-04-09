---
"@sideline/web": patch
---

Fix "Invalid date" crash on training type detail page caused by PostgreSQL TIME columns returning HH:mm:ss format, which broke utcTimeToLocal when it appended :00Z.
