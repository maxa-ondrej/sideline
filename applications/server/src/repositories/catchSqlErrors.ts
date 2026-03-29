import { LogicError } from '@sideline/effect-lib';
import { Effect } from 'effect';

/**
 * Catches `SqlError` and `ParseError` from `@effect/sql` and converts them
 * into `LogicError` defects.  Drop-in replacement for the verbose
 * `Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom)` pattern
 * used across all repository methods.
 *
 * Designed for use in `.pipe()` chains:
 * ```ts
 * this._query(input).pipe(catchSqlErrors)
 * ```
 */
export const catchSqlErrors = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<
  A,
  Exclude<E, { readonly _tag: 'SqlError' } | { readonly _tag: 'ParseError' }>,
  R
> =>
  effect.pipe(
    Effect.catchTags({
      SqlError: LogicError.dieFrom,
      ParseError: LogicError.dieFrom,
    }),
  ) as never;
