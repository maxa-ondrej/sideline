---
"@sideline/domain": minor
"@sideline/server": minor
"@sideline/web": minor
"@sideline/bot": minor
"@sideline/migrations": minor
"@sideline/i18n": minor
---

Add training game result logging. Coaches (any member with `member:edit`) open a training event and split the RSVP-yes attendees into Team A / Team B, then record the winner (Team A / Team B / Draw); multiple games (rounds) can be logged per session. Saving a result applies an incremental Elo update via the existing rating engine — the new game's id is recorded on each `player_rating_history` row — and best-effort auto-logs training attendance for all RSVP-yes members (deduplicated per UTC day). Two new tables (`training_games`, `training_game_participants`) back the feature. The `/training result` Discord command is a convenience deep-link: it replies with an ephemeral link to the web result editor, listing loggable trainings (including just-finished ones) via the new `Event/GetLoggableTrainingEvents` RPC. Logged games are immutable for now.
