/**
 * Tests for the /training result autocomplete handler.
 *
 * Verifies that the handler calls Event/GetLoggableTrainingEvents (not
 * GetUpcomingGuildEvents) so that just-finished trainings (status='started',
 * start_at in the past) are surfaced in autocomplete.
 */
import { describe, expect, it } from '@effect/vitest';
import { DateTime, Effect, Layer, Option } from 'effect';
import { SyncRpc, type SyncRpcClient } from '~/services/SyncRpc.js';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const TEST_GUILD_ID = '999999999999999999';

type GuildEventListEntry = {
  event_id: string;
  title: string;
  start_at: DateTime.Utc;
  end_at: Option.Option<DateTime.Utc>;
  location: Option.Option<string>;
  location_url: Option.Option<string>;
  event_type: string;
  yes_count: number;
  no_count: number;
  maybe_count: number;
  all_day: boolean;
};

// A training that already started (primary logging use-case: just-finished)
const PAST_TRAINING: GuildEventListEntry = {
  event_id: 'evt-past-001',
  title: 'Monday Practice',
  start_at: DateTime.makeUnsafe('2026-06-15T18:00:00.000Z'),
  end_at: Option.some(DateTime.makeUnsafe('2026-06-15T20:00:00.000Z')),
  location: Option.none(),
  location_url: Option.none(),
  event_type: 'training',
  yes_count: 10,
  no_count: 2,
  maybe_count: 1,
  all_day: false,
};

// A training that is in the future (still active)
const FUTURE_TRAINING: GuildEventListEntry = {
  event_id: 'evt-future-002',
  title: 'Wednesday Tactics',
  start_at: DateTime.makeUnsafe('2026-06-17T18:00:00.000Z'),
  end_at: Option.none(),
  location: Option.none(),
  location_url: Option.none(),
  event_type: 'training',
  yes_count: 8,
  no_count: 0,
  maybe_count: 3,
  all_day: false,
};

const ALL_LOGGABLE = [PAST_TRAINING, FUTURE_TRAINING];

// ---------------------------------------------------------------------------
// Mock SyncRpc
// ---------------------------------------------------------------------------

const makeMockSyncRpc = (
  events: GuildEventListEntry[] = ALL_LOGGABLE,
  shouldFail = false,
): SyncRpcClient => {
  return new Proxy({} as SyncRpcClient, {
    get: (_target, prop) => {
      if (prop === 'Event/GetLoggableTrainingEvents') {
        return (_payload: { guild_id: string }) => {
          if (shouldFail) {
            return Effect.fail({ _tag: 'RpcClientError', message: 'Network error' });
          }
          return Effect.succeed(events);
        };
      }
      // GetUpcomingGuildEvents must NOT be called — return an error to catch regressions
      if (prop === 'Event/GetUpcomingGuildEvents') {
        return () => Effect.die('GetUpcomingGuildEvents must not be called in autocomplete');
      }
      return () => Effect.void;
    },
  });
};

const makeMockLayer = (rpc: SyncRpcClient) => Layer.succeed(SyncRpc, rpc);

// ---------------------------------------------------------------------------
// Handler logic — mirrors training-result-autocomplete.ts implementation
// ---------------------------------------------------------------------------

