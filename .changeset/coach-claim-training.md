---
'@sideline/bot': minor
'@sideline/server': minor
'@sideline/domain': minor
'@sideline/migrations': patch
'@sideline/i18n': patch
---

feat: add coach claim training feature

Coaches can now volunteer to organize trainings via a dedicated Discord message posted to the owners group's channel. The message contains a Claim button that toggles to Release once claimed, and the regular reminder cron also posts a "still no coach" reminder when a training stays unclaimed at reminder time.
