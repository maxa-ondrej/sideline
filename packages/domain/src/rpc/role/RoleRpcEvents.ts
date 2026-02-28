import { Schema } from 'effect';
import { Discord, Role, RoleSyncEvent, Team, TeamMember } from '~/index.js';

export class RoleCreatedEvent extends Schema.TaggedClass<RoleCreatedEvent>()('role_created', {
  id: RoleSyncEvent.RoleSyncEventId,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  role_id: Role.RoleId,
  role_name: Schema.String,
}) {}

export class RoleDeletedEvent extends Schema.TaggedClass<RoleDeletedEvent>()('role_deleted', {
  id: RoleSyncEvent.RoleSyncEventId,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  role_id: Role.RoleId,
}) {}

export class RoleAssignedEvent extends Schema.TaggedClass<RoleAssignedEvent>()('role_assigned', {
  id: RoleSyncEvent.RoleSyncEventId,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  role_id: Role.RoleId,
  role_name: Schema.String,
  team_member_id: TeamMember.TeamMemberId,
  discord_user_id: Discord.Snowflake,
}) {}

export class RoleUnassignedEvent extends Schema.TaggedClass<RoleUnassignedEvent>()(
  'role_unassigned',
  {
    id: RoleSyncEvent.RoleSyncEventId,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    role_id: Role.RoleId,
    team_member_id: TeamMember.TeamMemberId,
    discord_user_id: Discord.Snowflake,
  },
) {}

export const UnprocessedRoleEvent = Schema.Union(
  RoleCreatedEvent,
  RoleDeletedEvent,
  RoleAssignedEvent,
  RoleUnassignedEvent,
);

export type UnprocessedRoleEvent = Schema.Schema.Type<typeof UnprocessedRoleEvent>;
