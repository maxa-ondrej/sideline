import { createFileRoute } from '@tanstack/react-router';
import { Effect } from 'effect';
import { NotificationsPage } from '~/components/pages/NotificationsPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/notifications/')({
  component: NotificationsRoute,
  loader: async ({ context }) => {
    return ApiClient.pipe(
      Effect.flatMap((api) => api.notification.listNotifications({})),
      warnAndCatchAll,
      context.run,
    );
  },
});

function NotificationsRoute() {
  const notifications = Route.useLoaderData();

  return <NotificationsPage notifications={notifications} />;
}
