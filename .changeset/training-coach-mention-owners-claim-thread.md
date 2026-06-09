---
"@sideline/server": patch
"@sideline/bot": patch
"@sideline/domain": patch
"@sideline/migrations": patch
"@sideline/i18n": patch
---

fix(event): mention the assigned coach on training start and consolidate claim embeds into one owners thread

When a training starts, the "Starting now" post now mentions the assigned coach
instead of pinging the whole member group. If no coach has claimed the training
(or the coach has no linked Discord account), the post instead pings the owners
group with a "no coach claimed this training" warning. Non-training events are
unchanged and still ping the member group.

Coach claim embeds are no longer posted as a separate thread per training. Each
owners group now has a single persistent claim thread (a new
`discord_channel_mappings.claim_thread_id` column, created lazily and race-safe
via an atomic save) into which all claim embeds are posted. When a training
starts, its claim message is removed from that thread to keep it tidy. Three new
RPCs (`Event/GetOwnerClaimThread`, `Event/SaveOwnerClaimThread`,
`Event/ClearOwnerClaimThread`) back the persistent thread, and `EventStartedEvent`
now carries the coach's Discord id.
