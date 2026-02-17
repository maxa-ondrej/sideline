import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Effect } from 'effect';
import React from 'react';
import { getLogin, setPendingInvite } from '../lib/auth';
import { ApiClient, ClientError, runPromise } from '../lib/runtime';

export const Route = createFileRoute('/invite/$code')({
  component: InvitePage,
  ssr: false,
  loader: async ({ params, abortController }) =>
    ApiClient.pipe(
      Effect.flatMap((api) => api.invite.getInvite({ path: { code: params.code } })),
      Effect.catchAll(() => Effect.fail(new ClientError({ message: 'Invite not found' }))),
      runPromise(abortController),
    ),
});

function InvitePage() {
  const { user } = Route.useRouteContext();
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
                  ? 'You are already a member of this team.'
                  : '_tag' in e && e._tag === 'InviteNotFound'
                    ? 'This invite is no longer valid.'
                    : 'Failed to join team.',
            }),
          ),
        ),
        runPromise(),
      );
      if (result.isProfileComplete) {
        navigate({ to: '/dashboard' });
      } else {
        navigate({ to: '/profile/complete' });
      }
    } catch (e) {
      setError(e instanceof ClientError ? e.message : 'Failed to join team.');
      setJoining(false);
    }
  }, [code, navigate]);

  const handleSignIn = React.useCallback(() => {
    setPendingInvite(code);
    window.location.href = getLogin();
  }, [code]);

  if (!invite) {
    return (
      <div>
        <h1>Invite Not Found</h1>
        <p>This invite link is invalid or has expired.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Join {invite.teamName}</h1>
      <p>You have been invited to join {invite.teamName}.</p>
      {error && <p>{error}</p>}
      {user ? (
        <button type='button' onClick={handleJoin} disabled={joining}>
          {joining ? 'Joining...' : 'Join Team'}
        </button>
      ) : (
        <button type='button' onClick={handleSignIn}>
          Sign in with Discord to join
        </button>
      )}
    </div>
  );
}
