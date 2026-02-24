import type { Auth } from '@sideline/domain';
import { Link } from '@tanstack/react-router';
import { LanguageSwitcher } from '~/components/organisms/LanguageSwitcher';
import { Button } from '~/components/ui/button';
import * as m from '~/paraglide/messages.js';

interface DashboardPageProps {
  user: { discordUsername: string };
  teams: ReadonlyArray<Auth.UserTeam>;
  onLogout: () => void;
}

export function DashboardPage({ user, teams, onLogout }: DashboardPageProps) {
  return (
    <div>
      <div className='flex items-center justify-between'>
        <h1>{m.dashboard_title()}</h1>
        <LanguageSwitcher isAuthenticated />
      </div>
      <p>{m.dashboard_welcome({ username: user.discordUsername })}</p>
      {teams.length > 0 && (
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
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button variant='outline' onClick={onLogout} className='mt-4'>
        {m.auth_logout()}
      </Button>
    </div>
  );
}
