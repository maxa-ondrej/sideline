import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { CreateTeamPage } from '~/components/pages/CreateTeamPage';
import { setLastTeamId } from '~/lib/auth';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

export const Route = createFileRoute('/(authenticated)/create-team')({
  component: CreateTeamRoute,
  beforeLoad: async ({ context }) => {
    if (context.user && !context.user.isProfileComplete) {
      throw redirect({ to: '/profile/complete' });
    }
  },
});

function CreateTeamRoute() {
  const navigate = useNavigate();
  const router = useRouter();
  const run = useRun();

  const handleCreateTeam = React.useCallback(
    async (name: string) => {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) => api.auth.createTeam({ payload: { name } })),
        Effect.catchAll(() => ClientError.make(m.dashboard_createFailed())),
        run,
      );
      if (Option.isSome(result)) {
        const teamId = result.value.teamId;
        setLastTeamId(teamId);
        router.invalidate();
        navigate({ to: '/teams/$teamId', params: { teamId } });
        return true;
      }
      return false;
    },
    [run, router, navigate],
  );

  return <CreateTeamPage onCreateTeam={handleCreateTeam} />;
}
