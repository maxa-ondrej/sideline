import { Schema } from 'effect';
import { Discord, DiscordRoleMapping, Role, Team } from '~/index.js';

export class RoleMapping extends Schema.Class<RoleMapping>('RoleMapping')({
  id: DiscordRoleMapping.DiscordRoleMappingId,
  team_id: Team.TeamId,
  role_id: Role.RoleId,
  discord_role_id: Discord.Snowflake,
}) {}
