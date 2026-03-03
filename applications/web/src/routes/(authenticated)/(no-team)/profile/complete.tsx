import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { ProfileCompletePage } from '~/components/pages/ProfileCompletePage';
import { getLastTeamId } from '~/lib/auth';
import { Redirect } from '~/lib/runtime';

export const Route = createFileRoute('/(authenticated)/(no-team)/profile/complete')({
  component: ProfileCompleteRoute,
  beforeLoad: ({ context }) =>
    context.user.isProfileComplete
      ? Effect.Do.pipe(
          Effect.flatMap(() => getLastTeamId),
          Effect.flatMap(
            Option.match({
              onSome: (teamId) => Redirect.make({ to: '/teams/$teamId', params: { teamId } }),
              onNone: () => Redirect.make({ to: '/create-team' }),
            }),
          ),
          context.run,
        )
      : {},
});

function ProfileCompleteRoute() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const handleSuccess = React.useCallback(() => {
    const lastTeamId = Effect.runSync(getLastTeamId);
    if (Option.isSome(lastTeamId)) {
      navigate({ to: '/teams/$teamId', params: { teamId: lastTeamId.value } });
    } else {
      navigate({ to: '/create-team' });
    }
  }, [navigate]);

  return <ProfileCompletePage user={user} onSuccess={handleSuccess} />;
}
