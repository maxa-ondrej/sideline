import { fileURLToPath } from 'node:url';
import { NodeFileSystem } from '@effect/platform-node';
import { Migrator } from '@effect/sql';
import { fromFileSystem } from '@effect/sql/Migrator/FileSystem';
import { Layer } from 'effect';

const migrationsDir = fileURLToPath(new URL('migrations', import.meta.url));

const migrator = Migrator.make({});

export const MigratorLive = migrator({
  loader: fromFileSystem(migrationsDir),
}).pipe(Layer.effectDiscard, Layer.provide(NodeFileSystem.layer));
