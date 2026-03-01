import { Effect } from 'effect';

export const remove =
  <A extends object, N extends keyof A>(name: N) =>
  <E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.map(self, ({ [name]: _, ...props }) => props);
