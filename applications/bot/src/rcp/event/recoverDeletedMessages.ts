import { DiscordREST } from 'dfx/DiscordREST';
import { Array as Arr, Effect, Schema } from 'effect';
import { guildLocale, type Locale } from '~/locale.js';
import { DfxGuild } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';
import { reorderChannelMessages } from './reorderChannelMessages.js';

const parseGuild = (raw: unknown) =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(DfxGuild)(raw),
    catch: () => new Error('Failed to decode guild'),
  });

/**
 * On bot startup, scan every channel with stored event messages and trigger
 * a reorder. Combined with the recovery in `editMessage`, any messages that
 * have been deleted from Discord are recreated and their new IDs persisted.
 */
export const recoverDeletedMessages = Effect.Do.pipe(
  Effect.bind('rpc', () => SyncRpc.asEffect()),
  Effect.bind('rest', () => DiscordREST.asEffect()),
  Effect.bind('channels', ({ rpc }) => rpc['Event/GetChannelsWithStoredMessages']()),
  Effect.tap(({ channels }) =>
    Effect.logInfo(
      `Startup recovery: scanning ${channels.length} channel(s) with stored event messages`,
    ),
  ),
  Effect.flatMap(({ rest, channels }) =>
    Effect.all(
      Arr.map(channels, ({ discord_channel_id, guild_id }) =>
        rest
          .getGuild(guild_id)
          .pipe(
            Effect.flatMap(parseGuild),
            Effect.map((g) => guildLocale({ guild_locale: g.preferred_locale })),
            Effect.catch(() => Effect.succeed<Locale>('en')),
          )
          .pipe(
            Effect.flatMap((locale) => reorderChannelMessages(discord_channel_id, locale)),
            Effect.tapError((e) =>
              Effect.logWarning(`Startup recovery failed for channel ${discord_channel_id}`, e),
            ),
            Effect.exit,
            Effect.asVoid,
          ),
      ),
      { concurrency: 3 },
    ),
  ),
  Effect.asVoid,
);
