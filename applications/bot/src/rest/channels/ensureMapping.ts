import type { Discord, SubgroupModel, Team } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';
import { createChannelWithRole } from './createChannelWithRole.js';

export const ensureMapping = (
  teamId: Team.TeamId,
  subgroupId: SubgroupModel.SubgroupId,
  guildId: Discord.Snowflake,
  subgroupName: string,
) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Channel/GetMapping']({ team_id: teamId, subgroup_id: subgroupId }),
    ),
    Effect.bind('mapping', ({ cached }) => cached),
    Effect.bind('roleId', ({ mapping }) => mapping.discord_role_id),
    Effect.map(({ mapping, roleId }) => ({
      discord_channel_id: mapping.discord_channel_id,
      discord_role_id: roleId,
    })),
    Effect.catchTag('NoSuchElementException', () =>
      createChannelWithRole(teamId, subgroupId, guildId, subgroupName),
    ),
  );
