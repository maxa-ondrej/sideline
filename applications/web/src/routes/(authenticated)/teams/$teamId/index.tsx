import { Team } from '@sideline/domain';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { TeamDetailPage } from '~/components/pages/TeamDetailPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/')({
  component: TeamDetailRoute,
  beforeLoad: async ({ context }) => {
    if (context.user && !context.user.isProfileComplete) {
      throw redirect({ to: '/profile/complete' });
    }
  },
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const teams = await ApiClient.pipe(
      Effect.flatMap((api) => api.auth.myTeams()),
      warnAndCatchAll,
      context.run,
    );
    const team = teams.find((t) => t.teamId === teamId);
    if (!team) {
      throw redirect({ to: '/teams' });
    }
    return team;
  },
});

function TeamDetailRoute() {
  const { teamId } = Route.useParams();
  const team = Route.useLoaderData();

  return <TeamDetailPage teamId={teamId} team={team} />;
}
