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
    return ApiClient.pipe(
      Effect.flatMap((api) =>
        Effect.all({
          settings: api.teamSettings.getTeamSettings({ path: { teamId } }),
          discordChannels: api.group.listDiscordChannels({ path: { teamId } }),
        }),
      ),
      warnAndCatchAll,
      context.run,
    );
  },
});

function TeamSettingsRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const { settings, discordChannels } = Route.useLoaderData();

  return (
    <TeamSettingsPage teamId={teamIdRaw} settings={settings} discordChannels={discordChannels} />
  );
}
