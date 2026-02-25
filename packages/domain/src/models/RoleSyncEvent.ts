import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { RoleId } from '~/models/Role.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export const RoleSyncEventId = Schema.String.pipe(Schema.brand('RoleSyncEventId'));
export type RoleSyncEventId = typeof RoleSyncEventId.Type;

export const RoleSyncEventType = Schema.Literal(
  'role_assigned',
  'role_unassigned',
  'role_created',
  'role_deleted',
);
export type RoleSyncEventType = typeof RoleSyncEventType.Type;

export class RoleSyncEvent extends Model.Class<RoleSyncEvent>('RoleSyncEvent')({
  id: Model.Generated(RoleSyncEventId),
  team_id: TeamId,
  guild_id: Schema.String,
  event_type: RoleSyncEventType,
  role_id: RoleId,
  role_name: Schema.NullOr(Schema.String),
  team_member_id: Schema.NullOr(TeamMemberId),
  discord_user_id: Schema.NullOr(Schema.String),
  processed_at: Schema.NullOr(Schema.String),
  error: Schema.NullOr(Schema.String),
  created_at: Model.DateTimeInsertFromDate,
}) {}
