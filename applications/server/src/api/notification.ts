import { HttpApiBuilder } from '@effect/platform';
import { Auth, NotificationApi } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';

const forbidden = new NotificationApi.Forbidden();

export const NotificationApiLive = HttpApiBuilder.group(Api, 'notification', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('notifications', () => NotificationsRepository),
    Effect.map(({ notifications }) =>
      handlers
        .handle('listNotifications', () =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('list', ({ currentUser }) =>
              notifications.findByUser(currentUser.id).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(({ list }) =>
              list.map(
                (n) =>
                  new NotificationApi.NotificationInfo({
                    notificationId: n.id,
                    teamId: n.team_id,
                    type: n.type,
                    title: n.title,
                    body: n.body,
                    isRead: n.is_read,
                    createdAt: n.created_at,
                  }),
              ),
            ),
          ),
        )
        .handle('markAsRead', ({ path: { notificationId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('notification', () =>
              notifications.findById(notificationId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new NotificationApi.NotificationNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ currentUser, notification }) =>
              notification.user_id !== currentUser.id ? Effect.fail(forbidden) : Effect.void,
            ),
            Effect.tap(() =>
              notifications.markAsRead(notificationId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.asVoid,
          ),
        )
        .handle('markAllAsRead', () =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.tap(({ currentUser }) =>
              notifications.markAllAsRead(currentUser.id).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