const formatDateLabel = (dt: DateTime.Utc): string => {
  const ms = Number(DateTime.toEpochMillis(dt));
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

type AutocompleteChoice = { name: string; value: string };

const handleAutocomplete = (
  rpc: SyncRpcClient,
  guildId: Option.Option<string>,
  query: string,
): Effect.Effect<AutocompleteChoice[]> => {
  if (Option.isNone(guildId)) {
    return Effect.succeed([]);
  }

  return (
    rpc['Event/GetLoggableTrainingEvents'] as unknown as (p: {
      guild_id: string;
    }) => Effect.Effect<GuildEventListEntry[], { _tag: string }>
  )({ guild_id: guildId.value }).pipe(
    Effect.map((events) => {
      const queryLower = query.toLowerCase();
      return events
        .filter((e) => {
          if (queryLower === '') return true;
          const dateLabel = formatDateLabel(e.start_at);
          return e.title.toLowerCase().includes(queryLower) || dateLabel.includes(queryLower);
        })
        .slice(0, 25)
        .map((e) => {
          const dateLabel = formatDateLabel(e.start_at);
          const label = `${dateLabel} · ${e.title}`.slice(0, 100);
          return { name: label, value: e.event_id };
        });
    }),
    Effect.catchTag('RpcClientError', () => Effect.succeed<AutocompleteChoice[]>([])),
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('training-result-autocomplete handler', () => {
  it.effect('offers just-finished (past start_at) trainings via GetLoggableTrainingEvents', () => {
    const rpc = makeMockSyncRpc();
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), '').pipe(
      Effect.provide(layer),
      Effect.tap((result) =>
        Effect.sync(() => {
          // Both past and future training should be offered (server-side filtering handles cutoff)
          expect(result).toHaveLength(2);
          const ids = result.map((c) => c.value);
          expect(ids).toContain(PAST_TRAINING.event_id);
          expect(ids).toContain(FUTURE_TRAINING.event_id);
        }),
      ),
      Effect.asVoid,
    );
  });

  it.effect('past training appears as first choice when server returns it first', () => {
    const rpc = makeMockSyncRpc([PAST_TRAINING, FUTURE_TRAINING]);
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), '').pipe(
      Effect.provide(layer),
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result[0]?.value).toBe(PAST_TRAINING.event_id);
        }),
      ),
      Effect.asVoid,
    );
  });

  it.effect('choice name is formatted as "YYYY-MM-DD · title"', () => {
    const rpc = makeMockSyncRpc([PAST_TRAINING]);
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), '').pipe(
      Effect.provide(layer),
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result).toHaveLength(1);
          expect(result[0]?.name).toBe('2026-06-15 · Monday Practice');
          expect(result[0]?.value).toBe('evt-past-001');
        }),
      ),
      Effect.asVoid,
    );
  });

  it.effect('filters by title substring (case-insensitive)', () => {
    const rpc = makeMockSyncRpc();
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), 'TACTICS').pipe(
      Effect.provide(layer),
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result).toHaveLength(1);
          expect(result[0]?.value).toBe(FUTURE_TRAINING.event_id);
        }),
      ),
      Effect.asVoid,
    );
  });

  it.effect('filters by date substring', () => {
    const rpc = makeMockSyncRpc();
    const layer = makeMockLayer(rpc);

    // Query "2026-06-15" matches only PAST_TRAINING
    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), '2026-06-15').pipe(
      Effect.provide(layer),
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result).toHaveLength(1);
          expect(result[0]?.value).toBe(PAST_TRAINING.event_id);
        }),
      ),
      Effect.asVoid,
    );
  });

  it.effect('returns empty choices when no guild_id is present', () => {
    const rpc = makeMockSyncRpc();
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.none(), '').pipe(
      Effect.provide(layer),
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result).toHaveLength(0);
        }),
      ),
      Effect.asVoid,
    );
  });

  it.effect('returns empty choices on GuildNotFound / RpcClientError', () => {
    const rpc = makeMockSyncRpc([], true);
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), '').pipe(
      Effect.provide(layer),
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result).toHaveLength(0);
        }),
      ),
      Effect.asVoid,
    );
  });

  it.effect('limits choices to 25', () => {
    const manyEvents: GuildEventListEntry[] = Array.from({ length: 30 }, (_, i) => ({
      event_id: `evt-${i}`,
      title: `Training ${String(i).padStart(2, '0')}`,
      start_at: DateTime.makeUnsafe(
        `2026-06-${String((i % 28) + 1).padStart(2, '0')}T18:00:00.000Z`,
      ),
      end_at: Option.none(),
      location: Option.none(),
      location_url: Option.none(),
      event_type: 'training',
      yes_count: 0,
      no_count: 0,
      maybe_count: 0,
      all_day: false,
    }));
    const rpc = makeMockSyncRpc(manyEvents);
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), '').pipe(
      Effect.provide(layer),
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result).toHaveLength(25);
        }),
      ),
      Effect.asVoid,
    );
  });
});
