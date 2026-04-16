---
"@sideline/bot": patch
---

Show Discord mentions alongside names in RSVP reminder messages

RSVP reminder embeds now render attendees as `**Name** (<@id>)` instead of `**Name**` alone, matching the format used in the attendees list. Also closes a related edge case in the attendees list where a user with only `display_name` (no name/nickname/username) would render as mention-only.
