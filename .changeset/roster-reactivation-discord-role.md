---
"@sideline/domain": patch
"@sideline/server": patch
"@sideline/bot": patch
"@sideline/web": patch
"@sideline/i18n": patch
---

Fix roster reactivation not re-adding members to the Discord role

When a roster was reactivated, the bot re-created the Discord role but never re-added the roster's members, so the role came back empty. The bot's roster channel-created handler now backfills all current roster members onto the role, and is idempotent — if a role mapping already exists it reuses that role instead of creating a duplicate. Members are added with per-member failure isolation (a single failed add no longer aborts the sync) and no retries on permanent errors.

Adds a manual "Sync with Discord" action on rosters (matching the existing group action) so captains can re-apply members on demand. This first phase re-adds members (add/heal); pruning stale role-holders is a planned follow-up.
