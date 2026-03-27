import type { ActivityLog, Auth, Role } from '@sideline/domain';
import { ActivityLogApi, type ActivityType, Team, TeamMember } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import type { PlayerEditValues } from '~/components/pages/PlayerDetailPage';
import { PlayerDetailPage } from '~/components/pages/PlayerDetailPage';
import { ApiClient, ClientError, useRun, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/members/$memberId')({
  ssr: false,
  component: MemberDetailRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(params.memberId);
    return ApiClient.pipe(
      Effect.flatMap((api) =>
        Effect.all({
          player: api.roster.getMember({ path: { teamId, memberId } }),
          myTeams: api.auth.myTeams(),
          roles: api.role.listRoles({ path: { teamId } }),
          activityStats: api.activityStats.getMemberStats({ path: { teamId, memberId } }),
          activityLogs: api.activityLog.listLogs({ path: { teamId, memberId } }).pipe(
            Effect.map((r) => ({ isOwnProfile: true as boolean, logs: r.logs })),
            Effect.catchAll(() =>
              Effect.succeed({ isOwnProfile: false as boolean, logs: [] as const }),
            ),
          ),
          activityTypes: api.activityLog.listActivityTypes({ path: { teamId } }),
        }),
      ),
      warnAndCatchAll,
      context.run,
    );
  },
});

function MemberDetailRoute() {
  const { teamId: teamIdRaw, memberId: memberIdRaw } = Route.useParams();
  const teamId = Schema.decodeSync(Team.TeamId)(teamIdRaw);
  const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(memberIdRaw);
  const navigate = useNavigate();
  const router = useRouter();
  const run = useRun();
  const {
    player,
    myTeams,
    roles: roleListResponse,
    activityStats,
    activityLogs,
    activityTypes: fetchedActivityTypes,
  } = Route.useLoaderData();
  const roles = roleListResponse.roles;

  const activityTypes = React.useMemo(
    () =>
      fetchedActivityTypes.activityTypes.filter(
        (t) => Option.isNone(t.slug) || t.slug.value !== 'training',
      ),
    [fetchedActivityTypes],
  );

  // Use the current user's permissions for this team, not the target player's
  const myPermissions =
    myTeams.find((t: Auth.UserTeam) => t.teamId === teamIdRaw)?.permissions ?? [];
  const canEdit = myPermissions.includes('member:edit');
  const canManageRoles = myPermissions.includes('role:manage' as Role.Permission);

  const handleSave = React.useCallback(
    async (values: PlayerEditValues) => {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.roster.updateMember({
            path: { teamId, memberId },
            payload: {
              name: Option.fromNullable(values.name),
              birthDate: values.birthDate ? Option.some(values.birthDate) : Option.none(),
              gender: Option.fromNullable(values.gender),
              jerseyNumber: Option.fromNullable(values.jerseyNumber),
            },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.members_saveFailed())),
        run(),
      );
      if (Option.isSome(result)) {
        navigate({ to: '/teams/$teamId/members', params: { teamId: teamIdRaw } });
      }
    },
    [teamId, memberId, teamIdRaw, navigate, run],
  );

  const handleAssignRole = React.useCallback(
    async (roleId: string) => {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.role.assignRole({
            path: { teamId, memberId },
            payload: { roleId: roleId as Role.RoleId },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.roles_assignFailed())),
        run(),
      );
      if (Option.isSome(result)) {
        router.invalidate();
      }
    },
    [teamId, memberId, run, router],
  );

  const handleUnassignRole = React.useCallback(
    async (roleId: string) => {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.role.unassignRole({
            path: { teamId, memberId, roleId: roleId as Role.RoleId },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.roles_unassignFailed())),
        run(),
      );
      if (Option.isSome(result)) {
        router.invalidate();
      }
    },
    [teamId, memberId, run, router],
  );

  const handleCreateLog = React.useCallback(
    async (input: {
      activityTypeId: ActivityType.ActivityTypeId;
      durationMinutes: Option.Option<number>;
      note: Option.Option<string>;
    }) => {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.activityLog.createLog({
            path: { teamId, memberId },
            payload: {
              activityTypeId: input.activityTypeId,
              durationMinutes: input.durationMinutes,
              note: input.note,
            },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.activityLog_logFailed())),
        run(),
      );
      if (Option.isSome(result)) {
        router.invalidate();
      }
    },
    [teamId, memberId, run, router],
  );

  const handleUpdateLog = React.useCallback(
    async (
      logId: ActivityLog.ActivityLogId,
      input: {
        activityTypeId: Option.Option<ActivityType.ActivityTypeId>;
        durationMinutes: Option.Option<Option.Option<number>>;
        note: Option.Option<Option.Option<string>>;
      },
    ) => {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.activityLog.updateLog({
            path: { teamId, memberId, logId },
            payload: {
              activityTypeId: input.activityTypeId,
              durationMinutes: input.durationMinutes,
              note: input.note,
            },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.activityLog_updateFailed())),
        run(),
      );
      if (Option.isSome(result)) {
        router.invalidate();
      }
    },
    [teamId, memberId, run, router],
  );

  const handleDeleteLog = React.useCallback(
    async (logId: ActivityLog.ActivityLogId) => {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.activityLog.deleteLog({
            path: { teamId, memberId, logId },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.activityLog_deleteFailed())),
        run(),
      );
      if (Option.isSome(result)) {
        router.invalidate();
      }
    },
    [teamId, memberId, run, router],
  );

  return (
    <PlayerDetailPage
      teamId={teamIdRaw}
      player={player}
      canEdit={canEdit}
      canManageRoles={canManageRoles}
      availableRoles={roles}
      activityStats={activityStats}
      isOwnProfile={activityLogs.isOwnProfile}
      activityLogs={new ActivityLogApi.ActivityLogListResponse({ logs: activityLogs.logs })}
      activityTypes={activityTypes}
      onSave={handleSave}
      onAssignRole={handleAssignRole}
      onUnassignRole={handleUnassignRole}
      onCreateLog={handleCreateLog}
      onUpdateLog={handleUpdateLog}
      onDeleteLog={handleDeleteLog}
    />
  );
}
