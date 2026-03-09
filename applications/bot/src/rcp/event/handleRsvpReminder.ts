import type { EventRpcEvents } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import { DateTime, Effect, Option, Schema } from 'effect';
import { guildLocale } from '~/locale.js';
import { DfxGuild } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeGuild = Schema.decodeUnknownSync(DfxGuild);

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
    Effect.bind('guild', ({ rest }) => rest.getGuild(event.guild_id).pipe(Effect.map(decodeGuild))),
    Effect.bind('votingMessage', ({ rpc }) =>
      rpc['Event/GetDiscordMessageId']({ event_id: event.event_id }),
    ),
    Effect.flatMap(({ rest, summary, guild, votingMessage }) => {
      const channelId = Option.getOrUndefined(
        Option.orElse(event.discord_channel_id, () => guild.system_channel_id),
      );
      if (!channelId) {
        return Effect.logWarning(
          `Guild ${event.guild_id} has no system channel, skipping RSVP reminder`,
        );
      }
      const locale = guildLocale({ guild_locale: guild.preferred_locale });

      const nonResponderMentions = summary.nonResponders
        .filter((nr) => Option.isSome(nr.discord_id))
        .map((nr) => `<@${Option.getOrElse(nr.discord_id, () => '')}>`)
        .join(', ');

      const nonResponderNames = summary.nonResponders
        .filter((nr) => Option.isNone(nr.discord_id))
        .map((nr) => Option.getOrElse(nr.name, () => Option.getOrElse(nr.username, () => '?')))
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

      const whenText = `${toDiscordTimestamp(event.start_at, 'f')} (${toDiscordTimestamp(event.start_at, 'R')})`;

      const postChannel = rest
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

      const voteLink = Option.match(votingMessage, {
        onNone: () => `https://discord.com/channels/${event.guild_id}/${channelId}`,
        onSome: (msg) =>
          `https://discord.com/channels/${event.guild_id}/${msg.discord_channel_id}/${msg.discord_message_id}`,
      });

      const dmNonResponders = summary.nonResponders
        .filter((nr) => Option.isSome(nr.discord_id))
        .map((nr) =>
          rest.createDm({ recipient_id: Option.getOrElse(nr.discord_id, () => '') }).pipe(
            Effect.flatMap((dm) =>
              rest.createMessage(dm.id, {
                embeds: [
                  {
                    title: m.bot_rsvp_reminder_title({ title: event.title }, { locale }),
                    description: m.bot_rsvp_reminder_dm(
                      { title: event.title, when: whenText, link: voteLink },
                      { locale },
                    ),
                    color: REMINDER_COLOR,
                  },
                ],
              }),
            ),
            Effect.tap(() =>
              Effect.log(
                `Sent RSVP reminder DM to Discord user ${Option.getOrElse(nr.discord_id, () => '?')}`,
              ),
            ),
            Effect.catchAll((err) =>
              Effect.logWarning(
                `Failed to send RSVP reminder DM to Discord user ${Option.getOrElse(nr.discord_id, () => '?')}: ${err}`,
              ),
            ),
          ),
        );

      const sendDms =
        dmNonResponders.length > 0
          ? Effect.all(dmNonResponders, { concurrency: 5 }).pipe(Effect.asVoid)
          : Effect.void;

      return Effect.all([postChannel, sendDms], { concurrency: 'unbounded' }).pipe(Effect.asVoid);
    }),
  );
