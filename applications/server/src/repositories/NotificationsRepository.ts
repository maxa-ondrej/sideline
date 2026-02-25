import { SqlClient, SqlSchema } from '@effect/sql';
import { Notification as NotificationNS, Team as TeamNS, User as UserNS } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class NotificationRow extends Schema.Class<NotificationRow>('NotificationRow')({
  id: NotificationNS.NotificationId,
  team_id: TeamNS.TeamId,
  user_id: UserNS.UserId,
  type: NotificationNS.NotificationType,
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

class MarkReadInput extends Schema.Class<MarkReadInput>('MarkReadInput')({
  id: NotificationNS.NotificationId,
}) {}

export class NotificationsRepository extends Effect.Service<NotificationsRepository>()(
  'api/NotificationsRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('findByUserId', ({ sql }) =>
        SqlSchema.findAll({
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
        }),
      ),
      Effect.let('insertOne', ({ sql }) =>
        SqlSchema.single({
          Request: InsertInput,
          Result: NotificationRow,
          execute: (input) => sql`
            INSERT INTO notifications (team_id, user_id, type, title, body)
            VALUES (${input.team_id}, ${input.user_id}, ${input.type}, ${input.title}, ${input.body})
            RETURNING id, team_id, user_id, type, title, body, is_read,
                      created_at::text AS created_at
          `,
        }),
      ),
      Effect.let('markOneAsRead', ({ sql }) =>
        SqlSchema.void({
          Request: MarkReadInput,
          execute: (input) => sql`UPDATE notifications SET is_read = true WHERE id = ${input.id}`,
        }),
      ),
      Effect.let('markAllRead', ({ sql }) =>
        SqlSchema.void({
          Request: Schema.String,
          execute: (userId) =>
            sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId} AND is_read = false`,
        }),
      ),
      Effect.let('findOneById', ({ sql }) =>
        SqlSchema.findOne({
          Request: NotificationNS.NotificationId,
          Result: NotificationRow,
          execute: (id) => sql`
            SELECT id, team_id, user_id, type, title, body, is_read,
                   created_at::text AS created_at
            FROM notifications WHERE id = ${id}
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findByUser(userId: UserNS.UserId) {
    return this.findByUserId(userId);
  }

  insert(
    teamId: TeamNS.TeamId,
    userId: UserNS.UserId,
    type: NotificationNS.NotificationType,
    title: string,
    body: string,
  ) {
    return this.insertOne({ team_id: teamId, user_id: userId, type, title, body });
  }

  insertBulk(
    notifications: ReadonlyArray<{
      teamId: TeamNS.TeamId;
      userId: UserNS.UserId;
      type: NotificationNS.NotificationType;
      title: string;
      body: string;
    }>,
  ) {
    return Effect.all(
      notifications.map((n) =>
        this.insertOne({
          team_id: n.teamId,
          user_id: n.userId,
          type: n.type,
          title: n.title,
          body: n.body,
        }),
      ),
    ).pipe(Effect.asVoid);
  }

  markAsRead(notificationId: NotificationNS.NotificationId) {
    return this.markOneAsRead({ id: notificationId });
  }

  markAllAsRead(userId: UserNS.UserId) {
    return this.markAllRead(userId);
  }

  findById(notificationId: NotificationNS.NotificationId) {
    return this.findOneById(notificationId);
  }
}
