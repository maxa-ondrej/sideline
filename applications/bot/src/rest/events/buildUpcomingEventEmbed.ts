import type { EventRpcModels } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import * as Discord from 'dfx/types';
import { DateTime, Option } from 'effect';
import type { Locale } from '~/locale.js';

const EVENT_TYPE_COLORS: Record<string, number> = {
  training: 0x57f287,
  match: 0xed4245,
  tournament: 0xfee75c,
  meeting: 0x5865f2,
  social: 0xeb459e,
  other: 0x99aab5,
};

const DEFAULT_COLOR = 0x99aab5;

const toDiscordTimestamp = (
  dt: DateTime.Utc,
  style: 'D' | 'F' | 'R' | 'd' | 'f' | 't' = 'f',
): string => {
  const unix = Math.floor(Number(DateTime.toEpochMillis(dt)) / 1000);
  return `<t:${unix}:${style}>`;
};

const isSameDay = (a: DateTime.Utc, b: DateTime.Utc): boolean => {
  const pa = DateTime.toParts(a);
  const pb = DateTime.toParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
};

const buildYourRsvpValue = (
  myResponse: Option.Option<'yes' | 'no' | 'maybe'>,
  myMessage: Option.Option<string>,
  locale: Locale,
): string => {
  const status = Option.match(myResponse, {
    onNone: () => m.bot_your_rsvp_none({}, { locale }),
    onSome: (r) => {
      switch (r) {
        case 'yes':
          return m.bot_your_rsvp_yes({}, { locale });
        case 'no':
          return m.bot_your_rsvp_no({}, { locale });
        case 'maybe':
          return m.bot_your_rsvp_maybe({}, { locale });
      }
    },
  });

  return Option.match(myMessage, {
    onNone: () => status,
    onSome: (message) => m.bot_your_rsvp_with_message({ status, message }, { locale }),
  });
};

export const buildUpcomingEventPage = (params: {
  entry: EventRpcModels.UpcomingEventForUserEntry;
  currentIndex: number;
  total: number;
  locale: Locale;
}): {
  embeds: ReadonlyArray<Discord.RichEmbed>;
  components: ReadonlyArray<Discord.ActionRowComponentForMessageRequest>;
} => {
  const { entry, currentIndex, total, locale } = params;

  const descParts: string[] = [];
  if (Option.isSome(entry.description)) {
    descParts.push(entry.description.value);
  }
  descParts.push(toDiscordTimestamp(entry.start_at, 'R'));

  const fields: Array<Discord.RichEmbedField> = [];

  const startTs = toDiscordTimestamp(entry.start_at, 'f');
  const when = Option.match(entry.end_at, {
    onNone: () => startTs,
    onSome: (endAt) => {
      const endStyle = isSameDay(entry.start_at, endAt) ? 't' : 'f';
      return `${startTs} — ${toDiscordTimestamp(endAt, endStyle)}`;
    },
  });
  fields.push({ name: m.bot_embed_when({}, { locale }), value: when, inline: false });

  if (Option.isSome(entry.location)) {
    fields.push({
      name: m.bot_embed_where({}, { locale }),
      value: entry.location.value,
      inline: false,
    });
  }

  fields.push({
    name: m.bot_embed_rsvps({}, { locale }),
    value: m.bot_embed_rsvp_summary(
      {
        yes: String(entry.yes_count),
        no: String(entry.no_count),
        maybe: String(entry.maybe_count),
      },
      { locale },
    ),
  });

  fields.push({
    name: m.bot_embed_your_rsvp({}, { locale }),
    value: buildYourRsvpValue(entry.my_response, entry.my_message, locale),
    inline: false,
  });

  const color = EVENT_TYPE_COLORS[entry.event_type] ?? DEFAULT_COLOR;

  const embeds: ReadonlyArray<Discord.RichEmbed> = [
    {
      title: entry.title,
      description: descParts.join('\n'),
      color,
      fields,
      footer: {
        text: m.bot_upcoming_footer(
          { current: String(currentIndex + 1), total: String(total) },
          { locale },
        ),
      },
    },
  ];

  const myResponse = entry.my_response;

  // Row 1: RSVP buttons
  // Styles: 1=Primary(blurple), 2=Secondary(grey), 3=Success(green), 4=Danger(red)
  const yesStyle =
    Option.isSome(myResponse) && myResponse.value === 'yes'
      ? Discord.ButtonStyleTypes.SUCCESS
      : Discord.ButtonStyleTypes.SECONDARY;
  const noStyle =
    Option.isSome(myResponse) && myResponse.value === 'no'
      ? Discord.ButtonStyleTypes.DANGER
      : Discord.ButtonStyleTypes.SECONDARY;
  const maybeStyle =
    Option.isSome(myResponse) && myResponse.value === 'maybe'
      ? Discord.ButtonStyleTypes.PRIMARY
      : Discord.ButtonStyleTypes.SECONDARY;

  // custom_id: upcoming-rsvp:<event_id>:<team_id>:<response>:<offset>
  const rsvpRow: Discord.ActionRowComponentForMessageRequest = {
    type: 1,
    components: [
      {
        type: 2,
        style: yesStyle,
        label: m.bot_btn_yes({}, { locale }),
        custom_id: `upcoming-rsvp:${entry.event_id}:${entry.team_id}:yes:${currentIndex}`,
      },
      {
        type: 2,
        style: noStyle,
        label: m.bot_btn_no({}, { locale }),
        custom_id: `upcoming-rsvp:${entry.event_id}:${entry.team_id}:no:${currentIndex}`,
      },
      {
        type: 2,
        style: maybeStyle,
        label: m.bot_btn_maybe({}, { locale }),
        custom_id: `upcoming-rsvp:${entry.event_id}:${entry.team_id}:maybe:${currentIndex}`,
      },
    ],
  };

  // Row 2: Navigation buttons
  const navRow: Discord.ActionRowComponentForMessageRequest = {
    type: 1,
    components: [
      {
        type: 2,
        style: 2,
        label: m.bot_btn_prev({}, { locale }),
        custom_id: `upcoming-page:${currentIndex - 1}`,
        disabled: currentIndex === 0,
      },
      {
        type: 2,
        style: 2,
        label: m.bot_btn_next({}, { locale }),
        custom_id: `upcoming-page:${currentIndex + 1}`,
        disabled: currentIndex >= total - 1,
      },
    ],
  };

  return {
    embeds,
    components: [rsvpRow, navRow],
  };
};
