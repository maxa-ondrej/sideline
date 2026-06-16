import { Effect } from 'effect';
import { SqlClient } from 'effect/unstable/sql';

export default Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) =>
  Effect.Do.pipe(
    Effect.tap(
      () => sql`
      CREATE TABLE training_games (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        round INT NOT NULL CHECK (round >= 1),
        outcome TEXT NOT NULL CHECK (outcome IN ('teamA', 'teamB', 'draw')),
        submitted_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(event_id, round)
      )
    `,
    ),
    Effect.tap(() => sql`CREATE INDEX idx_training_games_event ON training_games(event_id, round)`),
    Effect.tap(
      () => sql`
      CREATE TABLE training_game_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        training_game_id UUID NOT NULL REFERENCES training_games(id) ON DELETE CASCADE,
        team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
        side TEXT NOT NULL CHECK (side IN ('A', 'B')),
        UNIQUE(training_game_id, team_member_id)
      )
    `,
    ),
    Effect.tap(
      () =>
        sql`CREATE INDEX idx_training_game_participants_game ON training_game_participants(training_game_id)`,
    ),
  ),
);
