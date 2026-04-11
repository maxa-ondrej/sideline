import type { EventRpcModels } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import type * as Discord from 'dfx/types';
import { Option } from 'effect';
import type { Locale } from '~/locale.js';

const EVENT_COLOR = 0x5865f2;

const formatEntry = (entry: EventRpcModels.RsvpAttendeeEntry): string => {
  const boldName = Option.orElse(
    Option.map(entry.name, (n) => `**${n}**`),
    () =>
      Option.orElse(
        Option.map(entry.nickname, (n) => `**${n}**`),
        () => Option.map(entry.username, (u) => `**${u}**`),
      ),
  );
  const name = Option.getOrElse(boldName, () => 'Unknown');
  return entry.message.pipe(
    Option.map((msg) => `${name} — "${msg}"`),
    Option.getOrElse(() => name),
  );
};

export const buildAttendeesEmbed = (opts: {
  attendees: ReadonlyArray<EventRpcModels.RsvpAttendeeEntry>;
  total: number;
  offset: number;
  limit: number;
  teamId: string;
  eventId: string;
  locale: Locale;
}): {
  embeds: ReadonlyArray<Discord.RichEmbed>;
  components: ReadonlyArray<Discord.ActionRowComponentForMessageRequest>;
} => {
  const locale = opts.locale;
  const fields: Array<Discord.RichEmbedField> = [];

  const grouped = { yes: [] as string[], no: [] as string[], maybe: [] as string[] };
  for (const entry of opts.attendees) {
    grouped[entry.response].push(formatEntry(entry));
  }

  if (grouped.yes.length > 0) {
    fields.push({
      name: m.bot_attendees_yes({ count: String(grouped.yes.length) }, { locale }),
      value: grouped.yes.join('\n'),
    });
  }
  if (grouped.no.length > 0) {
    fields.push({
      name: m.bot_attendees_no({ count: String(grouped.no.length) }, { locale }),
      value: grouped.no.join('\n'),
    });
  }
  if (grouped.maybe.length > 0) {
    fields.push({
      name: m.bot_attendees_maybe({ count: String(grouped.maybe.length) }, { locale }),
      value: grouped.maybe.join('\n'),
    });
  }

  const page = Math.floor(opts.offset / opts.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(opts.total / opts.limit));

  const embeds: ReadonlyArray<Discord.RichEmbed> = [
    {
      title: m.bot_attendees_title({}, { locale }),
      color: EVENT_COLOR,
      fields:
        fields.length > 0
          ? fields
          : [{ name: m.bot_attendees_empty({}, { locale }), value: '\u200b' }],
      footer: {
        text: m.bot_attendees_footer(
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

  if (opts.total > opts.limit) {
    components.push({
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: m.bot_btn_prev({}, { locale }),
          custom_id: `attendees-page:${opts.teamId}:${opts.eventId}:${opts.offset - opts.limit}`,
          disabled: opts.offset === 0,
        },
        {
          type: 2,
          style: 2,
          label: m.bot_btn_next({}, { locale }),
          custom_id: `attendees-page:${opts.teamId}:${opts.eventId}:${opts.offset + opts.limit}`,
          disabled: opts.offset + opts.limit >= opts.total,
        },
      ],
    });
  }

  return { embeds, components };
};
