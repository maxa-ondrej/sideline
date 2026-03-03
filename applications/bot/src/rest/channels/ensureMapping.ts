import type { Discord as DiscordSchemas, GroupModel, Team } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Discord from 'dfx/types';
import { Effect } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';
import { READ_WRITE } from '../permissions.js';
import { allow, retryPolicy } from '../utils.js';
import { createChannelWithRole } from './createChannelWithRole.js';

const createRoleForExistingChannel = (
  teamId: Team.TeamId,
  groupId: GroupModel.GroupId,
  guildId: DiscordSchemas.Snowflake,
  channelId: DiscordSchemas.Snowflake,
  channelName: string,
) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('role', ({ rest }) =>
      rest.createGuildRole(guildId, { name: channelName }).pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ role }) =>
      Effect.logInfo(`Auto-created Discord role "${channelName}" (${role.id}) in guild ${guildId}`),
    ),
    Effect.tap(({ role, rest }) =>
      rest
        .setChannelPermissionOverwrite(channelId, role.id, {
          type: Discord.ChannelPermissionOverwrites.ROLE,
          allow: allow(READ_WRITE),
        })
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ role, rpc }) =>
      rpc['Channel/UpsertMapping']({
        team_id: teamId,
        group_id: groupId,
        discord_channel_id: channelId,
        discord_role_id: role.id as DiscordSchemas.Snowflake,
      }),
    ),
    Effect.map(({ role }) => ({
      discord_channel_id: channelId,
      discord_role_id: role.id,
    })),
  );

export const ensureMapping = (
  teamId: Team.TeamId,
  groupId: GroupModel.GroupId,
  guildId: DiscordSchemas.Snowflake,
  groupName: string,
) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Channel/GetMapping']({ team_id: teamId, group_id: groupId }),
    ),
    Effect.flatMap(({ cached }) =>
      cached.pipe(
        Effect.flatMap((mapping) =>
          mapping.discord_role_id.pipe(
            Effect.map((roleId) => ({
              discord_channel_id: mapping.discord_channel_id,
              discord_role_id: roleId,
            })),
            Effect.catchTag('NoSuchElementException', () =>
              createRoleForExistingChannel(
                teamId,
                groupId,
                guildId,
                mapping.discord_channel_id,
                groupName,
              ),
            ),
          ),
        ),
        Effect.catchTag('NoSuchElementException', () =>
          createChannelWithRole(teamId, groupId, guildId, groupName),
        ),
      ),
    ),
  );
