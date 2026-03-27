import { SqlClient } from '@effect/sql';
import type { ActivityType, Leaderboard, Team } from '@sideline/domain';
import { TeamMember, User } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';

class LeaderboardRow extends Schema.Class<LeaderboardRow>('LeaderboardRow')({
  team_member_id: TeamMember.TeamMemberId,
  user_id: User.UserId,
  username: Schema.String,
  name: Schema.OptionFromNullOr(Schema.String),
  avatar: Schema.OptionFromNullOr(Schema.String),
  total_activities: Schema.Int,
  total_duration_minutes: Schema.Int,
  activity_dates: Schema.Array(Schema.String),
}) {}

const decodeRows = Schema.decodeUnknown(Schema.Array(LeaderboardRow));

export class LeaderboardRepository extends Effect.Service<LeaderboardRepository>()(
  'api/LeaderboardRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  getLeaderboard = (
    teamId: Team.TeamId,
    activityTypeId: Option.Option<ActivityType.ActivityTypeId>,
    timeframe: Leaderboard.LeaderboardTimeframe,
  ) => {
    const activityTypeFilter = Option.match(activityTypeId, {
      onNone: () => this.sql``,
      onSome: (id) => this.sql`AND al.activity_type_id = ${id}`,
    });

    const activityTypeDatesFilter = Option.match(activityTypeId, {
      onNone: () => this.sql``,
      onSome: (id) => this.sql`AND al2.activity_type_id = ${id}`,
    });

    const timeframeFilter =
      timeframe === 'week' ? this.sql`AND al.logged_at >= NOW() - INTERVAL '7 days'` : this.sql``;

    const query = this.sql`
      SELECT
        tm.id::text AS team_member_id,
        u.id::text AS user_id,
        u.username,
        u.name,
        u.avatar,
        COUNT(al.id)::int AS total_activities,
        COALESCE(SUM(al.duration_minutes), 0)::int AS total_duration_minutes,
        ARRAY(
          SELECT DISTINCT (al2.logged_at AT TIME ZONE 'Europe/Prague')::date::text
          FROM activity_logs al2
          WHERE al2.team_member_id = tm.id
            ${activityTypeDatesFilter}
          ORDER BY 1
        ) AS activity_dates
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      LEFT JOIN activity_logs al ON al.team_member_id = tm.id
        ${activityTypeFilter}
        ${timeframeFilter}
      WHERE tm.team_id = ${teamId}
        AND tm.active = true
      GROUP BY tm.id, u.id, u.username, u.name, u.avatar
      HAVING COUNT(al.id) > 0
      ORDER BY total_activities DESC, total_duration_minutes DESC
    `;

    return query.pipe(
      Effect.flatMap(decodeRows),
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );
  };
}
