---
'@sideline/bot': patch
'@sideline/server': patch
'@sideline/domain': patch
---

When an event starts, push the original embed up into the past section and apply the started color/banner consistently. Also recover from messages that have been deleted in Discord — `editMessage` and `handleStarted`'s in-place edit fall back to creating a new message and saving the new ID, and the bot runs a one-time scan on connect to recreate any messages that went missing while it was offline.
