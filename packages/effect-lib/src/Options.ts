import { Effect, Option } from 'effect';

export const toEffect =
  <E>(onNone: () => E) =>
  <T>(option: Option.Option<T>): Effect.Effect<T, E> =>
    Option.match(option, {
      onSome: Effect.succeed,
      onNone: () => Effect.fail(onNone()),
    });
