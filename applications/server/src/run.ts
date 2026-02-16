import { createServer } from 'node:http';
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node';
import { PgClient } from '@effect/sql-pg';
import { MigratorLive } from '@sideline/migrations';
import { Config, Layer, Logger, LogLevel } from 'effect';
import { AppLive } from './index.js';

const PgLive = PgClient.layerConfig({
  url: Config.redacted('DATABASE_URL'),
});

const HttpLive = AppLive.pipe(
  Layer.provide(MigratorLive),
  Layer.provide(PgLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
  Layer.provide(Logger.json),
  Layer.provide(Logger.minimumLogLevel(LogLevel.Info)),
);

Layer.launch(HttpLive).pipe(NodeRuntime.runMain);
