import type { Roster as RosterDomain } from '@sideline/domain';
import { RosterModel, Team, TeamMember } from '@sideline/domain';
import { Link, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

interface RosterDetailPageProps {
  teamId: string;
  rosterId: string;
  rosterDetail: RosterDomain.RosterDetail;
  allMembers: ReadonlyArray<RosterDomain.RosterPlayer>;
  userId: string;
}

export function RosterDetailPage({
  teamId,
  rosterId,
  rosterDetail,
  allMembers,
}: RosterDetailPageProps) {
  const run = useRun();
  const router = useRouter();
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const rosterIdBranded = Schema.decodeSync(RosterModel.RosterId)(rosterId);

  const memberIdsInRoster = new Set(rosterDetail.members.map((m) => m.memberId));
  const availableMembers = allMembers.filter((m) => !memberIdsInRoster.has(m.memberId));

  const handleToggleActive = React.useCallback(async () => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.roster.updateRoster({
          path: { teamId: teamIdBranded, rosterId: rosterIdBranded },
          payload: { name: null, active: !rosterDetail.active },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.roster_updateFailed())),
      run,
    );
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, rosterIdBranded, rosterDetail.active, run, router]);

  const handleAddMember = React.useCallback(async () => {
    if (!selectedMemberId) return;
    const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(selectedMemberId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.roster.addRosterMember({
          path: { teamId: teamIdBranded, rosterId: rosterIdBranded },
          payload: { memberId },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.roster_updateFailed())),
      run,
    );
    if (Option.isSome(result)) {
      setSelectedMemberId('');
      toast.success(m.roster_memberAdded());
      router.invalidate();
    }
  }, [selectedMemberId, teamIdBranded, rosterIdBranded, run, router]);

  const handleRemoveMember = React.useCallback(
    async (memberIdRaw: string) => {
      const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(memberIdRaw);
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.roster.removeRosterMember({
            path: { teamId: teamIdBranded, rosterId: rosterIdBranded, memberId },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.roster_updateFailed())),
        run,
      );
      if (Option.isSome(result)) {
        toast.success(m.roster_memberRemoved());
        router.invalidate();
      }
    },
    [teamIdBranded, rosterIdBranded, run, router],
  );

  const handleDelete = React.useCallback(async () => {
    if (!window.confirm(m.roster_deleteRosterConfirm())) return;
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.roster.deleteRoster({
          path: { teamId: teamIdBranded, rosterId: rosterIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.roster_updateFailed())),
      run,
    );
    if (Option.isSome(result)) {
      toast.success(m.roster_rosterDeleted());
      router.navigate({ to: '/teams/$teamId/rosters', params: { teamId } });
    }
  }, [teamId, teamIdBranded, rosterIdBranded, run, router]);

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId/rosters' params={{ teamId }}>
            ← {m.roster_backToRosters()}
          </Link>
        </Button>
        <div className='flex items-center gap-4'>
          <h1 className='text-2xl font-bold'>{rosterDetail.name}</h1>
          <span
            className={
              rosterDetail.active
                ? 'text-green-700 font-medium'
                : 'text-muted-foreground font-medium'
            }
          >
            {rosterDetail.active ? m.roster_active() : m.roster_inactive()}
          </span>
          <Button variant='outline' size='sm' onClick={handleToggleActive}>
            {rosterDetail.active ? m.roster_toggleInactive() : m.roster_toggleActive()}
          </Button>
          <Button variant='destructive' size='sm' onClick={handleDelete}>
            {m.roster_deleteRoster()}
          </Button>
        </div>
      </header>

      <div className='flex gap-2 mb-6 max-w-md'>
        <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
          <SelectTrigger className='flex-1'>
            <SelectValue placeholder={m.roster_addMember()} />
          </SelectTrigger>
          <SelectContent>
            {availableMembers.map((member) => (
              <SelectItem key={member.memberId} value={member.memberId}>
                {member.name ?? member.discordUsername}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAddMember} disabled={!selectedMemberId}>
          {m.roster_addMember()}
        </Button>
      </div>

      {rosterDetail.members.length === 0 ? (
        <p className='text-muted-foreground'>{m.members_noPlayers()}</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {rosterDetail.members.map((player) => {
              const displayName = player.name ?? player.discordUsername;
              return (
                <tr key={player.memberId} className='border-b'>
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
                  <td className='py-2 px-4'>
                    {player.jerseyNumber !== null ? `#${player.jerseyNumber}` : '—'}
                  </td>
                  <td className='py-2 px-4'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleRemoveMember(player.memberId)}
                    >
                      {m.roster_removeMember()}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
