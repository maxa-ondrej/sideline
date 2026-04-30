import type { EventRpcEvents } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import { DateTime, Effect, Option, Schema } from 'effect';
import { guildLocale } from '~/locale.js';
import { DfxGuild } from '~/schemas.js';

const decodeGuild = Schema.decodeUnknownSync(DfxGuild);

const REMINDER_COLOR = 0xfee75c; // yellow

const toDiscordTimestamp = (dt: DateTime.Utc, style: 'R' | 'f' = 'f'): string =>
  `<t:${Math.floor(Number(DateTime.toEpochMillis(dt)) / 1000)}:${style}>`;

export const handleUnclaimedTrainingReminder = (
  event: EventRpcEvents.UnclaimedTrainingReminderEvent,
) =>
  Option.match(event.discord_target_channel_id, {
    onNone: () =>
      Effect.logWarning(
        `handleUnclaimedTrainingReminder: no owner channel resolved for event ${event.event_id}, skipping`,
      ),
    onSome: (channelId) =>
      Effect.Do.pipe(
        Effect.bind('rest', () => DiscordREST.asEffect()),
        Effect.bind('guild', ({ rest }) =>
          rest.getGuild(event.guild_id).pipe(Effect.map(decodeGuild)),
        ),
        Effect.flatMap(({ rest, guild }) => {
          const locale = guildLocale({ guild_locale: guild.preferred_locale });

          const whenText = `${toDiscordTimestamp(event.start_at, 'f')} (${toDiscordTimestamp(event.start_at, 'R')})`;

          // Optionally append a jump link when we have the claim message IDs
          const jumpLink = Option.flatMap(event.claim_discord_channel_id, (claimChannelId) =>
            Option.map(
              event.claim_discord_message_id,
              (messageId) =>
                `https://discord.com/channels/${event.guild_id}/${claimChannelId}/${messageId}`,
            ),
          );

          const description = Option.match(jumpLink, {
            onNone: () =>
              m.bot_claim_unclaimed_reminder_description({ when: whenText }, { locale }),
            onSome: (link) =>
              `${m.bot_claim_unclaimed_reminder_description({ when: whenText }, { locale })}\n[${m.bot_claim_unclaimed_reminder_jump({}, { locale })}](${link})`,
          });

          const roleMention = Option.match(event.discord_role_id, {
            onNone: () =>
              ({}) as {
                content?: string;
                allowed_mentions?: { parse: []; roles: string[] };
              },
            onSome: (role) => ({
              content: `<@&${role}>`,
              allowed_mentions: { parse: [] as [], roles: [role] },
            }),
          });

          return rest
            .createMessage(channelId, {
              ...roleMention,
              embeds: [
                {
                  title: m.bot_claim_unclaimed_reminder_title({ title: event.title }, { locale }),
                  description,
                  color: REMINDER_COLOR,
                },
              ],
            })
            .pipe(
              Effect.tap((msg) =>
                Effect.logInfo(
                  `Posted unclaimed training reminder for "${event.title}" to channel ${channelId}, message ${msg.id}`,
                ),
              ),
              Effect.asVoid,
            );
        }),
      ),
  });
