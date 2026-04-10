import type { EventRpcModels } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import type * as Discord from 'dfx/types';
import { DateTime, Option } from 'effect';
import type { Locale } from '~/locale.js';

const PENDING_COLOR = 0xfee75c; // amber/yellow

const EVENT_TYPE_EMOJIS: Record<string, string> = {
  training: '\u{1F3C3}',
  match: '\u{26BD}',
  tournament: '\u{1F3C6}',
  meeting: '\u{1F4CB}',
  social: '\u{1F389}',
  other: '\u{1F4C5}',
};

const toDiscordTimestamp = (
  dt: DateTime.Utc,
  style: 'D' | 'F' | 'R' | 'd' | 'f' | 't' = 'f',
): string => {
  const unix = Math.floor(Number(DateTime.toEpochMillis(dt)) / 1000);
  return `<t:${unix}:${style}>`;
};

const formatEntry = (entry: EventRpcModels.PendingRsvpEntry): string => {
  const emoji = EVENT_TYPE_EMOJIS[entry.event_type] ?? EVENT_TYPE_EMOJIS.other;
  const locationPart = Option.match(entry.location, {
    onNone: () => '',
    onSome: (loc) => `\n\u{1F4CD} ${loc}`,
  });
  return `${emoji} **${entry.title}**\n${toDiscordTimestamp(entry.start_at, 'f')}${locationPart}`;
};

export const PAGE_SIZE = 5;

export const buildPendingRsvpEmbed = (opts: {
  events: ReadonlyArray<EventRpcModels.PendingRsvpEntry>;
  total: number;
  offset: number;
  guildId: string;
  discordUserId: string;
  locale: Locale;
}): {
  embeds: ReadonlyArray<Discord.RichEmbed>;
  components: ReadonlyArray<Discord.ActionRowComponentForMessageRequest>;
} => {
  const locale = opts.locale;
  const page = Math.floor(opts.offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(opts.total / PAGE_SIZE));

  const description =
    opts.events.length === 0
      ? m.bot_event_pending_empty({}, { locale })
      : opts.events.map(formatEntry).join('\n\n');

  const embeds: ReadonlyArray<Discord.RichEmbed> = [
    {
      title: m.bot_event_pending_title({}, { locale }),
      description,
      color: PENDING_COLOR,
      footer: {
        text: m.bot_event_pending_footer(
          {
            page: String(page),
            totalPages: String(totalPages),
            total: String(opts.total),
          },
          { locale },
        ),
      },
    },
  ];

  const components: Array<Discord.ActionRowComponentForMessageRequest> = [];
  const discordUserId = opts.discordUserId;

  if (opts.total > PAGE_SIZE) {
    components.push({
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: m.bot_btn_prev({}, { locale }),
          custom_id: `pending-rsvp-page:${opts.guildId}:${discordUserId}:${opts.offset - PAGE_SIZE}`,
          disabled: opts.offset === 0,
        },
        {
          type: 2,
          style: 2,
          label: m.bot_btn_next({}, { locale }),
          custom_id: `pending-rsvp-page:${opts.guildId}:${discordUserId}:${opts.offset + PAGE_SIZE}`,
          disabled: opts.offset + PAGE_SIZE >= opts.total,
        },
      ],
    });
  }

  return { embeds, components };
};
