import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE users ADD COLUMN birth_date DATE`),
    Effect.tap(
      () =>
        sql`UPDATE users SET birth_date = make_date(birth_year, 1, 1) WHERE birth_year IS NOT NULL`,
    ),
    Effect.tap(() => sql`ALTER TABLE users DROP COLUMN birth_year`),
  ),
);
