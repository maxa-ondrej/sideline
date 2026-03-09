import type { Roster } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link } from '@tanstack/react-router';
import { Option } from 'effect';
import { Button } from '~/components/ui/button';

interface PlayerRowProps {
  player: Roster.RosterPlayer;
  teamId: string;
  canEdit: boolean;
  canRemove: boolean;
  onDeactivate: (memberId: string) => void;
}

export function PlayerRow({ player, teamId, canEdit, canRemove, onDeactivate }: PlayerRowProps) {
  const displayName = Option.getOrElse(player.name, () => player.username);
  const roleLabel = player.roleNames.join(', ') || '—';

  return (
    <tr className='border-b'>
      <td className='py-2 px-4'>
        {Option.isSome(player.avatar) ? (
          <img
            src={`https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar.value}.png?size=32`}
            alt={displayName}
            className='w-8 h-8 rounded-full inline-block mr-2'
          />
        ) : null}
        {displayName}
      </td>
      <td className='py-2 px-4'>
        {player.jerseyNumber.pipe(
          Option.map((v) => `#${v}`),
          Option.getOrElse(() => '—'),
        )}
      </td>
      <td className='py-2 px-4'>{roleLabel}</td>
      {canEdit || canRemove ? (
        <td className='py-2 px-4 flex gap-2'>
          {canEdit ? (
            <Button asChild variant='outline' size='sm'>
              <Link
                to='/teams/$teamId/members/$memberId'
                params={{ teamId, memberId: player.memberId }}
              >
                {m.members_editPlayer()}
              </Link>
            </Button>
          ) : null}
          {canRemove ? (
            <Button variant='destructive' size='sm' onClick={() => onDeactivate(player.memberId)}>
              {m.members_deactivatePlayer()}
            </Button>
          ) : null}
        </td>
      ) : (
        <td className='py-2 px-4' />
      )}
    </tr>
  );
}
