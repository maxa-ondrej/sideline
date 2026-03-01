import type { Discord as DiscordSchemas, SubgroupModel, Team } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Discord from 'dfx/types';
import { Effect } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';
import { HIDDEN, READ_WRITE } from '../permissions.js';
import { allow, deny, retryPolicy } from '../utils.js';

export const createChannelWithRole = (
  teamId: Team.TeamId,
  subgroupId: SubgroupModel.SubgroupId,
  guildId: DiscordSchemas.Snowflake,
  channelName: string,
) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('channel', ({ rest }) =>
      rest
        .createGuildChannel(guildId, {
          name: channelName,
          type: Discord.ChannelTypes.GUILD_TEXT,
          permission_overwrites: [
            { id: guildId, type: Discord.ChannelPermissionOverwrites.ROLE, deny: deny(HIDDEN) },
          ],
        })
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ channel }) =>
      Effect.logInfo(
        `Auto-created Discord channel "${channelName}" (${channel.id}) in guild ${guildId}`,
      ),
    ),
    Effect.bind('role', ({ rest }) =>
      rest.createGuildRole(guildId, { name: channelName }).pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ role }) =>
      Effect.logInfo(`Auto-created Discord role "${channelName}" (${role.id}) in guild ${guildId}`),
    ),
    Effect.tap(({ channel, role, rest }) =>
      rest
        .setChannelPermissionOverwrite(channel.id, role.id, {
          type: Discord.ChannelPermissionOverwrites.ROLE,
          allow: allow(READ_WRITE),
        })
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ channel, role }) =>
      Effect.logInfo(`Set role ${role.id} permission overwrite on channel ${channel.id}`),
    ),
    Effect.tap(({ channel, role, rpc }) =>
      rpc['Channel/UpsertMapping']({
        team_id: teamId,
        subgroup_id: subgroupId,
        discord_channel_id: channel.id as DiscordSchemas.Snowflake,
        discord_role_id: role.id as DiscordSchemas.Snowflake,
      }),
    ),
    Effect.map(({ channel, role }) => ({
      discord_channel_id: channel.id,
      discord_role_id: role.id,
    })),
  );
