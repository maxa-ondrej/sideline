import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, pipe, Schema } from 'effect';
import { TeamSettingsPage } from '~/components/pages/TeamSettingsPage';
import { ApiClient, NotFound, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/settings')({
  component: TeamSettingsRoute,
  ssr: false,
  loader: async ({ params, context }) => {
    const teamId = await pipe(
      params.teamId,
      Schema.decode(Team.TeamId),
      Effect.mapError(NotFound.make),
      context.run,
    );
    const settings = await Effect.flatMap(ApiClient, (api) =>
      api.teamSettings.getTeamSettings({ path: { teamId } }),
    ).pipe(warnAndCatchAll, context.run);
    return { settings };
  },
});

function TeamSettingsRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const { settings } = Route.useLoaderData();

  return <TeamSettingsPage teamId={teamIdRaw} settings={settings} />;
}
