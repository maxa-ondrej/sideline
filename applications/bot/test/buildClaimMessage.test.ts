import * as m from '@sideline/i18n/messages';
import { DateTime, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { buildClaimMessage } from '~/rest/events/buildClaimMessage.js';

const locale = 'en' as const;

const baseOpts = {
  title: 'Tuesday Training',
  startAt: DateTime.makeUnsafe('2023-11-14T22:13:20.000Z'),
  endAt: Option.none<DateTime.Utc>(),
  description: Option.none<string>(),
  claimedBy: Option.none<{ teamMemberId: string; displayName: string }>(),
  eventStatus: 'active',
  teamId: 'team-1',
  eventId: 'event-1',
  locale,
};

describe('buildClaimMessage — Where field with locationUrl', () => {
  it('renders plain location text when locationUrl is None', () => {
    const { embeds } = buildClaimMessage({
      ...baseOpts,
      location: Option.some('Main Field'),
      locationUrl: Option.none(),
    });
    const fields = embeds[0].fields ?? [];
    const whereField = fields.find((f) => f.name === m.bot_embed_where({}, { locale }));
    expect(whereField).toBeDefined();
    expect(whereField?.value).toBe('Main Field');
  });

  it('renders a markdown link when location and locationUrl are both Some', () => {
    const { embeds } = buildClaimMessage({
      ...baseOpts,
      location: Option.some('Main Field'),
      locationUrl: Option.some('https://maps.google.com/x'),
    });
    const fields = embeds[0].fields ?? [];
    const whereField = fields.find((f) => f.name === m.bot_embed_where({}, { locale }));
    expect(whereField).toBeDefined();
    expect(whereField?.value).toBe('[Main Field](<https://maps.google.com/x>)');
  });

  it('omits the Where field when location is None even if locationUrl is Some', () => {
    const { embeds } = buildClaimMessage({
      ...baseOpts,
      location: Option.none(),
      locationUrl: Option.some('https://x'),
    });
    const fields = embeds[0].fields ?? [];
    const whereField = fields.find((f) => f.name === m.bot_embed_where({}, { locale }));
    expect(whereField).toBeUndefined();
  });
});
