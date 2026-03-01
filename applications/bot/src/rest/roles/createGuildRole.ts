import type { Discord, Role, Team } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';
import { retryPolicy } from '../utils.js';

export const createGuildRole = (
  teamId: Team.TeamId,
  roleId: Role.RoleId,
  guildId: Discord.Snowflake,
  roleName: string,
) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('role', ({ rest }) => rest.createGuildRole(guildId, { name: roleName })),
    Effect.retry(retryPolicy),
    Effect.tap(({ role }) =>
      Effect.log(`Auto-created Discord role "${roleName}" (${role.id}) in guild ${guildId}`),
    ),
    Effect.flatMap(({ role, rpc }) =>
      rpc['Role/UpsertMapping']({
        team_id: teamId,
        role_id: roleId,
        discord_role_id: role.id as Discord.Snowflake,
      }).pipe(Effect.map(() => role.id)),
    ),
  );
