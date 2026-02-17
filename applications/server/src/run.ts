import { createServer } from 'node:http';
import { NodeHttpServer } from '@effect/platform-node';
import { PgClient } from '@effect/sql-pg';
import { Runtime } from '@sideline/effect-lib';
import { MigratorLive } from '@sideline/migrations';
import { Config, Layer } from 'effect';
import { env } from './env.js';
import { AppLive } from './index.js';

const PgLive = PgClient.layerConfig({
  url: Config.succeed(env.DATABASE_URL),
});

const HttpLive = AppLive.pipe(
  Layer.provide(MigratorLive),
  Layer.provide(PgLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
);

Layer.launch(HttpLive).pipe(Runtime.runMain(env.NODE_ENV));
