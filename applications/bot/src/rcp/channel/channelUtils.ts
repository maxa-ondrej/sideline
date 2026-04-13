import type { Discord } from '@sideline/domain';
import { DiscordREST } from 'dfx';
import { Effect, type Option } from 'effect';
import { retryPolicy } from '~/rest/utils.js';

export const deleteRole = (guildId: Discord.Snowflake, roleId: Option.Option<Discord.Snowflake>) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.bind('roleId', () => roleId),
    Effect.tap(({ rest, roleId }) =>
      rest.deleteGuildRole(guildId, roleId).pipe(Effect.retry(retryPolicy)),
    ),
    Effect.tap(({ roleId }) =>
      Effect.logInfo(`Deleted Discord role ${roleId} in guild ${guildId}`),
    ),
    Effect.catchTag('NoSuchElementError', () => Effect.void),
  );

export const deleteChannelAndRole = (
  guildId: Discord.Snowflake,
  discordChannelId: Discord.Snowflake,
  discordRoleId: Option.Option<Discord.Snowflake>,
) =>
  Effect.Do.pipe(
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.tap(() => deleteRole(guildId, discordRoleId)),
    Effect.tap(({ rest }) => rest.deleteChannel(discordChannelId).pipe(Effect.retry(retryPolicy))),
    Effect.tap(() =>
      Effect.logInfo(`Deleted Discord channel ${discordChannelId} in guild ${guildId}`),
    ),
    Effect.asVoid,
  );
