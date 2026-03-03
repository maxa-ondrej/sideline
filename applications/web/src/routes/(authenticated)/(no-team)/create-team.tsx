import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { CreateTeamPage } from '~/components/pages/CreateTeamPage';
import { setLastTeamId } from '~/lib/auth';
import { ApiClient, ClientError, Redirect, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

export const Route = createFileRoute('/(authenticated)/(no-team)/create-team')({
  component: CreateTeamRoute,
  beforeLoad: ({ context }) =>
    Effect.Do.pipe(
      Effect.tap(() =>
        context.user.isProfileComplete ? Effect.void : Redirect.make({ to: '/profile/complete' }),
      ),
      context.run,
    ),
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
        Effect.runSync(setLastTeamId(teamId));
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
