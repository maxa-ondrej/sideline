import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { TeamId } from '~/models/Team.js';

export const RoleId = Schema.String.pipe(Schema.brand('RoleId'));
export type RoleId = typeof RoleId.Type;

export const Permission = Schema.Literal(
  'team:manage',
  'team:invite',
  'roster:view',
  'roster:manage',
  'member:view',
  'member:edit',
  'member:remove',
  'role:view',
  'role:manage',
);
export type Permission = typeof Permission.Type;

export const allPermissions: ReadonlyArray<Permission> =
  Permission.literals as ReadonlyArray<Permission>;

export const defaultPermissions: Record<string, ReadonlyArray<Permission>> = {
  Admin: [
    'team:manage',
    'team:invite',
    'roster:view',
    'roster:manage',
    'member:view',
    'member:edit',
    'member:remove',
    'role:view',
    'role:manage',
  ],
  Captain: ['roster:view', 'roster:manage', 'member:view', 'member:edit', 'role:view'],
  Player: ['roster:view', 'member:view'],
};

export const builtInRoleNames = ['Admin', 'Captain', 'Player'] as const;

export class Role extends Model.Class<Role>('Role')({
  id: Model.Generated(RoleId),
  team_id: TeamId,
  name: Schema.String,
  is_built_in: Schema.Boolean,
  created_at: Model.DateTimeInsertFromDate,
}) {}

export class RolePermission extends Schema.Class<RolePermission>('RolePermission')({
  role_id: RoleId,
  permission: Permission,
}) {}
