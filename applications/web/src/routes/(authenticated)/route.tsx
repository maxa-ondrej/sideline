import type { Auth } from '@sideline/domain';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Array, Effect } from 'effect';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)')({
  component: AuthenticatedLayoutRoute,
  beforeLoad: ({ context }) =>
    Effect.Do.pipe(
      Effect.bind('user', () => context.userOption),
      Effect.bind('teams', () =>
        ApiClient.pipe(
          Effect.flatMap((api) => api.auth.myTeams()),
          Effect.tapError((e) => Effect.logWarning('Could not fetch my teams', e)),
          Effect.catchAll(() => Effect.succeed(Array.empty<Auth.UserTeam>())),
        ),
      ),
      warnAndCatchAll,
      context.run,
    ),
});

function AuthenticatedLayoutRoute() {
  return <Outlet />;
}
