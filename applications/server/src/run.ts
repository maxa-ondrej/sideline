import { createServer } from 'node:http';
import { NodeHttpServer } from '@effect/platform-node';
import { PgClient } from '@effect/sql-pg';
import { Runtime } from '@sideline/effect-lib';
import { MigratorLive } from '@sideline/migrations';
import { Config, Effect, Layer } from 'effect';
import { env } from './env.js';
import { AppLive, HealthServerLive } from './index.js';

const PgLive = PgClient.layerConfig({
  url: Config.succeed(env.DATABASE_URL),
});

const App = AppLive.pipe(
  Layer.provide(MigratorLive),
  Layer.provide(PgLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.PORT })),
  Layer.launch,
  Effect.withLogSpan('app'),
);

const Health = HealthServerLive.pipe(Layer.launch, Effect.withLogSpan('health'));

Effect.all([App, Health], { concurrency: 2 }).pipe(Runtime.runMain(env.NODE_ENV));
