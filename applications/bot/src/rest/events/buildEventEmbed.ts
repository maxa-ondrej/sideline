import type { EventRpcModels } from '@sideline/domain';
import type * as Discord from 'dfx/types';

const EVENT_COLOR = 0x5865f2;
const CANCELLED_COLOR = 0xed4245;

const toDiscordTimestamp = (
  dateStr: string,
  style: 'D' | 'F' | 'R' | 'd' | 'f' | 't' = 'f',
): string => {
  const unix = Math.floor(new Date(dateStr).getTime() / 1000);
  return `<t:${unix}:${style}>`;
};

const isSameDay = (a: string, b: string): boolean => {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
};

export const buildEventEmbed = (opts: {
  teamId: string;
  eventId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  eventType: string;
  counts: EventRpcModels.RsvpCountsResult;
}): {
  embeds: ReadonlyArray<Discord.RichEmbed>;
  components: ReadonlyArray<Discord.ActionRowComponentForMessageRequest>;
} => {
  const descParts: string[] = [];
  if (opts.description) {
    descParts.push(opts.description);
  }
  descParts.push(toDiscordTimestamp(opts.startAt, 'R'));

  const fields: Array<Discord.RichEmbedField> = [];

  const startTs = toDiscordTimestamp(opts.startAt, 'f');
  const endStyle = opts.endAt && isSameDay(opts.startAt, opts.endAt) ? 't' : 'f';
  const when = opts.endAt ? `${startTs} — ${toDiscordTimestamp(opts.endAt, endStyle)}` : startTs;
  fields.push({ name: 'When', value: when, inline: false });

  if (opts.location) {
    fields.push({ name: 'Where', value: opts.location, inline: true });
  }

  fields.push({ name: 'Type', value: opts.eventType, inline: true });

  fields.push({
    name: 'RSVPs',
    value: `Yes: ${opts.counts.yesCount}  |  No: ${opts.counts.noCount}  |  Maybe: ${opts.counts.maybeCount}`,
  });

  const embeds: ReadonlyArray<Discord.RichEmbed> = [
    {
      title: opts.title,
      description: descParts.join('\n'),
      color: EVENT_COLOR,
      fields,
    },
  ];

  const components: Array<Discord.ActionRowComponentForMessageRequest> = [];

  if (opts.counts.canRsvp) {
    components.push({
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: 'Yes',
          custom_id: `rsvp:${opts.teamId}:${opts.eventId}:yes`,
        },
        {
          type: 2,
          style: 4,
          label: 'No',
          custom_id: `rsvp:${opts.teamId}:${opts.eventId}:no`,
        },
        {
          type: 2,
          style: 2,
          label: 'Maybe',
          custom_id: `rsvp:${opts.teamId}:${opts.eventId}:maybe`,
        },
      ],
    });
  }

  components.push({
    type: 1,
    components: [
      {
        type: 2,
        style: 2,
        label: '📋 Attendees',
        custom_id: `attendees:${opts.teamId}:${opts.eventId}:0`,
      },
    ],
  });

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
