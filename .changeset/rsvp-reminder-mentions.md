---
"@sideline/bot": patch
"@sideline/server": patch
"@sideline/domain": patch
"@sideline/i18n": patch
---

Show Discord mentions alongside names in RSVP reminder messages and the late-RSVP channel

- RSVP reminder embeds now render attendees as `**Name** (<@id>)` instead of `**Name**` alone, matching the format used in the attendees list.
- Late-RSVP notifications (posted to the channel configured via `discord_channel_late_rsvp` after the reminder is sent) also now include the user's name alongside the mention, sourced from the new name fields on `SubmitRsvpResult`.
- Reminder attendee lists now truncate with a localised "…and N more" suffix when the joined text would exceed Discord's 1024-character embed-field limit, preventing `createMessage` from failing for large teams.
- Closes a related edge case in the attendees list where a user with only `display_name` (no name/nickname/username) would render as mention-only.
