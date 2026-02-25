import type { Auth } from '@sideline/domain';
import { Link } from '@tanstack/react-router';
import React from 'react';
import { LanguageSwitcher } from '~/components/organisms/LanguageSwitcher';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import * as m from '~/paraglide/messages.js';

interface DashboardPageProps {
  user: { discordUsername: string };
  teams: ReadonlyArray<Auth.UserTeam>;
  onLogout: () => void;
  onCreateTeam: (name: string) => Promise<boolean>;
}

export function DashboardPage({ user, teams, onLogout, onCreateTeam }: DashboardPageProps) {
  const [teamName, setTeamName] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const handleCreate = React.useCallback(async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    const success = await onCreateTeam(teamName.trim());
    setCreating(false);
    if (success) {
      setTeamName('');
    }
  }, [teamName, onCreateTeam]);

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <header className='flex items-center justify-between mb-8'>
        <div>
          <h1 className='text-2xl font-bold'>{m.dashboard_title()}</h1>
          <p className='text-muted-foreground'>
            {m.dashboard_welcome({ username: user.discordUsername })}
          </p>
        </div>
        <LanguageSwitcher isAuthenticated />
      </header>

      <nav className='flex gap-2 mb-8'>
        <Button asChild variant='outline' size='sm'>
          <Link to='/teams'>{m.teams_viewTeams()}</Link>
        </Button>
        <Button asChild variant='outline' size='sm'>
          <Link to='/notifications'>{m.notification_title()}</Link>
        </Button>
        <Button asChild variant='outline' size='sm'>
          <Link to='/profile'>{m.profile_viewProfile()}</Link>
        </Button>
        <Button variant='ghost' size='sm' onClick={onLogout}>
          {m.auth_logout()}
        </Button>
      </nav>

      <section className='mb-8'>
        <h2 className='text-lg font-semibold mb-3'>{m.teams_title()}</h2>
        {teams.length > 0 ? (
          <ul className='flex flex-col gap-2'>
            {teams.map((team) => (
              <li key={team.teamId}>
                <Link
                  to='/teams/$teamId'
                  params={{ teamId: team.teamId }}
                  className='flex items-center justify-between border rounded-lg p-3 hover:bg-accent transition-colors'
                >
                  <span className='font-medium'>{team.teamName}</span>
                  {team.roleNames.length > 0 && (
                    <span className='text-sm text-muted-foreground'>
                      {team.roleNames.join(', ')}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground'>{m.dashboard_noTeams()}</p>
        )}
      </section>

      <section>
        <h2 className='text-lg font-semibold mb-3'>{m.dashboard_createTeam()}</h2>
        <div className='flex gap-2 max-w-md'>
          <Input
            placeholder={m.dashboard_teamNamePlaceholder()}
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <Button onClick={handleCreate} disabled={creating || !teamName.trim()}>
            {creating ? m.dashboard_creating() : m.dashboard_createTeam()}
          </Button>
        </div>
      </section>
    </div>
  );
}
