import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    // Rename existing group_id on training_types to owner_group_id
    Effect.tap(() => sql`ALTER TABLE training_types RENAME COLUMN group_id TO owner_group_id`),
    // Add member_group_id to training_types
    Effect.tap(
      () =>
        sql`ALTER TABLE training_types ADD COLUMN member_group_id UUID REFERENCES groups(id) ON DELETE SET NULL`,
    ),
    // Add owner/member group columns to events
    Effect.tap(
      () =>
        sql`ALTER TABLE events ADD COLUMN owner_group_id UUID REFERENCES groups(id) ON DELETE SET NULL`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE events ADD COLUMN member_group_id UUID REFERENCES groups(id) ON DELETE SET NULL`,
    ),
    // Add owner/member group columns to event_series
    Effect.tap(
      () =>
        sql`ALTER TABLE event_series ADD COLUMN owner_group_id UUID REFERENCES groups(id) ON DELETE SET NULL`,
    ),
    Effect.tap(
      () =>
        sql`ALTER TABLE event_series ADD COLUMN member_group_id UUID REFERENCES groups(id) ON DELETE SET NULL`,
    ),
  ),
);
