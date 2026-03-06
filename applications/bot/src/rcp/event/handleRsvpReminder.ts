import type { EventRpcEvents } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import { DateTime, Effect } from 'effect';
import { guildLocale } from '~/locale.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const REMINDER_COLOR = 0xfee75c; // yellow

const toDiscordTimestamp = (dateStr: string, style: 'R' | 'f' = 'f'): string => {
  const unix = Math.floor(Number(DateTime.toEpochMillis(DateTime.unsafeMake(dateStr))) / 1000);
  return `<t:${unix}:${style}>`;
};

export const handleRsvpReminder = (event: EventRpcEvents.RsvpReminderEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('summary', ({ rpc }) =>
      rpc['Event/GetRsvpReminderSummary']({ event_id: event.event_id }),
    ),
    Effect.bind('guild', ({ rest }) => rest.getGuild(event.guild_id)),
    Effect.flatMap(({ rest, summary, guild }) => {
      const channelId = event.discord_channel_id ?? guild.system_channel_id;
      if (!channelId) {
        return Effect.logWarning(
          `Guild ${event.guild_id} has no system channel, skipping RSVP reminder`,
        );
      }
      const locale = guildLocale({ guild_locale: guild.preferred_locale });

      const nonResponderMentions = summary.nonResponders
        .filter((nr) => nr.discord_id)
        .map((nr) => `<@${nr.discord_id}>`)
        .join(', ');

      const nonResponderNames = summary.nonResponders
        .filter((nr) => !nr.discord_id)
        .map((nr) => nr.name ?? nr.username ?? '?')
        .join(', ');

      const nonResponderText = [nonResponderMentions, nonResponderNames].filter(Boolean).join(', ');

      const fields = [
        {
          name: m.bot_embed_when({}, { locale }),
          value: `${toDiscordTimestamp(event.start_at, 'f')} (${toDiscordTimestamp(event.start_at, 'R')})`,
          inline: false,
        },
        {
          name: m.bot_embed_rsvps({}, { locale }),
          value: m.bot_embed_rsvp_summary(
            {
              yes: String(summary.yesCount),
              no: String(summary.noCount),
              maybe: String(summary.maybeCount),
            },
            { locale },
          ),
          inline: false,
        },
      ];

      if (nonResponderText) {
        fields.push({
          name: m.rsvp_nonRespondersTitle({}, { locale }),
          value: nonResponderText,
          inline: false,
        });
      }

      return rest
        .createMessage(channelId, {
          embeds: [
            {
              title: m.bot_rsvp_reminder_title({ title: event.title }, { locale }),
              color: REMINDER_COLOR,
              fields,
            },
          ],
        })
        .pipe(
          Effect.tap((msg) =>
            Effect.log(
              `Posted RSVP reminder for "${event.title}" to channel ${channelId}, message ${msg.id}`,
            ),
          ),
          Effect.asVoid,
        );
    }),
  );
