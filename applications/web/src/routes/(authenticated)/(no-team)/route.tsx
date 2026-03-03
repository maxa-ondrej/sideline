import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Array, Effect, Equal, flow, Option, Struct } from 'effect';
import { getLastTeamId } from '~/lib/auth';
import { Redirect } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/(no-team)')({
  component: AuthenticatedLayoutRoute,
  ssr: false,
  beforeLoad: ({ context }) =>
    Effect.Do.pipe(
      Effect.bind('lastTeamId', () => getLastTeamId),
      Effect.tap(({ lastTeamId }) =>
        lastTeamId.pipe(
          Option.flatMap((id) =>
            Array.findFirst(context.teams, flow(Struct.get('teamId'), Equal.equals(id))),
          ),
          Option.orElse(() => Array.head(context.teams)),
          Option.map((team) =>
            Redirect.make({ to: '/teams/$teamId', params: { teamId: team.teamId } }),
          ),
          Option.getOrElse(() => Effect.void),
        ),
      ),
      context.run,
    ),
});

function AuthenticatedLayoutRoute() {
  return <Outlet />;
}
