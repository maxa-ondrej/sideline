import { SubgroupModel, Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { SubgroupDetailPage } from '~/components/pages/SubgroupDetailPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/subgroups/$subgroupId')({
  component: SubgroupDetailRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const subgroupId = Schema.decodeSync(SubgroupModel.SubgroupId)(params.subgroupId);
    const [subgroupDetail, allMembers] = await Promise.all([
      ApiClient.pipe(
        Effect.flatMap((api) => api.subgroup.getSubgroup({ path: { teamId, subgroupId } })),
        warnAndCatchAll,
        context.run,
      ),
      ApiClient.pipe(
        Effect.flatMap((api) => api.roster.listMembers({ path: { teamId } })),
        warnAndCatchAll,
        context.run,
      ),
    ]);
    return { subgroupDetail, allMembers };
  },
});

function SubgroupDetailRoute() {
  const { teamId: teamIdRaw, subgroupId: subgroupIdRaw } = Route.useParams();
  const { subgroupDetail, allMembers } = Route.useLoaderData();

  return (
    <SubgroupDetailPage
      teamId={teamIdRaw}
      subgroupId={subgroupIdRaw}
      subgroupDetail={subgroupDetail}
      allMembers={allMembers}
    />
  );
}
