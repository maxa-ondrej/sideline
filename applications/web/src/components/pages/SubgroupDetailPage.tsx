import type { Roster as RosterDomain, SubgroupApi } from '@sideline/domain';
import { Role, SubgroupModel, Team, TeamMember } from '@sideline/domain';
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

const permissionLabels: Record<Role.Permission, () => string> = {
  'team:manage': m.role_perm_teamManage,
  'team:invite': m.role_perm_teamInvite,
  'roster:view': m.role_perm_rosterView,
  'roster:manage': m.role_perm_rosterManage,
  'member:view': m.role_perm_memberView,
  'member:edit': m.role_perm_memberEdit,
  'member:remove': m.role_perm_memberRemove,
  'role:view': m.role_perm_roleView,
  'role:manage': m.role_perm_roleManage,
};

interface SubgroupDetailPageProps {
  teamId: string;
  subgroupId: string;
  subgroupDetail: SubgroupApi.SubgroupDetail;
  allMembers: ReadonlyArray<RosterDomain.RosterPlayer>;
}

export function SubgroupDetailPage({
  teamId,
  subgroupId,
  subgroupDetail,
  allMembers,
}: SubgroupDetailPageProps) {
  const run = useRun();
  const router = useRouter();
  const navigate = useNavigate();

  const teamIdBranded = Schema.decodeSync(Team.TeamId)(teamId);
  const subgroupIdBranded = Schema.decodeSync(SubgroupModel.SubgroupId)(subgroupId);

  const [name, setName] = React.useState(subgroupDetail.name);
  const [permissions, setPermissions] = React.useState<ReadonlyArray<Role.Permission>>(
    subgroupDetail.permissions,
  );
  const [saving, setSaving] = React.useState(false);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');

  const memberIdsInSubgroup = new Set(subgroupDetail.members.map((m) => m.memberId));
  const availableMembers = allMembers.filter((m) => !memberIdsInSubgroup.has(m.memberId));

  const togglePermission = React.useCallback((perm: Role.Permission) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  }, []);

  const handleSaveName = React.useCallback(async () => {
    setSaving(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.subgroup.updateSubgroup({
          path: { teamId: teamIdBranded, subgroupId: subgroupIdBranded },
          payload: { name },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.subgroup_updateFailed())),
      run,
    );
    setSaving(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, subgroupIdBranded, name, run, router]);

  const handleSavePermissions = React.useCallback(async () => {
    setSaving(true);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.subgroup.setSubgroupPermissions({
          path: { teamId: teamIdBranded, subgroupId: subgroupIdBranded },
          payload: { permissions: [...permissions] },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.subgroup_updateFailed())),
      run,
    );
    setSaving(false);
    if (Option.isSome(result)) {
      router.invalidate();
    }
  }, [teamIdBranded, subgroupIdBranded, permissions, run, router]);

  const handleAddMember = React.useCallback(async () => {
    if (!selectedMemberId) return;
    const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(selectedMemberId);
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.subgroup.addSubgroupMember({
          path: { teamId: teamIdBranded, subgroupId: subgroupIdBranded },
          payload: { memberId },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.subgroup_updateFailed())),
      run,
    );
    if (Option.isSome(result)) {
      setSelectedMemberId('');
      toast.success(m.subgroup_memberAdded());
      router.invalidate();
    }
  }, [selectedMemberId, teamIdBranded, subgroupIdBranded, run, router]);

  const handleRemoveMember = React.useCallback(
    async (memberIdRaw: string) => {
      const memberId = Schema.decodeSync(TeamMember.TeamMemberId)(memberIdRaw);
      const result = await ApiClient.pipe(
        Effect.flatMap((api) =>
          api.subgroup.removeSubgroupMember({
            path: { teamId: teamIdBranded, subgroupId: subgroupIdBranded, memberId },
          }),
        ),
        Effect.catchAll(() => ClientError.make(m.subgroup_updateFailed())),
        run,
      );
      if (Option.isSome(result)) {
        toast.success(m.subgroup_memberRemoved());
        router.invalidate();
      }
    },
    [teamIdBranded, subgroupIdBranded, run, router],
  );

  const handleDelete = React.useCallback(async () => {
    if (!window.confirm(m.subgroup_deleteSubgroupConfirm())) return;
    const result = await ApiClient.pipe(
      Effect.flatMap((api) =>
        api.subgroup.deleteSubgroup({
          path: { teamId: teamIdBranded, subgroupId: subgroupIdBranded },
        }),
      ),
      Effect.catchAll(() => ClientError.make(m.subgroup_deleteFailed())),
      run,
    );
    if (Option.isSome(result)) {
      toast.success(m.subgroup_subgroupDeleted());
      navigate({ to: '/teams/$teamId/subgroups', params: { teamId } });
    }
  }, [teamId, teamIdBranded, subgroupIdBranded, run, navigate]);

  return (
    <div className='p-4 max-w-lg'>
      <Button asChild variant='ghost' className='mb-4'>
        <Link to='/teams/$teamId/subgroups' params={{ teamId }}>
          ← {m.subgroup_backToSubgroups()}
        </Link>
      </Button>
      <h1 className='text-2xl font-bold mb-6'>{subgroupDetail.name}</h1>

      <div className='flex flex-col gap-6'>
        {/* Rename */}
        <div>
          <label htmlFor='subgroup-name' className='text-sm font-medium mb-1 block'>
            {m.subgroup_rename()}
          </label>
          <div className='flex gap-2'>
            <Input
              id='subgroup-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='flex-1'
            />
            <Button onClick={handleSaveName} disabled={saving || name === subgroupDetail.name}>
              {saving ? m.subgroup_saving() : m.subgroup_saveChanges()}
            </Button>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <p className='text-sm font-medium mb-2'>{m.subgroup_permissions()}</p>
          <div className='flex flex-col gap-2'>
            {Role.allPermissions.map((perm) => (
              <label key={perm} className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={permissions.includes(perm)}
                  onChange={() => togglePermission(perm)}
                  className='rounded'
                />
                <span className='text-sm'>{permissionLabels[perm]()}</span>
              </label>
            ))}
          </div>
          <Button onClick={handleSavePermissions} disabled={saving} className='mt-2'>
            {saving ? m.subgroup_saving() : m.subgroup_saveChanges()}
          </Button>
        </div>

        {/* Members */}
        <div>
          <p className='text-sm font-medium mb-2'>{m.subgroup_members()}</p>
          <div className='flex gap-2 mb-4'>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className='flex-1'>
                <SelectValue placeholder={m.subgroup_addMember()} />
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
              {m.subgroup_addMember()}
            </Button>
          </div>

          {subgroupDetail.members.length === 0 ? (
            <p className='text-muted-foreground'>{m.members_noPlayers()}</p>
          ) : (
            <table className='w-full'>
              <tbody>
                {subgroupDetail.members.map((member) => (
                  <tr key={member.memberId} className='border-b'>
                    <td className='py-2 px-4'>{member.name ?? member.discordUsername}</td>
                    <td className='py-2 px-4'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleRemoveMember(member.memberId)}
                      >
                        {m.subgroup_removeMember()}
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
            {m.subgroup_deleteSubgroup()}
          </Button>
        </div>
      </div>
    </div>
  );
}
