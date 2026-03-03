import type { GroupApi, RoleApi, Roster as RosterDomain } from '@sideline/domain';
import { Discord, GroupModel, Role, Team, TeamMember } from '@sideline/domain';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import React from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { ApiClient, ClientError, useRun } from '~/lib/runtime';
import * as m from '~/paraglide/messages.js';

interface GroupDetailPageProps {
  teamId: string;
  groupId: string;
  groupDetail: GroupApi.GroupDetail;
  allMembers: ReadonlyArray<RosterDomain.RosterPlayer>;
  allRoles: ReadonlyArray<RoleApi.RoleInfo>;
  channelMapping: GroupApi.ChannelMappingInfo | null;
}

export function GroupDetailPage({
  teamId,
  groupId,
  groupDetail,
  allMembers,
  allRoles,
  channelMapping,
}: GroupDetailPageProps) {
  const run = useRun();
  const router = useRouter();
  const navigate = useNavigate();

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const groupIdBranded = Schema.decodeSync(GroupModel.GroupId)(groupId);

  const [name, setName] = React.useState(groupDetail.name);
  const [emoji, setEmoji] = React.useState(groupDetail.emoji ?? '');
  const [saving, setSaving] = React.useState(false);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = React.useState<string>('');
  const [channelIdInput, setChannelIdInput] = React.useState('');

  const memberIdsInGroup = new Set(groupDetail.members.map((m) => m.memberId));
  const availableMembers = allMembers.filter((m) => !memberIdsInGroup.has(m.memberId));

  const roleIdsInGroup = new Set(groupDetail.roles.map((r) => r.roleId));
  const availableRoles = allRoles.filter((r) => !roleIdsInGroup.has(r.roleId));

  const handleSaveName = React.useCallback(async () => {
    setSaving(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.updateGroup({
          path: { teamId: teamIdBranded, groupId: groupIdBranded },
          payload: { name, emoji: emoji || null },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_updateFailed())),
      run,
    );
    setSaving(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, groupIdBranded, name, emoji, run, router]);

  const handleAddMember = React.useCallback(async () => {
    if (!selectedMemberId) return;
    const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(selectedMemberId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.addGroupMember({
          path: { teamId: teamIdBranded, groupId: groupIdBranded },
          payload: { memberId },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_updateFailed())),
      run,
    );
    if (Option.isSome(result)) {
      setSelectedMemberId('');
      toast.success(m.group_memberAdded());
      router.invalidate();
    }
  }, [selectedMemberId, teamIdBranded, groupIdBranded, run, router]);

  const handleRemoveMember = React.useCallback(
    async (memberIdRaw: string) => {
      const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(memberIdRaw);
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.group.removeGroupMember({
            path: { teamId: teamIdBranded, groupId: groupIdBranded, memberId },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.group_updateFailed())),
        run,
      );
      if (Option.isSome(result)) {
        toast.success(m.group_memberRemoved());
        router.invalidate();
      }
    },
    [teamIdBranded, groupIdBranded, run, router],
  );

  const handleAssignRole = React.useCallback(async () => {
    if (!selectedRoleId) return;
    const roleId = Schema.decodeSync(Role.RoleId)(selectedRoleId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.assignGroupRole({
          path: { teamId: teamIdBranded, groupId: groupIdBranded },
          payload: { roleId },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_updateFailed())),
      run,
    );
    if (Option.isSome(result)) {
      setSelectedRoleId('');
      router.invalidate();
    }
  }, [selectedRoleId, teamIdBranded, groupIdBranded, run, router]);

  const handleUnassignRole = React.useCallback(
    async (roleIdRaw: string) => {
      const roleId = Schema.decodeSync(Role.RoleId)(roleIdRaw);
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.group.unassignGroupRole({
            path: { teamId: teamIdBranded, groupId: groupIdBranded, roleId },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.group_updateFailed())),
        run,
      );
      if (Option.isSome(result)) {
        router.invalidate();
      }
    },
    [teamIdBranded, groupIdBranded, run, router],
  );

  const handleDelete = React.useCallback(async () => {
    if (!window.confirm(m.group_deleteGroupConfirm())) return;
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.deleteGroup({
          path: { teamId: teamIdBranded, groupId: groupIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_deleteFailed())),
      run,
    );
    if (Option.isSome(result)) {
      toast.success(m.group_groupDeleted());
      navigate({ to: '/teams/$teamId/groups', params: { teamId } });
    }
  }, [teamId, teamIdBranded, groupIdBranded, run, navigate]);

  const handleLinkChannel = React.useCallback(async () => {
    if (!channelIdInput.trim()) return;
    const discordChannelId = Schema.decodeSync(Discord.Snowflake)(channelIdInput.trim());
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.setChannelMapping({
          path: { teamId: teamIdBranded, groupId: groupIdBranded },
          payload: { discordChannelId },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_channelLinkFailed())),
      run,
    );
    if (Option.isSome(result)) {
      setChannelIdInput('');
      toast.success(m.group_channelLinked());
      router.invalidate();
    }
  }, [channelIdInput, teamIdBranded, groupIdBranded, run, router]);

  const handleUnlinkChannel = React.useCallback(async () => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.deleteChannelMapping({
          path: { teamId: teamIdBranded, groupId: groupIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_channelLinkFailed())),
      run,
    );
    if (Option.isSome(result)) {
      toast.success(m.group_channelUnlinked());
      router.invalidate();
    }
  }, [teamIdBranded, groupIdBranded, run, router]);

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId/groups' params={{ teamId }}>
            ← {m.group_backToGroups()}
          </Link>
        </Button>
        <h1 className='text-2xl font-bold'>{groupDetail.name}</h1>
      </header>

      <div className='flex flex-col gap-6'>
        {/* Rename / Emoji */}
        <div>
          <label htmlFor='group-name' className='text-sm font-medium mb-1 block'>
            {m.group_rename()}
          </label>
          <div className='flex gap-2'>
            <Input
              id='group-emoji'
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className='w-16'
              placeholder='Emoji'
            />
            <Input
              id='group-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='flex-1'
            />
            <Button
              onClick={handleSaveName}
              disabled={
                saving && name === groupDetail.name && (emoji || null) === groupDetail.emoji
              }
            >
              {saving ? m.group_saving() : m.group_saveChanges()}
            </Button>
          </div>
        </div>

        {/* Roles */}
        <div>
          <p className='text-sm font-medium mb-2'>{m.group_roles()}</p>
          <div className='flex gap-2 mb-4'>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger className='flex-1'>
                <SelectValue placeholder={m.group_assignRole()} />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.roleId} value={role.roleId}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssignRole} disabled={!selectedRoleId}>
              {m.group_assignRole()}
            </Button>
          </div>

          {groupDetail.roles.length === 0 ? (
            <p className='text-muted-foreground'>{m.roles_noRoles()}</p>
          ) : (
            <table className='w-full'>
              <tbody>
                {groupDetail.roles.map((role) => (
                  <tr key={role.roleId} className='border-b'>
                    <td className='py-2 px-4'>{role.roleName}</td>
                    <td className='py-2 px-4'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleUnassignRole(role.roleId)}
                      >
                        {m.group_unassignRole()}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Discord Channel */}
        <div>
          <p className='text-sm font-medium mb-2'>{m.group_discordChannel()}</p>
          {channelMapping ? (
            <div className='flex items-center gap-2'>
              <span className='text-sm'>
                {m.group_discordChannelId()}: <code>{channelMapping.discordChannelId}</code>
                {channelMapping.discordRoleId && (
                  <>
                    {' '}
                    (Role: <code>{channelMapping.discordRoleId}</code>)
                  </>
                )}
              </span>
              <Button variant='outline' size='sm' onClick={handleUnlinkChannel}>
                {m.group_unlinkChannel()}
              </Button>
            </div>
          ) : (
            <div className='flex gap-2'>
              <Input
                value={channelIdInput}
                onChange={(e) => setChannelIdInput(e.target.value)}
                placeholder={m.group_discordChannelIdPlaceholder()}
                className='max-w-xs'
              />
              <Button onClick={handleLinkChannel} disabled={!channelIdInput.trim()}>
                {m.group_linkChannel()}
              </Button>
            </div>
          )}
        </div>

        {/* Members */}
        <div>
          <p className='text-sm font-medium mb-2'>{m.group_members()}</p>
          <div className='flex gap-2 mb-4'>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className='flex-1'>
                <SelectValue placeholder={m.group_addMember()} />
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
              {m.group_addMember()}
            </Button>
          </div>

          {groupDetail.members.length === 0 ? (
            <p className='text-muted-foreground'>{m.members_noPlayers()}</p>
          ) : (
            <table className='w-full'>
              <tbody>
                {groupDetail.members.map((member) => (
                  <tr key={member.memberId} className='border-b'>
                    <td className='py-2 px-4'>{member.name ?? member.discordUsername}</td>
                    <td className='py-2 px-4'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleRemoveMember(member.memberId)}
                      >
                        {m.group_removeMember()}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Delete */}
        <div>
          <Button variant='destructive' onClick={handleDelete}>
            {m.group_deleteGroup()}
          </Button>
        </div>
      </div>
    </div>
  );
}
