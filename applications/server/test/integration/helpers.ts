import { SqlClient } from '@effect/sql';
import { PgClient } from '@effect/sql-pg';
import { Config, Effect } from 'effect';

const TestPgClientConfig = {
  host: Config.string('DATABASE_HOST'),
  port: Config.number('DATABASE_PORT'),
  database: Config.string('DATABASE_NAME'),
  username: Config.string('DATABASE_USER'),
  password: Config.redacted('DATABASE_PASS'),
};

export const TestPgClient = PgClient.layerConfig(TestPgClientConfig);

export const cleanDatabase = SqlClient.SqlClient.pipe(
  Effect.andThen((sql) =>
    sql.unsafe(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'migrations_%')
        LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `),
  ),
  Effect.asVoid,
);
