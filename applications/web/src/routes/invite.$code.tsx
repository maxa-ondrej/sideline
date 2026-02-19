import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { getLogin, setPendingInvite } from '../lib/auth';
import { ApiClient, ClientError, NotFound } from '../lib/runtime';
import * as m from '../paraglide/messages.js';

export const Route = createFileRoute('/invite/$code')({
  component: InvitePage,
  ssr: false,
  loader: async ({ params, context }) =>
    ApiClient.pipe(
      Effect.flatMap((api) => api.invite.getInvite({ path: { code: params.code } })),
      Effect.catchAll(NotFound.make),
      context.run,
    ),
});

function InvitePage() {
  const { user, makeRun } = Route.useRouteContext();
  const { code } = Route.useParams();
  const invite = Route.useLoaderData();
  const navigate = useNavigate();
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleJoin = React.useCallback(async () => {
    setJoining(true);
    setError(null);
    try {
      const result = await ApiClient.pipe(
        Effect.flatMap((api) => api.invite.joinViaInvite({ path: { code } })),
        Effect.catchAll((e) =>
          Effect.fail(
            new ClientError({
              message:
                '_tag' in e && e._tag === 'AlreadyMember'
                  ? m.invite_errors_alreadyMember()
                  : '_tag' in e && e._tag === 'InviteNotFound'
                    ? m.invite_errors_inviteNotValid()
                    : m.invite_errors_joinFailed(),
            }),
          ),
        ),
        makeRun(),
      );
      if (result.isProfileComplete) {
        navigate({ to: '/dashboard' });
      } else {
        navigate({ to: '/profile/complete' });
      }
    } catch (e) {
      setError(e instanceof ClientError ? e.message : m.invite_errors_joinFailed());
      setJoining(false);
    }
  }, [code, navigate, makeRun]);

  const handleSignIn = React.useCallback(() => {
    setPendingInvite(code);
    getLogin()
      .pipe(Effect.option, makeRun())
      .then((url) => {
        if (Option.isSome(url)) {
          navigate({ href: url.value.toString() });
        }
      });
  }, [code, navigate, makeRun]);

  return (
    <div>
      <h1>{m.invite_joinTitle({ teamName: invite.teamName })}</h1>
      <p>{m.invite_joinDescription({ teamName: invite.teamName })}</p>
      {error && <p>{error}</p>}
      {user ? (
        <button type='button' onClick={handleJoin} disabled={joining}>
          {joining ? m.invite_joining() : m.invite_joinButton()}
        </button>
      ) : (
        <button type='button' onClick={handleSignIn}>
          {m.invite_signInToJoin()}
        </button>
      )}
    </div>
  );
}
