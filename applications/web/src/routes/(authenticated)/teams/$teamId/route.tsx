import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Array, Effect, Equal, flow, Struct } from 'effect';
import React from 'react';
import { AuthenticatedLayout } from '~/components/layouts/AuthenticatedLayout';
import { logout, setLastTeamId } from '~/lib/auth';
import { NotFound } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId')({
  component: AuthenticatedLayoutRoute,
  ssr: false,
  loader: ({ context, params }) =>
    Effect.Do.pipe(
      Effect.let('teams', () => context.teams),
      Effect.bind('team', ({ teams }) =>
        Array.findFirst(teams, flow(Struct.get('teamId'), Equal.equals(params.teamId))),
      ),
      Effect.tap(() => setLastTeamId(params.teamId)),
      Effect.catchTag('NoSuchElementError', () => NotFound.make()),
      context.run,
    ),
});

function AuthenticatedLayoutRoute() {
  const { user } = Route.useRouteContext();
  const { teams, team } = Route.useLoaderData();
  const navigate = useNavigate();

  const handleLogout = React.useCallback(() => {
    Effect.runSync(logout);
    navigate({ to: '/' });
  }, [navigate]);

  return (
    <AuthenticatedLayout user={user} teams={teams} activeTeam={team} onLogout={handleLogout} />
  );
}
