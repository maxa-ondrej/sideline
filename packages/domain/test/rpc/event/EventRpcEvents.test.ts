import { describe, expect, it } from '@effect/vitest';
import { Option, Schema } from 'effect';
import { EventCreatedEvent } from '~/rpc/event/EventRpcEvents.js';

// Release A expand/contract invariant (remove-global-events-board): the
// server no longer syncs a global events channel, so it stops populating
// `discord_channel_id`, but pre-Release-A pending sync rows may still carry
// an explicit null. These tests pin the wire shape until the field + this
// class are deleted in Release B.
describe('EventCreatedEvent discord_channel_id (transitional)', () => {
  const base = {
    _tag: 'event_created' as const,
    id: 'evt-1',
    team_id: '11111111-1111-1111-1111-111111111111',
    guild_id: '123456789012345678',
    event_id: '22222222-2222-2222-2222-222222222222',
    title: 'Match',
    description: null,
    image_url: null,
    start_at: '2026-05-01T16:00:00.000Z',
    end_at: null,
    location: null,
    location_url: null,
    event_type: 'match',
    all_day: false,
  };

  it('decodes a missing key to None (Release A server emission)', () => {
    const decoded = Schema.decodeUnknownSync(EventCreatedEvent)(base);
    expect(Option.isNone(decoded.discord_channel_id)).toBe(true);
  });

  it('decodes an explicit null to None (pre-Release-A pending rows)', () => {
    const decoded = Schema.decodeUnknownSync(EventCreatedEvent)({
      ...base,
      discord_channel_id: null,
    });
    expect(Option.isNone(decoded.discord_channel_id)).toBe(true);
  });

  it('encodes None as an explicit null key, never omitted (old-consumer compat)', () => {
    const decoded = Schema.decodeUnknownSync(EventCreatedEvent)(base);
    const encoded = Schema.encodeSync(EventCreatedEvent)(decoded);
    expect(Object.hasOwn(encoded, 'discord_channel_id')).toBe(true);
    expect(encoded.discord_channel_id).toBeNull();
  });
});
