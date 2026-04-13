import { Notification, Team, User } from '@sideline/domain';
import { Effect, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class NotificationRow extends Schema.Class<NotificationRow>('NotificationRow')({
  id: Notification.NotificationId,
  team_id: Team.TeamId,
  user_id: User.UserId,
  type: Notification.NotificationType,
  title: Schema.String,
  body: Schema.String,
  is_read: Schema.Boolean,
  created_at: Schema.String,
}) {}

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Schema.String,
  user_id: Schema.String,
  type: Schema.String,
  title: Schema.String,
  body: Schema.String,
}) {}

class FindByUserAndTeamInput extends Schema.Class<FindByUserAndTeamInput>('FindByUserAndTeamInput')(
  {
    user_id: Schema.String,
    team_id: Schema.String,
  },
) {}

class MarkAllReadForTeamInput extends Schema.Class<MarkAllReadForTeamInput>(
  'MarkAllReadForTeamInput',
)({
  user_id: Schema.String,
  team_id: Schema.String,
}) {}

class MarkReadInput extends Schema.Class<MarkReadInput>('MarkReadInput')({
  id: Notification.NotificationId,
}) {}

export class NotificationsRepository extends Effect.Service<NotificationsRepository>()(
  'api/NotificationsRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private findByUserId = SqlSchema.findAll({
    Request: Schema.String,
    Result: NotificationRow,
    execute: (userId) => this.sql`
      SELECT id, team_id, user_id, type, title, body, is_read,
             created_at::text AS created_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `,
  });

  private findByUserIdAndTeamId = SqlSchema.findAll({
    Request: FindByUserAndTeamInput,
    Result: NotificationRow,
    execute: (input) => this.sql`
      SELECT id, team_id, user_id, type, title, body, is_read,
             created_at::text AS created_at
      FROM notifications
      WHERE user_id = ${input.user_id} AND team_id = ${input.team_id}
      ORDER BY created_at DESC
      LIMIT 50
    `,
  });

  private markAllReadForTeam = SqlSchema.void({
    Request: MarkAllReadForTeamInput,
    execute: (input) =>
      this
        .sql`UPDATE notifications SET is_read = true WHERE user_id = ${input.user_id} AND team_id = ${input.team_id} AND is_read = false`,
  });

  private insertOne = SqlSchema.single({
    Request: InsertInput,
    Result: NotificationRow,
    execute: (input) => this.sql`
      INSERT INTO notifications (team_id, user_id, type, title, body)
      VALUES (${input.team_id}, ${input.user_id}, ${input.type}, ${input.title}, ${input.body})
      RETURNING id, team_id, user_id, type, title, body, is_read,
                created_at::text AS created_at
    `,
  });

  private markOneAsRead = SqlSchema.void({
    Request: MarkReadInput,
    execute: (input) => this.sql`UPDATE notifications SET is_read = true WHERE id = ${input.id}`,
  });

  private markAllRead = SqlSchema.void({
    Request: Schema.String,
    execute: (userId) =>
      this
        .sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId} AND is_read = false`,
  });

  private findOneById = SqlSchema.findOne({
    Request: Notification.NotificationId,
    Result: NotificationRow,
    execute: (id) => this.sql`
      SELECT id, team_id, user_id, type, title, body, is_read,
             created_at::text AS created_at
      FROM notifications WHERE id = ${id}
    `,
  });

  findByUser = (userId: User.UserId) => this.findByUserId(userId).pipe(catchSqlErrors);

  findByUserAndTeam = (userId: User.UserId, teamId: Team.TeamId) =>
    this.findByUserIdAndTeamId({ user_id: userId, team_id: teamId }).pipe(catchSqlErrors);

  markAllAsReadForTeam = (userId: User.UserId, teamId: Team.TeamId) =>
    this.markAllReadForTeam({ user_id: userId, team_id: teamId }).pipe(catchSqlErrors);

  insert = (
    teamId: Team.TeamId,
    userId: User.UserId,
    type: Notification.NotificationType,
    title: string,
    body: string,
  ) => this.insertOne({ team_id: teamId, user_id: userId, type, title, body }).pipe(catchSqlErrors);

  insertBulk = (
    notifications: ReadonlyArray<{
      teamId: Team.TeamId;
      userId: User.UserId;
      type: Notification.NotificationType;
      title: string;
      body: string;
    }>,
  ) =>
    Effect.all(
      notifications.map((n) =>
        this.insertOne({
          team_id: n.teamId,
          user_id: n.userId,
          type: n.type,
          title: n.title,
          body: n.body,
        }),
      ),
    ).pipe(Effect.asVoid, catchSqlErrors);

  markAsRead = (notificationId: Notification.NotificationId) =>
    this.markOneAsRead({ id: notificationId }).pipe(catchSqlErrors);

  markAllAsRead = (userId: User.UserId) => this.markAllRead(userId).pipe(catchSqlErrors);

  findById = (notificationId: Notification.NotificationId) =>
    this.findOneById(notificationId).pipe(catchSqlErrors);
}
