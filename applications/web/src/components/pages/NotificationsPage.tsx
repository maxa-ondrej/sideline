import type { NotificationApi } from '@sideline/domain';
import { Notification } from '@sideline/domain';
import { Link, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { Button } from '~/components/ui/button';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

interface NotificationsPageProps {
  notifications: ReadonlyArray<NotificationApi.NotificationInfo>;
}

export function NotificationsPage({ notifications }: NotificationsPageProps) {
  const run = useRun();
  const router = useRouter();

  const handleMarkAsRead = React.useCallback(
    async (notificationIdRaw: string) => {
      const notificationId = Schema.decodeSync(Notification.NotificationId)(notificationIdRaw);
      const result = await ApiClient.pipe(
        Effect.flatMap((api) => api.notification.markAsRead({ path: { notificationId } })),
        Effect.catchAll(() => ClientError.make(m.notification_markReadFailed())),
        run,
      );
      if (Option.isSome(result)) {
        router.invalidate();
      }
    },
    [run, router],
  );

  const handleMarkAllAsRead = React.useCallback(async () => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) => api.notification.markAllAsRead({})),
      Effect.catchAll(() => ClientError.make(m.notification_markReadFailed())),
      run,
    );
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [run, router]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/dashboard'>← {m.profile_backToDashboard()}</Link>
        </Button>
        <h1 className='text-2xl font-bold'>{m.notification_title()}</h1>
      </header>

      {unreadCount > 0 && (
        <Button onClick={handleMarkAllAsRead} variant='outline' className='mb-4' size='sm'>
          {m.notification_markAllRead()}
        </Button>
      )}

      {notifications.length === 0 ? (
        <p className='text-muted-foreground'>{m.notification_noNotifications()}</p>
      ) : (
        <div className='flex flex-col gap-2'>
          {notifications.map((notification) => (
            <div
              key={notification.notificationId}
              className={`border rounded p-3 ${notification.isRead ? 'opacity-60' : ''}`}
            >
              <div className='flex items-start justify-between gap-2'>
                <div>
                  <p className='font-medium'>{notification.title}</p>
                  <p className='text-sm text-muted-foreground'>{notification.body}</p>
                  <p className='text-xs text-muted-foreground mt-1'>{notification.createdAt}</p>
                </div>
                {!notification.isRead && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => handleMarkAsRead(notification.notificationId)}
                  >
                    {m.notification_markRead()}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
