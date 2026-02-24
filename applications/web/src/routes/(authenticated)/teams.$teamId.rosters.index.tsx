import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { RostersListPage } from '~/components/pages/RostersListPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/rosters/')({
  component: RostersRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.pipe(
      Effect.flatMap((api) => api.roster.listRosters({ path: { teamId } })),
      warnAndCatchAll,
      context.run,
    );
  },
});

function RostersRoute() {
  const { user } = Route.useRouteContext();
  const { teamId: teamIdRaw } = Route.useParams();
  const rosters = Route.useLoaderData();

  return <RostersListPage teamId={teamIdRaw} rosters={rosters} userId={user.id} />;
}
