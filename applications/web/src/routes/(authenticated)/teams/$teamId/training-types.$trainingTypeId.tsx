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
    return ApiClient.pipe(
      Effect.flatMap((api) =>
        api.trainingType.getTrainingType({ path: { teamId, trainingTypeId } }),
      ),
      warnAndCatchAll,
      context.run,
    );
  },
});

function TrainingTypeDetailRoute() {
  const { teamId: teamIdRaw, trainingTypeId: trainingTypeIdRaw } = Route.useParams();
  const trainingTypeDetail = Route.useLoaderData();

  return (
    <TrainingTypeDetailPage
      teamId={teamIdRaw}
      trainingTypeId={trainingTypeIdRaw}
      trainingTypeDetail={trainingTypeDetail}
      canAdmin={trainingTypeDetail.canAdmin}
    />
  );
}
