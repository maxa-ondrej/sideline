import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Effect } from 'effect';
import React from 'react';
import { DashboardPage } from '~/components/pages/DashboardPage';
import { logout } from '~/lib/auth';
import { ApiClient, NotFound } from '~/lib/runtime';

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
      Effect.catchAll(NotFound.make),
      context.run,
    ),
});

function DashboardRoute() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const teams = Route.useLoaderData();

  const handleLogout = React.useCallback(() => {
    logout();
    navigate({ to: '/' });
  }, [navigate]);

  return <DashboardPage user={user} teams={teams} onLogout={handleLogout} />;
}
