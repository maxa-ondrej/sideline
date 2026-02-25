import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE member_roles (
        team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
        PRIMARY KEY (team_member_id, role_id)
      )
    `,
    ),
    Effect.tap(
      () => sql`
      CREATE INDEX idx_member_roles_role_id ON member_roles(role_id)
    `,
    ),
    Effect.tap(
      () => sql`
      INSERT INTO member_roles (team_member_id, role_id)
      SELECT id, role_id FROM team_members WHERE role_id IS NOT NULL
    `,
    ),
    Effect.tap(
      () => sql`
      ALTER TABLE team_members DROP CONSTRAINT fk_team_members_role
    `,
    ),
    Effect.tap(
      () => sql`
      ALTER TABLE team_members DROP COLUMN role_id
    `,
    ),
  ),
);
