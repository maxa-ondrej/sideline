import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { TrainingTypesListPage } from '~/components/pages/TrainingTypesListPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/training-types/')({
  component: TrainingTypesRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.pipe(
      Effect.flatMap((api) => api.trainingType.listTrainingTypes({ path: { teamId } })),
      warnAndCatchAll,
      context.run,
    );
  },
});

function TrainingTypesRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const trainingTypes = Route.useLoaderData();

  return <TrainingTypesListPage teamId={teamIdRaw} trainingTypes={trainingTypes} />;
}
