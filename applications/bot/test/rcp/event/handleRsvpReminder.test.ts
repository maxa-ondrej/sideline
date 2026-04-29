import type { EventRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import type { MessageCreateRequest } from 'dfx/types';
import { DateTime, Effect, Layer, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { handleRsvpReminder } from '~/rcp/event/handleRsvpReminder.js';
import { SyncRpc } from '~/services/SyncRpc.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEAM_ID = '00000000-0000-0000-0000-000000000010';
const GUILD_ID = '111111111111111111';
const EVENT_ID = '00000000-0000-0000-0000-000000000001';
const CHANNEL_ID = '222222222222222222';
const SYSTEM_CHANNEL_ID = '333333333333333333';
const ROLE_ID = '555555555555555555';

const makeEvent = (
  overrides: Partial<EventRpcEvents.RsvpReminderEvent> = {},
): EventRpcEvents.RsvpReminderEvent =>
  ({
    _tag: 'rsvp_reminder' as const,
    id: 'sync-2',
    team_id: TEAM_ID as any,
    guild_id: GUILD_ID as any,
    event_id: EVENT_ID as any,
    title: 'Training Session',
    start_at: DateTime.makeUnsafe('2026-05-02T14:00:00Z'),
    discord_channel_id: Option.some(CHANNEL_ID as any),
    member_group_id: Option.none(),
    discord_role_id: Option.none(),
    ...overrides,
  }) as any;

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type CreateMessageCall = [string, MessageCreateRequest];

const makeRecordingSyncRpc = () => {
  const layer = Layer.succeed(
    SyncRpc,
    new Proxy({} as any, {
      get: (_target: unknown, method: string) => {
        if (method === 'Event/GetRsvpReminderSummary') {
          return () =>
            Effect.succeed({
              yesCount: 2,
              noCount: 1,
              maybeCount: 0,
              nonResponders: [],
              yesAttendees: [],
            });
        }
        if (method === 'Event/GetDiscordMessageId') {
          return () => Effect.succeed(Option.none());
        }
        return () => Effect.succeed(null);
      },
    }),
  );
  return { layer };
};

const makeRecordingDiscordREST = (
  overrides: Partial<Record<string, (...args: any[]) => Effect.Effect<any>>> = {},
) => {
  const createMessageCalls: CreateMessageCall[] = [];

  const defaults: Record<string, (...args: any[]) => Effect.Effect<any>> = {
    createMessage: (...args: any[]) => {
      createMessageCalls.push(args as CreateMessageCall);
      return Effect.succeed({ id: 'new-msg-id' });
    },
    getGuild: (_guildId: any) =>
      Effect.succeed({
        preferred_locale: 'en-US',
        system_channel_id: SYSTEM_CHANNEL_ID,
      }),
    createDm: () => Effect.succeed({ id: 'dm-channel-id' }),
  };

  const layer = Layer.succeed(
    DiscordREST,
    new Proxy({} as any, {
      get: (_target: unknown, method: string) => {
        const fn = overrides[method] ?? defaults[method];
        return fn ?? (() => Effect.succeed(null));
      },
    }),
  );

  return { createMessageCalls, layer };
};

const run = (
  effect: Effect.Effect<void, any, SyncRpc | DiscordREST>,
  layers: Layer.Layer<SyncRpc | DiscordREST>,
) => Effect.runPromise(effect.pipe(Effect.provide(layers)) as Effect.Effect<void, never, never>);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleRsvpReminder — no member-group role mention', () => {
  it('does NOT include role mention in content when discord_role_id is Some', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { createMessageCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleRsvpReminder(makeEvent({ discord_role_id: Option.some(ROLE_ID as any) })),
      Layer.merge(rpcLayer, restLayer),
    );

    expect(createMessageCalls.length).toBeGreaterThanOrEqual(1);
    const [_channelId, payload] = createMessageCalls[0];
    const content = payload.content ?? '';
    expect(content).not.toContain('<@&');
  });

  it('does NOT include role mention in content when discord_role_id is None', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { createMessageCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleRsvpReminder(makeEvent({ discord_role_id: Option.none() })),
      Layer.merge(rpcLayer, restLayer),
    );

    expect(createMessageCalls.length).toBeGreaterThanOrEqual(1);
    const [_channelId, payload] = createMessageCalls[0];
    const content = payload.content ?? '';
    expect(content).not.toContain('<@&');
  });

  it('does NOT set allowed_mentions.roles when discord_role_id is Some', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { createMessageCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleRsvpReminder(makeEvent({ discord_role_id: Option.some(ROLE_ID as any) })),
      Layer.merge(rpcLayer, restLayer),
    );

    expect(createMessageCalls.length).toBeGreaterThanOrEqual(1);
    const [_channelId, payload] = createMessageCalls[0];
    const roles = payload.allowed_mentions?.roles ?? [];
    expect(roles).toHaveLength(0);
  });
});
