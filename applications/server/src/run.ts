import { createServer } from 'node:http';
import { NodeHttpServer } from '@effect/platform-node';
import { PgClient } from '@effect/sql-pg';
import { Runtime } from '@sideline/effect-lib';
import { Config, Effect, Layer } from 'effect';
import { env } from './env.js';
import { AppLive, HealthServerLive } from './index.js';

const PgLive = PgClient.layerConfig({
  host: Config.succeed(env.DATABASE_HOST),
  port: Config.succeed(env.DATABASE_PORT),
  database: Config.succeed(env.DATABASE_NAME),
  username: Config.succeed(env.DATABASE_USER),
  password: Config.succeed(env.DATABASE_PASS),
});

const App = AppLive.pipe(
  Layer.provide(PgLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.PORT })),
  Layer.launch,
  Effect.withLogSpan('app'),
);

const Health = HealthServerLive.pipe(Layer.launch, Effect.withLogSpan('health'));

Effect.all([App, Health], { concurrency: 2 }).pipe(Runtime.runMain(env.NODE_ENV));
