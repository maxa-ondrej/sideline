import { EventRpcModels } from '@sideline/domain';
import { Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { formatName } from '~/rest/utils.js';

const makeAttendee = (opts: {
  name?: Option.Option<string>;
  nickname?: Option.Option<string>;
  display_name?: Option.Option<string>;
  username?: Option.Option<string>;
}): EventRpcModels.RsvpAttendeeEntry =>
  new EventRpcModels.RsvpAttendeeEntry({
    discord_id: Option.none(),
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
