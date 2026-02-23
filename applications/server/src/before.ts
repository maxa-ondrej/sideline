import { NodeFileSystem } from '@effect/platform-node';
import { SqlClient } from '@effect/sql';
import { PgClient } from '@effect/sql-pg';
import { Runtime } from '@sideline/effect-lib';
import { BeforeMigrator } from '@sideline/migrations';
import { Config, Effect } from 'effect';
import { env } from './env.js';

const CreateDb = SqlClient.SqlClient.pipe(
  Effect.andThen((sql) => sql`CREATE DATABASE ${env.DATABASE_NAME}`),
  Effect.option,
  Effect.asVoid,
  Effect.provide(
    PgClient.layerConfig({
      host: Config.succeed(env.DATABASE_HOST),
      port: Config.succeed(env.DATABASE_PORT),
      database: Config.succeed(env.DATABASE_MAIN),
      username: Config.succeed(env.DATABASE_USER),
      password: Config.succeed(env.DATABASE_PASS),
    }),
  ),
);

const Migrate = BeforeMigrator.pipe(
  Effect.provide(
    PgClient.layerConfig({
      host: Config.succeed(env.DATABASE_HOST),
      port: Config.succeed(env.DATABASE_PORT),
      database: Config.succeed(env.DATABASE_NAME),
      username: Config.succeed(env.DATABASE_USER),
      password: Config.succeed(env.DATABASE_PASS),
    }),
  ),
);

Effect.Do.pipe(
  Effect.tap(() => (env.NODE_ENV === 'development' ? CreateDb : Effect.void)),
  Effect.tap(() => Migrate),
  Effect.provide(NodeFileSystem.layer),
  Runtime.runMain(env.NODE_ENV),
);
