import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Effect, Option } from 'effect';
import React from 'react';
import { ProfileCompletePage } from '~/components/pages/ProfileCompletePage';
import { getLastTeamId } from '~/lib/auth';

export const Route = createFileRoute('/(authenticated)/profile/complete')({
  component: ProfileCompleteRoute,
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/' });
    }
    if (context.user.isProfileComplete) {
      const lastTeamId = Effect.runSync(getLastTeamId);
      if (Option.isSome(lastTeamId)) {
        throw redirect({ to: '/teams/$teamId', params: { teamId: lastTeamId.value } });
      }
      throw redirect({ to: '/create-team' });
    }
  },
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
