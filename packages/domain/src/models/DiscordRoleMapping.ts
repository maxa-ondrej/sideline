import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { RoleId } from '~/models/Role.js';
import { TeamId } from '~/models/Team.js';

export const DiscordRoleMappingId = Schema.String.pipe(Schema.brand('DiscordRoleMappingId'));
export type DiscordRoleMappingId = typeof DiscordRoleMappingId.Type;

export class DiscordRoleMapping extends Model.Class<DiscordRoleMapping>('DiscordRoleMapping')({
  id: Model.Generated(DiscordRoleMappingId),
  team_id: TeamId,
  role_id: RoleId,
  discord_role_id: Schema.String,
  created_at: Model.DateTimeInsertFromDate,
}) {}
