import { Discord as DomainDiscord, EventRpcModels } from '@sideline/domain';
import { DateTime, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { sortEntriesForChannel } from '~/rcp/event/reorderChannelMessages.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

let entryCounter = 0;

const makeEntry = (
  isoDate: string,
  overrides?: Partial<Pick<EventRpcModels.ChannelEventEntry, 'event_id' | 'discord_message_id'>>,
): EventRpcModels.ChannelEventEntry => {
  const id = String(++entryCounter).padStart(18, '0');
  return new EventRpcModels.ChannelEventEntry({
    event_id: overrides?.event_id ?? `event-${id}`,
    team_id: 'team-1',
    title: 'Test Event',
    description: Option.none(),
    image_url: Option.none(),
    start_at: DateTime.makeUnsafe(isoDate),
    end_at: Option.none(),
    location: Option.none(),
    location_url: Option.none(),
    event_type: 'match',
    status: 'scheduled',
    discord_message_id: overrides?.discord_message_id ?? DomainDiscord.Snowflake.makeUnsafe(id),
  });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sortEntriesForChannel', () => {
  const NOW = DateTime.makeUnsafe('2026-01-22T00:00:00Z');

  it('sorts all-future entries with nearest upcoming last', () => {
    const jan25 = makeEntry('2026-01-25T00:00:00Z');
    const jan23 = makeEntry('2026-01-23T00:00:00Z');
    const jan30 = makeEntry('2026-01-30T00:00:00Z');

    const result = sortEntriesForChannel([jan25, jan23, jan30], NOW);

    expect(result.map((e) => e.start_at)).toEqual([
      DateTime.makeUnsafe('2026-01-30T00:00:00Z'),
      DateTime.makeUnsafe('2026-01-25T00:00:00Z'),
      DateTime.makeUnsafe('2026-01-23T00:00:00Z'),
    ]);
  });

  it('sorts all-past entries by start_at ascending', () => {
    const jan15 = makeEntry('2026-01-15T00:00:00Z');
    const jan10 = makeEntry('2026-01-10T00:00:00Z');
    const jan18 = makeEntry('2026-01-18T00:00:00Z');

    const result = sortEntriesForChannel([jan15, jan10, jan18], NOW);

    expect(result.map((e) => e.start_at)).toEqual([
      DateTime.makeUnsafe('2026-01-10T00:00:00Z'),
      DateTime.makeUnsafe('2026-01-15T00:00:00Z'),
      DateTime.makeUnsafe('2026-01-18T00:00:00Z'),
    ]);
  });

  it('puts past entries before future entries with nearest upcoming last', () => {
    const jan20 = makeEntry('2026-01-20T00:00:00Z');
    const jan25 = makeEntry('2026-01-25T00:00:00Z');
    const jan23 = makeEntry('2026-01-23T00:00:00Z');
    const jan21 = makeEntry('2026-01-21T00:00:00Z');
    const jan30 = makeEntry('2026-01-30T00:00:00Z');

    const result = sortEntriesForChannel([jan20, jan25, jan23, jan21, jan30], NOW);

    expect(result.map((e) => e.start_at)).toEqual([
      DateTime.makeUnsafe('2026-01-20T00:00:00Z'),
      DateTime.makeUnsafe('2026-01-21T00:00:00Z'),
      DateTime.makeUnsafe('2026-01-30T00:00:00Z'),
      DateTime.makeUnsafe('2026-01-25T00:00:00Z'),
      DateTime.makeUnsafe('2026-01-23T00:00:00Z'),
    ]);
  });

  it('handles single entry', () => {
    const jan25 = makeEntry('2026-01-25T00:00:00Z');

    const result = sortEntriesForChannel([jan25], NOW);

    expect(result).toHaveLength(1);
    expect(result[0].start_at).toEqual(DateTime.makeUnsafe('2026-01-25T00:00:00Z'));
  });

  it('handles empty array', () => {
    const result = sortEntriesForChannel([], NOW);

    expect(result).toEqual([]);
  });

  it('handles entries with same start_at', () => {
    const jan25a = makeEntry('2026-01-25T00:00:00Z', {
      event_id: 'event-same-a',
      discord_message_id: DomainDiscord.Snowflake.makeUnsafe('100000000000000001'),
    });
    const jan25b = makeEntry('2026-01-25T00:00:00Z', {
      event_id: 'event-same-b',
      discord_message_id: DomainDiscord.Snowflake.makeUnsafe('100000000000000002'),
    });

    const result = sortEntriesForChannel([jan25a, jan25b], NOW);

    expect(result).toHaveLength(2);
    const eventIds = result.map((e) => e.event_id);
    expect(eventIds).toContain('event-same-a');
    expect(eventIds).toContain('event-same-b');
  });

  it('treats event at exactly now as future', () => {
    const jan22 = makeEntry('2026-01-22T00:00:00Z');
    const jan25 = makeEntry('2026-01-25T00:00:00Z');

    const result = sortEntriesForChannel([jan22, jan25], NOW);

    // Both are future (start_at >= now), sorted descending → nearest last
    // jan25 comes first (further away), jan22 comes last (nearest upcoming)
    expect(result.map((e) => e.start_at)).toEqual([
      DateTime.makeUnsafe('2026-01-25T00:00:00Z'),
      DateTime.makeUnsafe('2026-01-22T00:00:00Z'),
    ]);
  });
});
