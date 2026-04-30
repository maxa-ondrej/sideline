# Plan — allow attaching an image to events

**Bug:** [allow attaching an image to events](https://app.notion.com/p/allow-attaching-an-image-to-events-34f93506081880c394a5eb68cd89f239)
**Branch:** `feat/attach-image-to-events`
**Severity:** Medium

## Decisions (informed by architect + designer + hater)

| Question | v1 decision | Why |
|---|---|---|
| Storage approach | **URL paste, no upload** | No blob storage infra in repo (no S3/R2/sharp/multipart). Adding storage is a separate epic. |
| Discord embed slot | **`thumbnail`** (small, top-right) | Doesn't push RSVP buttons below the fold on mobile. Degrades gracefully if URL 404s. Switch to `image` later if user research disagrees. |
| Bot create modal | **Skip** (no image field) | Discord modals are capped at 5 inputs and all 5 are used. Captains add images via the web. Documented limitation. |
| Series-level image | **Per-event only for v1** | Matches existing `description` precedent (per-event, not inherited from series). Series-level default is a follow-up story. |
| List/calendar thumbnails | **Skip** | Keep date badge as the visual anchor. Banner appears only on detail page. |
| URL validation | **Strict `https://` only**, reject `data:`/`javascript:`/`file:`, reject loopback/RFC1918 hosts at API boundary | Prevents stored-XSS, SSRF, IP-leak via tracking pixels. |
| Broken-link UX on web | `loading="lazy"`, `decoding="async"`, fixed aspect-ratio container, `onError` hides the image, `referrerPolicy="no-referrer"` | Avoid layout shift; defeat IP-leak. |

## Files

### Domain & migrations
- `packages/migrations/src/before/<ts>_add_event_image_url.ts` — `ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT` and `ALTER TABLE event_sync_events ADD COLUMN IF NOT EXISTS event_image_url TEXT`. Both columns nullable.
- `packages/domain/src/models/Event.ts` — add `image_url: Schema.OptionFromNullOr(Schema.String)`.
- `packages/domain/src/api/EventApi.ts` — add validated `imageUrl` field to `EventInfo`, `EventDetail`, `CreateEventRequest`, `UpdateEventRequest`. Validation: `Schema.OptionFromNullOr(EventImageUrl)` where `EventImageUrl` is a refined `Schema.String` requiring `https://` and rejecting non-http(s) protocols. Length cap 2048.
- `packages/domain/src/rpc/event/EventRpcEvents.ts` — add `image_url` to `EventCreatedEvent`, `EventUpdatedEvent`, `EventStartedEvent`.
- `packages/domain/src/rpc/event/EventRpcModels.ts` — add `image_url` to `EventEmbedInfo`, `ChannelEventEntry`, `UpcomingEventForUserEntry`.

### Server
- `applications/server/src/repositories/EventsRepository.ts` — thread `image_url` through every SELECT/INSERT/UPDATE that already threads `description` or `discord_target_channel_id`.
- `applications/server/src/repositories/EventSyncEventsRepository.ts` — same pattern for `event_image_url`.
- `applications/server/src/api/event.ts` — `createEvent`, `updateEvent`, `getEvent`, `listEvents` thread the field.
- `applications/server/src/rpc/event/index.ts` — `GetEventEmbedInfo`, `GetChannelEvents`, `GetUpcomingEventsForUser` return the field. Bot-driven `Event/CreateEvent` hardcodes `Option.none()`.
- Series materialization (`EventHorizonCron.ts`, `event-series.ts`) passes `Option.none()`.

### Bot
- `applications/bot/src/rest/events/buildEventEmbed.ts` — accept `imageUrl: Option.Option<string>`. When `Some`, set `thumbnail: { url }` (NOT `image`).
- `applications/bot/src/rest/events/buildUpcomingEventEmbed.ts` — same, sourced from `entry.image_url`.
- `applications/bot/src/rcp/event/handleCreated.ts`, `handleUpdated.ts`, `handleStarted.ts` — pass `imageUrl: event.image_url`.
- Cancelled embed (`buildCancelledEmbed`): explicitly omit thumbnail — strikethrough should stay minimal.

### Web
- `applications/web/src/components/pages/EventsListPage.tsx`
  - `CreateEventSchema` gets a `imageUrl` URL-typed field. Empty string → `Option.none()`. Validation mirrors domain refinement.
  - New form field below Description: `<Input type="url" placeholder="https://...">` plus an inline preview when `URL.canParse(value)` and value passes `https://` check. Preview uses `loading="lazy"`, `referrerPolicy="no-referrer"`, fixed `aspect-[16/9]` container, `onError` hides itself.
  - Helper text under the field: "Optional — link to an image. Shown on the event page and in Discord."
- `applications/web/src/components/pages/EventDetailPage.tsx`
  - Same field added to the edit form.
  - Read view: between header and the two-column grid, render the cover banner — `aspect-[16/9]`, `max-h-[360px]`, `rounded-lg`, `object-cover`. Hidden if no image or on `onError`.

### i18n
- `packages/i18n/messages/en.json` and `cs.json`: add `event_imageUrl`, `event_imageUrlPlaceholder`, `event_imageUrlHelp`, `event_imageUrlInvalid`.

### Internal docs
- `docs/database.md` — note new columns.
- `docs/api.md` — note new `imageUrl` field on event endpoints.

### Product docs / changelog / changeset
- `applications/docs/src/content/docs/changelog.md` — append entry.
- `.changeset/<slug>.md` — patch bumps for affected packages.

## Task breakdown

1. **Domain**: extend `Event`, `EventApi`, RPC events/models with validated `imageUrl`. Run `pnpm build`.
2. **Migration**: add `image_url` to `events` and `event_image_url` to `event_sync_events`.
3. **Server**: extend `EventsRepository`, `EventSyncEventsRepository`, HTTP and RPC handlers.
4. **Tests** (TDD against server): repository + HTTP API + RPC handlers.
5. **Bot**: extend embed builders (`thumbnail`), wire RCP handlers, add unit tests.
6. **Web**: add form field with preview to create + edit forms; render banner on detail page.
7. **i18n**: new keys + Czech translations; run `pnpm codegen`.
8. **Docs + changelog + changeset**.

## Test plan

- **Repository**: insert/update/select with and without `image_url`.
- **HTTP**: POST/PATCH with valid URL, with `null`, missing field, with disallowed protocol/host (must fail validation).
- **RPC**: `GetEventEmbedInfo` etc. surface `image_url`.
- **Embed builder unit tests**: `thumbnail` present when URL is `Some`, absent when `None`, absent on cancelled state.
- **Manual smoke**: create + edit event with image on web, verify Discord post shows thumbnail.

## Out of scope (follow-up bugs)

- File uploads / drag-drop / image processing pipeline (needs storage decision: R2/S3/Vercel Blob).
- Series-level default image.
- Bot modal image input (would require restructuring the modal — Discord 5-component cap).
- Switching from `thumbnail` to `image` once we know whether it hurts RSVP rate.
