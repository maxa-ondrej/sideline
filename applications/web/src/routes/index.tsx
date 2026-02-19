import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { clearPendingInvite, finishLogin, getLogin, getPendingInvite, logout } from '../lib/auth';
import * as m from '../paraglide/messages.js';

const reasonMessages: Record<string, () => string> = {
  access_denied: m.auth_errors_accessDenied,
  missing_params: m.auth_errors_missingParams,
  oauth_failed: m.auth_errors_oauthFailed,
  profile_failed: m.auth_errors_profileFailed,
  internal_error: m.auth_errors_internalError,
};

export const Route = createFileRoute('/')({
  component: Home,
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

function Home() {
  const { userOption } = Route.useRouteContext();
  const { loginUrl } = Route.useLoaderData();
  const navigate = useNavigate();
  const { error, reason } = Route.useSearch();

  const doLogout = React.useCallback(() => {
    logout();
    navigate({ to: '/' });
  }, [navigate]);

  if (Option.isSome(userOption)) {
    return (
      <div>
        <div className='flex items-center justify-between'>
          <h1>{m.app_name()}</h1>
          <LanguageSwitcher isAuthenticated />
        </div>
        <p>{m.auth_signedInAs({ username: userOption.value.discordUsername })}</p>
        <button type='button' onClick={doLogout}>
          {m.auth_logout()}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className='flex items-center justify-between'>
        <h1>{m.app_name()}</h1>
        <LanguageSwitcher isAuthenticated={false} />
      </div>
      {error ? (
        <div>
          <p>{reasonMessages[reason ?? '']?.() ?? m.auth_loginFailed()}</p>
          <a href={loginUrl}>{m.auth_tryAgain()}</a>
        </div>
      ) : (
        <div>
          <p>{m.app_welcome()}</p>
          <a href={loginUrl}>{m.auth_signInDiscord()}</a>
        </div>
      )}
    </div>
  );
}
