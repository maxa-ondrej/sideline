import type { ChannelRpcEvents, Discord } from '@sideline/domain';
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

export const handleMemberRemoved = (event: ChannelRpcEvents.ChannelMemberRemovedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Channel/GetMapping']({
        team_id: event.team_id,
        subgroup_id: event.subgroup_id,
      }),
    ),
    Effect.bind('mapping', ({ cached }) => cached),
    Effect.tap(({ mapping }) =>
      removeRole(event.guild_id, event.discord_user_id, mapping.discord_role_id),
    ),
    Effect.asVoid,
    Effect.catchTag('NoSuchElementException', () =>
      Effect.logWarning(
        `No mapping found for subgroup ${event.subgroup_id}, skipping member_removed`,
      ),
    ),
  );
