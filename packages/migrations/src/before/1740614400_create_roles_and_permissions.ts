import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        is_built_in BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
    ),
    Effect.tap(
      () => sql`
      CREATE UNIQUE INDEX idx_roles_team_name ON roles(team_id, name)
    `,
    ),
    Effect.tap(
      () => sql`
      CREATE TABLE role_permissions (
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission TEXT NOT NULL,
        PRIMARY KEY (role_id, permission)
      )
    `,
    ),
    Effect.tap(
      () => sql`
      INSERT INTO roles (team_id, name, is_built_in)
      SELECT t.id, r.name, true
      FROM teams t
      CROSS JOIN (VALUES ('Admin'), ('Captain'), ('Player')) AS r(name)
    `,
    ),
    Effect.tap(
      () => sql`
      INSERT INTO role_permissions (role_id, permission)
      SELECT r.id, p.permission
      FROM roles r
      CROSS JOIN LATERAL (
        SELECT unnest(CASE r.name
          WHEN 'Admin' THEN ARRAY[
            'team:manage', 'team:invite',
            'roster:view', 'roster:manage',
            'member:view', 'member:edit', 'member:remove',
            'role:view', 'role:manage'
          ]
          WHEN 'Captain' THEN ARRAY[
            'roster:view', 'roster:manage',
            'member:view', 'member:edit',
            'role:view'
          ]
          WHEN 'Player' THEN ARRAY[
            'roster:view', 'member:view'
          ]
        END) AS permission
      ) p
      WHERE r.is_built_in = true
    `,
    ),
    Effect.tap(
      () => sql`
      ALTER TABLE team_members ADD COLUMN role_id UUID
    `,
    ),
    Effect.tap(
      () => sql`
      UPDATE team_members tm
      SET role_id = r.id
      FROM roles r
      WHERE r.team_id = tm.team_id
        AND r.is_built_in = true
        AND CASE
          WHEN tm.role = 'admin' THEN r.name = 'Admin'
          WHEN tm.role = 'member' THEN r.name = 'Player'
          ELSE false
        END
    `,
    ),
    Effect.tap(
      () => sql`
      ALTER TABLE team_members ALTER COLUMN role_id SET NOT NULL
    `,
    ),
    Effect.tap(
      () => sql`
      ALTER TABLE team_members
      ADD CONSTRAINT fk_team_members_role
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
    `,
    ),
    Effect.tap(
      () => sql`
      ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check
    `,
    ),
    Effect.tap(
      () => sql`
      ALTER TABLE team_members DROP COLUMN role
    `,
    ),
  ),
);
