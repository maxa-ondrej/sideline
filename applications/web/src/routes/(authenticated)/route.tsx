import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { Effect } from 'effect';
import React from 'react';
import { AuthenticatedLayout } from '~/components/layouts/AuthenticatedLayout';
import { logout } from '~/lib/auth';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)')({
  component: AuthenticatedLayoutRoute,
  beforeLoad: ({ context }) =>
    Effect.Do.pipe(
      Effect.bind('user', () => context.userOption),
      warnAndCatchAll,
      context.run,
    ),
  loader: ({ context }) =>
    ApiClient.pipe(
      Effect.flatMap((api) => api.auth.myTeams()),
      warnAndCatchAll,
      context.run,
    ),
});

function AuthenticatedLayoutRoute() {
  const { user } = Route.useRouteContext();
  const teams = Route.useLoaderData();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const activeTeamId = 'teamId' in params ? (params.teamId as string) : undefined;

  const handleLogout = React.useCallback(() => {
    logout();
    navigate({ to: '/' });
  }, [navigate]);

  return (
    <AuthenticatedLayout
      user={user}
      teams={teams}
      activeTeamId={activeTeamId}
      onLogout={handleLogout}
    />
  );
}
