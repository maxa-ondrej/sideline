import type { Auth } from '@sideline/domain';
import { Team, TeamMember } from '@sideline/domain';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import type { PlayerEditValues } from '~/components/pages/PlayerDetailPage';
import { PlayerDetailPage } from '~/components/pages/PlayerDetailPage';
import { ApiClient, ClientError, useRun, warnAndCatchAll } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/members/$memberId')({
  component: MemberDetailRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(params.memberId);
    return ApiClient.pipe(
      Effect.flatMap((api) =>
        Effect.all({
          player: api.roster.getMember({ path: { teamId, memberId } }),
          myTeams: api.auth.myTeams(),
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
  const run = useRun();
  const { player, myTeams } = Route.useLoaderData();

  // Use the current user's permissions for this team, not the target player's
  const myPermissions =
    myTeams.find((t: Auth.UserTeam) => t.teamId === teamIdRaw)?.permissions ?? [];
  const canEdit = myPermissions.includes('member:edit');

  const handleSave = React.useCallback(
    async (values: PlayerEditValues) => {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.roster.updateMember({
            path: { teamId, memberId },
            payload: {
              name: values.name,
              birthYear: values.birthYear,
              gender: values.gender,
              jerseyNumber: values.jerseyNumber,
              position: values.position,
              proficiency: values.proficiency,
            },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.members_saveFailed())),
        run,
      );
      if (Option.isSome(result)) {
        navigate({ to: '/teams/$teamId/members', params: { teamId: teamIdRaw } });
      }
    },
    [teamId, memberId, teamIdRaw, navigate, run],
  );

  return (
    <PlayerDetailPage teamId={teamIdRaw} player={player} canEdit={canEdit} onSave={handleSave} />
  );
}
