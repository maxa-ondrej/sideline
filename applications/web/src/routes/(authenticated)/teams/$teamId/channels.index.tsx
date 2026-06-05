import { Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { ChannelManagementPage } from '~/components/pages/ChannelManagementPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/channels/')({
  ssr: false,
  component: ChannelsRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const [channelList, groups, guildId] = await Promise.all([
      ApiClient.asEffect().pipe(
        Effect.flatMap((api) => api.channel.listChannels({ params: { teamId } })),
        warnAndCatchAll,
        context.run,
      ),
      ApiClient.asEffect().pipe(
        Effect.flatMap((api) => api.group.listGroups({ params: { teamId } })),
        warnAndCatchAll,
        context.run,
      ),
      ApiClient.asEffect().pipe(
        Effect.flatMap((api) => api.team.getTeamInfo({ params: { teamId } })),
        Effect.map((info) => Option.some(info.guildId)),
        Effect.tapError((e) => Effect.logWarning('Failed to load team info', e)),
        Effect.catch(() => Effect.succeed(Option.none<string>())),
        context.run,
      ),
    ]);
    return { channelList, groups, guildId };
  },
});

function ChannelsRoute() {
  const { teamId: teamIdRaw } = Route.useParams();
  const { channelList, groups, guildId } = Route.useLoaderData();

  return (
    <ChannelManagementPage
      teamId={teamIdRaw}
      guildId={guildId}
      data={channelList}
      allGroups={groups ?? []}
    />
  );
}
