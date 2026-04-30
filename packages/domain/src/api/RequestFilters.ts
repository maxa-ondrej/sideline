import { Option } from 'effect';

/**
 * Field state classification for cross-field schema filters.
 *
 * - `'absent'`  — field is not in the request (Option.none on a single-Option create field, or Option.none outer on a double-Option update field). Encoded form: key is `undefined`.
 * - `'clearing'` — field is in the request and is being set to "no value" (null on a single-Option create field, or Option.some(Option.none()) on a double-Option update field). Encoded form: value is `null`.
 * - `'setting'`  — field is in the request and is being set to a concrete value. Encoded form: a non-null value.
 */
export type FieldState = 'absent' | 'clearing' | 'setting';

/**
 * Classify an optional/patch field on a request schema regardless of whether
 * the surrounding `Schema.check` filter is running in the decode direction
 * (input is `Option<T>` or `Option<Option<T>>`) or the encode direction
 * (input is `T | null | undefined`).
 *
 * Effect Schema 4 runs struct-level checks on the surrounding pipeline output
 * in both directions, so cross-field predicates that read `._tag` directly
 * crash when a field encodes to `null` or `undefined`. This helper keeps the
 * predicate body symmetric across both directions.
 *
 * `''` (empty string) is intentionally classified as `'setting'` — the schema's
 * field-level non-emptiness rule (e.g., `Schema.NonEmptyString`) is responsible
 * for rejecting empty values, not the cross-field filter.
 */
export const fieldState = (value: unknown): FieldState => {
  if (Option.isOption(value)) {
    if (Option.isNone(value)) return 'absent';
    const inner = value.value;
    if (Option.isOption(inner) && Option.isNone(inner)) return 'clearing';
    return 'setting';
  }
  if (value === undefined) return 'absent';
  if (value === null) return 'clearing';
  return 'setting';
};
