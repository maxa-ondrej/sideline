import type { RoleRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect } from 'effect';
import { ensureMapping } from '~/rest/roles/ensureMapping.js';
import { retryPolicy } from '~/rest/utils.js';

export const handleMemberAdded = (event: RoleRpcEvents.RoleAssignedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('roleId', () =>
      ensureMapping(event.team_id, event.role_id, event.guild_id, event.role_name),
    ),
    Effect.bind('guildRole', ({ rest, roleId }) =>
      rest
        .addGuildMemberRole(event.guild_id, event.discord_user_id, roleId)
        .pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ roleId }) =>
      Effect.log(
        `Assigned role ${roleId} to user ${event.discord_user_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
  );
