import { createServer } from 'node:http';
import { NodeHttpServer } from '@effect/platform-node';
import { PgClient } from '@effect/sql-pg';
import { Runtime } from '@sideline/effect-lib';
import { MigratorLive } from '@sideline/migrations';
import { Config, Layer } from 'effect';
import { env } from './env.js';
import { HealthServerLive } from './HealthServerLive.js';
import { AppLive } from './index.js';

const PgLive = PgClient.layerConfig({
  url: Config.succeed(env.DATABASE_URL),
});

const HttpLive = AppLive.pipe(
  Layer.provide(MigratorLive),
  Layer.provide(PgLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.PORT })),
);

Layer.launch(Layer.mergeAll(HttpLive, HealthServerLive)).pipe(Runtime.runMain(env.NODE_ENV));
