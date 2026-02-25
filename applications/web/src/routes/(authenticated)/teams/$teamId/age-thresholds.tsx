import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { AgeThresholdsPage } from '~/components/pages/AgeThresholdsPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/age-thresholds')({
  component: AgeThresholdsRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const [rules, roles] = await Effect.all([
      ApiClient.pipe(
        Effect.flatMap((api) => api.ageThreshold.listAgeThresholds({ path: { teamId } })),
      ),
      ApiClient.pipe(Effect.flatMap((api) => api.role.listRoles({ path: { teamId } }))),
    ]).pipe(warnAndCatchAll, context.run);
    return { rules: rules ?? [], roles: roles ?? [] };
  },
});

function AgeThresholdsRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const { rules, roles } = Route.useLoaderData();

  return <AgeThresholdsPage teamId={teamIdRaw} rules={rules} roles={roles} />;
}
