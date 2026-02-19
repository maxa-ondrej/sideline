import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { logout } from '../../lib/auth';
import * as m from '../../paraglide/messages.js';

export const Route = createFileRoute('/(authenticated)/dashboard')({
  component: Dashboard,
  beforeLoad: async ({ context }) => {
    if (context.user && !context.user.isProfileComplete) {
      throw redirect({ to: '/profile/complete' });
    }
  },
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const doLogout = React.useCallback(() => {
    logout();
    navigate({ to: '/' });
  }, [navigate]);

  return (
    <div>
      <div className='flex items-center justify-between'>
        <h1>{m.dashboard_title()}</h1>
        <LanguageSwitcher isAuthenticated={!!user} />
      </div>
      <p>{m.dashboard_welcome({ username: user.discordUsername })}</p>
      <button type='button' onClick={doLogout}>
        {m.auth_logout()}
      </button>
    </div>
  );
}
