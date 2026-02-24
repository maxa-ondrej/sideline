import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import React from 'react';
import { HomePage } from '../components/pages/HomePage';
import { clearPendingInvite, finishLogin, getLogin, getPendingInvite, logout } from '../lib/auth';

export const Route = createFileRoute('/')({
  component: HomeRoute,
  validateSearch: Schema.standardSchemaV1(
    Schema.Struct({
      token: Schema.String.pipe(Schema.optional),
      error: Schema.String.pipe(Schema.optional),
      reason: Schema.String.pipe(Schema.optional),
    }),
  ),
  beforeLoad: async ({ search }) => {
    if (search.token) {
      finishLogin(search.token);
      const pendingInvite = getPendingInvite();
      if (pendingInvite) {
        clearPendingInvite();
        throw redirect({ to: '/invite/$code', params: { code: pendingInvite } });
      }
      throw redirect({ to: '/dashboard' });
    }
  },
  loader: ({ context }) =>
    getLogin().pipe(
      Effect.map((url) => url.toString()),
      Effect.catchAll(() => Effect.succeed('/error')),
      Effect.bindTo('loginUrl'),
      context.run,
    ),
});

function HomeRoute() {
  const { userOption } = Route.useRouteContext();
  const { loginUrl } = Route.useLoaderData();
  const { error, reason } = Route.useSearch();
  const navigate = useNavigate();

  const handleLogout = React.useCallback(() => {
    logout();
    navigate({ to: '/' });
  }, [navigate]);

  return (
    <HomePage
      userOption={userOption}
      loginUrl={loginUrl}
      error={error}
      reason={reason}
      onLogout={handleLogout}
    />
  );
}
