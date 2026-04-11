import type { EventRpcEvents } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import { Array, DateTime, Effect, Option, pipe, Schema } from 'effect';
import { guildLocale } from '~/locale.js';
import { DfxGuild } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeGuild = Schema.decodeUnknownSync(DfxGuild);

const REMINDER_COLOR = 0xfee75c; // yellow

const toDiscordTimestamp = (dt: DateTime.Utc, style: 'R' | 'f' = 'f'): string =>
  `<t:${Math.floor(Number(DateTime.toEpochMillis(dt)) / 1000)}:${style}>`;

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

      const formatReminderEntry = (entry: {
        discord_id: Option.Option<string>;
        name: Option.Option<string>;
        nickname: Option.Option<string>;
        username: Option.Option<string>;
      }): string => {
        const boldName = Option.orElse(
          Option.map(entry.name, (n) => `**${n}**`),
          () =>
            Option.orElse(
              Option.map(entry.nickname, (n) => `**${n}**`),
              () => Option.map(entry.username, (u) => `**${u}**`),
            ),
        );
        return Option.getOrElse(boldName, () => '?');
      };

      const nonResponderText = pipe(
        summary.nonResponders,
        Array.map(formatReminderEntry),
        Array.join(', '),
      );

      const yesAttendeeText = pipe(
        summary.yesAttendees,
        Array.map(formatReminderEntry),
        Array.join(', '),
      );

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

      if (yesAttendeeText) {
        fields.push({
          name: m.bot_embed_going({}, { locale }),
          value: yesAttendeeText,
          inline: false,
        });
      }

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
            Effect.logInfo(
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

      const dmNonResponders = pipe(
        summary.nonResponders,
        Array.filterMap((nr) => nr.discord_id),
        Array.map((discordId) =>
          rest.createDm({ recipient_id: discordId }).pipe(
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
            Effect.tap(() => Effect.logInfo(`Sent RSVP reminder DM to Discord user ${discordId}`)),
            Effect.catchTag(
              'RequestError',
              'ResponseError',
              'RatelimitedResponse',
              'ErrorResponse',
              (err) =>
                Effect.logWarning(
                  `Failed to send RSVP reminder DM to Discord user ${discordId}: ${err}`,
                ),
            ),
          ),
        ),
      );

      const sendDms = Array.isEmptyArray(dmNonResponders)
        ? Effect.void
        : Effect.all(dmNonResponders, { concurrency: 5 }).pipe(Effect.asVoid);

      return Effect.all([postChannel, sendDms], { concurrency: 'unbounded' }).pipe(Effect.asVoid);
    }),
  );
