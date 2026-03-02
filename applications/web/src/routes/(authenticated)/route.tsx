import { createFileRoute, redirect, useNavigate, useParams } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { AuthenticatedLayout } from '~/components/layouts/AuthenticatedLayout';
import { getLastTeamId, logout, setLastTeamId } from '~/lib/auth';
import { ApiClient, warnAndCatchAll } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)')({
  component: AuthenticatedLayoutRoute,
  beforeLoad: ({ context }) =>
    Effect.Do.pipe(
      Effect.bind('user', () => context.userOption),
      warnAndCatchAll,
      context.run,
    ),
  loader: async ({ context, location }) => {
    const teams = await ApiClient.pipe(
      Effect.flatMap((api) => api.auth.myTeams()),
      warnAndCatchAll,
      context.run,
    );

    const pathname = location.pathname;

    // Allow /create-team and /profile routes without a team
    if (pathname.startsWith('/create-team') || pathname.startsWith('/profile')) {
      return teams;
    }

    // If already on a team route, store the teamId
    const teamMatch = pathname.match(/^\/teams\/([^/]+)/);
    if (teamMatch) {
      const teamId = teamMatch[1];
      if (teams.some((t) => t.teamId === teamId)) {
        Effect.runSync(setLastTeamId(teamId));
        return teams;
      }
    }

    // No teams → go to create-team
    if (teams.length === 0) {
      throw redirect({ to: '/create-team' });
    }

    // Resolve the target team
    const lastTeamId = Effect.runSync(getLastTeamId);
    const targetTeamId =
      Option.isSome(lastTeamId) && teams.some((t) => t.teamId === lastTeamId.value)
        ? lastTeamId.value
        : teams[0].teamId;

    throw redirect({ to: '/teams/$teamId', params: { teamId: targetTeamId } });
  },
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
