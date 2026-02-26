import type { Roster } from '@sideline/domain';
import { Link } from '@tanstack/react-router';
import React from 'react';
import { PlayerRow } from '~/components/organisms/PlayerRow';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import * as m from '~/paraglide/messages.js';

interface TeamMembersPageProps {
  teamId: string;
  canEdit: boolean;
  canRemove: boolean;
  players: ReadonlyArray<Roster.RosterPlayer>;
  onDeactivate: (memberId: string) => void;
}

export function TeamMembersPage({
  teamId,
  canEdit,
  canRemove,
  players,
  onDeactivate,
}: TeamMembersPageProps) {
  const [search, setSearch] = React.useState('');

  const filtered = players.filter((p) => {
    const name = (p.name ?? p.discordUsername).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId' params={{ teamId }}>
            ← {m.team_backToTeams()}
          </Link>
        </Button>
        <h1 className='text-2xl font-bold'>{m.members_title()}</h1>
      </header>
      <div className='flex gap-4 mb-4'>
        <Input
          placeholder={m.members_searchPlaceholder()}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='max-w-xs'
        />
      </div>
      {filtered.length === 0 ? (
        <p className='text-muted-foreground'>{m.members_noPlayers()}</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {filtered.map((player) => (
              <PlayerRow
                key={player.memberId}
                player={player}
                teamId={teamId}
                canEdit={canEdit}
                canRemove={canRemove}
                onDeactivate={onDeactivate}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
