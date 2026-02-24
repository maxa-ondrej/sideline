import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { DashboardPage } from '../../components/pages/DashboardPage';
import { logout } from '../../lib/auth';

export const Route = createFileRoute('/(authenticated)/dashboard')({
  component: DashboardRoute,
  beforeLoad: async ({ context }) => {
    if (context.user && !context.user.isProfileComplete) {
      throw redirect({ to: '/profile/complete' });
    }
  },
});

function DashboardRoute() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const handleLogout = React.useCallback(() => {
    logout();
    navigate({ to: '/' });
  }, [navigate]);

  return <DashboardPage user={user} onLogout={handleLogout} />;
}
