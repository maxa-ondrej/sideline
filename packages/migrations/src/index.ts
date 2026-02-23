import { fileURLToPath } from 'node:url';
import { Migrator as SqlMigrator } from '@effect/sql';
import { fromFileSystem } from '@effect/sql/Migrator/FileSystem';

const createMigrator = SqlMigrator.make({});

export const BeforeMigrator = createMigrator({
  table: 'migrations_before',
  loader: fromFileSystem(fileURLToPath(new URL('before', import.meta.url))),
});

export const AfterMigrator = createMigrator({
  table: 'migrations_after',
  loader: fromFileSystem(fileURLToPath(new URL('after', import.meta.url))),
});
