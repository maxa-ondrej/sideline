import { Data, Effect } from 'effect';

export class LogicError extends Data.TaggedError('LogicError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Creates a function that catches an error and converts it to a defect
 * with a descriptive message via `Effect.die(new LogicError(...))`.
 *
 * @example
 * ```ts
 * pipe(
 *   fetchUser(id),
 *   Effect.catchTag('SqlError', LogicError.withMessage((e) => `Failed fetching user ${id}: ${e.message}`)),
 * )
 * ```
 */
export const make = (message: string, cause?: unknown) => new LogicError({ message, cause });

export const die = (message: string, cause?: unknown): Effect.Effect<never> =>
  Effect.die(make(message, cause));

/**
 * Drop-in replacement for `Effect.die` as a catch handler.
 * Wraps the caught error in a LogicError with the original error's message.
 *
 * @example
 * ```ts
 * Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom)
 * ```
 */
export const dieFrom = (e: unknown): Effect.Effect<never> =>
  Effect.die(make(e instanceof Error ? e.message : String(e), e));

export const withMessage =
  <E>(messageFn: (e: E) => string) =>
  (e: E): Effect.Effect<never> =>
    Effect.die(make(messageFn(e), e));
