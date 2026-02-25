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
    <div>
      <div className='flex items-center justify-between'>
        <h1>{m.dashboard_title()}</h1>
        <LanguageSwitcher isAuthenticated />
      </div>
      <p>{m.dashboard_welcome({ username: user.discordUsername })}</p>

      <div className='mt-6 p-4 border rounded-lg max-w-md'>
        <h2 className='text-lg font-semibold mb-2'>{m.dashboard_createTeam()}</h2>
        <div className='flex gap-2'>
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
      </div>

      {teams.length > 0 ? (
        <div className='mt-4'>
          <ul className='flex flex-col gap-2'>
            {teams.map((team) => (
              <li key={team.teamId} className='flex items-center gap-4'>
                <span>{team.teamName}</span>
                <Button asChild variant='outline' size='sm'>
                  <Link to='/teams/$teamId/members' params={{ teamId: team.teamId }}>
                    {m.members_viewMembers()}
                  </Link>
                </Button>
                <Button asChild variant='outline' size='sm'>
                  <Link to='/teams/$teamId/rosters' params={{ teamId: team.teamId }}>
                    {m.roster_viewRosters()}
                  </Link>
                </Button>
                <Button asChild variant='outline' size='sm'>
                  <Link to='/teams/$teamId/roles' params={{ teamId: team.teamId }}>
                    {m.role_viewRoles()}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className='mt-4 text-muted-foreground'>{m.dashboard_noTeams()}</p>
      )}
      <div className='mt-4 flex gap-2'>
        <Button asChild variant='outline'>
          <Link to='/profile'>{m.profile_viewProfile()}</Link>
        </Button>
        <Button variant='outline' onClick={onLogout}>
          {m.auth_logout()}
        </Button>
      </div>
    </div>
  );
}
