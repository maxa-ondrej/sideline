import type { EventSeriesApi } from '@sideline/domain';
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
        Effect.all({
          trainingType: api.trainingType.getTrainingType({ path: { teamId, trainingTypeId } }),
          series: api.eventSeries.listEventSeries({ path: { teamId } }),
          discordChannels: api.group.listDiscordChannels({ path: { teamId } }),
        }),
      ),
      warnAndCatchAll,
      context.run,
    );
  },
});

function TrainingTypeDetailRoute() {
  const { teamId: teamIdRaw, trainingTypeId: trainingTypeIdRaw } = Route.useParams();
  const data = Route.useLoaderData();

  return (
    <TrainingTypeDetailPage
      teamId={teamIdRaw}
      trainingTypeId={trainingTypeIdRaw}
      trainingTypeDetail={data.trainingType}
      canAdmin={data.trainingType.canAdmin}
      series={data.series.filter(
        (s: EventSeriesApi.EventSeriesInfo) => s.trainingTypeId === trainingTypeIdRaw,
      )}
      discordChannels={data.discordChannels}
    />
  );
}
