import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { SubgroupsListPage } from '~/components/pages/SubgroupsListPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/subgroups/')({
  component: SubgroupsRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.pipe(
      Effect.flatMap((api) => api.subgroup.listSubgroups({ path: { teamId } })),
      warnAndCatchAll,
      context.run,
    );
  },
});

function SubgroupsRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const subgroups = Route.useLoaderData();

  return <SubgroupsListPage teamId={teamIdRaw} subgroups={subgroups} />;
}
