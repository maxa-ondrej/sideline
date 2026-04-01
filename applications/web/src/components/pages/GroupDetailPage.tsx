import type { GroupApi, RoleApi, Roster as RosterDomain } from '@sideline/domain';
import { Discord, GroupModel, Role, Team, TeamMember } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { Loader2 } from 'lucide-react';
import React from 'react';

import { ColorPicker } from '~/components/atoms/ColorPicker.js';
import { DiscordChannelLink } from '~/components/atoms/DiscordChannelLink.js';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
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

interface GroupDetailPageProps {
  teamId: string;
  groupId: string;
  groupDetail: GroupApi.GroupDetail;
  allMembers: ReadonlyArray<RosterDomain.RosterPlayer>;
  allRoles: ReadonlyArray<RoleApi.RoleInfo>;
  channelMapping: Option.Option<GroupApi.ChannelMappingInfo>;
  allGroups: ReadonlyArray<GroupApi.GroupInfo>;
  discordChannels: ReadonlyArray<GroupApi.DiscordChannelInfo>;
  guildId: Option.Option<string>;
}

export function GroupDetailPage({
  teamId,
  groupId,
  groupDetail,
  allMembers,
  allRoles,
  channelMapping,
  allGroups,
  discordChannels,
  guildId,
}: GroupDetailPageProps) {
  const run = useRun();
  const router = useRouter();
  const navigate = useNavigate();

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const groupIdBranded = Schema.decodeSync(GroupModel.GroupId)(groupId);

  const [name, setName] = React.useState(groupDetail.name);
  const [emoji, setEmoji] = React.useState(Option.getOrElse(groupDetail.emoji, () => ''));
  const [color, setColor] = React.useState<string | undefined>(
    Option.getOrUndefined(groupDetail.color),
  );
  const [saving, setSaving] = React.useState(false);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = React.useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = React.useState('');
  const [parentGroupId, setParentGroupId] = React.useState<string>(
    Option.getOrElse(groupDetail.parentId, () => '__root__'),
  );

  React.useEffect(() => {
    if (!groupDetail.discordChannelProvisioning) return;
    const id = setInterval(() => {
      router.invalidate();
    }, 5000);
    return () => clearInterval(id);
  }, [groupDetail.discordChannelProvisioning, router]);

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
          payload: {
            name,
            emoji: emoji ? Option.some(emoji) : Option.none(),
            color: color ? Option.some(color) : Option.none(),
          },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_updateFailed())),
      run({ success: m.group_groupSaved() }),
    );
    setSaving(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, groupIdBranded, name, emoji, color, run, router]);

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
      run({ success: m.group_memberAdded() }),
    );
    if (Option.isSome(result)) {
      setSelectedMemberId('');
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
        run({ success: m.group_memberRemoved() }),
      );
      if (Option.isSome(result)) {
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
      run({ success: m.group_roleAssigned() }),
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
        run({ success: m.group_roleUnassigned() }),
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
      run({ success: m.group_groupDeleted() }),
    );
    if (Option.isSome(result)) {
      navigate({ to: '/teams/$teamId/groups', params: { teamId } });
    }
  }, [teamId, teamIdBranded, groupIdBranded, run, navigate]);

  const handleLinkChannel = React.useCallback(async () => {
    if (!selectedChannelId) return;
    const discordChannelId = Schema.decodeSync(Discord.Snowflake)(selectedChannelId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.setChannelMapping({
          path: { teamId: teamIdBranded, groupId: groupIdBranded },
          payload: { discordChannelId },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_channelLinkFailed())),
      run({ success: m.group_channelLinked() }),
    );
    if (Option.isSome(result)) {
      setSelectedChannelId('');
      router.invalidate();
    }
  }, [selectedChannelId, teamIdBranded, groupIdBranded, run, router]);

  const handleUnlinkChannel = React.useCallback(async () => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.deleteChannelMapping({
          path: { teamId: teamIdBranded, groupId: groupIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_channelLinkFailed())),
      run({ success: m.group_channelUnlinked() }),
    );
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, groupIdBranded, run, router]);

  const handleMoveGroup = React.useCallback(
    async (newParentId: string) => {
      const parentId =
        newParentId === '__root__'
          ? Option.none()
          : Option.some(Schema.decodeSync(GroupModel.GroupId)(newParentId));
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.group.moveGroup({
            path: { teamId: teamIdBranded, groupId: groupIdBranded },
            payload: { parentId },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.group_moveGroupFailed())),
        run({ success: m.group_parentChanged() }),
      );
      if (Option.isSome(result)) {
        router.invalidate();
      }
    },
    [teamIdBranded, groupIdBranded, run, router],
  );

  const handleCreateChannel = React.useCallback(async () => {
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.group.createChannel({
          path: { teamId: teamIdBranded, groupId: groupIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.group_channelCreateFailed())),
      run({ success: m.group_channelCreateRequested() }),
    );
    if (Option.isSome(result)) {
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
        {/* Rename / Emoji / Color */}
        <div>
          <label htmlFor='group-name' className='text-sm font-medium mb-1 block'>
            {m.group_nameEmojiColor()}
          </label>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <div className='flex gap-2 flex-1'>
              <Input
                id='group-emoji'
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className='w-16 shrink-0'
                placeholder='Emoji'
              />
              <ColorPicker value={color} onChange={setColor} />
              <Input
                id='group-name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                className='flex-1'
              />
            </div>
            <Button
              onClick={handleSaveName}
              disabled={
                saving &&
                name === groupDetail.name &&
                (emoji || null) === Option.getOrNull(groupDetail.emoji)
              }
            >
              {saving ? m.group_saving() : m.group_saveChanges()}
            </Button>
          </div>
        </div>

        {/* Parent Group */}
        <div>
          <label htmlFor='parent-group' className='text-sm font-medium mb-1 block'>
            {m.group_parentGroup()}
          </label>
          <div className='flex gap-2'>
            <Select
              value={parentGroupId}
              onValueChange={(value) => {
                setParentGroupId(value);
                handleMoveGroup(value);
              }}
            >
              <SelectTrigger className='flex-1'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__root__'>{m.group_rootGroup()}</SelectItem>
                {allGroups
                  .filter((g) => g.groupId !== groupId)
                  .map((g) => (
                    <SelectItem key={g.groupId} value={g.groupId}>
                      {g.emoji.pipe(
                        Option.map((v) => `${v} ${g.name}`),
                        Option.getOrElse(() => g.name),
                      )}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
        <Card className='max-w-md'>
          <CardHeader>
            <CardTitle className='text-base'>{m.group_discordChannel()}</CardTitle>
          </CardHeader>
          <CardContent>
            {groupDetail.discordChannelProvisioning ? (
              <div className='flex flex-col items-center gap-2 py-4'>
                <Loader2 className='size-5 animate-spin text-muted-foreground' />
                <p className='text-sm font-medium'>{m.discord_channelProvisioning()}</p>
                <p className='text-xs text-muted-foreground'>
                  {m.discord_channelProvisioningHint()}
                </p>
              </div>
            ) : Option.isSome(channelMapping) ? (
              <div className='flex items-center justify-between'>
                {Option.isSome(guildId) ? (
                  <DiscordChannelLink
                    guildId={guildId.value}
                    channelId={channelMapping.value.discordChannelId}
                    channelName={Option.getOrElse(
                      channelMapping.value.discordChannelName,
                      () => channelMapping.value.discordChannelId,
                    )}
                  />
                ) : (
                  <span className='text-sm font-medium'>
                    #{' '}
                    {Option.getOrElse(
                      channelMapping.value.discordChannelName,
                      () => channelMapping.value.discordChannelId,
                    )}
                  </span>
                )}
                <Button variant='outline' size='sm' onClick={handleUnlinkChannel}>
                  {m.group_unlinkChannel()}
                </Button>
              </div>
            ) : (
              <div className='flex flex-col gap-4'>
                <Button className='w-full' onClick={handleCreateChannel}>
                  {m.group_createChannel()}
                </Button>

                <div className='relative'>
                  <div className='absolute inset-0 flex items-center'>
                    <Separator className='w-full' />
                  </div>
                  <div className='relative flex justify-center text-xs uppercase'>
                    <span className='bg-card px-2 text-muted-foreground'>
                      {m.group_orLinkExisting()}
                    </span>
                  </div>
                </div>

                <div className='flex gap-2'>
                  <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                    <SelectTrigger className='flex-1'>
                      <SelectValue placeholder={m.group_selectChannel()} />
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
                  <Button onClick={handleLinkChannel} disabled={!selectedChannelId}>
                    {m.group_linkChannel()}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
                    {Option.getOrElse(member.name, () => member.username)}
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
                    <td className='py-2 px-4'>
                      {Option.getOrElse(member.name, () => member.username)}
                    </td>
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
