---
"@sideline/bot": patch
---

Paginate RSVP reminder attendee and non-responder lists across multiple embed fields

Previously the reminder message failed for large teams because the non-responder list exceeded Discord's 1024-character embed field limit, causing every reminder to be rejected with `BASE_TYPE_MAX_LENGTH`. The previous fix truncated the list with "…and N more"; this replaces that with full pagination: names are split across as many consecutive embed fields as needed so all members are always shown.
