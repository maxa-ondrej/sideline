import type { Roster } from '@sideline/domain';
import React from 'react';
import { PlayerRow } from '~/components/organisms/PlayerRow';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import * as m from '~/paraglide/messages.js';

interface TeamMembersPageProps {
  teamId: string;
  isAdmin: boolean;
  players: ReadonlyArray<Roster.RosterPlayer>;
  onDeactivate: (memberId: string) => void;
}

export function TeamMembersPage({ teamId, isAdmin, players, onDeactivate }: TeamMembersPageProps) {
  const [search, setSearch] = React.useState('');
  const [positionFilter, setPositionFilter] = React.useState<string>('all');

  const filtered = players.filter((p) => {
    const name = (p.name ?? p.discordUsername).toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase());
    const matchesPosition = positionFilter === 'all' || p.position === positionFilter;
    return matchesSearch && matchesPosition;
  });

  return (
    <div className='p-4'>
      <h1 className='text-2xl font-bold mb-4'>{m.members_title()}</h1>
      <div className='flex gap-4 mb-4'>
        <Input
          placeholder={m.members_searchPlaceholder()}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='max-w-xs'
        />
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className='w-48'>
            <SelectValue placeholder={m.members_filterPosition()} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{m.members_filterPosition()}</SelectItem>
            <SelectItem value='goalkeeper'>{m.profile_complete_positionGoalkeeper()}</SelectItem>
            <SelectItem value='defender'>{m.profile_complete_positionDefender()}</SelectItem>
            <SelectItem value='midfielder'>{m.profile_complete_positionMidfielder()}</SelectItem>
            <SelectItem value='forward'>{m.profile_complete_positionForward()}</SelectItem>
          </SelectContent>
        </Select>
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
                isAdmin={isAdmin}
                onDeactivate={onDeactivate}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
