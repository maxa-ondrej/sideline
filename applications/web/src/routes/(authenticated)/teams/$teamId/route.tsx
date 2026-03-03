import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { Array, Effect, Equal, flow, Struct } from 'effect';
import React from 'react';
import { AuthenticatedLayout } from '~/components/layouts/AuthenticatedLayout';
import { logout, setLastTeamId } from '~/lib/auth';
import { NotFound, Redirect } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/teams/$teamId')({
  component: AuthenticatedLayoutRoute,
  loader: async ({ context, params }) =>
    Effect.Do.pipe(
      Effect.let('teams', () => context.teams),
      Effect.tap(
        flow(
          Struct.get('teams'),
          Array.isEmptyReadonlyArray,
          Effect.if({
            onTrue: () => Redirect.make({ to: '/create-team' }),
            onFalse: () => Effect.void,
          }),
        ),
      ),
      Effect.bind(
        'team',
        flow(
          Struct.get('teams'),
          Array.findFirst(flow(Struct.get('teamId'), Equal.equals(params.teamId))),
          Effect.map((a) => a),
        ),
      ),
      Effect.tap(() => setLastTeamId(params.teamId)),
      Effect.catchTag('NoSuchElementException', () => NotFound.make()),
      context.run,
    ),
});

function AuthenticatedLayoutRoute() {
  const { user } = Route.useRouteContext();
  const teams = Route.useLoaderData();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const activeTeamId = 'teamId' in params ? (params.teamId as string) : undefined;

  React.useEffect(() => {
    if (activeTeamId) {
      Effect.runSync(setLastTeamId(activeTeamId));
    }
  }, [activeTeamId]);

  const handleLogout = React.useCallback(() => {
    Effect.runSync(logout);
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
