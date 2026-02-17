import type { Effect } from 'effect';

export const remove =
  <A extends object, N extends keyof A>(name: N) =>
  <E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<Omit<A, N>, E, R> => ({
    ...self,
    [name]: undefined,
  });
