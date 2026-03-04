import type { EventRpcModels } from '@sideline/domain';
import type * as Discord from 'dfx/types';

const EVENT_COLOR = 0x5865f2;

const formatEntry = (entry: EventRpcModels.RsvpAttendeeEntry): string => {
  const name = entry.discord_id ? `<@${entry.discord_id}>` : (entry.name ?? 'Unknown');
  return entry.message ? `${name} — "${entry.message}"` : name;
};

export const buildAttendeesEmbed = (opts: {
  attendees: ReadonlyArray<EventRpcModels.RsvpAttendeeEntry>;
  total: number;
  offset: number;
  limit: number;
  teamId: string;
  eventId: string;
}): {
  embeds: ReadonlyArray<Discord.RichEmbed>;
  components: ReadonlyArray<Discord.ActionRowComponentForMessageRequest>;
} => {
  const fields: Array<Discord.RichEmbedField> = [];

  const grouped = { yes: [] as string[], no: [] as string[], maybe: [] as string[] };
  for (const entry of opts.attendees) {
    grouped[entry.response].push(formatEntry(entry));
  }

  if (grouped.yes.length > 0) {
    fields.push({ name: `✅ Yes (${grouped.yes.length})`, value: grouped.yes.join('\n') });
  }
  if (grouped.no.length > 0) {
    fields.push({ name: `❌ No (${grouped.no.length})`, value: grouped.no.join('\n') });
  }
  if (grouped.maybe.length > 0) {
    fields.push({ name: `❓ Maybe (${grouped.maybe.length})`, value: grouped.maybe.join('\n') });
  }

  const page = Math.floor(opts.offset / opts.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(opts.total / opts.limit));

  const embeds: ReadonlyArray<Discord.RichEmbed> = [
    {
      title: 'Attendees',
      color: EVENT_COLOR,
      fields: fields.length > 0 ? fields : [{ name: 'No responses yet', value: '\u200b' }],
      footer: { text: `Page ${page} of ${totalPages} · ${opts.total} total responses` },
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
          label: '◀ Prev',
          custom_id: `attendees-page:${opts.teamId}:${opts.eventId}:${opts.offset - opts.limit}`,
          disabled: opts.offset === 0,
        },
        {
          type: 2,
          style: 2,
          label: 'Next ▶',
          custom_id: `attendees-page:${opts.teamId}:${opts.eventId}:${opts.offset + opts.limit}`,
          disabled: opts.offset + opts.limit >= opts.total,
        },
      ],
    });
  }

  return { embeds, components };
};
