---
"@sideline/bot": patch
---

DRY up the RCP sync-event failure handling: extract the identical log-then-metric tail (`Effect.logWarning` + `syncEventsFailedTotal` bump) that ten ProcessorServices ran after marking an event failed into a shared `recordSyncFailure` helper. Each processor's `Effect.catch` now calls `recordSyncFailure(rpc['<Domain>/Mark…Failed']({…}), { syncType, message, error })`; the mark-failed RPC call stays at the call site (its method, id field, and error stringification vary per domain, including the channel processor's permanent/transient branch). No behavior change. inviteGenerator/onboarding (custom counters + classified errors) and personalEvents (no mark-failed path) are intentionally left as-is.
