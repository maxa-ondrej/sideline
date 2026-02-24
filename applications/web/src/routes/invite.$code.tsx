import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { InvitePage } from '~/components/pages/InvitePage';
import { getLogin, setPendingInvite } from '~/lib/auth';
import { ApiClient, NotFound, useRun } from '~/lib/runtime';

export const Route = createFileRoute('/invite/$code')({
  component: InviteRoute,
  loader: async ({ params, context }) =>
    ApiClient.pipe(
      Effect.flatMap((api) => api.invite.getInvite({ path: { code: params.code } })),
      Effect.catchAll(NotFound.make),
      context.run,
    ),
});

function InviteRoute() {
  const { userOption } = Route.useRouteContext();
  const { code } = Route.useParams();
  const invite = Route.useLoaderData();
  const navigate = useNavigate();
  const run = useRun();

  const handleJoined = React.useCallback(
    (isProfileComplete: boolean) => {
      if (isProfileComplete) {
        navigate({ to: '/dashboard' });
      } else {
        navigate({ to: '/profile/complete' });
      }
    },
    [navigate],
  );

  const handleSignIn = React.useCallback(() => {
    setPendingInvite(code);
    getLogin()
      .pipe(Effect.option, run)
      .then((url) => {
        if (Option.isSome(url)) {
          navigate({ href: url.value.toString() });
        }
      });
  }, [code, navigate, run]);

  return (
    <InvitePage
      isAuthenticated={Option.isSome(userOption)}
      invite={invite}
      code={code}
      onJoined={handleJoined}
      onSignIn={handleSignIn}
    />
  );
}
