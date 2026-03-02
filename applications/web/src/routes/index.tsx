import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Array, Data, Effect, Option, Schema } from 'effect';
import React from 'react';
import { HomePage } from '~/components/pages/HomePage';
import {
  clearPendingInvite,
  finishLogin,
  getLastTeamId,
  getLogin,
  getPendingInvite,
  logout,
} from '~/lib/auth';
import { client } from '../lib/client';
import { Redirect } from '../lib/runtime';

class SkipError extends Data.TaggedError('SkipError') {}

export const Route = createFileRoute('/')({
  component: HomeRoute,
  validateSearch: Schema.standardSchemaV1(
    Schema.Struct({
      token: Schema.String.pipe(Schema.optionalWith({ nullable: true })),
      error: Schema.String.pipe(Schema.optionalWith({ nullable: true })),
      reason: Schema.String.pipe(Schema.optionalWith({ nullable: true })),
    }),
  ),
  beforeLoad: ({ search, context }) =>
    Option.fromNullable(search.token).pipe(
      Effect.catchTag('NoSuchElementException', () => new SkipError()),
      Effect.flatMap(finishLogin),
      Effect.tap(() => (Option.isNone(context.userOption) ? new SkipError() : Effect.void)),
      Effect.flatMap(() => getPendingInvite),
      Effect.tap(() => clearPendingInvite),
      Effect.flatMap(
        Option.match({
          onSome: (code) => Redirect.make(redirect({ to: '/invite/$code', params: { code } })),
          onNone: () => Effect.void,
        }),
      ),
      Effect.flatMap(() => getLastTeamId),
      Effect.flatMap(
        Option.match({
          onSome: (teamId) => Redirect.make(redirect({ to: '/teams/$teamId', params: { teamId } })),
          onNone: () => Effect.void,
        }),
      ),
      Effect.flatMap(() => client),
      Effect.flatMap((c) => c.auth.myTeams()),
      Effect.map(Array.head),
      Effect.catchTag(
        'HttpApiDecodeError',
        'ParseError',
        'RequestError',
        'ResponseError',
        'Unauthorized',
        () => Effect.succeed(Option.none()),
      ),
      Effect.flatten,
      Effect.flatMap((team) =>
        Effect.fail(
          Redirect.make(redirect({ to: '/teams/$teamId', params: { teamId: team.teamId } })),
        ),
      ),
      Effect.catchTag('NoSuchElementException', () =>
        Redirect.make(redirect({ to: '/create-team' })),
      ),
      Effect.catchTag('SkipError', () => Effect.void),
      context.run,
    ),
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
    Effect.runSync(logout);
    navigate({ to: '/' });
  }, [navigate]);

  return (
    <HomePage
      userOption={userOption}
      loginUrl={loginUrl}
      error={Option.fromNullable(error)}
      reason={Option.fromNullable(reason)}
      onLogout={handleLogout}
    />
  );
}
