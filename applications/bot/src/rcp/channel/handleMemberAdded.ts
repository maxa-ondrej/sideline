import type { ChannelRpcEvents, Discord } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect } from 'effect';
import { ensureMapping } from '~/rest/channels/ensureMapping.js';
import { retryPolicy } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const handleMemberAdded = (event: ChannelRpcEvents.GroupMemberAddedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.bind('mapping', () =>
      // Note: Using raw group_name as fallback channel/role name. In the normal flow, the channel
      // is already created by channel_created with the correct format applied.
      ensureMapping(
        event.team_id,
        event.group_id,
        event.guild_id,
        event.group_name,
        event.group_name,
      ),
    ),
    Effect.tap(({ rest, mapping }) =>
      rest
        .addGuildMemberRole(
          event.guild_id,
          event.discord_user_id,
          mapping.discord_role_id as Discord.Snowflake,
        )
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ mapping }) =>
      Effect.logInfo(
        `Assigned role ${mapping.discord_role_id} to user ${event.discord_user_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
  );

export const handleRosterMemberAdded = (event: ChannelRpcEvents.RosterMemberAddedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Channel/GetRosterMapping']({ team_id: event.team_id, roster_id: event.roster_id }),
    ),
    Effect.bind('mapping', ({ cached }) => Effect.fromOption(cached)),
    Effect.bind('roleId', ({ mapping }) => Effect.fromOption(mapping.discord_role_id)),
    Effect.tap(({ rest, roleId }) =>
      rest
        .addGuildMemberRole(event.guild_id, event.discord_user_id, roleId)
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ roleId }) =>
      Effect.logInfo(
        `Assigned role ${roleId} to user ${event.discord_user_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
    Effect.catchTag('NoSuchElementError', () =>
      Effect.logWarning(
        `No mapping or role found for roster ${event.roster_id} in guild ${event.guild_id}, skipping member_added`,
      ),
    ),
  );
