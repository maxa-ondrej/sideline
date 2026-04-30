# Plan — Coach claim training (revised)

**Branch:** `feat/coach-claim-training`
**Bug:** [add the option to "claim" a training as a coach](https://app.notion.com/p/add-the-option-to-claim-a-training-as-an-coach-34f93506081880f88cbaeea8835aefeb) (Critical 🔥)

## Goals

1. **New, separate Discord message** posted to the **owners group's channel** when a training is created. Contains a Claim button. Editable in place to reflect claim state. **The existing event embed is left untouched.**
2. Cron-driven reminder posted to the owners channel (mentioning the owners role) when a training is still unclaimed at reminder-window time. Separate from the standard RSVP reminder.

## Key decisions

- **Two messages per training in owners channel**: the existing event embed (unchanged) AND a new claim message.
- **Schema:** column-on-events for both the domain field and the Discord-state IDs:
  - `events.claimed_by UUID` (FK `team_members(id)` ON DELETE SET NULL)
  - `events.claim_discord_channel_id TEXT`
  - `events.claim_discord_message_id TEXT`
- **Sync events:**
  - `training_claim_request` — emitted when a training is created and `owner_group_id` resolves to a channel. Bot posts the claim message and saves `claim_discord_*` IDs.
  - `training_claim_update` — emitted whenever `claimed_by` changes (claim/unclaim) or the event is cancelled. Bot edits the existing claim message in place (or strips its components on cancel).
  - `unclaimed_training_reminder` — emitted by `RsvpReminderCron` when training+unclaimed+owner-channel. Bot posts a separate "still no coach" message with role mention + jump link.
- **Cron:** reuse `RsvpReminderCron` window — no new schedule.
- **Out of scope (dropped):** Reassign-for-admins, UnclaimOnGroupLeave hook, repost-on-manual-delete, "unclaimed at start time" embed state.

## State machine — `events.claimed_by`

| State | `status` | `claimed_by` | Claim-message buttons | Allowed RPC |
| --- | --- | --- | --- | --- |
| unclaimed | `active` | `NULL` | Claim | `Event/ClaimTraining` |
| claimed-by-X | `active` | `tm_id` | Release | `Event/UnclaimTraining` (only X) |
| cancelled | `cancelled` | any | none | none |
| started | `started` | any | none | none |

Atomicity:
- claim → `UPDATE events SET claimed_by=$tm WHERE id=$id AND status='active' AND event_type='training' AND claimed_by IS NULL RETURNING id`
- unclaim → `UPDATE events SET claimed_by=NULL WHERE id=$id AND status='active' AND claimed_by=$tm RETURNING id`

## Migration

`packages/migrations/src/before/1745900000_add_event_claim.ts` (highest current = `1745800000`):

1. `ALTER TABLE events ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES team_members(id) ON DELETE SET NULL`
2. `ALTER TABLE events ADD COLUMN IF NOT EXISTS claim_discord_channel_id TEXT`
3. `ALTER TABLE events ADD COLUMN IF NOT EXISTS claim_discord_message_id TEXT`
4. `CREATE INDEX IF NOT EXISTS idx_events_claimed_by_unclaimed ON events (team_id) WHERE event_type='training' AND status='active' AND claimed_by IS NULL`
5. DROP + re-ADD `event_sync_events_event_type_check` to include `'training_claim_request'`, `'training_claim_update'`, `'unclaimed_training_reminder'`
6. `ALTER TABLE event_sync_events ADD COLUMN IF NOT EXISTS claimed_by_member_id UUID`
7. `ALTER TABLE event_sync_events ADD COLUMN IF NOT EXISTS claimed_by_display_name TEXT`

(Use `IF NOT EXISTS` everywhere; idempotent for preview re-runs.)

## Files

### New (6)

- `packages/migrations/src/before/1745900000_add_event_claim.ts`
- `applications/bot/src/rest/events/buildClaimMessage.ts` — builder for the claim message (embed + button row)
- `applications/bot/src/rcp/event/handleTrainingClaimRequest.ts` — posts the claim message, saves IDs
- `applications/bot/src/rcp/event/handleTrainingClaimUpdate.ts` — edits the claim message in place
- `applications/bot/src/rcp/event/handleUnclaimedTrainingReminder.ts` — posts the "still no coach" reminder
- `applications/bot/src/interactions/claim.ts` — Claim + Unclaim button handlers
- `applications/server/test/rpc/ClaimTrainingRpc.test.ts`

### Modified (~13)

Domain:
- `packages/domain/src/rpc/event/EventRpcEvents.ts` — add `TrainingClaimRequestEvent`, `TrainingClaimUpdateEvent`, `UnclaimedTrainingReminderEvent` to the union
- `packages/domain/src/rpc/event/EventRpcModels.ts` — `EventClaimInfo` + tagged errors (`ClaimEventNotFound`, `ClaimNotTraining`, `ClaimNotOwnerGroupMember`, `ClaimAlreadyClaimed`, `ClaimNotClaimer`, `ClaimEventInactive`)
- `packages/domain/src/rpc/event/EventRpcGroup.ts` — `Event/ClaimTraining`, `Event/UnclaimTraining`, `Event/SaveClaimDiscordMessageId`, `Event/GetClaimInfo`

Server:
- `applications/server/src/repositories/EventsRepository.ts` — extend schemas with `claimed_by`, `claim_discord_*`, `claimer_name`; add `claimTraining`, `unclaimTraining`, `saveClaimDiscordMessage`, `findClaimInfo`
- `applications/server/src/repositories/EventSyncEventsRepository.ts` — add 3 new literals; `emitTrainingClaimRequest`, `emitTrainingClaimUpdate`, `emitUnclaimedTrainingReminder`
- `applications/server/src/repositories/TeamSettingsRepository.ts` — `EventNeedingReminder` schema gains `claimed_by` and existing `discord_message_id`/`discord_channel_id` for the jump link
- `applications/server/src/services/RsvpReminderCron.ts` — emit `unclaimed_training_reminder` alongside RSVP reminder when applicable
- `applications/server/src/rpc/event/events.ts` — match the three new sync-event tags
- `applications/server/src/rpc/event/index.ts` — four new RPC handlers; emit `training_claim_request` from event creation when type=training+owner_group resolves; emit `training_claim_update` after claim/unclaim/cancel

Bot:
- `applications/bot/src/rcp/event/ProcessorService.ts` — register the three new handlers
- `applications/bot/src/rcp/event/handleCancelled.ts` — emit `training_claim_update` for cancellation (or directly fetch claim info and update message)
- `applications/bot/src/interactions/index.ts` — register Claim/Unclaim button handlers

i18n:
- `packages/i18n/messages/en.json` and `cs.json` — 14 keys (see below)

## Translation keys (14 per locale)

```
bot_claim_message_title                  Coach needed: {title}    / Trénink potřebuje trenéra: {title}
bot_claim_button                         Claim training           / Vzít trénink
bot_unclaim_button                       Release                  / Uvolnit
bot_claim_status_unclaimed               🟠 Unclaimed             / 🟠 Bez trenéra
bot_claim_status_claimed_by              🟢 Claimed by {user}     / 🟢 Vzal/a si {user}
bot_claim_unclaimed_reminder_title       {title} — still no coach / {title} — stále bez trenéra
bot_claim_unclaimed_reminder_description This training is happening {when} and nobody has volunteered yet.
                                         Trénink je {when} a nikdo se ho zatím neujal.
bot_claim_unclaimed_reminder_jump        Jump to claim ↗          / Přejít a vzít si ↗
bot_claim_already_claimed_by             This training is already claimed by {user}.
                                         Tento trénink si už vzal/a {user}.
bot_claim_not_owner                      Only coaches can claim trainings.
                                         Trénink si mohou vzít jen trenéři.
bot_claim_event_cancelled                This training was cancelled.
                                         Tento trénink byl zrušen.
bot_claim_event_started                  This training has already started.
                                         Tento trénink už začal.
bot_claim_release_not_claimer            Only the coach who claimed this training can release it.
                                         Uvolnit trénink může jen ten trenér, který si ho vzal.
bot_claim_success                        You've claimed this training.
                                         Vzal/a sis tento trénink.
bot_claim_release_success                You've released this training.
                                         Uvolnil/a jsi tento trénink.
```

Existing reused keys: `bot_embed_when`, `bot_embed_where`.

## Test plan (~14 focused cases)

Server (RPC unit + integration where atomicity matters):
1. claim happy path — emits `training_claim_update` with `claimed_by_member_id`
2. claim race (atomic UPDATE returns no row → ClaimAlreadyClaimed)
3. claim non-coach → ClaimNotOwnerGroupMember
4. claim non-training → ClaimNotTraining
5. claim cancelled/started → ClaimEventInactive
6. claim event-not-found → ClaimEventNotFound
7. claim with `owner_group_id IS NULL` → ClaimNotOwnerGroupMember
8. unclaim happy path — emits `training_claim_update` with `claimed_by_member_id=NULL`
9. unclaim by non-claimer → ClaimNotClaimer
10. event creation emits `training_claim_request` for trainings with owner-group channel
11. event creation does NOT emit for non-training events
12. event creation does NOT emit when owner-group has no channel mapping

Cron extension:
13. emits `unclaimed_training_reminder` when training+unclaimed+owner-channel
14. does NOT emit when claimed_by is Some / no owner-channel

Bot smoke (lightweight; the heavy logic lives in shared builders):
- `buildClaimMessage` renders Claim button with `custom_id` starting with `claim:` when unclaimed
- `buildClaimMessage` renders Release button with `custom_id` starting with `unclaim:` when claimed
- Claim/unclaim handlers call the right RPC and edit/skip on the right error tags

## Risks

- Domain rebuild (`pnpm build`) required after `packages/domain` edits.
- Migration timestamp `1745900000` — verify highest at PR-open time.
- Three-place literal verification: migration CHECK, `EventSyncEventsRepository` schema, sync-event `_tag`s in `EventRpcEvents.ts` (and `Match.tag` in events.ts/ProcessorService.ts).
- `pnpm codegen` required after i18n changes.
- Two messages per training in owners channel (event embed + claim message) — ensure copy on the claim message clearly says "Coach needed:" so it doesn't look duplicate.
