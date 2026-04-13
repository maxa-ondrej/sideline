import type { Auth } from '@sideline/domain';
import { createFileRoute } from '@tanstack/react-router';
import { Array, Data, Effect, Option, Schema } from 'effect';
import { HomePage } from '~/components/pages/HomePage';
import {
  clearPendingInvite,
  finishLogin,
  getLastTeamId,
  getLogin,
  getPendingInvite,
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
    Effect.Do.pipe(
      Effect.flatMap(() => Option.fromNullishOr(search.token)),
      Effect.flatMap(finishLogin),
      Effect.flatMap(() => Redirect.make({ to: '.' })),
      Effect.catchTag('NoSuchElementException', () => Effect.void),
      Effect.tap(
        Option.match(context.userOption, {
          onSome: () => Effect.void,
          onNone: () => new SkipError(),
        }),
      ),
      Effect.flatMap(() => getPendingInvite),
      Effect.tap(() => clearPendingInvite),
      Effect.flatMap(
        Option.match({
          onSome: (code) => Redirect.make({ to: '/invite/$code', params: { code } }),
          onNone: () => Effect.void,
        }),
      ),
      Effect.flatMap(() => client),
      Effect.flatMap((c) => c.auth.myTeams()),
      Effect.catchTag(
        'HttpApiDecodeError',
        'ParseError',
        'RequestError',
        'ResponseError',
        'Unauthorized',
        () => Effect.succeed([] as readonly Auth.UserTeam[]),
      ),
      Effect.tap((teams) =>
        getLastTeamId.pipe(
          Effect.flatMap(
            Option.match({
              onSome: (teamId) =>
                Option.isSome(Array.findFirst(teams, (t) => t.teamId === teamId))
                  ? Redirect.make({ to: '/teams/$teamId', params: { teamId } })
                  : Effect.void,
              onNone: () => Effect.void,
            }),
          ),
        ),
      ),
      Effect.map(Array.head),
      Effect.flatten,
      Effect.flatMap((team) =>
        Effect.fail(Redirect.make({ to: '/teams/$teamId', params: { teamId: team.teamId } })),
      ),
      Effect.catchTag('NoSuchElementException', () => Redirect.make({ to: '/create-team' })),
      Effect.catchTag('SkipError', () => Effect.void),
      context.run,
    ),
  loader: ({ context }) =>
    getLogin().pipe(
      Effect.map((url) => url.toString()),
      Effect.tapError((e) => Effect.logWarning('Failed to generate login URL', e)),
      // Intentional UI error boundary: any login URL failure redirects to /error page.
      // The tapError above already logs the cause for debugging.
      Effect.catchAll(() => Effect.succeed('/error')),
      Effect.bindTo('loginUrl'),
      context.run,
    ),
});

function HomeRoute() {
  const { loginUrl } = Route.useLoaderData();
  const { error, reason } = Route.useSearch();

  return (
    <HomePage
      loginUrl={loginUrl}
      error={Option.fromNullishOr(error)}
      reason={Option.fromNullishOr(reason)}
    />
  );
}
