import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import type { RoleApi, Roster } from '@sideline/domain';
import { Link } from '@tanstack/react-router';
import { Schema } from 'effect';
import React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import * as m from '~/paraglide/messages.js';

const PlayerEditSchema = Schema.Struct({
  name: Schema.NullOr(Schema.String),
  birthYear: Schema.NullOr(Schema.NumberFromString),
  gender: Schema.NullOr(Schema.Literal('male', 'female', 'other')),
  jerseyNumber: Schema.NullOr(Schema.NumberFromString.pipe(Schema.int(), Schema.between(0, 99))),
});

export type PlayerEditValues = Schema.Schema.Type<typeof PlayerEditSchema>;

interface PlayerDetailPageProps {
  teamId: string;
  player: Roster.RosterPlayer;
  canEdit: boolean;
  canManageRoles: boolean;
  availableRoles: ReadonlyArray<RoleApi.RoleInfo>;
  onSave: (values: PlayerEditValues) => Promise<void>;
  onAssignRole: (roleId: string) => Promise<void>;
  onUnassignRole: (roleId: string) => Promise<void>;
}

export function PlayerDetailPage({
  teamId,
  player,
  canEdit,
  canManageRoles,
  availableRoles,
  onSave,
  onAssignRole,
  onUnassignRole,
}: PlayerDetailPageProps) {
  const form = useForm({
    resolver: effectTsResolver(PlayerEditSchema),
    mode: 'onChange',
    defaultValues: {
      name: player.name,
      birthYear: player.birthYear !== null ? String(player.birthYear) : null,
      gender: player.gender,
      jerseyNumber: player.jerseyNumber !== null ? String(player.jerseyNumber) : null,
    },
  });

  const displayName = player.name ?? player.discordUsername;

  return (
    <div>
      <header className='mb-8'>
        <Button asChild variant='ghost' size='sm' className='mb-2'>
          <Link to='/teams/$teamId/members' params={{ teamId }}>
            ← {m.members_backToMembers()}
          </Link>
        </Button>
        <h1 className='text-2xl font-bold'>{displayName}</h1>
      </header>
      {canEdit ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className='flex flex-col gap-4'>
            <FormField
              {...form.register('name')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.profile_complete_displayName()}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              {...form.register('birthYear')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.profile_complete_birthYear()}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={m.profile_complete_birthYearPlaceholder()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              {...form.register('gender')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.profile_complete_gender()}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={m.profile_complete_genderPlaceholder()} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='male'>{m.profile_complete_genderMale()}</SelectItem>
                      <SelectItem value='female'>{m.profile_complete_genderFemale()}</SelectItem>
                      <SelectItem value='other'>{m.profile_complete_genderOther()}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              {...form.register('jerseyNumber')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{m.profile_complete_jerseyNumber()}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={m.profile_complete_jerseyNumberPlaceholder()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type='submit' disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? m.members_saving() : m.members_saveChanges()}
            </Button>
          </form>
        </Form>
      ) : (
        <div className='flex flex-col gap-2'>
          <p>
            <strong>{m.profile_complete_jerseyNumber()}:</strong>{' '}
            {player.jerseyNumber !== null ? `#${player.jerseyNumber}` : '—'}
          </p>
        </div>
      )}
      <RolesSection
        player={player}
        canManageRoles={canManageRoles}
        availableRoles={availableRoles}
        onAssignRole={onAssignRole}
        onUnassignRole={onUnassignRole}
      />
    </div>
  );
}

function RolesSection({
  player,
  canManageRoles,
  availableRoles,
  onAssignRole,
  onUnassignRole,
}: {
  player: Roster.RosterPlayer;
  canManageRoles: boolean;
  availableRoles: ReadonlyArray<RoleApi.RoleInfo>;
  onAssignRole: (roleId: string) => Promise<void>;
  onUnassignRole: (roleId: string) => Promise<void>;
}) {
  const [selectedRoleId, setSelectedRoleId] = React.useState('');
  const [assigning, setAssigning] = React.useState(false);

  const assignableRoles = availableRoles.filter((r) => !player.roleNames.includes(r.name));

  const handleAssign = React.useCallback(async () => {
    if (!selectedRoleId) return;
    setAssigning(true);
    await onAssignRole(selectedRoleId);
    setSelectedRoleId('');
    setAssigning(false);
  }, [selectedRoleId, onAssignRole]);

  return (
    <div className='mt-6'>
      <h2 className='text-lg font-semibold mb-2'>{m.roles_currentRoles()}</h2>
      {player.roleNames.length === 0 ? (
        <p className='text-muted-foreground'>{m.roles_noRoles()}</p>
      ) : (
        <div className='flex flex-wrap gap-2 mb-4'>
          {player.roleNames.map((roleName) => {
            const roleInfo = availableRoles.find((r) => r.name === roleName);
            return (
              <span
                key={roleName}
                className='inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm'
              >
                {roleName}
                {canManageRoles && roleInfo ? (
                  <button
                    type='button'
                    className='ml-1 text-muted-foreground hover:text-destructive'
                    onClick={() => onUnassignRole(roleInfo.roleId)}
                  >
                    x
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      )}
      {canManageRoles && assignableRoles.length > 0 ? (
        <div className='flex gap-2 items-end'>
          <Select onValueChange={setSelectedRoleId} value={selectedRoleId}>
            <SelectTrigger className='w-48'>
              <SelectValue placeholder={m.roles_addRole()} />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((r) => (
                <SelectItem key={r.roleId} value={r.roleId}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size='sm' disabled={!selectedRoleId || assigning} onClick={handleAssign}>
            {m.roles_addRole()}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
