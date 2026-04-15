import { Notification, Team, User } from '@sideline/domain';
import { Effect, Layer, Schema, ServiceMap } from 'effect';
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

const InsertInput = Schema.Struct({
  team_id: Schema.String,
  user_id: Schema.String,
  type: Schema.String,
  title: Schema.String,
  body: Schema.String,
});

const FindByUserAndTeamInput = Schema.Struct({
  user_id: Schema.String,
  team_id: Schema.String,
});

const MarkAllReadForTeamInput = Schema.Struct({
  user_id: Schema.String,
  team_id: Schema.String,
});

const MarkReadInput = Schema.Struct({
  id: Notification.NotificationId,
});

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const findByUserId = SqlSchema.findAll({
    Request: Schema.String,
    Result: NotificationRow,
    execute: (userId) => sql`
      SELECT id, team_id, user_id, type, title, body, is_read,
             created_at::text AS created_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `,
  });

  const findByUserIdAndTeamId = SqlSchema.findAll({
    Request: FindByUserAndTeamInput,
    Result: NotificationRow,
    execute: (input) => sql`
      SELECT id, team_id, user_id, type, title, body, is_read,
             created_at::text AS created_at
      FROM notifications
      WHERE user_id = ${input.user_id} AND team_id = ${input.team_id}
      ORDER BY created_at DESC
      LIMIT 50
    `,
  });

  const markAllReadForTeam = SqlSchema.void({
    Request: MarkAllReadForTeamInput,
    execute: (input) =>
      sql`UPDATE notifications SET is_read = true WHERE user_id = ${input.user_id} AND team_id = ${input.team_id} AND is_read = false`,
  });

  const insertOne = SqlSchema.findOne({
    Request: InsertInput,
    Result: NotificationRow,
    execute: (input) => sql`
      INSERT INTO notifications (team_id, user_id, type, title, body)
      VALUES (${input.team_id}, ${input.user_id}, ${input.type}, ${input.title}, ${input.body})
      RETURNING id, team_id, user_id, type, title, body, is_read,
                created_at::text AS created_at
    `,
  });

  const markOneAsRead = SqlSchema.void({
    Request: MarkReadInput,
    execute: (input) => sql`UPDATE notifications SET is_read = true WHERE id = ${input.id}`,
  });

  const markAllRead = SqlSchema.void({
    Request: Schema.String,
    execute: (userId) =>
      sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId} AND is_read = false`,
  });

  const findOneById = SqlSchema.findOneOption({
    Request: Notification.NotificationId,
    Result: NotificationRow,
    execute: (id) => sql`
      SELECT id, team_id, user_id, type, title, body, is_read,
             created_at::text AS created_at
      FROM notifications WHERE id = ${id}
    `,
  });

  const findByUser = (userId: User.UserId) => findByUserId(userId).pipe(catchSqlErrors);

  const findByUserAndTeam = (userId: User.UserId, teamId: Team.TeamId) =>
    findByUserIdAndTeamId({ user_id: userId, team_id: teamId }).pipe(catchSqlErrors);

  const markAllAsReadForTeam = (userId: User.UserId, teamId: Team.TeamId) =>
    markAllReadForTeam({ user_id: userId, team_id: teamId }).pipe(catchSqlErrors);

  const insert = (
    teamId: Team.TeamId,
    userId: User.UserId,
    type: Notification.NotificationType,
    title: string,
    body: string,
  ) => insertOne({ team_id: teamId, user_id: userId, type, title, body }).pipe(catchSqlErrors);

  const insertBulk = (
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
        insertOne({
          team_id: n.teamId,
          user_id: n.userId,
          type: n.type,
          title: n.title,
          body: n.body,
        }),
      ),
    ).pipe(Effect.asVoid, catchSqlErrors);

  const markAsRead = (notificationId: Notification.NotificationId) =>
    markOneAsRead({ id: notificationId }).pipe(catchSqlErrors);

  const markAllAsRead = (userId: User.UserId) => markAllRead(userId).pipe(catchSqlErrors);

  const findById = (notificationId: Notification.NotificationId) =>
    findOneById(notificationId).pipe(catchSqlErrors);

  return {
    findByUser,
    findByUserAndTeam,
    markAllAsReadForTeam,
    insert,
    insertBulk,
    markAsRead,
    markAllAsRead,
    findById,
  };
});

export class NotificationsRepository extends ServiceMap.Service<
  NotificationsRepository,
  Effect.Success<typeof make>
>()('api/NotificationsRepository') {
  static readonly Default = Layer.effect(NotificationsRepository, make);
}
