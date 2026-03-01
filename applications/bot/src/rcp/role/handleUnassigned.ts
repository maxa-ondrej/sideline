import type { RoleRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect } from 'effect';
import { retryPolicy } from '~/rest/utils.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const handleMemberRemoved = (event: RoleRpcEvents.RoleUnassignedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('cached', ({ rpc }) =>
      rpc['Role/GetMapping']({
        team_id: event.team_id,
        role_id: event.role_id,
      }),
    ),
    Effect.bind('mapping', ({ cached }) => cached),
    Effect.tap(({ rest, mapping }) =>
      rest
        .deleteGuildMemberRole(event.guild_id, event.discord_user_id, mapping.discord_role_id)
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ mapping }) =>
      Effect.logInfo(
        `Removed Discord role ${mapping.discord_role_id} from user ${event.discord_user_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
    Effect.catchTag('NoSuchElementException', () =>
      Effect.logWarning(`No mapping found for role ${event.role_id}, skipping role_unassigned`),
    ),
  );
