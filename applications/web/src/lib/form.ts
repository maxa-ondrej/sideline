import { Effect } from 'effect';
import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { SilentClientError } from '~/lib/runtime';

export const withFieldErrors =
  <TFieldValues extends FieldValues>(
    form: UseFormReturn<TFieldValues>,
    mapping: ReadonlyArray<{
      readonly tag: string;
      readonly field: FieldPath<TFieldValues>;
      readonly message: string;
    }>,
  ) =>
  <A, E extends { readonly _tag: string }, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, Exclude<E, { readonly _tag: string }> | SilentClientError, R> =>
    effect.pipe(
      Effect.catchIf(
        (e): e is E & { readonly _tag: string } => {
          const match = mapping.find((m) => m.tag === e._tag);
          return match !== undefined;
        },
        (e) => {
          const match = mapping.find((m) => m.tag === e._tag);
          if (match) {
            form.setError(match.field, { message: match.message });
          }
          return new SilentClientError({ message: e._tag });
        },
      ),
    ) as Effect.Effect<A, Exclude<E, { readonly _tag: string }> | SilentClientError, R>;
