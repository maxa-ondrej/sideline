import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
    ALTER TABLE users ADD COLUMN name TEXT;
    ALTER TABLE users ADD COLUMN birth_year INTEGER;
    ALTER TABLE users ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female', 'other'));
    ALTER TABLE users ADD COLUMN jersey_number INTEGER;
    ALTER TABLE users ADD COLUMN position TEXT CHECK (position IN ('goalkeeper', 'defender', 'midfielder', 'forward'));
    ALTER TABLE users ADD COLUMN proficiency TEXT CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'pro'));
  `,
);
