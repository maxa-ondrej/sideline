import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`ALTER TABLE event_series ADD COLUMN days_of_week INTEGER[] NOT NULL DEFAULT '{}'`,
    ),
    Effect.tap(() => sql`UPDATE event_series SET days_of_week = ARRAY[day_of_week]`),
    Effect.tap(() => sql`ALTER TABLE event_series DROP COLUMN day_of_week`),
    Effect.tap(
      () =>
        sql`ALTER TABLE event_series ADD CONSTRAINT chk_days_of_week CHECK (days_of_week <> '{}' AND array_length(days_of_week, 1) <= 7)`,
    ),
  ),
);
