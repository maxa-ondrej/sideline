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

const NON_RESPONDER_WITH_CHANNEL_ID = '600000000000000001';
const NON_RESPONDER_WITHOUT_CHANNEL_ID = '600000000000000002';
const PERSONAL_CHANNEL_ID = '700000000000000001';

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

const makeRecordingSyncRpc = (
  overrides: {
    nonResponders?: ReadonlyArray<{
      discord_id: Option.Option<string>;
      name: Option.Option<string>;
      nickname: Option.Option<string>;
      username: Option.Option<string>;
      display_name: Option.Option<string>;
    }>;
    personalChannels?: ReadonlyArray<{
      team_member_id: string;
      discord_id: string;
      personal_channel_id: string;
    }>;
  } = {},
) => {
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
              nonResponders: overrides.nonResponders ?? [],
              yesAttendees: [],
            });
        }
        if (method === 'Guild/ListPersonalChannelsForEvent') {
          return () => Effect.succeed(overrides.personalChannels ?? []);
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

// ---------------------------------------------------------------------------
// Per-member personal channel link (remove-global-events-board, Release A):
// each non-responder's DM should link to THEIR OWN personal events channel,
// falling back to the reminder-channel link when they don't have one.
// ---------------------------------------------------------------------------

describe('handleRsvpReminder — per-member personal channel link', () => {
  it('links a non-responder with a personal channel to their own personal channel', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc({
      nonResponders: [
        {
          discord_id: Option.some(NON_RESPONDER_WITH_CHANNEL_ID as any),
          name: Option.some('Alice'),
          nickname: Option.none(),
          username: Option.none(),
          display_name: Option.none(),
        },
      ],
      personalChannels: [
        {
          team_member_id: 'member-1' as any,
          discord_id: NON_RESPONDER_WITH_CHANNEL_ID as any,
          personal_channel_id: PERSONAL_CHANNEL_ID as any,
        },
      ],
    });
    const { createMessageCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(handleRsvpReminder(makeEvent()), Layer.merge(rpcLayer, restLayer));

    // One createMessage for the reminder-channel post, one for the DM.
    const dmCall = createMessageCalls.find(([channelId]) => channelId === 'dm-channel-id');
    expect(dmCall).toBeDefined();
    const description = dmCall?.[1].embeds?.[0]?.description ?? '';
    expect(description).toContain(
      `https://discord.com/channels/${GUILD_ID}/${PERSONAL_CHANNEL_ID}`,
    );
  });

  it('falls back to the reminder-channel link for a non-responder without a personal channel', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc({
      nonResponders: [
        {
          discord_id: Option.some(NON_RESPONDER_WITHOUT_CHANNEL_ID as any),
          name: Option.some('Bob'),
          nickname: Option.none(),
          username: Option.none(),
          display_name: Option.none(),
        },
      ],
      personalChannels: [],
    });
    const { createMessageCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(handleRsvpReminder(makeEvent()), Layer.merge(rpcLayer, restLayer));

    const dmCall = createMessageCalls.find(([channelId]) => channelId === 'dm-channel-id');
    expect(dmCall).toBeDefined();
    const description = dmCall?.[1].embeds?.[0]?.description ?? '';
    expect(description).toContain(`https://discord.com/channels/${GUILD_ID}/${CHANNEL_ID}`);
    expect(description).not.toContain(PERSONAL_CHANNEL_ID);
  });
});
