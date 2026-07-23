import { Discord as DomainDiscord } from '@sideline/domain';
import { Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { compareSnowflakes, longestKeepablePrefix } from '~/rcp/event/channelReorderPrefix.js';

/** Convert a numeric-ish ID to a Discord.Snowflake branded string */
const sf = (n: number | string): DomainDiscord.Snowflake =>
  DomainDiscord.Snowflake.makeUnsafe(String(n).padStart(18, '0'));

const some = (n: number) => Option.some(sf(n));
const none = Option.none<DomainDiscord.Snowflake>();

describe('compareSnowflakes', () => {
  it('returns -1 when a < b numerically', () => {
    expect(compareSnowflakes(sf(100), sf(200))).toBe(-1);
  });

  it('returns 1 when a > b numerically', () => {
    expect(compareSnowflakes(sf(200), sf(100))).toBe(1);
  });

  it('returns 0 when a === b', () => {
    expect(compareSnowflakes(sf(100), sf(100))).toBe(0);
  });

  it('compares numerically, not lexicographically (big values)', () => {
    // Lexicographically "999..." < "1000..." would be wrong if compared as
    // strings of different length; both are padded to 18 digits here so this
    // mainly guards against accidental string comparison of the raw values.
    expect(compareSnowflakes(sf('900000000000000000'), sf('100000000000000000'))).toBe(1);
  });
});

describe('longestKeepablePrefix', () => {
  it('returns 0 for an empty list', () => {
    expect(longestKeepablePrefix([])).toBe(0);
  });

  it('T1 pattern: [100,200,300] already strictly increasing — keeps all', () => {
    expect(
      longestKeepablePrefix([
        { snowflake: some(100) },
        { snowflake: some(200) },
        { snowflake: some(300) },
      ]),
    ).toBe(3);
  });

  it('T2 pattern: [300,100,200] — suffix min violates immediately, k=0', () => {
    expect(
      longestKeepablePrefix([
        { snowflake: some(300) },
        { snowflake: some(100) },
        { snowflake: some(200) },
      ]),
    ).toBe(0);
  });

  it('T3 pattern: [100,300,200] — keeps only the first item, k=1', () => {
    expect(
      longestKeepablePrefix([
        { snowflake: some(100) },
        { snowflake: some(300) },
        { snowflake: some(200) },
      ]),
    ).toBe(1);
  });

  it('T4 pattern: [100,150,99] — suffix min violates at i=0, k=0', () => {
    expect(
      longestKeepablePrefix([
        { snowflake: some(100) },
        { snowflake: some(150) },
        { snowflake: some(99) },
      ]),
    ).toBe(0);
  });

  it('a None snowflake at the head breaks the prefix immediately', () => {
    expect(longestKeepablePrefix([{ snowflake: none }, { snowflake: some(200) }])).toBe(0);
  });

  it('a non-increasing pair (equal snowflakes) breaks the prefix at i=0 (suffix min not strictly greater)', () => {
    expect(longestKeepablePrefix([{ snowflake: some(100) }, { snowflake: some(100) }])).toBe(0);
  });

  it('T14 pattern: an override of None on a middle item forces the prefix to stop before it', () => {
    // ev-2's snowflake override is None (simulating a message missing from Discord),
    // even though its numeric position would otherwise fit the increasing prefix.
    const items = [{ snowflake: some(100) }, { snowflake: none }, { snowflake: some(300) }];
    expect(longestKeepablePrefix(items)).toBe(1);
  });

  it('single item with Some snowflake keeps it', () => {
    expect(longestKeepablePrefix([{ snowflake: some(100) }])).toBe(1);
  });

  it('single item with None snowflake is not kept', () => {
    expect(longestKeepablePrefix([{ snowflake: none }])).toBe(0);
  });
});
