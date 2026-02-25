import { Role, Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { RoleDetailPage } from '~/components/pages/RoleDetailPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/roles/$roleId')({
  component: RoleDetailRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const roleId = Schema.decodeSync(Role.RoleId)(params.roleId);
    return ApiClient.pipe(
      Effect.flatMap((api) => api.role.getRole({ path: { teamId, roleId } })),
      warnAndCatchAll,
      context.run,
    );
  },
});

function RoleDetailRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const role = Route.useLoaderData();

  return <RoleDetailPage teamId={teamIdRaw} role={role} />;
}
