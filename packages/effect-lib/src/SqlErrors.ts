import { SqlError } from '@effect/sql/SqlError';
import { Effect, Option, Schema } from 'effect';

const PG_UNIQUE_VIOLATION = '23505';

const PgError = Schema.Struct({ code: Schema.String });

const getCode = (cause: unknown): Option.Option<string> =>
  Schema.decodeUnknownOption(PgError)(cause).pipe(Option.map((e) => e.code));

export const isUniqueViolation = (error: SqlError): boolean =>
  getCode(error.cause).pipe(
    Option.map((code) => code === PG_UNIQUE_VIOLATION),
    Option.getOrElse(() => false),
  );

export const catchUniqueViolation =
  <E2>(mapError: () => E2) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    self.pipe(
      Effect.catchIf(
        (e) => e instanceof SqlError && isUniqueViolation(e),
        () => Effect.fail(mapError()),
      ),
    );
