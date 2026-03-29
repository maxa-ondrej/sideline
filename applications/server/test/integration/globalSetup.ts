import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeFileSystem } from '@effect/platform-node';
import { PgClient } from '@effect/sql-pg';
import { AfterMigrator, BeforeMigrator } from '@sideline/migrations';
import { Config, Effect, Layer, Redacted } from 'effect';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

const CONNECTION_FILE = join(tmpdir(), 'sideline-test-db.json');

const DATABASE = 'testdb';
const USERNAME = 'testuser';
const PASSWORD = 'testpass';

let container: StartedTestContainer | undefined;

export async function setup() {
  container = await new GenericContainer('postgres:17')
    .withEnvironment({
      POSTGRES_DB: DATABASE,
      POSTGRES_USER: USERNAME,
      POSTGRES_PASSWORD: PASSWORD,
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);

  const pgLayer = PgClient.layerConfig({
    host: Config.succeed(host),
    port: Config.succeed(port),
    database: Config.succeed(DATABASE),
    username: Config.succeed(USERNAME),
    password: Config.succeed(Redacted.make(PASSWORD)),
  });

  const MigratorContext = Layer.merge(pgLayer, NodeFileSystem.layer);

  await Effect.Do.pipe(
    Effect.tap(() => BeforeMigrator),
    Effect.tap(() => AfterMigrator),
    Effect.provide(MigratorContext),
    Effect.runPromise,
  );

  writeFileSync(
    CONNECTION_FILE,
    JSON.stringify({
      host,
      port,
      database: DATABASE,
      username: USERNAME,
      password: PASSWORD,
    }),
  );
}

export async function teardown() {
  try {
    unlinkSync(CONNECTION_FILE);
  } catch {
    // ignore if file doesn't exist
  }
  await container?.stop();
}
