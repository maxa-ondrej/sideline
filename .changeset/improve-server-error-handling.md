---
'@sideline/server': patch
---

Improve server error handling: restructure repositories to use private class fields, replace Effect.orDie with targeted Effect.catchTag('SqlError', 'ParseError', Effect.die) so only infrastructure errors become defects while NoSuchElementException remains typed
