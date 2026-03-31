import { GroupModel, Team } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { GroupDetailPage } from '~/components/pages/GroupDetailPage';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/groups/$groupId')({
  ssr: false,
  component: GroupDetailRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const groupId = Schema.decodeSync(GroupModel.GroupId)(params.groupId);
    const [groupDetail, allMembers, allRoles, channelMapping, allGroups, discordChannels, guildId] =
      await Promise.all([
        ApiClient.pipe(
          Effect.flatMap((api) => api.group.getGroup({ path: { teamId, groupId } })),
          warnAndCatchAll,
          context.run,
        ),
        ApiClient.pipe(
          Effect.flatMap((api) => api.roster.listMembers({ path: { teamId } })),
          warnAndCatchAll,
          context.run,
        ),
        ApiClient.pipe(
          Effect.flatMap((api) => api.role.listRoles({ path: { teamId } })),
          warnAndCatchAll,
          context.run,
        ),
        ApiClient.pipe(
          Effect.flatMap((api) => api.group.getChannelMapping({ path: { teamId, groupId } })),
          warnAndCatchAll,
          context.run,
        ),
        ApiClient.pipe(
          Effect.flatMap((api) => api.group.listGroups({ path: { teamId } })),
          warnAndCatchAll,
          context.run,
        ),
        ApiClient.pipe(
          Effect.flatMap((api) => api.group.listDiscordChannels({ path: { teamId } })),
          warnAndCatchAll,
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
    return {
      groupDetail,
      allMembers,
      allRoles,
      channelMapping,
      allGroups,
      discordChannels,
      guildId,
    };
  },
});

function GroupDetailRoute() {
  const { teamId: teamIdRaw, groupId: groupIdRaw } = Route.useParams();
  const {
    groupDetail,
    allMembers,
    allRoles: allRolesResponse,
    channelMapping,
    allGroups,
    discordChannels,
    guildId,
  } = Route.useLoaderData();

  return (
    <GroupDetailPage
      teamId={teamIdRaw}
      groupId={groupIdRaw}
      groupDetail={groupDetail}
      allMembers={allMembers}
      allRoles={allRolesResponse.roles}
      channelMapping={channelMapping}
      allGroups={allGroups}
      discordChannels={discordChannels}
      guildId={guildId}
    />
  );
}
