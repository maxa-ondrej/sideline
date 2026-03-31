import { RosterModel, Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { RosterDetailPage } from '~/components/pages/RosterDetailPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/rosters/$rosterId')({
  ssr: false,
  component: RosterDetailRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const rosterId = Schema.decodeSync(RosterModel.RosterId)(params.rosterId);
    const [rosterDetail, allMembers, discordChannels, guildId] = await Promise.all([
      ApiClient.pipe(
        Effect.flatMap((api) => api.roster.getRoster({ path: { teamId, rosterId } })),
        warnAndCatchAll,
        context.run,
      ),
      ApiClient.pipe(
        Effect.flatMap((api) => api.roster.listMembers({ path: { teamId } })),
        warnAndCatchAll,
        context.run,
      ),
      ApiClient.pipe(
        Effect.flatMap((api) => api.group.listDiscordChannels({ path: { teamId } })),
        Effect.tapError((e) => Effect.logWarning('Failed to load Discord channels', e)),
        Effect.catchAll(() => Effect.succeed([])),
        context.run,
      ),
      ApiClient.pipe(
        Effect.flatMap((api) => api.team.getTeamInfo({ path: { teamId } })),
        Effect.map((info) => Option.some(info.guildId)),
        Effect.tapError((e) => Effect.logWarning('Failed to load team info', e)),
        Effect.catchAll(() => Effect.succeed(Option.none<string>())),
        context.run,
      ),
    ]);
    return { rosterDetail, allMembers, discordChannels, guildId };
  },
});

function RosterDetailRoute() {
  const { user } = Route.useRouteContext();
  const { teamId: teamIdRaw, rosterId: rosterIdRaw } = Route.useParams();
  const { rosterDetail, allMembers, discordChannels, guildId } = Route.useLoaderData();

  return (
    <RosterDetailPage
      teamId={teamIdRaw}
      rosterId={rosterIdRaw}
      rosterDetail={rosterDetail}
      allMembers={allMembers}
      canManage={rosterDetail.canManage}
      userId={user.id}
      discordChannels={discordChannels}
      guildId={guildId}
    />
  );
}
