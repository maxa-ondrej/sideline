import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Schema } from 'effect';
import React from 'react';
import { finishLogin, getLogin, logout } from '../lib/auth';

const reasonMessages: Record<string, string> = {
  access_denied: 'You denied the Discord authorization request.',
  missing_params: 'The login response was incomplete. Please try again.',
  oauth_failed: 'Discord login failed. The authorization code may have expired.',
  profile_failed: 'Could not retrieve your Discord profile. Please try again.',
  internal_error: 'An unexpected error occurred. Please try again later.',
};

export const Route = createFileRoute('/')({
  component: Home,
  ssr: false,
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
      throw redirect({ to: '/dashboard' });
    }
  },
});

function Home() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { error, reason } = Route.useSearch();

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
      {error ? (
        <div>
          <p>{reasonMessages[reason ?? ''] ?? 'Login failed. Please try again.'}</p>
          <a href={getLogin()}>Try again</a>
        </div>
      ) : (
        <div>
          <p>Welcome to Sideline.</p>
          <a href={getLogin()}>Sign in with Discord</a>
        </div>
      )}
    </div>
  );
}
