import { EventRpcModels } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DateTime, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { buildEventEmbed } from '~/rest/events/buildEventEmbed.js';

const locale = 'en' as const;

const baseOpts = {
  teamId: 'team-1',
  eventId: 'event-1',
  title: 'Weekly Training',
  description: Option.none<string>(),
  imageUrl: Option.none<string>(),
  startAt: DateTime.makeUnsafe('2023-11-14T22:13:20.000Z'),
  endAt: Option.none<DateTime.Utc>(),
  eventType: 'training',
  counts: new EventRpcModels.RsvpCountsResult({
    yesCount: 0,
    noCount: 0,
    maybeCount: 0,
    canRsvp: false,
  }),
  yesAttendees: [] as ReadonlyArray<EventRpcModels.RsvpAttendeeEntry>,
  locale,
};

describe('buildEventEmbed — Where field with locationUrl', () => {
  it('renders plain location text when locationUrl is None', () => {
    const { embeds } = buildEventEmbed({
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
    const { embeds } = buildEventEmbed({
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
    const { embeds } = buildEventEmbed({
      ...baseOpts,
      location: Option.none(),
      locationUrl: Option.some('https://x'),
    });
    const fields = embeds[0].fields ?? [];
    const whereField = fields.find((f) => f.name === m.bot_embed_where({}, { locale }));
    expect(whereField).toBeUndefined();
  });

  it('escapes ] in location text to avoid breaking the markdown link', () => {
    const { embeds } = buildEventEmbed({
      ...baseOpts,
      location: Option.some('Field [B]'),
      locationUrl: Option.some('https://x.test/m'),
    });
    const fields = embeds[0].fields ?? [];
    const whereField = fields.find((f) => f.name === m.bot_embed_where({}, { locale }));
    expect(whereField).toBeDefined();
    // ] must be backslash-escaped inside the link label
    expect(whereField?.value).toBe('[Field [B\\]](<https://x.test/m>)');
  });

  it('escapes \\ in location text before escaping ]', () => {
    const { embeds } = buildEventEmbed({
      ...baseOpts,
      location: Option.some('A\\B'),
      locationUrl: Option.some('https://x.test/m'),
    });
    const fields = embeds[0].fields ?? [];
    const whereField = fields.find((f) => f.name === m.bot_embed_where({}, { locale }));
    expect(whereField).toBeDefined();
    // \ must be doubled before the ] escape
    expect(whereField?.value).toBe('[A\\\\B](<https://x.test/m>)');
  });

  it('wraps URL in angle brackets so parens in the URL path do not break markdown', () => {
    const { embeds } = buildEventEmbed({
      ...baseOpts,
      location: Option.some('Foo'),
      locationUrl: Option.some('https://en.wikipedia.org/wiki/Foo_(bar)'),
    });
    const fields = embeds[0].fields ?? [];
    const whereField = fields.find((f) => f.name === m.bot_embed_where({}, { locale }));
    expect(whereField).toBeDefined();
    expect(whereField?.value).toBe('[Foo](<https://en.wikipedia.org/wiki/Foo_(bar)>)');
  });
});
