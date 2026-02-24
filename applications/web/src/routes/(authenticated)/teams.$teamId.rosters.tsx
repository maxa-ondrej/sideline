import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { RostersListPage } from '~/components/pages/RostersListPage';
import { ApiClient, NotFound } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/rosters')({
  component: RostersRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.pipe(
      Effect.flatMap((api) => api.roster.listRosters({ path: { teamId } })),
      Effect.catchAll(NotFound.make),
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
