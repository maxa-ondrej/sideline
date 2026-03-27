import type { Auth } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link } from '@tanstack/react-router';

interface TeamDetailPageProps {
  teamId: string;
  team: Auth.UserTeam;
}

export function TeamDetailPage({ teamId, team }: TeamDetailPageProps) {
  const sections = [
    { to: '/teams/$teamId/members' as const, label: m.team_members() },
    { to: '/teams/$teamId/rosters' as const, label: m.team_rosters() },
    { to: '/teams/$teamId/roles' as const, label: m.team_roles() },
    { to: '/teams/$teamId/groups' as const, label: m.team_groups() },
    { to: '/teams/$teamId/training-types' as const, label: m.team_trainingTypes() },
    { to: '/teams/$teamId/age-thresholds' as const, label: m.team_ageThresholds() },
    { to: '/teams/$teamId/leaderboard' as const, label: m.team_leaderboard() },
    { to: '/teams/$teamId/settings' as const, label: m.team_settings() },
  ] as const;

  return (
    <div>
      <header className='mb-8'>
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
