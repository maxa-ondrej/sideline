import { Discord as DomainDiscord, EventRpcModels } from '@sideline/domain';
import { DateTime, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { buildEventEmbed } from '~/rest/events/buildEventEmbed.js';

const makeAttendee = (
  discord_id: Option.Option<string>,
  name: Option.Option<string>,
  username: Option.Option<string> = Option.none(),
  nickname: Option.Option<string> = Option.none(),
): EventRpcModels.RsvpAttendeeEntry =>
  new EventRpcModels.RsvpAttendeeEntry({
    discord_id: Option.map(discord_id, DomainDiscord.Snowflake.makeUnsafe),
    name,
    nickname,
    username,
    response: 'yes',
    message: Option.none(),
  });

const makeCounts = (yesCount = 0, noCount = 0, maybeCount = 0, canRsvp = true) =>
  new EventRpcModels.RsvpCountsResult({ yesCount, noCount, maybeCount, canRsvp });

const START_AT = DateTime.makeUnsafe('2026-06-01T18:00:00Z');

const baseOpts = {
  teamId: 'team-1',
  eventId: 'event-1',
  title: 'Test Event',
  description: Option.none<string>(),
  startAt: START_AT,
  endAt: Option.none<DateTime.Utc>(),
  location: Option.none<string>(),
  eventType: 'training',
  locale: 'en' as const,
};

describe('buildEventEmbed', () => {
  describe('"Going" field', () => {
    it('shows bold names when name is available', () => {
      const attendee = makeAttendee(Option.some('123'), Option.some('Alice'));
      const { embeds } = buildEventEmbed({
        ...baseOpts,
        counts: makeCounts(1, 0, 0),
        yesAttendees: [attendee],
      });

      const fields = embeds[0].fields ?? [];
      const goingField = fields.find((f) => f.name.toLowerCase().includes('going'));
      expect(goingField).toBeDefined();
      expect(goingField?.value).toContain('**Alice**');
    });

    it('renders "Unknown" when name is None and no username or nickname', () => {
      const attendee = makeAttendee(Option.some('456'), Option.none());
      const { embeds } = buildEventEmbed({
        ...baseOpts,
        counts: makeCounts(1, 0, 0),
        yesAttendees: [attendee],
      });

      const fields = embeds[0].fields ?? [];
      const goingField = fields.find((f) => f.name.toLowerCase().includes('going'));
      expect(goingField).toBeDefined();
      expect(goingField?.value).toBe('Unknown');
    });

    it('uses comma-space separator between names', () => {
      const alice = makeAttendee(Option.some('111'), Option.some('Alice'));
      const bob = makeAttendee(Option.some('222'), Option.some('Bob'));
      const { embeds } = buildEventEmbed({
        ...baseOpts,
        counts: makeCounts(2, 0, 0),
        yesAttendees: [alice, bob],
      });

      const fields = embeds[0].fields ?? [];
      const goingField = fields.find((f) => f.name.toLowerCase().includes('going'));
      expect(goingField).toBeDefined();
      expect(goingField?.value).toBe('**Alice**, **Bob**');
    });

    it('shows "+N more" suffix when yesCount > yesAttendees.length', () => {
      const alice = makeAttendee(Option.some('111'), Option.some('Alice'));
      const { embeds } = buildEventEmbed({
        ...baseOpts,
        counts: makeCounts(5, 0, 0),
        yesAttendees: [alice],
      });

      const fields = embeds[0].fields ?? [];
      const goingField = fields.find((f) => f.name.toLowerCase().includes('going'));
      expect(goingField).toBeDefined();
      expect(goingField?.value).toContain('+4 more');
    });

    it('falls back to bold username when name is None but username is set', () => {
      const attendee = makeAttendee(Option.some('789'), Option.none(), Option.some('alice123'));
      const { embeds } = buildEventEmbed({
        ...baseOpts,
        counts: makeCounts(1, 0, 0),
        yesAttendees: [attendee],
      });

      const fields = embeds[0].fields ?? [];
      const goingField = fields.find((f) => f.name.toLowerCase().includes('going'));
      expect(goingField).toBeDefined();
      expect(goingField?.value).toContain('**alice123**');
    });

    it('renders "Unknown" when name, username, and discord_id are all None', () => {
      const attendee = makeAttendee(Option.none(), Option.none());
      const { embeds } = buildEventEmbed({
        ...baseOpts,
        counts: makeCounts(1, 0, 0),
        yesAttendees: [attendee],
      });

      const fields = embeds[0].fields ?? [];
      const goingField = fields.find((f) => f.name.toLowerCase().includes('going'));
      expect(goingField).toBeDefined();
      expect(goingField?.value).toBe('Unknown');
    });

    it('is omitted when isStarted is true', () => {
      const alice = makeAttendee(Option.some('111'), Option.some('Alice'));
      const { embeds } = buildEventEmbed({
        ...baseOpts,
        counts: makeCounts(1, 0, 0),
        yesAttendees: [alice],
        isStarted: true,
      });

      const fields = embeds[0].fields ?? [];
      const goingField = fields.find((f) => f.name.toLowerCase().includes('going'));
      expect(goingField).toBeUndefined();
    });
  });
});
