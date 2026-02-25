import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { DashboardPage } from '~/components/pages/DashboardPage';
import { logout } from '~/lib/auth';
import { ApiClient, ClientError, useRun, warnAndCatchAll } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

export const Route = createFileRoute('/(authenticated)/dashboard')({
  component: DashboardRoute,
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

function DashboardRoute() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const run = useRun();
  const teams = Route.useLoaderData();

  const handleLogout = React.useCallback(() => {
    logout();
    navigate({ to: '/' });
  }, [navigate]);

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

  return (
    <DashboardPage
      user={user}
      teams={teams}
      onLogout={handleLogout}
      onCreateTeam={handleCreateTeam}
    />
  );
}
