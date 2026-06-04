import type { Discord, TeamChannelAccess } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import * as DiscordTypes from 'dfx/types';
import { Effect } from 'effect';
import { accessLevelPermission } from '../permissions.js';
import { allow, deny, retryPolicy } from '../utils.js';

type AccessLevel = TeamChannelAccess.AccessLevel;

export const setChannelAccessOverwrite = (
  channelId: Discord.Snowflake,
  roleId: Discord.Snowflake,
  level: AccessLevel,
) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.tap(({ rest }) => {
      const perm = accessLevelPermission(level);
      return rest
        .setChannelPermissionOverwrite(channelId, roleId, {
          type: DiscordTypes.ChannelPermissionOverwrites.ROLE,
          allow: allow(perm),
          deny: deny(perm),
        })
        .pipe(Effect.retry(retryPolicy));
    }),
    Effect.tap(() =>
      Effect.logInfo(
        `Set channel permission overwrite for role ${roleId} on channel ${channelId} (level: ${level})`,
      ),
    ),
    Effect.asVoid,
  );

export const removeChannelAccessOverwrite = (
  channelId: Discord.Snowflake,
  roleId: Discord.Snowflake,
) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.tap(({ rest }) =>
      rest.deleteChannelPermissionOverwrite(channelId, roleId).pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(() =>
      Effect.logInfo(
        `Removed channel permission overwrite for role ${roleId} on channel ${channelId}`,
      ),
    ),
    Effect.asVoid,
  );
