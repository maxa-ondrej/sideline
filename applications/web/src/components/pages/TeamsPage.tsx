import type { Auth } from '@sideline/domain';
import { Link } from '@tanstack/react-router';
import React from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import * as m from '~/paraglide/messages.js';

interface TeamsPageProps {
  teams: ReadonlyArray<Auth.UserTeam>;
  onCreateTeam: (name: string) => Promise<boolean>;
}

export function TeamsPage({ teams, onCreateTeam }: TeamsPageProps) {
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
    <div className='p-4'>
      <div className='flex items-center gap-4 mb-6'>
        <Button asChild variant='ghost' size='sm'>
          <Link to='/dashboard'>{m.teams_backToDashboard()}</Link>
        </Button>
        <h1 className='text-2xl font-bold'>{m.teams_title()}</h1>
      </div>

      <div className='p-4 border rounded-lg max-w-md mb-6'>
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
        <ul className='flex flex-col gap-3'>
          {teams.map((team) => (
            <li key={team.teamId} className='border rounded-lg p-4'>
              <Link
                to='/teams/$teamId/members'
                params={{ teamId: team.teamId }}
                className='text-lg font-semibold hover:underline'
              >
                {team.teamName}
              </Link>
              {team.roleNames.length > 0 && (
                <p className='text-sm text-muted-foreground mt-1'>
                  {m.teams_yourRoles({ roles: team.roleNames.join(', ') })}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className='text-muted-foreground'>{m.teams_noTeams()}</p>
      )}
    </div>
  );
}
