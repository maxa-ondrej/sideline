import { createServer } from 'node:http';
import { NodeHttpServer } from '@effect/platform-node';
import { PgClient } from '@effect/sql-pg';
import { MigratorLive } from '@sideline/migrations';
import { Config, Layer } from 'effect';
import { AppLive } from './index.js';
import { runMain } from './Runtime.js';

const PgLive = PgClient.layerConfig({
  url: Config.redacted('DATABASE_URL'),
});

const HttpLive = AppLive.pipe(
  Layer.provide(MigratorLive),
  Layer.provide(PgLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
);

Layer.launch(HttpLive).pipe(runMain);
