// NOTE: These tests are written in TDD mode BEFORE the implementation.
// They reference the expanded EventStartedEvent (title, start_at, end_at,
// location, event_type, member_group_id, discord_channel_id, discord_role_id,
// claimed_by_discord_id) and the new "Starting now" post behaviour added to
// handleStarted.
// Tests T12.x cover Change A (coach mention) and Change B (delete-on-start).
// They will FAIL to compile / run until the developer implements the bot task.

import type { EventRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import type { MessageCreateRequest } from 'dfx/types';

type CreateMessageCall = [string, MessageCreateRequest];

import { DateTime, Effect, Layer, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { ChannelReorderSemaphore } from '~/rcp/event/ChannelReorderSemaphore.js';
import { handleStarted } from '~/rcp/event/handleStarted.js';
import { SyncRpc } from '~/services/SyncRpc.js';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const TEAM_ID = '00000000-0000-0000-0000-000000000010';
const GUILD_ID = '111111111111111111';
const EVENT_ID = '00000000-0000-0000-0000-000000000001';
const CHANNEL_ID = '222222222222222222';
const SYSTEM_CHANNEL_ID = '333333333333333333';
const MESSAGE_ID = '444444444444444444';
const ROLE_ID = '555555555555555555';

// New constants for Change A / Change B tests
const COACH_ID = '666666666666666666';
const OWNERS_ROLE = '777777777777777777';
const CLAIM_THREAD_ID = '888888888888888888';
const CLAIM_MSG_ID = '999999999999999999';

const makeEvent = (
  overrides: Partial<EventRpcEvents.EventStartedEvent> = {},
): EventRpcEvents.EventStartedEvent =>
  ({
    _tag: 'event_started' as const,
    id: 'sync-1',
    team_id: TEAM_ID as any,
    guild_id: GUILD_ID as any,
    event_id: EVENT_ID as any,
    title: 'Saturday Match',
    start_at: DateTime.makeUnsafe('2026-05-01T16:00:00Z'),
    end_at: Option.none(),
    location: Option.none(),
    event_type: 'match',
    member_group_id: Option.none(),
    discord_channel_id: Option.some(CHANNEL_ID as any),
    discord_role_id: Option.none(),
    claimed_by_discord_id: Option.none(),
    ...overrides,
  }) as any;

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type SyncRpcCalls = {
  GetDiscordMessageId: unknown[];
  GetRsvpCounts: unknown[];
  GetEventEmbedInfo: unknown[];
  GetYesAttendeesForEmbed: unknown[];
  GetClaimInfo: unknown[];
};

const makeRecordingSyncRpc = (
  overrides: Partial<Record<string, (...args: any[]) => Effect.Effect<any>>> = {},
) => {
  const calls: SyncRpcCalls = {
    GetDiscordMessageId: [],
    GetRsvpCounts: [],
    GetEventEmbedInfo: [],
    GetYesAttendeesForEmbed: [],
    GetClaimInfo: [],
  };

  const defaults: Record<string, (...args: any[]) => Effect.Effect<any>> = {
    'Event/GetDiscordMessageId': (_args: any) => {
      calls.GetDiscordMessageId.push(_args);
      return Effect.succeed(
        Option.some({
          discord_channel_id: CHANNEL_ID as any,
          discord_message_id: MESSAGE_ID as any,
        }),
      );
    },
    'Event/GetRsvpCounts': (_args: any) => {
      calls.GetRsvpCounts.push(_args);
      return Effect.succeed({ yesCount: 3, noCount: 1, maybeCount: 0, canRsvp: true });
    },
    'Event/GetEventEmbedInfo': (_args: any) => {
      calls.GetEventEmbedInfo.push(_args);
      return Effect.succeed(
        Option.some({
          title: 'Saturday Match',
          description: Option.none(),
          image_url: Option.none(),
          start_at: DateTime.makeUnsafe('2026-05-01T16:00:00Z'),
          end_at: Option.none(),
          location: Option.none(),
          event_type: 'match',
        }),
      );
    },
    'Event/GetYesAttendeesForEmbed': (_args: any) => {
      calls.GetYesAttendeesForEmbed.push(_args);
      return Effect.succeed([]);
    },
    'Event/GetChannelEvents': () => Effect.succeed([]),
    'Event/GetChannelDivider': () => Effect.succeed(Option.none()),
    // Default: no stored claim info (no claim to delete)
    'Event/GetClaimInfo': (_args: any) => {
      calls.GetClaimInfo.push(_args);
      return Effect.succeed(
        Option.some({
          event_id: EVENT_ID,
          event_type: 'training',
          status: 'active',
          claimed_by_member_id: Option.none(),
          claimed_by_display_name: Option.none(),
          claim_discord_channel_id: Option.none(),
          claim_discord_message_id: Option.none(),
          claim_thread_id: Option.none(),
        }),
      );
    },
  };

  const layer = Layer.succeed(
    SyncRpc,
    new Proxy({} as any, {
      get: (_target: unknown, method: string) => {
        const fn = overrides[method] ?? defaults[method];
        return fn ?? (() => Effect.succeed(null));
      },
    }),
  );

  return { calls, layer };
};

type RestCalls = {
  updateMessage: unknown[];
  createMessage: CreateMessageCall[];
  deleteMessage: unknown[][];
};

const makeRecordingDiscordREST = (
  overrides: Partial<Record<string, (...args: any[]) => Effect.Effect<any>>> = {},
) => {
  const calls: RestCalls = { updateMessage: [], createMessage: [], deleteMessage: [] };

  const defaults: Record<string, (...args: any[]) => Effect.Effect<any>> = {
    updateMessage: (...args: any[]) => {
      calls.updateMessage.push(args);
      return Effect.succeed({});
    },
    createMessage: (...args: any[]) => {
      calls.createMessage.push(args as CreateMessageCall);
      return Effect.succeed({ id: 'new-msg-id' });
    },
    deleteMessage: (...args: any[]) => {
      calls.deleteMessage.push(args);
      return Effect.succeed(undefined);
    },
    getGuild: (_guildId: any) =>
      Effect.succeed({
        preferred_locale: 'en-US',
        system_channel_id: SYSTEM_CHANNEL_ID,
      }),
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

  return { calls, layer };
};

const run = (
  effect: Effect.Effect<void, any, SyncRpc | DiscordREST | ChannelReorderSemaphore>,
  layers: Layer.Layer<SyncRpc | DiscordREST>,
) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(Layer.merge(layers, ChannelReorderSemaphore.Live))) as Effect.Effect<
      void,
      never,
      never
    >,
  );

// ---------------------------------------------------------------------------
// T11.1 — in-place edit + new "Starting now" post both succeed
// ---------------------------------------------------------------------------

describe('handleStarted', () => {
  it('performs in-place edit AND posts "Starting now" message when both channels are known', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleStarted(makeEvent({ discord_channel_id: Option.some(CHANNEL_ID as any) })),
      Layer.merge(rpcLayer, restLayer),
    );

    expect(restCalls.updateMessage).toHaveLength(1);
    expect(restCalls.createMessage).toHaveLength(1);
    // The createMessage should target the event channel
    const [createChannelArg] = restCalls.createMessage[0] as [string, unknown];
    expect(createChannelArg).toBe(CHANNEL_ID);
  });

  // T11.2 — in-place edit failure is isolated (does not prevent "Starting now" post)
  it('still posts "Starting now" message even if in-place edit fails', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST({
      updateMessage: (..._args: any[]) => Effect.die(new Error('update failed')),
    });

    await run(handleStarted(makeEvent()), Layer.merge(rpcLayer, restLayer));

    // In-place edit failed but createMessage should still have been attempted
    expect(restCalls.createMessage).toHaveLength(1);
  });

  // T11.3 — "Starting now" post failure is isolated (does not affect in-place edit)
  it('still performs in-place edit even if "Starting now" post fails', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST({
      createMessage: (..._args: any[]) => Effect.die(new Error('post failed')),
    });

    await run(handleStarted(makeEvent()), Layer.merge(rpcLayer, restLayer));

    // createMessage failed but updateMessage should still have been attempted
    expect(restCalls.updateMessage).toHaveLength(1);
  });

  // T11.4 — role mention rendered when discord_role_id is Some
  it('includes <@&roleId> mention prefix in content when discord_role_id is Some', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleStarted(makeEvent({ discord_role_id: Option.some(ROLE_ID as any) })),
      Layer.merge(rpcLayer, restLayer),
    );

    expect(restCalls.createMessage).toHaveLength(1);
    const [_channelId, payload] = restCalls.createMessage[0] as [string, MessageCreateRequest];
    // The content field should include the role mention
    expect(typeof payload.content).toBe('string');
    expect(payload.content).toContain(`<@&${ROLE_ID}>`);
  });

  // T11.5 — role mention omitted when discord_role_id is None
  it('does NOT include role mention in content when discord_role_id is None', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleStarted(makeEvent({ discord_role_id: Option.none() })),
      Layer.merge(rpcLayer, restLayer),
    );

    expect(restCalls.createMessage).toHaveLength(1);
    const [_channelId, payload] = restCalls.createMessage[0] as [string, MessageCreateRequest];
    // content should be absent or not contain a role mention
    const content = payload.content ?? '';
    expect(content).not.toContain('<@&');
  });

  // T11.6 — system_channel fallback when discord_channel_id is None
  it('falls back to system_channel_id when event discord_channel_id is None', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleStarted(makeEvent({ discord_channel_id: Option.none() })),
      Layer.merge(rpcLayer, restLayer),
    );

    expect(restCalls.createMessage).toHaveLength(1);
    const [createChannelArg] = restCalls.createMessage[0] as [string, unknown];
    // Should have fallen back to the system channel
    expect(createChannelArg).toBe(SYSTEM_CHANNEL_ID);
  });

  // T11.7 — both channels None → no createMessage call
  it('does NOT call createMessage when both discord_channel_id and system_channel_id are absent', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST({
      getGuild: (_guildId: any) =>
        Effect.succeed({
          preferred_locale: 'en-US',
          system_channel_id: null,
        }),
    });

    await run(
      handleStarted(makeEvent({ discord_channel_id: Option.none() })),
      Layer.merge(rpcLayer, restLayer),
    );

    // No channel available → no message posted
    expect(restCalls.createMessage).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // T12.A — Change A: coach mention in "Starting now" post
  // -------------------------------------------------------------------------

  // T12.A.1 — Coach assigned → content contains <@COACH_ID>, NOT <@&, NOT warning text
  it('T12.A.1: training with coach → content mentions coach user, not role, not warning', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleStarted(
        makeEvent({
          event_type: 'training',
          discord_role_id: Option.some(OWNERS_ROLE as any),
          claimed_by_discord_id: Option.some(COACH_ID as any),
        }),
      ),
      Layer.merge(rpcLayer, restLayer),
    );

    const createCalls = restCalls.createMessage.filter(([channelId]) => channelId === CHANNEL_ID);
    expect(createCalls).toHaveLength(1);
    const [, payload] = createCalls[0] as [string, MessageCreateRequest];
    const content = payload.content ?? '';
    expect(content).toContain(`<@${COACH_ID}>`);
    expect(content).not.toContain('<@&');
    expect(payload.allowed_mentions?.users).toEqual([COACH_ID]);
    expect(
      Array.isArray(payload.allowed_mentions?.roles) ? payload.allowed_mentions.roles.length : 0,
    ).toBe(0);
  });

  // T12.A.2 — No coach, owners role present → content contains <@&OWNERS_ROLE> AND warning text
  it('T12.A.2: training with no coach + owners role → content mentions owners role + warning', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleStarted(
        makeEvent({
          event_type: 'training',
          discord_role_id: Option.some(OWNERS_ROLE as any),
          claimed_by_discord_id: Option.none(),
        }),
      ),
      Layer.merge(rpcLayer, restLayer),
    );

    const createCalls = restCalls.createMessage.filter(([channelId]) => channelId === CHANNEL_ID);
    expect(createCalls).toHaveLength(1);
    const [, payload] = createCalls[0] as [string, MessageCreateRequest];
    const content = payload.content ?? '';
    // Must ping owners role
    expect(content).toContain(`<@&${OWNERS_ROLE}>`);
    // Must contain the no-coach warning
    expect(content).toContain('coach');
    // Must NOT be a user ping
    expect(content).not.toMatch(/<@[^&]/);
    expect(payload.allowed_mentions?.roles).toEqual([OWNERS_ROLE]);
  });

  // T12.A.3 — No coach, no owners role → content is warning text only; no <@ mention
  it('T12.A.3: training with no coach and no owners role → warning text only, no mentions', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleStarted(
        makeEvent({
          event_type: 'training',
          discord_role_id: Option.none(),
          claimed_by_discord_id: Option.none(),
        }),
      ),
      Layer.merge(rpcLayer, restLayer),
    );

    const createCalls = restCalls.createMessage.filter(([channelId]) => channelId === CHANNEL_ID);
    expect(createCalls).toHaveLength(1);
    const [, payload] = createCalls[0] as [string, MessageCreateRequest];
    const content = payload.content ?? '';
    // Warning text present
    expect(content.length).toBeGreaterThan(0);
    // No Discord mention of any kind
    expect(content).not.toContain('<@');
    const allowedMentions = payload.allowed_mentions;
    expect(
      !allowedMentions ||
        ((!allowedMentions.roles || allowedMentions.roles.length === 0) &&
          (!allowedMentions.users || allowedMentions.users.length === 0)),
    ).toBe(true);
  });

  // T12.A.4 — Non-training event → member-group ping (existing behavior preserved)
  it('T12.A.4: non-training event (match) → member-group role ping, no warning text', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleStarted(
        makeEvent({
          event_type: 'match',
          discord_role_id: Option.some(ROLE_ID as any),
          claimed_by_discord_id: Option.none(),
        }),
      ),
      Layer.merge(rpcLayer, restLayer),
    );

    const createCalls = restCalls.createMessage.filter(([channelId]) => channelId === CHANNEL_ID);
    expect(createCalls).toHaveLength(1);
    const [, payload] = createCalls[0] as [string, MessageCreateRequest];
    const content = payload.content ?? '';
    // Must ping the member-group role, not an owners role
    expect(content).toContain(`<@&${ROLE_ID}>`);
    // Must NOT contain the no-coach warning text
    expect(content.toLowerCase()).not.toContain('coach');
  });

  // -------------------------------------------------------------------------
  // T12.B — Change B: delete-on-start (safeDeleteClaim branch)
  // -------------------------------------------------------------------------

  // T12.B.1 — Training with claim stored → deleteMessage called once with correct ids
  it('T12.B.1: training with stored claim → deleteMessage called once', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc({
      'Event/GetClaimInfo': (_args: any) =>
        Effect.succeed(
          Option.some({
            event_id: EVENT_ID,
            event_type: 'training',
            status: 'active',
            claimed_by_member_id: Option.none(),
            claimed_by_display_name: Option.none(),
            claim_discord_channel_id: Option.some(CLAIM_THREAD_ID as any),
            claim_discord_message_id: Option.some(CLAIM_MSG_ID as any),
            claim_thread_id: Option.none(),
          }),
        ),
    });
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleStarted(makeEvent({ event_type: 'training' })),
      Layer.merge(rpcLayer, restLayer),
    );

    expect(restCalls.deleteMessage).toHaveLength(1);
    const [threadId, msgId] = restCalls.deleteMessage[0] as [string, string];
    expect(threadId).toBe(CLAIM_THREAD_ID);
    expect(msgId).toBe(CLAIM_MSG_ID);
  });

  // T12.B.2 — Training with no stored claim → deleteMessage NOT called
  it('T12.B.2: training with no stored claim → deleteMessage not called', async () => {
    // Default mock returns claim_discord_channel_id: Option.none()
    const { layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(
      handleStarted(makeEvent({ event_type: 'training' })),
      Layer.merge(rpcLayer, restLayer),
    );

    expect(restCalls.deleteMessage).toHaveLength(0);
  });

  // T12.B.3 — deleteMessage returns 10008 Unknown Message → swallowed, handler resolves
  it('T12.B.3: deleteMessage returns 10008 → error swallowed, handler succeeds', async () => {
    const { layer: rpcLayer } = makeRecordingSyncRpc({
      'Event/GetClaimInfo': (_args: any) =>
        Effect.succeed(
          Option.some({
            event_id: EVENT_ID,
            event_type: 'training',
            status: 'active',
            claimed_by_member_id: Option.none(),
            claimed_by_display_name: Option.none(),
            claim_discord_channel_id: Option.some(CLAIM_THREAD_ID as any),
            claim_discord_message_id: Option.some(CLAIM_MSG_ID as any),
            claim_thread_id: Option.none(),
          }),
        ),
    });
    const { layer: restLayer } = makeRecordingDiscordREST({
      deleteMessage: (..._args: any[]) =>
        // Simulate Discord "Unknown Message" error
        Effect.fail({
          _tag: 'ErrorResponse',
          data: { code: 10008 },
        }) as unknown as Effect.Effect<any>,
    });

    // Must resolve without throwing
    await expect(
      run(handleStarted(makeEvent({ event_type: 'training' })), Layer.merge(rpcLayer, restLayer)),
    ).resolves.not.toThrow();
  });

  // T12.B.4 — Non-training → GetClaimInfo and deleteMessage NOT called
  it('T12.B.4: non-training (match) → GetClaimInfo not called, deleteMessage not called', async () => {
    const { calls: rpcCalls, layer: rpcLayer } = makeRecordingSyncRpc();
    const { calls: restCalls, layer: restLayer } = makeRecordingDiscordREST();

    await run(handleStarted(makeEvent({ event_type: 'match' })), Layer.merge(rpcLayer, restLayer));

    expect(rpcCalls.GetClaimInfo).toHaveLength(0);
    expect(restCalls.deleteMessage).toHaveLength(0);
  });
});
