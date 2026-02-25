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
    <div className='p-4'>
      <div className='flex items-center gap-4 mb-6'>
        <Button asChild variant='ghost' size='sm'>
          <Link to='/teams'>{m.team_backToTeams()}</Link>
        </Button>
        <h1 className='text-2xl font-bold'>{team.teamName}</h1>
      </div>

      {team.roleNames.length > 0 && (
        <p className='text-sm text-muted-foreground mb-6'>
          {m.teams_yourRoles({ roles: team.roleNames.join(', ') })}
        </p>
      )}

      <div className='grid gap-3 max-w-md'>
        {sections.map((section) => (
          <Button key={section.to} asChild variant='outline' className='justify-start'>
            <Link to={section.to} params={{ teamId }}>
              {section.label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
