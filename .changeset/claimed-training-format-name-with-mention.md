---
'@sideline/domain': patch
'@sideline/server': patch
'@sideline/bot': patch
---

Render the claimer of a training in the Discord claim-message embed using the same `**Name** (<@discord-id>)` formatter that already powers the events RSVP attendees embed, so claimers now appear with their Discord mention instead of just a plain display name. Identity is resolved at read-time via a join in the sync-event outbox, with a fallback to the snapshotted display name for orphaned rows — no database migration required.
