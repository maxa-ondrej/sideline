import type { ChannelRpcEvents, ChannelRpcModels, Discord } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect, type Option } from 'effect';
import { retryPolicy } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const removeRole = (
  guildId: Discord.Snowflake,
  userId: Discord.Snowflake,
  roleId: Option.Option<Discord.Snowflake>,
) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('roleId', () => roleId),
    Effect.tap(({ rest, roleId }) =>
      rest.deleteGuildMemberRole(guildId, userId, roleId).pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ roleId }) =>
      Effect.logInfo(`Removed role ${roleId} from user ${userId} in guild ${guildId}`),
    ),
    Effect.catchTag('NoSuchElementException', () => Effect.void),
  );

const removeRoleFromMapping = (
  guildId: Discord.Snowflake,
  discordUserId: Discord.Snowflake,
  mapping: ChannelRpcModels.ChannelMapping,
) => removeRole(guildId, discordUserId, mapping.discord_role_id);

export const handleMemberRemoved = (event: ChannelRpcEvents.GroupMemberRemovedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Channel/GetMapping']({ team_id: event.team_id, group_id: event.group_id }),
    ),
    Effect.bind('mapping', ({ cached }) => cached),
    Effect.tap(({ mapping }) =>
      removeRoleFromMapping(event.guild_id, event.discord_user_id, mapping),
    ),
    Effect.asVoid,
    Effect.catchTag('NoSuchElementException', () =>
      Effect.logWarning(
        `No mapping found for group ${event.group_id} in guild ${event.guild_id}, skipping member_removed`,
      ),
    ),
  );

export const handleRosterMemberRemoved = (event: ChannelRpcEvents.RosterMemberRemovedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Channel/GetRosterMapping']({ team_id: event.team_id, roster_id: event.roster_id }),
    ),
    Effect.bind('mapping', ({ cached }) => cached),
    Effect.tap(({ mapping }) =>
      removeRoleFromMapping(event.guild_id, event.discord_user_id, mapping),
    ),
    Effect.asVoid,
    Effect.catchTag('NoSuchElementException', () =>
      Effect.logWarning(
        `No mapping found for roster ${event.roster_id} in guild ${event.guild_id}, skipping member_removed`,
      ),
    ),
  );
