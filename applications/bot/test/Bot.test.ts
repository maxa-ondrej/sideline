import { DiscordREST } from 'dfx/DiscordREST';
import { DiscordGateway, InteractionsRegistry } from 'dfx/gateway';
import { Effect, Layer, Logger, LogLevel } from 'effect';
import { describe, expect, it } from 'vitest';
import { Bot } from '~/index.js';
import { RoleSyncService } from '~/services/RoleSyncService.js';

const MockDiscordGatewayLayer = Layer.succeed(DiscordGateway, {
  [DiscordGateway.key]: DiscordGateway.key,
  dispatch: undefined as never,
  fromDispatch: undefined as never,
  handleDispatch: (_event: string, _handle: unknown) => Effect.never,
  send: () => Effect.succeed(true),
  shards: Effect.succeed(new Set()),
} as never);

const MockInteractionsRegistryLayer = Layer.succeed(InteractionsRegistry, {
  register: () => Effect.void,
} as never);

const MockDiscordRESTLayer = Layer.succeed(
  DiscordREST,
  new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'getMyApplication') {
          return () => Effect.succeed({ id: 'mock-app-id' });
        }
        if (prop === 'bulkSetApplicationCommands') {
          return () => Effect.succeed([]);
        }
        if (prop === 'listMyGuilds') {
          return () => Effect.succeed([]);
        }
        return () => Effect.succeed(undefined);
      },
    },
  ) as never,
);

const MockRoleSyncServiceLayer = Layer.succeed(RoleSyncService, {
  processTick: Effect.void,
  poll: () => Effect.void,
  pollLoop: () => Effect.void,
} as unknown as RoleSyncService);

describe('Bot', () => {
  it('program composes and starts without error', async () => {
    const TestLayer = Layer.mergeAll(
      MockDiscordGatewayLayer,
      MockInteractionsRegistryLayer,
      MockDiscordRESTLayer,
      MockRoleSyncServiceLayer,
    );

    const result = await Effect.runPromise(
      Bot.program.pipe(
        Effect.timeout('200 millis'),
        Effect.ignore,
        Effect.provide(TestLayer),
        Logger.withMinimumLogLevel(LogLevel.None),
      ),
    );

    expect(result).toBeUndefined();
  });
});
