import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { ProfileCompletePage } from '../../components/pages/ProfileCompletePage';

export const Route = createFileRoute('/(authenticated)/profile/complete')({
  component: ProfileCompleteRoute,
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/' });
    }
    if (context.user.isProfileComplete) {
      throw redirect({ to: '/dashboard' });
    }
  },
});

function ProfileCompleteRoute() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const handleSuccess = React.useCallback(() => {
    navigate({ to: '/dashboard' });
  }, [navigate]);

  return <ProfileCompletePage user={user} onSuccess={handleSuccess} />;
}
