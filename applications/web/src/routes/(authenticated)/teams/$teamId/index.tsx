import { Team } from '@sideline/domain';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { TeamDetailPage } from '~/components/pages/TeamDetailPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/')({
  ssr: false,
  component: TeamDetailRoute,
  beforeLoad: async ({ context }) => {
    if (context.user && !context.user.isProfileComplete) {
      throw redirect({ to: '/profile/complete' });
    }
  },
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.asEffect().pipe(
      Effect.flatMap((api) => api.dashboard.getDashboard({ path: { teamId } })),
      warnAndCatchAll,
      context.run,
    );
  },
});

function TeamDetailRoute() {
  const { teamId } = Route.useParams();
  const dashboard = Route.useLoaderData();

  return <TeamDetailPage teamId={teamId} dashboard={dashboard} />;
}
