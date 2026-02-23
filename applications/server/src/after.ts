import { NodeFileSystem } from '@effect/platform-node';
import { PgClient } from '@effect/sql-pg';
import { Runtime } from '@sideline/effect-lib';
import { AfterMigrator } from '@sideline/migrations';
import { Config, Effect } from 'effect';
import { env } from './env.js';

const Migrate = AfterMigrator.pipe(
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
  Effect.tap(() => Migrate),
  Effect.provide(NodeFileSystem.layer),
  Runtime.runMain(env.NODE_ENV),
);
