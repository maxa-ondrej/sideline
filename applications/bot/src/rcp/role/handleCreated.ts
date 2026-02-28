import type { RoleRpcEvents } from '@sideline/domain';
import { Effect } from 'effect';
import { ensureMapping } from '~/rest/roles/ensureMapping.js';

export const handleCreated = (event: RoleRpcEvents.RoleCreatedEvent) =>
  ensureMapping(event.team_id, event.role_id, event.guild_id, event.role_name).pipe(
    Effect.tap((discord_role_id) =>
      Effect.logInfo(
        `Synced role_created: role ${event.role_id} → Discord role ${discord_role_id} in guild ${event.guild_id}`,
      ),
    ),
    Effect.asVoid,
  );
