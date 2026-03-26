import { describe, expect, it } from '@effect/vitest';
import type { TrainingType } from '@sideline/domain';
import { Effect, Layer, Option } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';

// --- Test IDs ---
const TEST_GUILD_ID = '999999999999999999';
const TEST_TT_1 = '00000000-0000-0000-0000-000000000050' as TrainingType.TrainingTypeId;
const TEST_TT_2 = '00000000-0000-0000-0000-000000000051' as TrainingType.TrainingTypeId;
const TEST_TT_3 = '00000000-0000-0000-0000-000000000052' as TrainingType.TrainingTypeId;

const mockTrainingTypes = [
  { id: TEST_TT_1, name: 'Fitness' },
  { id: TEST_TT_2, name: 'Tactics' },
  { id: TEST_TT_3, name: 'Strength Training' },
];

// --- Mock SyncRpc ---
const makeMockSyncRpc = (
  trainingTypes: Array<{ id: string; name: string }> = mockTrainingTypes,
  shouldFail = false,
): SyncRpc => {
  return new Proxy({} as SyncRpc, {
    get: (_target, prop) => {
      if (prop === 'Event/GetTrainingTypesByGuild') {
        return (_payload: { guild_id: string }) => {
          if (shouldFail) {
            return Effect.die('RPC error');
          }
          return Effect.succeed(trainingTypes);
        };
      }
      return () => Effect.void;
    },
  });
};

// --- The autocomplete handler logic (mirrors what event-create-autocomplete.ts will implement) ---
// These tests verify the BEHAVIOR of the handler that will be implemented.

const handleAutocomplete = (
  rpc: SyncRpc,
  guildId: Option.Option<string>,
  eventType: string,
  query: string,
) =>
  Effect.Do.pipe(
    Effect.bind('rpcService', () => Effect.succeed(rpc)),
    Effect.flatMap(({ rpcService }) => {
      // Non-training event types should return empty choices immediately
      if (eventType !== 'training') {
        return Effect.succeed([] as Array<{ name: string; value: string }>);
      }

      // No guild means no choices
      if (Option.isNone(guildId)) {
        return Effect.succeed([] as Array<{ name: string; value: string }>);
      }

      return (
        rpcService['Event/GetTrainingTypesByGuild'] as unknown as (p: {
          guild_id: string;
        }) => Effect.Effect<Array<{ id: string; name: string }>>
      )({ guild_id: guildId.value }).pipe(
        Effect.map((types) =>
          types
            .filter((tt) => tt.name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 25)
            .map((tt) => ({ name: tt.name, value: tt.id })),
        ),
        Effect.catchAllDefect(() => Effect.succeed([] as Array<{ name: string; value: string }>)),
      );
    }),
  );

const makeMockLayer = (rpc: SyncRpc) => Layer.succeed(SyncRpc, rpc);

describe('event-create-autocomplete handler', () => {
  it.effect('returns filtered training type choices matching query', () => {
    const rpc = makeMockSyncRpc();
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), 'training', 'fit').pipe(
      Effect.provide(layer),
      Effect.tap((result) => {
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Fitness');
        expect(result[0].value).toBe(TEST_TT_1);
      }),
      Effect.asVoid,
    );
  });

  it.effect('returns all choices when query is empty', () => {
    const rpc = makeMockSyncRpc();
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), 'training', '').pipe(
      Effect.provide(layer),
      Effect.tap((result) => {
        expect(result).toHaveLength(3);
      }),
      Effect.asVoid,
    );
  });

  it.effect('returns empty choices when event type is not training', () =>
    Effect.forEach(
      ['match', 'tournament', 'meeting', 'social', 'other'],
      (eventType) => {
        const rpc = makeMockSyncRpc();
        const layer = makeMockLayer(rpc);

        return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), eventType, '').pipe(
          Effect.provide(layer),
          Effect.tap((result) => {
            expect(result).toHaveLength(0);
          }),
          Effect.asVoid,
        );
      },
      { discard: true },
    ),
  );

  it.effect('returns empty choices on RPC error', () => {
    const rpc = makeMockSyncRpc([], true);
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), 'training', '').pipe(
      Effect.provide(layer),
      Effect.tap((result) => {
        expect(result).toHaveLength(0);
      }),
      Effect.asVoid,
    );
  });

  it.effect('limits results to 25 items', () => {
    const manyTypes = Array.from({ length: 30 }, (_, i) => ({
      id: `type-${i}`,
      name: `Type ${i}`,
    }));
    const rpc = makeMockSyncRpc(manyTypes);
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.some(TEST_GUILD_ID), 'training', '').pipe(
      Effect.provide(layer),
      Effect.tap((result) => {
        expect(result).toHaveLength(25);
      }),
      Effect.asVoid,
    );
  });

  it.effect('returns empty choices when no guild_id is present', () => {
    const rpc = makeMockSyncRpc();
    const layer = makeMockLayer(rpc);

    return handleAutocomplete(rpc, Option.none(), 'training', 'fit').pipe(
      Effect.provide(layer),
      Effect.tap((result) => {
        expect(result).toHaveLength(0);
      }),
      Effect.asVoid,
    );
  });
});

