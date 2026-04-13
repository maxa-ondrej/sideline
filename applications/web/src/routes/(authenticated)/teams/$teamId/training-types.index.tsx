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
    return ApiClient.asEffect().pipe(
      Effect.flatMap((api) =>
        api.trainingType.listTrainingTypes({ params: { teamId } }).pipe(
          Effect.flatMap((trainingTypesData) =>
            trainingTypesData.canAdmin
              ? api.group.listGroups({ params: { teamId } }).pipe(
                  Effect.tapError((e) => Effect.logWarning('Failed to load groups', e)),
                  Effect.catchAll(() => Effect.succeed([] as const)),
                  Effect.map((groups) => ({ ...trainingTypesData, groups })),
                )
              : Effect.succeed({ ...trainingTypesData, groups: [] as const }),
          ),
        ),
      ),
      warnAndCatchAll,
      context.run,
    );
  },
});

function TrainingTypesRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const { trainingTypes, canAdmin, groups } = Route.useLoaderData();

  return (
    <TrainingTypesListPage
      teamId={teamIdRaw}
      trainingTypes={trainingTypes}
      canAdmin={canAdmin}
      groups={groups}
    />
  );
}
