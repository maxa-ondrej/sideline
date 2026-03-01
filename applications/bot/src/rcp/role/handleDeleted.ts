import type { RoleRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect } from 'effect';
import { SyncRpc } from '~/index.js';
import { retryPolicy } from '~/rest/utils.js';

export const handleDeleted = (event: RoleRpcEvents.RoleDeletedEvent) =>
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
    Effect.tapErrorTag('NoSuchElementException', () =>
      Effect.logWarning(
        `No mapping found for role ${event.role_id} in guild ${event.guild_id}, skipping delete`,
      ),
    ),
    Effect.tap(({ rest, mapping }) =>
      rest.deleteGuildRole(event.guild_id, mapping.discord_role_id).pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ mapping }) =>
      Effect.log(`Deleted Discord role ${mapping.discord_role_id} in guild ${event.guild_id}`),
    ),
    Effect.tap(({ rpc }) =>
      rpc['Role/DeleteMapping']({
        team_id: event.team_id,
        role_id: event.role_id,
      }),
    ),
    Effect.asVoid,
    Effect.catchTag('NoSuchElementException', () => Effect.void),
  );
