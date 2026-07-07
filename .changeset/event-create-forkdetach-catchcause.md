---
"@sideline/bot": patch
---

Fix the `/event`-create modal hanging on "Sideline is thinking…" when event creation fails in the background fork with an untagged defect. The detached fork that resolves the deferred ephemeral reply now has a `catchCause` backstop (mirroring the profile-complete handler) that always updates the original webhook message, so a server-side defect (e.g. a `LogicError.die` surfaced from the `Event/CreateEvent` RPC) can no longer leave the interaction unresolved. Adds handler-level tests covering the success and defect paths.
