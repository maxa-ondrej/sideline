import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';
import { AuthMiddleware } from '~/api/Auth.js';
import { NotificationId, NotificationType } from '~/models/Notification.js';
import { TeamId } from '~/models/Team.js';

export class NotificationInfo extends Schema.Class<NotificationInfo>('NotificationInfo')({
  notificationId: NotificationId,
  teamId: TeamId,
  type: NotificationType,
  title: Schema.String,
  body: Schema.String,
  isRead: Schema.Boolean,
  createdAt: Schema.String,
}) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'NotificationForbidden',
  {},
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class NotificationNotFound extends Schema.TaggedError<NotificationNotFound>()(
  'NotificationNotFound',
  {},
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class NotificationApiGroup extends HttpApiGroup.make('notification')
  .add(
    HttpApiEndpoint.get('listNotifications', '/notifications')
      .addSuccess(Schema.Array(NotificationInfo))
      .addError(Forbidden, { status: 403 })
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.patch('markAsRead', '/notifications/:notificationId/read')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .addError(NotificationNotFound, { status: 404 })
      .setPath(Schema.Struct({ notificationId: NotificationId }))
      .middleware(AuthMiddleware),
  )
  .add(
    HttpApiEndpoint.post('markAllAsRead', '/notifications/read-all')
      .addSuccess(Schema.Void)
      .addError(Forbidden, { status: 403 })
      .middleware(AuthMiddleware),
  ) {}
