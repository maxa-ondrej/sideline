import type { Auth } from '@sideline/domain';
import { Link } from '@tanstack/react-router';
import { Button } from '~/components/ui/button';
import * as m from '~/paraglide/messages.js';

interface TeamDetailPageProps {
  teamId: string;
  team: Auth.UserTeam;
}

export function TeamDetailPage({ teamId, team }: TeamDetailPageProps) {
  const sections = [
    { to: '/teams/$teamId/members' as const, label: m.team_members() },
    { to: '/teams/$teamId/rosters' as const, label: m.team_rosters() },
    { to: '/teams/$teamId/roles' as const, label: m.team_roles() },
    { to: '/teams/$teamId/subgroups' as const, label: m.team_subgroups() },
    { to: '/teams/$teamId/age-thresholds' as const, label: m.team_ageThresholds() },
  ] as const;

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams'>← {m.team_backToTeams()}</Link>
        </Button>
        <h1 className='text-2xl font-bold'>{team.teamName}</h1>
        {team.roleNames.length > 0 && (
          <p className='text-muted-foreground'>
            {m.teams_yourRoles({ roles: team.roleNames.join(', ') })}
          </p>
        )}
      </header>

      <nav className='flex flex-col gap-2'>
        {sections.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            params={{ teamId }}
            className='flex items-center border rounded-lg p-3 font-medium hover:bg-accent transition-colors'
          >
            {section.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
