import { Team, TrainingType } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { TrainingTypeDetailPage } from '~/components/pages/TrainingTypeDetailPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute(
  '/(authenticated)/teams/$teamId/training-types/$trainingTypeId',
)({
  component: TrainingTypeDetailRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const trainingTypeId = Schema.decodeSync(TrainingType.TrainingTypeId)(params.trainingTypeId);
    const [trainingTypeDetail, allMembers] = await Promise.all([
      ApiClient.pipe(
        Effect.flatMap((api) =>
          api.trainingType.getTrainingType({ path: { teamId, trainingTypeId } }),
        ),
        warnAndCatchAll,
        context.run,
      ),
      ApiClient.pipe(
        Effect.flatMap((api) => api.roster.listMembers({ path: { teamId } })),
        warnAndCatchAll,
        context.run,
      ),
    ]);
    return { trainingTypeDetail, allMembers };
  },
});

function TrainingTypeDetailRoute() {
  const { teamId: teamIdRaw, trainingTypeId: trainingTypeIdRaw } = Route.useParams();
  const { trainingTypeDetail, allMembers } = Route.useLoaderData();

  return (
    <TrainingTypeDetailPage
      teamId={teamIdRaw}
      trainingTypeId={trainingTypeIdRaw}
      trainingTypeDetail={trainingTypeDetail}
      allMembers={allMembers}
    />
  );
}
