import { describe, expect, it } from '@effect/vitest';
import { Option } from 'effect';
import type { DisplayNameParts } from '~/models/DisplayName.js';
import { pickDisplayName } from '~/models/DisplayName.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parts = (overrides: Partial<DisplayNameParts> = {}): DisplayNameParts => ({
  name: Option.none(),
  nickname: Option.none(),
  displayName: Option.none(),
  username: Option.none(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// pickDisplayName — precedence: name → nickname → displayName → username
// ---------------------------------------------------------------------------

describe('pickDisplayName', () => {
  // Case 1: All four slots present — name wins
  it('returns name when all four slots are present (name has highest precedence)', () => {
    const result = pickDisplayName(
      parts({
        name: Option.some('Alice'),
        nickname: Option.some('Nick'),
        displayName: Option.some('Disp'),
        username: Option.some('handle'),
      }),
    );
    expect(result).toEqual(Option.some('Alice'));
  });

  // Case 2: name = None, nickname wins
  it('returns nickname when name is None', () => {
    const result = pickDisplayName(
      parts({
        name: Option.none(),
        nickname: Option.some('Nick'),
        displayName: Option.some('Disp'),
        username: Option.some('handle'),
      }),
    );
    expect(result).toEqual(Option.some('Nick'));
  });

  // Case 3: name/nickname None, displayName wins
  it('returns displayName when name and nickname are None', () => {
    const result = pickDisplayName(
      parts({
        name: Option.none(),
        nickname: Option.none(),
        displayName: Option.some('Disp'),
        username: Option.some('handle'),
      }),
    );
    expect(result).toEqual(Option.some('Disp'));
  });

  // Case 4: Only username present
  it('returns username when it is the only slot present', () => {
    const result = pickDisplayName(
      parts({
        username: Option.some('handle'),
      }),
    );
    expect(result).toEqual(Option.some('handle'));
  });

  // Case 5: All four None — returns none
  it('returns none when all slots are None', () => {
    const result = pickDisplayName(parts());
    expect(result).toEqual(Option.none());
  });

  // Case 6: name beats displayName (explicit precedence check without nickname)
  it('returns name over displayName when name is present', () => {
    const result = pickDisplayName(
      parts({
        name: Option.some('Alice'),
        displayName: Option.some('Disp'),
      }),
    );
    expect(result).toEqual(Option.some('Alice'));
  });

  // Case 7: Empty-string name is skipped, nickname is returned
  it('skips empty-string name and falls back to nickname', () => {
    const result = pickDisplayName(
      parts({
        name: Option.some(''),
        nickname: Option.some('Nick'),
      }),
    );
    expect(result).toEqual(Option.some('Nick'));
  });

  // Case 8: Whitespace-only name is skipped, username is returned
  it('skips whitespace-only name and falls back to username', () => {
    const result = pickDisplayName(
      parts({
        name: Option.some('   '),
        username: Option.some('handle'),
      }),
    );
    expect(result).toEqual(Option.some('handle'));
  });

  // Case 9: All slots empty or whitespace — returns none
  it('returns none when all slots are empty or whitespace', () => {
    const result = pickDisplayName(
      parts({
        name: Option.some(''),
        nickname: Option.some('   '),
        displayName: Option.some(''),
        username: Option.some('  '),
      }),
    );
    expect(result).toEqual(Option.none());
  });

  // Case 10: Value preservation — surrounding spaces are NOT stripped from the returned value
  it('returns the original value unchanged even when it has surrounding spaces (trim used only for presence test)', () => {
    const result = pickDisplayName(
      parts({
        name: Option.some('  Alice  '),
      }),
    );
    // The implementation filters on s.trim().length > 0 but returns the original string.
    // '  Alice  ' passes the filter, so it must be returned as-is.
    expect(result).toEqual(Option.some('  Alice  '));
  });
});
