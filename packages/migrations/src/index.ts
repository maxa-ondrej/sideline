import { fileURLToPath } from 'node:url';
import { Migrator as SqlMigrator } from '@effect/sql';
import { fromFileSystem } from '@effect/sql/Migrator/FileSystem';

const migrationsDir = fileURLToPath(new URL('migrations', import.meta.url));

const createMigrator = SqlMigrator.make({});

export const Migrator = createMigrator({
  loader: fromFileSystem(migrationsDir),
});
