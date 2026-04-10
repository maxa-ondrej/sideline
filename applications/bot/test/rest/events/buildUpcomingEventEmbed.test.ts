import { EventRpcModels } from '@sideline/domain';
import { DateTime, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { buildUpcomingEventPage } from '~/rest/events/buildUpcomingEventEmbed.js';

const FUTURE_START = DateTime.unsafeMake('2099-06-01T18:00:00Z');

const makeEntry = (
  overrides: Partial<
    ConstructorParameters<typeof EventRpcModels.UpcomingEventForUserEntry>[0]
  > = {},
): EventRpcModels.UpcomingEventForUserEntry =>
  new EventRpcModels.UpcomingEventForUserEntry({
    event_id: 'event-1',
    team_id: 'team-1',
    title: 'Training Session',
    description: Option.none(),
    start_at: FUTURE_START,
    end_at: Option.none(),
    location: Option.none(),
    event_type: 'training',
    yes_count: 0,
    no_count: 0,
    maybe_count: 0,
    my_response: Option.none(),
    my_message: Option.none(),
    ...overrides,
  });

const baseParams = {
  currentIndex: 0,
  total: 3,
  locale: 'en' as const,
};

describe('buildUpcomingEventPage', () => {
  describe('embed title and footer', () => {
    it('uses entry title as embed title', () => {
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry: makeEntry() });
      expect(embeds[0].title).toBe('Training Session');
    });

    it('footer shows current + 1 and total', () => {
      const { embeds } = buildUpcomingEventPage({
        ...baseParams,
        entry: makeEntry(),
        currentIndex: 1,
        total: 5,
      });
      expect(embeds[0].footer?.text).toContain('2');
      expect(embeds[0].footer?.text).toContain('5');
    });
  });

  describe('embed color', () => {
    it('uses training color when not started', () => {
      const { embeds } = buildUpcomingEventPage({
        ...baseParams,
        entry: makeEntry({ event_type: 'training' }),
      });
      expect(embeds[0].color).toBe(0x57f287);
    });

    it('uses match color when not started', () => {
      const { embeds } = buildUpcomingEventPage({
        ...baseParams,
        entry: makeEntry({ event_type: 'match' }),
      });
      expect(embeds[0].color).toBe(0xed4245);
    });

    it('uses default color for unknown event type', () => {
      const { embeds } = buildUpcomingEventPage({
        ...baseParams,
        entry: makeEntry({ event_type: 'unknown_type' }),
      });
      expect(embeds[0].color).toBe(0x99aab5);
    });
  });

  describe('description', () => {
    it('includes description text when present', () => {
      const entry = makeEntry({ description: Option.some('Bring your boots') });
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry });
      expect(embeds[0].description).toContain('Bring your boots');
    });

    it('does not include description when absent', () => {
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry: makeEntry() });
      expect(embeds[0].description).not.toContain('Bring your boots');
    });
  });

  describe('fields', () => {
    it('includes a when field', () => {
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry: makeEntry() });
      const fields = embeds[0].fields ?? [];
      const whenField = fields.find(
        (f) => f.name.toLowerCase().includes('when') || f.name.toLowerCase().includes('date'),
      );
      expect(whenField).toBeDefined();
    });

    it('includes location field when location is set', () => {
      const entry = makeEntry({ location: Option.some('Sports Hall') });
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry });
      const fields = embeds[0].fields ?? [];
      const whereField = fields.find((f) => f.value === 'Sports Hall');
      expect(whereField).toBeDefined();
    });

    it('does not include location field when location is absent', () => {
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry: makeEntry() });
      const fields = embeds[0].fields ?? [];
      const hasLocation = fields.some((f) => f.value === 'Sports Hall');
      expect(hasLocation).toBe(false);
    });

    it('includes rsvp counts field with yes/no/maybe values', () => {
      const entry = makeEntry({ yes_count: 5, no_count: 2, maybe_count: 1 });
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry });
      const allValues = (embeds[0].fields ?? []).map((f) => f.value).join(' ');
      expect(allValues).toContain('5');
      expect(allValues).toContain('2');
      expect(allValues).toContain('1');
    });

    it('includes your rsvp field', () => {
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry: makeEntry() });
      const fields = embeds[0].fields ?? [];
      // The "your rsvp" field should exist
      expect(fields.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('when field with end_at', () => {
    it('shows only start timestamp when end_at is absent', () => {
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry: makeEntry() });
      const fields = embeds[0].fields ?? [];
      // First field is "when", should not contain " — "
      expect(fields[0].value).not.toContain(' — ');
    });

    it('shows start and end timestamp separated by dash when end_at is set', () => {
      const endAt = DateTime.unsafeMake('2099-06-01T20:00:00Z');
      const entry = makeEntry({ end_at: Option.some(endAt) });
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry });
      const fields = embeds[0].fields ?? [];
      expect(fields[0].value).toContain(' — ');
    });
  });

  describe('RSVP buttons', () => {
    it('returns two component rows', () => {
      const { components } = buildUpcomingEventPage({ ...baseParams, entry: makeEntry() });
      expect(components).toHaveLength(2);
    });

    it('rsvp row has three buttons', () => {
      const { components } = buildUpcomingEventPage({ ...baseParams, entry: makeEntry() });
      expect(components[0].components).toHaveLength(3);
    });

    it('rsvp buttons are always enabled', () => {
      const { components } = buildUpcomingEventPage({ ...baseParams, entry: makeEntry() });
      const rsvpButtons = components[0].components as ReadonlyArray<{ disabled?: boolean }>;
      expect(rsvpButtons.every((b) => !b.disabled)).toBe(true);
    });

    it('yes button uses success style when my_response is yes', () => {
      const entry = makeEntry({ my_response: Option.some('yes') });
      const { components } = buildUpcomingEventPage({ ...baseParams, entry });
      const yesButton = components[0].components[0] as { style: number };
      expect(yesButton.style).toBe(3); // success/green
    });

    it('no button uses danger style when my_response is no', () => {
      const entry = makeEntry({ my_response: Option.some('no') });
      const { components } = buildUpcomingEventPage({ ...baseParams, entry });
      const noButton = components[0].components[1] as { style: number };
      expect(noButton.style).toBe(4); // danger/red
    });

    it('maybe button uses primary style when my_response is maybe', () => {
      const entry = makeEntry({ my_response: Option.some('maybe') });
      const { components } = buildUpcomingEventPage({ ...baseParams, entry });
      const maybeButton = components[0].components[2] as { style: number };
      expect(maybeButton.style).toBe(1); // primary/blurple
    });

    it('all rsvp buttons use secondary style when my_response is none', () => {
      const entry = makeEntry({ my_response: Option.none() });
      const { components } = buildUpcomingEventPage({ ...baseParams, entry });
      const rsvpButtons = components[0].components as ReadonlyArray<{ style: number }>;
      expect(rsvpButtons.every((b) => b.style === 2)).toBe(true);
    });

    it('rsvp button custom_ids encode event_id, team_id, response, and currentIndex', () => {
      const entry = makeEntry({ event_id: 'ev-42', team_id: 'tm-7' });
      const { components } = buildUpcomingEventPage({ ...baseParams, entry, currentIndex: 2 });
      const [yesBtn, noBtn, maybeBtn] = components[0].components as ReadonlyArray<{
        custom_id: string;
      }>;
      expect(yesBtn.custom_id).toBe('upcoming-rsvp:ev-42:tm-7:yes:2');
      expect(noBtn.custom_id).toBe('upcoming-rsvp:ev-42:tm-7:no:2');
      expect(maybeBtn.custom_id).toBe('upcoming-rsvp:ev-42:tm-7:maybe:2');
    });
  });

  describe('navigation buttons', () => {
    it('prev button is disabled on first page', () => {
      const { components } = buildUpcomingEventPage({
        ...baseParams,
        entry: makeEntry(),
        currentIndex: 0,
      });
      const prevBtn = components[1].components[0] as { disabled?: boolean };
      expect(prevBtn.disabled).toBe(true);
    });

    it('next button is disabled on last page', () => {
      const { components } = buildUpcomingEventPage({
        ...baseParams,
        entry: makeEntry(),
        currentIndex: 2,
        total: 3,
      });
      const nextBtn = components[1].components[1] as { disabled?: boolean };
      expect(nextBtn.disabled).toBe(true);
    });

    it('prev button is enabled on second page', () => {
      const { components } = buildUpcomingEventPage({
        ...baseParams,
        entry: makeEntry(),
        currentIndex: 1,
      });
      const prevBtn = components[1].components[0] as { disabled?: boolean };
      expect(prevBtn.disabled).toBe(false);
    });

    it('next button is enabled when not on last page', () => {
      const { components } = buildUpcomingEventPage({
        ...baseParams,
        entry: makeEntry(),
        currentIndex: 0,
        total: 3,
      });
      const nextBtn = components[1].components[1] as { disabled?: boolean };
      expect(nextBtn.disabled).toBe(false);
    });

    it('nav button custom_ids encode the correct offset', () => {
      const { components } = buildUpcomingEventPage({
        ...baseParams,
        entry: makeEntry(),
        currentIndex: 2,
      });
      const [prevBtn, nextBtn] = components[1].components as ReadonlyArray<{ custom_id: string }>;
      expect(prevBtn.custom_id).toBe('upcoming-page:1');
      expect(nextBtn.custom_id).toBe('upcoming-page:3');
    });
  });

  describe('your rsvp value', () => {
    it('shows "yes" state message when my_response is yes', () => {
      const entry = makeEntry({ my_response: Option.some('yes') });
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry });
      const yourRsvpField = (embeds[0].fields ?? []).find((f) =>
        f.name.toLowerCase().includes('rsvp'),
      );
      expect(yourRsvpField).toBeDefined();
    });

    it('includes message text when my_message is set', () => {
      const entry = makeEntry({
        my_response: Option.some('yes'),
        my_message: Option.some('Cannot wait!'),
      });
      const { embeds } = buildUpcomingEventPage({ ...baseParams, entry });
      const allText = (embeds[0].fields ?? []).map((f) => f.value).join(' ');
      expect(allText).toContain('Cannot wait!');
    });
  });
});
