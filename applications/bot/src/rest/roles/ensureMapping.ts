import type { Discord, Role, Team } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';
import { createGuildRole } from './createGuildRole.js';

export const ensureMapping = (
  teamId: Team.TeamId,
  roleId: Role.RoleId,
  guildId: Discord.Snowflake,
  roleName: string,
) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Role/GetMapping']({ team_id: teamId, role_id: roleId }),
    ),
    Effect.flatMap(({ cached }) => cached),
    Effect.map(({ discord_role_id }) => discord_role_id),
    Effect.catchTag('NoSuchElementException', () =>
      createGuildRole(teamId, roleId, guildId, roleName),
    ),
  );
