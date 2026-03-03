import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, pipe, Schema } from 'effect';
import { AgeThresholdsPage } from '~/components/pages/AgeThresholdsPage';
import { ApiClient, NotFound, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/age-thresholds')({
  component: AgeThresholdsRoute,
  ssr: false,
  loader: async ({ params, context }) => {
    const teamId = await pipe(
      params.teamId,
      Schema.decode(Team.TeamId),
      Effect.mapError(NotFound.make),
      context.run,
    );
    const [rules, groups] = await Effect.all([
      Effect.flatMap(ApiClient, (api) => api.ageThreshold.listAgeThresholds({ path: { teamId } })),
      Effect.flatMap(ApiClient, (api) => api.group.listGroups({ path: { teamId } })),
    ]).pipe(warnAndCatchAll, context.run);
    return { rules, groups };
  },
});

function AgeThresholdsRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const { rules, groups } = Route.useLoaderData();

  return <AgeThresholdsPage teamId={teamIdRaw} rules={rules} groups={groups} />;
}
