import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Schema } from 'effect';
import React from 'react';
import { finishLogin, getLogin, logout } from '../lib/auth';

export const Route = createFileRoute('/')({
  component: Home,
  ssr: false,
  validateSearch: Schema.standardSchemaV1(
    Schema.Struct({
      token: Schema.String.pipe(Schema.optional),
    }),
  ),
  beforeLoad: async ({ search }) => {
    if (search.token) {
      finishLogin(search.token);
      throw redirect({ to: '/dashboard' });
    }
  },
});

function Home() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const doLogout = React.useCallback(() => {
    logout();
    navigate({ to: '/' });
  }, [navigate]);

  if (user) {
    return (
      <div>
        <h1>Sideline</h1>
        <p>Signed in as {user.username}</p>
        <button type='button' onClick={() => console.log('ahoj')}>
          Dump
        </button>
        <button type='button' onClick={doLogout}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Sideline</h1>
      <p>Welcome to Sideline.</p>
      <a href={getLogin()}>Sign in with Discord</a>
    </div>
  );
}
