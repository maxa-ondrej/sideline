import { EventRpcModels } from '@sideline/domain';
import { DateTime, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { buildPendingRsvpEmbed, PAGE_SIZE } from '~/rest/events/buildPendingRsvpEmbed.js';

const makeEntry = (
  overrides?: Partial<EventRpcModels.PendingRsvpEntry>,
): EventRpcModels.PendingRsvpEntry =>
  new EventRpcModels.PendingRsvpEntry({
    event_id: 'event-1',
    team_id: 'team-1',
    title: 'Test Event',
    start_at: DateTime.unsafeMake('2026-06-01T18:00:00Z'),
    end_at: Option.none(),
    location: Option.none(),
    event_type: 'training',
    ...overrides,
  });

const baseOpts = {
  guildId: 'guild-1',
  discordUserId: 'user-1',
  offset: 0,
  locale: 'en' as const,
};

describe('buildPendingRsvpEmbed', () => {
  it('renders event titles in the description', () => {
    const events = [
      makeEntry({ event_id: 'e1', title: 'Match vs Rivals' }),
      makeEntry({ event_id: 'e2', title: 'Weekly Training' }),
    ];
    const { embeds } = buildPendingRsvpEmbed({
      ...baseOpts,
      events,
      total: 2,
    });

    const description = embeds[0].description ?? '';
    expect(description).toContain('Match vs Rivals');
    expect(description).toContain('Weekly Training');
  });

  it('shows an empty message when events array is empty', () => {
    const { embeds } = buildPendingRsvpEmbed({
      ...baseOpts,
      events: [],
      total: 0,
    });

    const description = embeds[0].description ?? '';
    expect(description.length).toBeGreaterThan(0);
    // The description should be a non-empty "no pending events" message, not a list
    expect(description).not.toContain('**');
  });

  it('does not render pagination buttons when total <= page size', () => {
    const events = [makeEntry()];
    const { components } = buildPendingRsvpEmbed({
      ...baseOpts,
      events,
      total: 1,
    });

    expect(components).toHaveLength(0);
  });

  it('renders pagination buttons when total > page size', () => {
    const events = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeEntry({ event_id: `e${i}`, title: `Event ${i}` }),
    );
    const { components } = buildPendingRsvpEmbed({
      ...baseOpts,
      events,
      total: PAGE_SIZE + 1,
    });

    expect(components).toHaveLength(1);
    const row = components[0];
    expect(row.type).toBe(1);
    const buttons = (row as { type: 1; components: ReadonlyArray<{ disabled?: boolean }> })
      .components;
    expect(buttons).toHaveLength(2);
    // prev button is disabled on first page (offset = 0)
    expect(buttons[0].disabled).toBe(true);
    // next button is enabled
    expect(buttons[1].disabled).toBe(false);
  });

  it('enables both buttons when on a middle page', () => {
    const events = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeEntry({ event_id: `e${i}`, title: `Event ${i}` }),
    );
    const { components } = buildPendingRsvpEmbed({
      ...baseOpts,
      events,
      total: PAGE_SIZE * 3,
      offset: PAGE_SIZE,
    });

    const row = components[0] as { type: 1; components: ReadonlyArray<{ disabled?: boolean }> };
    expect(row.components[0].disabled).toBe(false); // prev enabled
    expect(row.components[1].disabled).toBe(false); // next enabled
  });

  it('disables next button on the last page', () => {
    const events = Array.from({ length: 2 }, (_, i) =>
      makeEntry({ event_id: `e${i}`, title: `Event ${i}` }),
    );
    const lastOffset = PAGE_SIZE * 2;
    const { components } = buildPendingRsvpEmbed({
      ...baseOpts,
      events,
      total: PAGE_SIZE * 2 + 2,
      offset: lastOffset,
    });

    const row = components[0] as { type: 1; components: ReadonlyArray<{ disabled?: boolean }> };
    expect(row.components[0].disabled).toBe(false); // prev enabled
    expect(row.components[1].disabled).toBe(true); // next disabled
  });
});