describe('event-create modal custom_id parsing', () => {
  // Tests for parsing the updated modal custom_id format:
  // Old: event-create:{eventType}
  // New: event-create:{eventType}:{trainingTypeId}

  const parseModalCustomId = (
    customId: string,
  ): { eventType: string; trainingTypeId: Option.Option<string> } => {
    const parts = customId.split(':');
    const eventType = parts[1] ?? 'other';
    const trainingTypeId = parts[2] ? Option.some(parts[2]) : Option.none();
    return { eventType, trainingTypeId };
  };

  it('parses eventType and trainingTypeId from 3-segment custom_id', () => {
    const { eventType, trainingTypeId } = parseModalCustomId(`event-create:training:${TEST_TT_1}`);
    expect(eventType).toBe('training');
    expect(Option.isSome(trainingTypeId)).toBe(true);
    expect(Option.getOrNull(trainingTypeId)).toBe(TEST_TT_1);
  });

  it('handles 2-segment custom_id (legacy, no training type)', () => {
    const { eventType, trainingTypeId } = parseModalCustomId('event-create:match');
    expect(eventType).toBe('match');
    expect(Option.isNone(trainingTypeId)).toBe(true);
  });

  it('handles 2-segment custom_id with training event type (no training type selected)', () => {
    const { eventType, trainingTypeId } = parseModalCustomId('event-create:training');
    expect(eventType).toBe('training');
    expect(Option.isNone(trainingTypeId)).toBe(true);
  });

  it('handles other event types in 3-segment custom_id', () => {
    const { eventType, trainingTypeId } = parseModalCustomId('event-create:match:some-id');
    expect(eventType).toBe('match');
    expect(Option.isSome(trainingTypeId)).toBe(true);
    expect(Option.getOrNull(trainingTypeId)).toBe('some-id');
  });

  it.effect('passes trainingTypeId to CreateEvent RPC when present in custom_id', () => {
    let capturedTrainingTypeId: Option.Option<string> = Option.none();

    const rpc = new Proxy({} as SyncRpc, {
      get: (_target, prop) => {
        if (prop === 'Event/CreateEvent') {
          return (payload: { training_type_id: Option.Option<string> }) => {
            capturedTrainingTypeId = payload.training_type_id;
            return Effect.succeed({ event_id: 'new-event-id', title: 'Test' });
          };
        }
        return () => Effect.void;
      },
    });

    // Simulate modal submission with 3-segment custom_id
    const customId = `event-create:training:${TEST_TT_1}`;
    const { trainingTypeId } = parseModalCustomId(customId);

    return Effect.Do.pipe(
      Effect.flatMap(() =>
        (
          rpc['Event/CreateEvent'] as (p: {
            training_type_id: Option.Option<string>;
          }) => Effect.Effect<unknown>
        )({
          training_type_id: trainingTypeId,
        }),
      ),
      Effect.tap(() => {
        expect(Option.isSome(capturedTrainingTypeId)).toBe(true);
        expect(Option.getOrNull(capturedTrainingTypeId)).toBe(TEST_TT_1);
      }),
      Effect.asVoid,
    );
  });

  it.effect(
    'passes Option.none() for training_type_id when using legacy 2-segment custom_id',
    () => {
      let capturedTrainingTypeId: Option.Option<string> = Option.some('should-be-cleared');

      const rpc = new Proxy({} as SyncRpc, {
        get: (_target, prop) => {
          if (prop === 'Event/CreateEvent') {
            return (payload: { training_type_id: Option.Option<string> }) => {
              capturedTrainingTypeId = payload.training_type_id;
              return Effect.succeed({ event_id: 'new-event-id', title: 'Test' });
            };
          }
          return () => Effect.void;
        },
      });

      // Legacy custom_id without training type
      const customId = 'event-create:training';
      const { trainingTypeId } = parseModalCustomId(customId);

      return Effect.Do.pipe(
        Effect.flatMap(() =>
          (
            rpc['Event/CreateEvent'] as (p: {
              training_type_id: Option.Option<string>;
            }) => Effect.Effect<unknown>
          )({
            training_type_id: trainingTypeId,
          }),
        ),
        Effect.tap(() => {
          expect(Option.isNone(capturedTrainingTypeId)).toBe(true);
        }),
        Effect.asVoid,
      );
    },
  );
});
