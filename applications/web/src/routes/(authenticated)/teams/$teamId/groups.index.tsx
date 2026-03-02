import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { GroupsListPage } from '~/components/pages/GroupsListPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/groups/')({
  component: GroupsRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.pipe(
      Effect.flatMap((api) => api.group.listGroups({ path: { teamId } })),
      warnAndCatchAll,
      context.run,
    );
  },
});

function GroupsRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const groups = Route.useLoaderData();

  return <GroupsListPage teamId={teamIdRaw} groups={groups} />;
}
