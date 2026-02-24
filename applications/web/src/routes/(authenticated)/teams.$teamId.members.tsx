import type { Roster } from '@sideline/domain';
import { Team, TeamMember } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { toast } from 'sonner';
import { TeamMembersPage } from '~/components/pages/TeamMembersPage';
import { ApiClient, ClientError, NotFound, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

export const Route = createFileRoute('/(authenticated)/teams/$teamId/members')({
  component: MembersRoute,
  loader: async ({ params, context }) => {
    const teamId = Schema.decodeSync(Team.TeamId)(params.teamId);
    return ApiClient.pipe(
      Effect.flatMap((api) => api.roster.listMembers({ path: { teamId } })),
      Effect.catchAll(NotFound.make),
      context.run,
    );
  },
});

function MembersRoute() {
  const { user } = Route.useRouteContext();
  const { teamId: teamIdRaw } = Route.useParams();
  const teamId = Schema.decodeSync(Team.TeamId)(teamIdRaw);
  const run = useRun();
  const initialPlayers = Route.useLoaderData();
  const [players, setPlayers] = React.useState<ReadonlyArray<Roster.RosterPlayer>>(initialPlayers);

  const currentMembership = players.find((p) => p.userId === user.id);
  const isAdmin = currentMembership?.role === 'admin';

  const handleDeactivate = React.useCallback(
    async (memberIdRaw: string) => {
      const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(memberIdRaw);
      const result = await ApiClient.pipe(
        Effect.flatMap((api) => api.roster.deactivateMember({ path: { teamId, memberId } })),
        Effect.catchAll(() => ClientError.make(m.members_saveFailed())),
        run,
      );
      if (Option.isSome(result)) {
        setPlayers((prev) => prev.filter((p) => p.memberId !== memberId));
        toast.success(m.members_deactivated());
      }
    },
    [teamId, run],
  );

  return (
    <TeamMembersPage
      teamId={teamIdRaw}
      isAdmin={isAdmin ?? false}
      players={players}
      onDeactivate={handleDeactivate}
    />
  );
}
