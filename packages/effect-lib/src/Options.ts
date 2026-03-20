import { Effect, Option } from 'effect';

export const toEffect =
  <E>(onNone: () => E) =>
  <T>(option: Option.Option<T>): Effect.Effect<T, E> =>
    Option.match(option, {
      onSome: Effect.succeed,
      onNone: () => Effect.fail(onNone()),
    });

export const extractEffect = <T, E>(
  option: Option.Option<Effect.Effect<T, E>>,
): Effect.Effect<Option.Option<T>, E> =>
  Option.match(option, {
    onSome: (effect) => Effect.map(effect, Option.some),
    onNone: () => Effect.succeed(Option.none()),
  });
