import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { TrainingTypesListPage } from '~/components/pages/TrainingTypesListPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/training-types/')({
  ssr: false,
  component: TrainingTypesRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.pipe(
      Effect.flatMap((api) =>
        Effect.all({
          trainingTypesData: api.trainingType.listTrainingTypes({ path: { teamId } }),
          groups: api.group.listGroups({ path: { teamId } }).pipe(
            Effect.tapError((e) => Effect.logWarning('Failed to load groups', e)),
            Effect.catchAll(() => Effect.succeed([] as const)),
          ),
        }),
      ),
      warnAndCatchAll,
      context.run,
    );
  },
});

function TrainingTypesRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const { trainingTypesData, groups } = Route.useLoaderData();

  return (
    <TrainingTypesListPage
      teamId={teamIdRaw}
      trainingTypes={trainingTypesData.trainingTypes}
      canAdmin={trainingTypesData.canAdmin}
      groups={groups}
    />
  );
}
