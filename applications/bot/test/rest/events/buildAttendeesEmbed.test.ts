import { Discord as DomainDiscord, EventRpcModels } from '@sideline/domain';
import { Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { buildAttendeesEmbed } from '~/rest/events/buildAttendeesEmbed.js';

const makeAttendee = (opts: {
  discord_id?: Option.Option<string>;
  name?: Option.Option<string>;
  message?: Option.Option<string>;
  response?: 'yes' | 'no' | 'maybe';
}): EventRpcModels.RsvpAttendeeEntry =>
  new EventRpcModels.RsvpAttendeeEntry({
    discord_id: Option.map(opts.discord_id ?? Option.none(), DomainDiscord.Snowflake.make),
    name: opts.name ?? Option.none(),
    response: opts.response ?? 'yes',
    message: opts.message ?? Option.none(),
  });

const baseOpts = {
  total: 1,
  offset: 0,
  limit: 10,
  teamId: 'team-1',
  eventId: 'event-1',
  locale: 'en' as const,
};

// Extract all text from a rendered embed to verify formatEntry output.
const collectFieldValues = (attendees: EventRpcModels.RsvpAttendeeEntry[]): string => {
  const { embeds } = buildAttendeesEmbed({
    ...baseOpts,
    attendees,
    total: attendees.length,
  });
  return (embeds[0].fields ?? []).map((f) => f.value).join('\n');
};

describe('buildAttendeesEmbed - formatEntry', () => {
  it('formats with both name and discord_id as "**Alice** (<@123>)"', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.some('Alice'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Alice** (<@123>)');
  });

  it('formats with name, discord_id, and message', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.some('Alice'),
      message: Option.some('Hello'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Alice** (<@123>) — "Hello"');
  });

  it('formats with only discord_id as "<@123>"', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('<@123>');
    expect(text).not.toContain('**');
  });

  it('formats with only name as "**Bob**"', () => {
    const attendee = makeAttendee({
      discord_id: Option.none(),
      name: Option.some('Bob'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Bob**');
    expect(text).not.toContain('<@');
  });

  it('formats with neither name nor discord_id as "Unknown"', () => {
    const attendee = makeAttendee({
      discord_id: Option.none(),
      name: Option.none(),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('Unknown');
  });

  it('formats with only name and message as "**Bob** — \\"msg\\""', () => {
    const attendee = makeAttendee({
      discord_id: Option.none(),
      name: Option.some('Bob'),
      message: Option.some('msg'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Bob** — "msg"');
  });
});
