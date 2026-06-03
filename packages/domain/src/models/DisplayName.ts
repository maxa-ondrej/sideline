import { Array, Option, pipe } from 'effect';

/**
 * The four name slots used to resolve a display name.
 * Precedence: profile name → Discord nickname → Discord display name → username.
 */
export interface DisplayNameParts {
  readonly name: Option.Option<string>;
  readonly nickname: Option.Option<string>;
  readonly displayName: Option.Option<string>;
  readonly username: Option.Option<string>;
}

/**
 * Picks the best available display name following this precedence:
 * profile name → Discord nickname → Discord display name → username.
 *
 * Returns `Option.none()` only when all four slots are absent or blank.
 */
export const pickDisplayName = (parts: DisplayNameParts): Option.Option<string> =>
  pipe(
    Array.make(parts.name, parts.nickname, parts.displayName, parts.username),
    Array.map(Option.filter((s) => s.trim().length > 0)),
    Array.getSomes,
    Array.head,
  );
