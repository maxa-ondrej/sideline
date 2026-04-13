import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(() => sql`ALTER TABLE users ADD COLUMN birth_date DATE`),
    Effect.tap(
      () =>
        sql`UPDATE users SET birth_date = make_date(birth_year, 1, 1) WHERE birth_year IS NOT NULL`,
    ),
    Effect.tap(() => sql`ALTER TABLE users DROP COLUMN birth_year`),
  ),
);
