import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE oauth_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'discord',
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, provider)
      )
    `,
    ),
    Effect.tap(
      () => sql`
      INSERT INTO oauth_connections (user_id, provider, access_token, refresh_token)
      SELECT id, 'discord', discord_access_token, discord_refresh_token FROM users
      WHERE discord_access_token != ''
    `,
    ),
    Effect.tap(() => sql`ALTER TABLE users DROP COLUMN discord_access_token`),
    Effect.tap(() => sql`ALTER TABLE users DROP COLUMN discord_refresh_token`),
  ),
);
