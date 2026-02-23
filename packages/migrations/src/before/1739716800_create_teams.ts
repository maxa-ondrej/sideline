import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
    CREATE TABLE teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE team_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (team_id, user_id)
    );

    CREATE TABLE team_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ
    );

    ALTER TABLE users ADD COLUMN is_profile_complete BOOLEAN NOT NULL DEFAULT false;

    CREATE INDEX idx_team_members_team_user ON team_members(team_id, user_id);
    CREATE INDEX idx_team_invites_code ON team_invites(code);
    CREATE INDEX idx_team_invites_team ON team_invites(team_id);
  `,
);
