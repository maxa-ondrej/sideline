import { RosterModel, Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { RosterDetailPage } from '~/components/pages/RosterDetailPage';
import { ApiClient, NotFound } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/rosters/$rosterId')({
  component: RosterDetailRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const rosterId = Schema.decodeSync(RosterModel.RosterId)(params.rosterId);
    const [rosterDetail, allMembers] = await Promise.all([
      ApiClient.pipe(
        Effect.flatMap((api) => api.roster.getRoster({ path: { teamId, rosterId } })),
        Effect.catchAll(NotFound.make),
        context.run,
      ),
      ApiClient.pipe(
        Effect.flatMap((api) => api.roster.listMembers({ path: { teamId } })),
        Effect.catchAll(NotFound.make),
        context.run,
      ),
    ]);
    return { rosterDetail, allMembers };
  },
});

function RosterDetailRoute() {
  const { user } = Route.useRouteContext();
  const { teamId: teamIdRaw, rosterId: rosterIdRaw } = Route.useParams();
  const { rosterDetail, allMembers } = Route.useLoaderData();

  return (
    <RosterDetailPage
      teamId={teamIdRaw}
      rosterId={rosterIdRaw}
      rosterDetail={rosterDetail}
      allMembers={allMembers}
      userId={user.id}
    />
  );
}
