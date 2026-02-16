import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { logout } from '../lib/auth';

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
  ssr: false,
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
      <h1>Dashboard</h1>
      <p>Welcome, {user?.username}</p>
      <button type='button' onClick={doLogout}>
        Logout
      </button>
    </div>
  );
}
