import { createServer } from 'node:http';
import { NodeFileSystem, NodeHttpServer } from '@effect/platform-node';
import { SqlClient } from '@effect/sql';
import { PgClient } from '@effect/sql-pg';
import { Runtime } from '@sideline/effect-lib';
import { AfterMigrator, BeforeMigrator } from '@sideline/migrations';
import { Config, Effect, Layer } from 'effect';
import { env } from './env.js';
import { AppLive, HealthServerLive } from './index.js';

const BasePg: Config.Config.Wrap<PgClient.PgClientConfig> = {
  host: Config.succeed(env.DATABASE_HOST),
  port: Config.succeed(env.DATABASE_PORT),
  database: Config.succeed(env.DATABASE_NAME),
  username: Config.succeed(env.DATABASE_USER),
  password: Config.succeed(env.DATABASE_PASS),
};

const CreateDb = SqlClient.SqlClient.pipe(
  Effect.andThen((sql) => sql(`CREATE DATABASE "${env.DATABASE_NAME}"`)),
  Effect.tap(Effect.logInfo),
  Effect.tapError(Effect.logWarning),
  Effect.option,
  Effect.asVoid,
  Effect.provide(
    PgClient.layerConfig({
      ...BasePg,
      database: Config.succeed(env.DATABASE_MAIN),
    }),
  ),
);

const MigratorContext = Layer.merge(PgClient.layerConfig(BasePg), NodeFileSystem.layer);
const MigrateBefore = BeforeMigrator.pipe(Effect.provide(MigratorContext));
const MigrateAfter = AfterMigrator.pipe(Effect.provide(MigratorContext));

const App = AppLive.pipe(
  Layer.provide(PgClient.layerConfig(BasePg)),
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.PORT })),
  Layer.launch,
  Effect.withLogSpan('app'),
);

const Health = HealthServerLive.pipe(Layer.launch, Effect.withLogSpan('health'));

Effect.Do.pipe(
  Effect.tap(() => (env.NODE_ENV === 'development' ? CreateDb : Effect.void)),
  Effect.tap(() => MigrateBefore),
  Effect.andThen(() => Effect.all([App, Health, MigrateAfter], { concurrency: 3 })),
  Runtime.runMain(env.NODE_ENV),
);
