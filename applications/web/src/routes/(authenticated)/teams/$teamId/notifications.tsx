import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { NotificationsPage } from '~/components/pages/NotificationsPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/notifications')({
  component: TeamNotificationsRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.pipe(
      Effect.flatMap((api) =>
        api.notification.listNotifications({ urlParams: { teamId: Option.some(teamId) } }),
      ),
      warnAndCatchAll,
      context.run,
    );
  },
});

function TeamNotificationsRoute() {
  const { teamId } = Route.useParams();
  const notifications = Route.useLoaderData();

  return <NotificationsPage notifications={notifications} teamId={teamId} />;
}
