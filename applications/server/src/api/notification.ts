import { Auth, NotificationApi } from '@sideline/domain';
import { Array, Effect, Option } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { Api } from '~/api/api.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';

const forbidden = new NotificationApi.Forbidden();

export const NotificationApiLive = HttpApiBuilder.group(Api, 'notification', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('notifications', () => NotificationsRepository.asEffect()),
    Effect.map(({ notifications }) =>
      handlers
        .handle('listNotifications', ({ urlParams }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
            Effect.bind('list', ({ currentUser }) =>
              notifications.findByUserAndTeam(currentUser.id, urlParams.teamId),
            ),
            Effect.map(({ list }) =>
              Array.map(
                list,
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
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
            Effect.bind('notification', () =>
              notifications.findById(notificationId).pipe(
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
            Effect.tap(() => notifications.markAsRead(notificationId)),
            Effect.asVoid,
          ),
        )
        .handle('markAllAsRead', ({ payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext.asEffect()),
            Effect.tap(({ currentUser }) =>
              notifications.markAllAsReadForTeam(currentUser.id, payload.teamId),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
