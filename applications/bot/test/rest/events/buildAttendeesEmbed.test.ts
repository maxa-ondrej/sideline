import { Discord as DomainDiscord, EventRpcModels } from '@sideline/domain';
import { Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { buildAttendeesEmbed } from '~/rest/events/buildAttendeesEmbed.js';

const makeAttendee = (opts: {
  discord_id?: Option.Option<string>;
  name?: Option.Option<string>;
  nickname?: Option.Option<string>;
  display_name?: Option.Option<string>;
  username?: Option.Option<string>;
  message?: Option.Option<string>;
  response?: 'yes' | 'no' | 'maybe';
}): EventRpcModels.RsvpAttendeeEntry =>
  new EventRpcModels.RsvpAttendeeEntry({
    discord_id: Option.map(opts.discord_id ?? Option.none(), DomainDiscord.Snowflake.makeUnsafe),
    name: opts.name ?? Option.none(),
    nickname: opts.nickname ?? Option.none(),
    display_name: opts.display_name ?? Option.none(),
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
  it('formats with name and mention as "**Alice** (<@123>)"', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.some('Alice'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Alice** (<@123>)');
  });

  it('formats with name, mention, and message', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.some('Alice'),
      message: Option.some('Hello'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Alice** (<@123>) — "Hello"');
  });

  it('formats with only discord_id as mention fallback', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('<@123>');
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

  it('falls back to bold nickname with mention when name is None but nickname is set', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
      nickname: Option.some('Server Nick'),
      username: Option.some('bob_discord'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Server Nick** (<@123>)');
    expect(text).not.toContain('bob_discord');
  });

  it('falls back to bold username with mention when name and nickname are None', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
      username: Option.some('bob_discord'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**bob_discord** (<@123>)');
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

  it('falls back to bold display_name when name and nickname are None but display_name is set', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
      nickname: Option.none(),
      display_name: Option.some('Global Nick'),
      username: Option.some('bob_discord'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Global Nick** (<@123>)');
    expect(text).not.toContain('bob_discord');
  });

  it('prefers nickname over display_name when both are set', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('456'),
      name: Option.none(),
      nickname: Option.some('Server Nick'),
      display_name: Option.some('Global Nick'),
      username: Option.some('bob_discord'),
    });
    const text = collectFieldValues([attendee]);
    expect(text).toContain('**Server Nick** (<@456>)');
    expect(text).not.toContain('Global Nick');
    expect(text).not.toContain('bob_discord');
  });
});
