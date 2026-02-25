import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { TeamsPage } from '~/components/pages/TeamsPage';
import { ApiClient, ClientError, useRun, warnAndCatchAll } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

export const Route = createFileRoute('/(authenticated)/teams/')({
  component: TeamsRoute,
  beforeLoad: async ({ context }) => {
    if (context.user && !context.user.isProfileComplete) {
      throw redirect({ to: '/profile/complete' });
    }
  },
  loader: async ({ context }) =>
    ApiClient.pipe(
      Effect.flatMap((api) => api.auth.myTeams()),
      warnAndCatchAll,
      context.run,
    ),
});

function TeamsRoute() {
  const router = useRouter();
  const run = useRun();
  const teams = Route.useLoaderData();

  const handleCreateTeam = React.useCallback(
    async (name: string) => {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) => api.auth.createTeam({ payload: { name } })),
        Effect.catchAll(() => ClientError.make(m.dashboard_createFailed())),
        run,
      );
      if (Option.isSome(result)) {
        router.invalidate();
        return true;
      }
      return false;
    },
    [run, router],
  );

  return <TeamsPage teams={teams} onCreateTeam={handleCreateTeam} />;
}
