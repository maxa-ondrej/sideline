import { Discord as DomainDiscord, EventRpcModels } from '@sideline/domain';
import { Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { buildAttendeesEmbed } from '~/rest/events/buildAttendeesEmbed.js';

const makeAttendee = (opts: {
  discord_id?: Option.Option<string>;
  name?: Option.Option<string>;
  nickname?: Option.Option<string>;
  username?: Option.Option<string>;
  message?: Option.Option<string>;
  response?: 'yes' | 'no' | 'maybe';
}): EventRpcModels.RsvpAttendeeEntry =>
  new EventRpcModels.RsvpAttendeeEntry({
    discord_id: Option.map(opts.discord_id ?? Option.none(), DomainDiscord.Snowflake.make),
    name: opts.name ?? Option.none(),
    nickname: opts.nickname ?? Option.none(),
    username: opts.username ?? Option.none(),
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
  it('formats with name as "**Alice**"', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.some('Alice'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Alice**');
    expect(text).not.toContain('<@');
  });

  it('formats with name and message', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.some('Alice'),
      message: Option.some('Hello'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Alice** — "Hello"');
  });

  it('formats with only discord_id (no name/nickname/username) as "Unknown"', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('Unknown');
    expect(text).not.toContain('<@');
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

  it('falls back to bold nickname when name is None but nickname is set', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
      nickname: Option.some('Server Nick'),
      username: Option.some('bob_discord'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Server Nick**');
    expect(text).not.toContain('<@');
    expect(text).not.toContain('bob_discord');
  });

  it('falls back to bold username when name and nickname are None but username is set', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
      username: Option.some('bob_discord'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**bob_discord**');
    expect(text).not.toContain('<@');
  });

  it('falls back to bold username when name is None but username is set (no discord_id)', () => {
    const attendee = makeAttendee({
      discord_id: Option.none(),
      name: Option.none(),
      username: Option.some('bob_discord'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**bob_discord**');
    expect(text).not.toContain('<@');
  });
});
