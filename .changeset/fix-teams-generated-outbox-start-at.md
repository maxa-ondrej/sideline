---
"@sideline/server": patch
---

Fix the `teams_generated` outbox event so posting generated teams to Discord works. The enqueue query stored `event_start_at` as a raw epoch-0 `DateTime` interpolated straight into SQL, which persisted a JSON-quoted string the bot's sync poller could not decode — throwing `Invalid DateTime input` and stalling the entire Discord sync poll loop (no event/RSVP/claim/roster sync processed until the bad row was cleared). The query now binds the event's real `start_at`/`end_at` through the same `DateTimeFromIsoString` encoding path the other emitters use, so the stored value is a bare ISO string that decodes cleanly.
