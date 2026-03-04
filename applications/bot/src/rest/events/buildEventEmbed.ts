import type { EventRpcModels } from '@sideline/domain';
import type * as Discord from 'dfx/types';

const EVENT_COLOR = 0x5865f2;
const CANCELLED_COLOR = 0xed4245;

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
  const fields: Array<Discord.RichEmbedField> = [];

  const when = opts.endAt ? `${opts.startAt} — ${opts.endAt}` : opts.startAt;
  fields.push({ name: 'When', value: when, inline: true });

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
      description: opts.description ?? undefined,
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
