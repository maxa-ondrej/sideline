import type { Roster } from '@sideline/domain';
import { Link } from '@tanstack/react-router';
import { Button } from '~/components/ui/button';
import * as m from '~/paraglide/messages.js';

interface PlayerRowProps {
  player: Roster.RosterPlayer;
  teamId: string;
  isAdmin: boolean;
  onDeactivate: (memberId: string) => void;
}

export function PlayerRow({ player, teamId, isAdmin, onDeactivate }: PlayerRowProps) {
  const displayName = player.name ?? player.discordUsername;
  const roleLabel = player.role === 'admin' ? m.members_admin() : m.members_member();

  return (
    <tr className='border-b'>
      <td className='py-2 px-4'>
        {player.discordAvatar ? (
          <img
            src={`https://cdn.discordapp.com/avatars/${player.userId}/${player.discordAvatar}.png?size=32`}
            alt={displayName}
            className='w-8 h-8 rounded-full inline-block mr-2'
          />
        ) : null}
        {displayName}
      </td>
      <td className='py-2 px-4'>{player.position ?? '—'}</td>
      <td className='py-2 px-4'>
        {player.jerseyNumber !== null ? `#${player.jerseyNumber}` : '—'}
      </td>
      <td className='py-2 px-4'>{roleLabel}</td>
      {isAdmin ? (
        <td className='py-2 px-4 flex gap-2'>
          <Button asChild variant='outline' size='sm'>
            <Link
              to='/teams/$teamId/members/$memberId'
              params={{ teamId, memberId: player.memberId }}
            >
              {m.members_editPlayer()}
            </Link>
          </Button>
          <Button variant='destructive' size='sm' onClick={() => onDeactivate(player.memberId)}>
            {m.members_deactivatePlayer()}
          </Button>
        </td>
      ) : (
        <td className='py-2 px-4' />
      )}
    </tr>
  );
}
