// The shared events board is removed (remove-global-events-board, Release A):
// `postRsvpDiscordUpdates` no longer refreshes a global board message
// (GetDiscordMessageId + buildEventEmbed + updateMessage are gone). Personal
// channel messages refresh via the server-side dirty-mark instead. The only
// remaining Discord-side effect is the late-RSVP notice.

import {
  Discord as DomainDiscord,
  type Event,
  type EventRpcModels,
  type EventRsvp,
  type Team,
} from '@sideline/domain';
import type { DiscordRestService } from 'dfx/DiscordREST';
import type * as DiscordTypes from 'dfx/types';
import * as DiscordTypesImport from 'dfx/types';
import { Effect, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { postRsvpDiscordUpdates } from '~/interactions/rsvp.js';
import type { SyncRpcClient } from '~/services/SyncRpc.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUILD_ID = '999999999999999999' as DiscordTypes.Snowflake;
const APP_ID = '444444444444444444' as DiscordTypes.Snowflake;
const INTERACTION_TOKEN = 'test-interaction-token';
const EVENT_ID = '00000000-0000-0000-0000-000000000060' as Event.EventId;
const TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
// `discordUserId` / `counts.lateRsvpChannelId` are domain-branded Snowflakes
// (distinct from dfx's own Snowflake brand used on the raw interaction).
const USER_DISCORD_ID = DomainDiscord.Snowflake.makeUnsafe('111111111111111111');
const LATE_RSVP_CHANNEL_ID = DomainDiscord.Snowflake.makeUnsafe('222222222222222222');

const makeInteraction = (): DiscordTypes.APIInteraction =>
  ({
    id: '1234567890' as DiscordTypes.Snowflake,
    application_id: APP_ID,
    token: INTERACTION_TOKEN,
    version: 1,
    type: DiscordTypesImport.InteractionTypes.MESSAGE_COMPONENT,
    guild_id: GUILD_ID,
    channel_id: LATE_RSVP_CHANNEL_ID as unknown as DiscordTypes.Snowflake,
  }) as unknown as DiscordTypes.APIInteraction;

const makeCounts = (
  overrides: Partial<EventRpcModels.SubmitRsvpResult> = {},
): EventRpcModels.SubmitRsvpResult =>
  ({
    yesCount: 3,
    noCount: 1,
    maybeCount: 0,
    canRsvp: true,
    isLateRsvp: false,
    lateRsvpChannelId: Option.none(),
    message: Option.none(),
    userName: Option.some('Alice'),
    userNickname: Option.none(),
    userDisplayName: Option.none(),
    userUsername: Option.none(),
    ...overrides,
  }) as EventRpcModels.SubmitRsvpResult;

const makeRpc = (
  overrides: Partial<Record<string, (...args: any[]) => Effect.Effect<any>>> = {},
) => {
  const defaults: Record<string, (...args: any[]) => Effect.Effect<any>> = {
    'Event/GetEventEmbedInfo': () =>
      Effect.succeed(
        Option.some({
          title: 'Saturday Match',
          description: Option.none(),
          image_url: Option.none(),
          start_at: undefined,
          end_at: Option.none(),
          location: Option.none(),
          location_url: Option.none(),
          event_type: 'match',
          all_day: false,
          status: 'active',
        }),
      ),
  };
  return new Proxy({} as any, {
    get: (_target, prop: string) => {
      if (typeof prop !== 'string' || prop === 'then' || prop === 'catch') return undefined;
      return overrides[prop] ?? defaults[prop] ?? (() => Effect.succeed(null));
    },
  }) as SyncRpcClient;
};

const makeRest = (calls: {
  getGuild: unknown[];
  getMessage: unknown[];
  updateMessage: unknown[];
  createMessage: Array<{ channelId: unknown; payload: unknown }>;
}) =>
  new Proxy({} as DiscordRestService, {
    get: (_target, prop: string) => {
      if (prop === 'getGuild') {
        return (...args: unknown[]) => {
          calls.getGuild.push(args);
          return Effect.succeed({ preferred_locale: 'en-US', system_channel_id: null });
        };
      }
      if (prop === 'getMessage') {
        return (...args: unknown[]) => {
          calls.getMessage.push(args);
          return Effect.succeed({ id: 'msg-id', embeds: [], components: [] });
        };
      }
      if (prop === 'updateMessage') {
        return (...args: unknown[]) => {
          calls.updateMessage.push(args);
          return Effect.succeed({});
        };
      }
      if (prop === 'createMessage') {
        return (channelId: unknown, payload: unknown) => {
          calls.createMessage.push({ channelId, payload });
          return Effect.succeed({ id: 'new-msg-id' });
        };
      }
      return () => Effect.succeed(null);
    },
  }) as unknown as DiscordRestService;

const makeCallTracker = () => ({
  getGuild: [] as unknown[],
  getMessage: [] as unknown[],
  updateMessage: [] as unknown[],
  createMessage: [] as Array<{ channelId: unknown; payload: unknown }>,
});

const baseParams = (counts: EventRpcModels.SubmitRsvpResult) => ({
  interaction: makeInteraction(),
  rpc: makeRpc(),
  eventId: EVENT_ID,
  teamId: TEAM_ID,
  response: 'yes' as EventRsvp.RsvpResponse,
  discordUserId: USER_DISCORD_ID,
  counts,
});

describe('postRsvpDiscordUpdates', () => {
  it('not-late RSVP: zero Discord REST calls (no board refresh, no late notice)', async () => {
    const calls = makeCallTracker();
    const rest = makeRest(calls);
    const counts = makeCounts({ isLateRsvp: false });

    await Effect.runPromise(
      postRsvpDiscordUpdates({ ...baseParams(counts), rest }) as Effect.Effect<void, never, never>,
    );

    expect(calls.getGuild).toHaveLength(0);
    expect(calls.getMessage).toHaveLength(0);
    expect(calls.updateMessage).toHaveLength(0);
    expect(calls.createMessage).toHaveLength(0);
  });

  it('late RSVP with a configured channel: exactly one createMessage to that channel, no board refresh', async () => {
    const calls = makeCallTracker();
    const rest = makeRest(calls);
    const counts = makeCounts({
      isLateRsvp: true,
      lateRsvpChannelId: Option.some(LATE_RSVP_CHANNEL_ID),
    });

    await Effect.runPromise(
      postRsvpDiscordUpdates({ ...baseParams(counts), rest }) as Effect.Effect<void, never, never>,
    );

    expect(calls.updateMessage).toHaveLength(0);
    expect(calls.getMessage).toHaveLength(0);
    expect(calls.createMessage).toHaveLength(1);
    expect(calls.createMessage[0]?.channelId).toBe(LATE_RSVP_CHANNEL_ID);
  });

  it('late RSVP with no configured channel: no Discord calls at all', async () => {
    const calls = makeCallTracker();
    const rest = makeRest(calls);
    const counts = makeCounts({ isLateRsvp: true, lateRsvpChannelId: Option.none() });

    await Effect.runPromise(
      postRsvpDiscordUpdates({ ...baseParams(counts), rest }) as Effect.Effect<void, never, never>,
    );

    expect(calls.getGuild).toHaveLength(0);
    expect(calls.createMessage).toHaveLength(0);
  });

  it('error path: a late-RSVP REST failure is caught and logged, not thrown', async () => {
    const calls = makeCallTracker();
    const rest = new Proxy({} as DiscordRestService, {
      get: (_target, prop: string) => {
        if (prop === 'getGuild') {
          return () => Effect.fail({ _tag: 'ErrorResponse' as const, data: { code: 50001 } });
        }
        return () => Effect.succeed(null);
      },
    }) as unknown as DiscordRestService;
    const counts = makeCounts({
      isLateRsvp: true,
      lateRsvpChannelId: Option.some(LATE_RSVP_CHANNEL_ID),
    });

    await expect(
      Effect.runPromise(
        postRsvpDiscordUpdates({ ...baseParams(counts), rest }) as Effect.Effect<
          void,
          never,
          never
        >,
      ),
    ).resolves.toBeUndefined();

    expect(calls.createMessage).toHaveLength(0);
  });

  it('no guild id on the interaction: resolves without any Discord call', async () => {
    const calls = makeCallTracker();
    const rest = makeRest(calls);
    const counts = makeCounts({
      isLateRsvp: true,
      lateRsvpChannelId: Option.some(LATE_RSVP_CHANNEL_ID),
    });
    const interactionWithoutGuild = { ...makeInteraction(), guild_id: undefined };

    await Effect.runPromise(
      postRsvpDiscordUpdates({
        ...baseParams(counts),
        interaction: interactionWithoutGuild,
        rest,
      }) as Effect.Effect<void, never, never>,
    );

    expect(calls.createMessage).toHaveLength(0);
  });
});
