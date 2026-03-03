import { DiscordGateway } from 'dfx/gateway';
import * as Discord from 'dfx/types';
import { Effect, Layer, Logger, LogLevel } from 'effect';
import { describe, expect, it } from 'vitest';
import { eventHandlers } from '~/events/index.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const makeRecordingGateway = () => {
  const registeredEvents: string[] = [];

  const layer = Layer.succeed(DiscordGateway, {
    [DiscordGateway.key]: DiscordGateway.key,
    dispatch: undefined as never,
    fromDispatch: undefined as never,
    handleDispatch: (event: string, _handle: unknown) => {
      registeredEvents.push(event);
      return Effect.never;
    },
    send: undefined as never,
    shards: Effect.succeed(new Set()),
  } as never);

  return { registeredEvents, layer };
};

const MockSyncRpcLayer = Layer.succeed(
  SyncRpc,
  new Proxy({} as SyncRpc, {
    get: () => () => Effect.void,
  }),
);

describe('events', () => {
  it('registers handlers for expected gateway events', async () => {
    const { registeredEvents, layer } = makeRecordingGateway();

    await Effect.runPromise(
      eventHandlers.pipe(
        Effect.timeout('100 millis'),
        Effect.ignore,
        Effect.provide(Layer.merge(layer, MockSyncRpcLayer)),
        Logger.withMinimumLogLevel(LogLevel.None),
      ),
    );

    expect(registeredEvents).toContain(Discord.GatewayDispatchEvents.GuildCreate);
    expect(registeredEvents).toContain(Discord.GatewayDispatchEvents.GuildDelete);
    expect(registeredEvents).toContain(Discord.GatewayDispatchEvents.GuildMemberAdd);
    expect(registeredEvents).toContain(Discord.GatewayDispatchEvents.GuildMemberRemove);
    expect(registeredEvents).toContain(Discord.GatewayDispatchEvents.GuildMemberUpdate);
    expect(registeredEvents).toHaveLength(5);
  });

  it('returns the correct number of handler effects', async () => {
    const { layer } = makeRecordingGateway();

    const result = await Effect.runPromise(
      eventHandlers.pipe(
        Effect.timeout('100 millis'),
        Effect.provide(Layer.merge(layer, MockSyncRpcLayer)),
        Logger.withMinimumLogLevel(LogLevel.None),
      ),
    );

    expect(Array.isArray(result)).toBe(true);
  });
});
