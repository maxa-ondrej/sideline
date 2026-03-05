import type { EventRpcModels } from '@sideline/domain';
import type * as Discord from 'dfx/types';
import { DateTime, Option } from 'effect';

const EVENT_TYPE_COLORS: Record<string, number> = {
  training: 0x57f287, // green
  match: 0xed4245, // red
  tournament: 0xfee75c, // yellow
  meeting: 0x5865f2, // blurple
  social: 0xeb459e, // pink
  other: 0x99aab5, // grey
};

const DEFAULT_COLOR = 0x99aab5;

const CANCELLED_COLOR = 0xed4245;

const toDiscordTimestamp = (
  dateStr: string,
  style: 'D' | 'F' | 'R' | 'd' | 'f' | 't' = 'f',
): string => {
  const unix = Number(DateTime.toEpochMillis(DateTime.unsafeMake(dateStr))) / 1000;
  return `<t:${unix}:${style}>`;
};

const isSameDay = (a: string, b: string): boolean => {
  const da = DateTime.unsafeMake(a);
  const db = DateTime.unsafeMake(b);
  const pa = DateTime.toParts(da);
  const pb = DateTime.toParts(db);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
};

export const buildEventEmbed = (opts: {
  teamId: string;
  eventId: string;
  title: string;
  description: Option.Option<string>;
  startAt: string;
  endAt: Option.Option<string>;
  location: Option.Option<string>;
  eventType: string;
  counts: EventRpcModels.RsvpCountsResult;
}): {
  embeds: ReadonlyArray<Discord.RichEmbed>;
  components: ReadonlyArray<Discord.ActionRowComponentForMessageRequest>;
} => {
  const descParts: string[] = [];
  if (Option.isSome(opts.description)) {
    descParts.push(opts.description.value);
  }
  descParts.push(toDiscordTimestamp(opts.startAt, 'R'));

  const fields: Array<Discord.RichEmbedField> = [];

  const startTs = toDiscordTimestamp(opts.startAt, 'f');
  const when = Option.match(opts.endAt, {
    onNone: () => startTs,
    onSome: (endAt) => {
      const endStyle = isSameDay(opts.startAt, endAt) ? 't' : 'f';
      return `${startTs} — ${toDiscordTimestamp(endAt, endStyle)}`;
    },
  });
  fields.push({ name: '📅 When', value: when, inline: false });

  if (Option.isSome(opts.location)) {
    fields.push({ name: '📍 Where', value: opts.location.value, inline: false });
  }

  fields.push({
    name: '📊 RSVPs',
    value: `✅ ${opts.counts.yesCount}  ·  ❌ ${opts.counts.noCount}  ·  ❓ ${opts.counts.maybeCount}`,
  });

  const embeds: ReadonlyArray<Discord.RichEmbed> = [
    {
      title: opts.title,
      description: descParts.join('\n'),
      color: EVENT_TYPE_COLORS[opts.eventType] ?? DEFAULT_COLOR,
      fields,
    },
  ];

  const components: Array<Discord.ActionRowComponentForMessageRequest> = [];

  const rowButtons: Array<Discord.ButtonComponentForMessageRequest> = [];

  if (opts.counts.canRsvp) {
    rowButtons.push(
      {
        type: 2,
        style: 3,
        label: '✅ Yes',
        custom_id: `rsvp:${opts.teamId}:${opts.eventId}:yes`,
      },
      {
        type: 2,
        style: 4,
        label: '❌ No',
        custom_id: `rsvp:${opts.teamId}:${opts.eventId}:no`,
      },
      {
        type: 2,
        style: 2,
        label: '❓ Maybe',
        custom_id: `rsvp:${opts.teamId}:${opts.eventId}:maybe`,
      },
    );
  }

  rowButtons.push({
    type: 2,
    style: 2,
    label: '📋 Attendees',
    custom_id: `attendees:${opts.teamId}:${opts.eventId}:0`,
  });

  components.push({ type: 1, components: rowButtons });

  return { embeds, components };
};

export const buildCancelledEmbed = (
  title: string,
): {
  embeds: ReadonlyArray<Discord.RichEmbed>;
  components: ReadonlyArray<Discord.ActionRowComponentForMessageRequest>;
} => ({
  embeds: [
    {
      title: `~~${title}~~`,
      description: 'This event has been **CANCELLED**.',
      color: CANCELLED_COLOR,
    },
  ],
  components: [],
});
