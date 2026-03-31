import type { GroupApi, Roster as RosterDomain } from '@sideline/domain';
import { Discord, RosterModel, Team, TeamMember } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { Loader2 } from 'lucide-react';
import React from 'react';

import { DiscordChannelLink } from '~/components/atoms/DiscordChannelLink.js';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { DISCORD_CHANNEL_TYPE_TEXT } from '~/lib/discord';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';

interface RosterDetailPageProps {
  teamId: string;
  rosterId: string;
  rosterDetail: RosterDomain.RosterDetail;
  allMembers: ReadonlyArray<RosterDomain.RosterPlayer>;
  canManage: boolean;
  userId: string;
  discordChannels: ReadonlyArray<GroupApi.DiscordChannelInfo>;
  guildId: Option.Option<string>;
}

export function RosterDetailPage({
  teamId,
  rosterId,
  rosterDetail,
  allMembers,
  canManage,
  discordChannels,
  guildId,
}: RosterDetailPageProps) {
  const run = useRun();
  const router = useRouter();
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = React.useState('');

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const rosterIdBranded = Schema.decodeSync(RosterModel.RosterId)(rosterId);

  React.useEffect(() => {
    if (!rosterDetail.discordChannelProvisioning) return;
    const id = setInterval(() => {
      router.invalidate();
    }, 5000);
    return () => clearInterval(id);
  }, [rosterDetail.discordChannelProvisioning, router]);

  const memberIdsInRoster = new Set(rosterDetail.members.map((m) => m.memberId));
  const availableMembers = allMembers.filter((m) => !memberIdsInRoster.has(m.memberId));

  const handleToggleActive = React.useCallback(async () => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.roster.updateRoster({
          path: { teamId: teamIdBranded, rosterId: rosterIdBranded },
          payload: {
            name: Option.none(),
            active: Option.some(!rosterDetail.active),
            discordChannelId: Option.none(),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.roster_updateFailed())),
      run({ success: m.roster_rosterUpdated() }),
    );
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, rosterIdBranded, rosterDetail.active, run, router]);

  const handleLinkChannel = React.useCallback(async () => {
    if (!selectedChannelId) return;
    const snowflake = Schema.decodeSync(Discord.Snowflake)(selectedChannelId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.roster.updateRoster({
          path: { teamId: teamIdBranded, rosterId: rosterIdBranded },
          payload: {
            name: Option.none(),
            active: Option.none(),
            discordChannelId: Option.some(Option.some(snowflake)),
          },
        }),
      ),
      Effect.catchTag('ChannelAlreadyLinked', () =>
        ClientError.make(m.roster_channelAlreadyLinked()),
      ),
      Effect.catchAll(() => ClientError.make(m.roster_updateFailed())),
      run({ success: m.roster_channelLinked() }),
    );
    if (Option.isSome(result)) {
      setSelectedChannelId('');
      router.invalidate();
    }
  }, [selectedChannelId, teamIdBranded, rosterIdBranded, run, router]);

  const handleUnlinkChannel = React.useCallback(async () => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.roster.updateRoster({
          path: { teamId: teamIdBranded, rosterId: rosterIdBranded },
          payload: {
            name: Option.none(),
            active: Option.none(),
            discordChannelId: Option.some(Option.none()),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.roster_updateFailed())),
      run({ success: m.roster_channelUnlinked() }),
    );
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, rosterIdBranded, run, router]);

  const handleCreateChannel = React.useCallback(async () => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.roster.createChannel({
          path: { teamId: teamIdBranded, rosterId: rosterIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.roster_channelCreateFailed())),
      run({ success: m.roster_channelCreateRequested() }),
    );
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, rosterIdBranded, run, router]);

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
      run({ success: m.roster_memberAdded() }),
    );
    if (Option.isSome(result)) {
      setSelectedMemberId('');
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
        run({ success: m.roster_memberRemoved() }),
      );
      if (Option.isSome(result)) {
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
      run({ success: m.roster_rosterDeleted() }),
    );
    if (Option.isSome(result)) {
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
        <div className='flex flex-wrap items-center gap-3'>
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
          {canManage && (
            <>
              <Button variant='outline' size='sm' onClick={handleToggleActive}>
                {rosterDetail.active ? m.roster_toggleInactive() : m.roster_toggleActive()}
              </Button>
              <Button variant='destructive' size='sm' onClick={handleDelete}>
                {m.roster_deleteRoster()}
              </Button>
            </>
          )}
        </div>
      </header>

      {canManage && (
        <Card className='mb-6 max-w-md'>
          <CardHeader>
            <CardTitle className='text-base'>{m.roster_discordChannel()}</CardTitle>
          </CardHeader>
          <CardContent>
            {rosterDetail.discordChannelProvisioning ? (
              <div className='flex flex-col items-center gap-2 py-4'>
                <Loader2 className='size-5 animate-spin text-muted-foreground' />
                <p className='text-sm font-medium'>{m.discord_channelProvisioning()}</p>
                <p className='text-xs text-muted-foreground'>
                  {m.discord_channelProvisioningHint()}
                </p>
              </div>
            ) : Option.isSome(rosterDetail.discordChannelId) ? (
              <div className='flex items-center justify-between'>
                {Option.isSome(guildId) ? (
                  <DiscordChannelLink
                    guildId={guildId.value}
                    channelId={Option.getOrElse(rosterDetail.discordChannelId, () => '')}
                    channelName={Option.getOrElse(rosterDetail.discordChannelName, () =>
                      Option.getOrElse(rosterDetail.discordChannelId, () => ''),
                    )}
                  />
                ) : (
                  <span className='text-sm font-medium'>
                    #{' '}
                    {Option.getOrElse(rosterDetail.discordChannelName, () =>
                      Option.getOrElse(rosterDetail.discordChannelId, () => ''),
                    )}
                  </span>
                )}
                <Button variant='outline' size='sm' onClick={handleUnlinkChannel}>
                  {m.roster_unlinkChannel()}
                </Button>
              </div>
            ) : (
              <div className='flex flex-col gap-4'>
                <Button className='w-full' onClick={handleCreateChannel}>
                  {m.roster_createChannel()}
                </Button>

                <div className='relative'>
                  <div className='absolute inset-0 flex items-center'>
                    <Separator className='w-full' />
                  </div>
                  <div className='relative flex justify-center text-xs uppercase'>
                    <span className='bg-card px-2 text-muted-foreground'>
                      {m.roster_orLinkExisting()}
                    </span>
                  </div>
                </div>

                <div className='flex gap-2'>
                  <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                    <SelectTrigger className='flex-1'>
                      <SelectValue placeholder={m.roster_selectChannel()} />
                    </SelectTrigger>
                    <SelectContent>
                      {discordChannels
                        .filter((ch) => ch.type === DISCORD_CHANNEL_TYPE_TEXT)
                        .map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            # {ch.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant='outline'
                    onClick={handleLinkChannel}
                    disabled={!selectedChannelId}
                  >
                    {m.roster_linkChannel()}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <div className='flex gap-2 mb-6 max-w-md'>
          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <SelectTrigger className='flex-1'>
              <SelectValue placeholder={m.roster_addMember()} />
            </SelectTrigger>
            <SelectContent>
              {availableMembers.map((member) => (
                <SelectItem key={member.memberId} value={member.memberId}>
                  {Option.getOrElse(member.name, () => member.username)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddMember} disabled={!selectedMemberId}>
            {m.roster_addMember()}
          </Button>
        </div>
      )}

      {rosterDetail.members.length === 0 ? (
        <p className='text-muted-foreground'>{m.members_noPlayers()}</p>
      ) : (
        <table className='w-full'>
          <tbody>
            {rosterDetail.members.map((player) => {
              const displayName = Option.getOrElse(player.name, () => player.username);
              const jerseyNumber = player.jerseyNumber.pipe(
                Option.map((v) => `#${v}`),
                Option.getOrElse(() => '—'),
              );
              return (
                <tr key={player.memberId} className='border-b'>
                  <td className='py-2 px-4'>
                    <div className='flex items-center gap-2'>
                      <Avatar className='size-8'>
                        {Option.isSome(player.avatar) && (
                          <AvatarImage
                            src={`https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar.value}.png?size=32`}
                            alt={displayName}
                          />
                        )}
                        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className='truncate'>{displayName}</span>
                    </div>
                  </td>
                  <td className='hidden sm:table-cell py-2 px-4'>{jerseyNumber}</td>
                  {canManage && (
                    <td className='py-2 px-4'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleRemoveMember(player.memberId)}
                      >
                        {m.roster_removeMember()}
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
