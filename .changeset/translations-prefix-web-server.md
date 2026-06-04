---
'@sideline/server': patch
'@sideline/web': patch
---

Pick up the corrected Translations API endpoint paths (08fb679c). The server now mounts the translations endpoints at `/api/translations` (instead of the double-prefixed `/api/api/translations`), and the web client requests them at the matching `/api/translations`. This restores translation-override loading and fixes the CSV/JSON export route.
