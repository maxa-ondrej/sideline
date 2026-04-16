import { Discord as DomainDiscord, EventRpcModels } from '@sideline/domain';
import { Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { formatName, formatNameWithMention, joinEntriesWithLimit } from '~/rest/utils.js';

const makeAttendee = (opts: {
  discord_id?: Option.Option<string>;
  name?: Option.Option<string>;
  nickname?: Option.Option<string>;
  display_name?: Option.Option<string>;
  username?: Option.Option<string>;
}): EventRpcModels.RsvpAttendeeEntry =>
  new EventRpcModels.RsvpAttendeeEntry({
    discord_id: Option.map(opts.discord_id ?? Option.none(), DomainDiscord.Snowflake.makeUnsafe),
    name: opts.name ?? Option.none(),
    nickname: opts.nickname ?? Option.none(),
    display_name: opts.display_name ?? Option.none(),
    username: opts.username ?? Option.none(),
    response: 'yes',
    message: Option.none(),
  });

describe('formatName', () => {
  it('returns bold app name when all fields are present', () => {
    const attendee = makeAttendee({
      name: Option.some('Alice'),
      nickname: Option.some('ServerNick'),
      display_name: Option.some('Display'),
      username: Option.some('handle'),
    });
    expect(formatName(attendee)).toBe('**Alice**');
  });

  it('falls back to nickname when name is None', () => {
    const attendee = makeAttendee({
      name: Option.none(),
      nickname: Option.some('ServerNick'),
      display_name: Option.some('Display'),
      username: Option.some('handle'),
    });
    expect(formatName(attendee)).toBe('**ServerNick**');
  });

  it('falls back to display_name when name and nickname are None', () => {
    const attendee = makeAttendee({
      name: Option.none(),
      nickname: Option.none(),
      display_name: Option.some('Display'),
      username: Option.some('handle'),
    });
    expect(formatName(attendee)).toBe('**Display**');
  });

  it('falls back to username when name, nickname, and display_name are None', () => {
    const attendee = makeAttendee({
      name: Option.none(),
      nickname: Option.none(),
      display_name: Option.none(),
      username: Option.some('handle'),
    });
    expect(formatName(attendee)).toBe('**handle**');
  });

  it('returns Unknown when all fields are None', () => {
    const attendee = makeAttendee({
      name: Option.none(),
      nickname: Option.none(),
      display_name: Option.none(),
      username: Option.none(),
    });
    expect(formatName(attendee)).toBe('Unknown');
  });

  it('prefers name over display_name', () => {
    const attendee = makeAttendee({
      name: Option.some('App'),
      nickname: Option.none(),
      display_name: Option.some('Discord'),
      username: Option.none(),
    });
    expect(formatName(attendee)).toBe('**App**');
  });

  it('prefers nickname over display_name', () => {
    const attendee = makeAttendee({
      name: Option.none(),
      nickname: Option.some('ServerNick'),
      display_name: Option.some('Discord'),
      username: Option.none(),
    });
    expect(formatName(attendee)).toBe('**ServerNick**');
  });
});

describe('formatNameWithMention', () => {
  it('formats name and mention as "**Alice** (<@123>)"', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.some('Alice'),
    });
    expect(formatNameWithMention(attendee)).toBe('**Alice** (<@123>)');
  });

  it('formats name only as "**Alice**" when discord_id is None', () => {
    const attendee = makeAttendee({
      discord_id: Option.none(),
      name: Option.some('Alice'),
    });
    expect(formatNameWithMention(attendee)).toBe('**Alice**');
  });

  it('formats mention only when all name fields are None', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
      nickname: Option.none(),
      display_name: Option.none(),
      username: Option.none(),
    });
    expect(formatNameWithMention(attendee)).toBe('<@123>');
  });

  it('returns "Unknown" when everything is None', () => {
    const attendee = makeAttendee({
      discord_id: Option.none(),
      name: Option.none(),
      nickname: Option.none(),
      display_name: Option.none(),
      username: Option.none(),
    });
    expect(formatNameWithMention(attendee)).toBe('Unknown');
  });

  it('falls back to bold nickname with mention when name is None', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
      nickname: Option.some('ServerNick'),
    });
    expect(formatNameWithMention(attendee)).toBe('**ServerNick** (<@123>)');
  });

  it('falls back to bold display_name with mention when name and nickname are None', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
      nickname: Option.none(),
      display_name: Option.some('Display'),
    });
    expect(formatNameWithMention(attendee)).toBe('**Display** (<@123>)');
  });

  it('falls back to bold display_name when name, nickname, username are None and no discord_id', () => {
    const attendee = makeAttendee({
      discord_id: Option.none(),
      name: Option.none(),
      nickname: Option.none(),
      display_name: Option.some('Display'),
      username: Option.none(),
    });
    expect(formatNameWithMention(attendee)).toBe('**Display**');
  });

  it('falls back to bold username with mention when only username is set', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.none(),
      nickname: Option.none(),
      display_name: Option.none(),
      username: Option.some('handle'),
    });
    expect(formatNameWithMention(attendee)).toBe('**handle** (<@123>)');
  });

  it('prefers name over nickname/display_name/username even with discord_id', () => {
    const attendee = makeAttendee({
      discord_id: Option.some('123'),
      name: Option.some('Alice'),
      nickname: Option.some('ServerNick'),
      display_name: Option.some('Display'),
      username: Option.some('handle'),
    });
    expect(formatNameWithMention(attendee)).toBe('**Alice** (<@123>)');
  });
});

describe('joinEntriesWithLimit', () => {
  const andMore = (count: number) => `...and ${count} more`;

  it('returns the full joined string when it fits under the limit', () => {
    const out = joinEntriesWithLimit(['Alice', 'Bob', 'Carol'], andMore, 100);
    expect(out).toBe('Alice, Bob, Carol');
  });

  it('truncates with "...and N more" when the joined result would exceed the limit', () => {
    const entries = ['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD', 'EEEEE'];
    const out = joinEntriesWithLimit(entries, andMore, 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.startsWith('AAAAA')).toBe(true);
    expect(out).toMatch(/\.\.\.and \d+ more$/);
  });

  it('returns only the overflow suffix when even the first entry does not fit', () => {
    const entries = ['WayTooLongEntryThatCannotFit', 'Second'];
    const out = joinEntriesWithLimit(entries, andMore, 10);
    expect(out).toBe('...and 2 more');
  });

  it('handles an empty array by returning an empty string', () => {
    expect(joinEntriesWithLimit([], andMore, 100)).toBe('');
  });

  it('defaults the limit to 1024 characters (Discord embed field cap)', () => {
    const entry = 'x'.repeat(50);
    // 30 * 52 ('x'*50 + ', ') > 1024; should truncate.
    const entries = new Array(30).fill(entry) as Array<string>;
    const out = joinEntriesWithLimit(entries, andMore);
    expect(out.length).toBeLessThanOrEqual(1024);
    expect(out).toMatch(/\.\.\.and \d+ more$/);
  });
});
