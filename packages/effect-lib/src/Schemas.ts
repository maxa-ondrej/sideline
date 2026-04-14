import { Array, flow, Option, Schema, SchemaGetter, String } from 'effect';

export const NodeEnv = Schema.OptionFromNullishOr(Schema.String).pipe(
  Schema.decodeTo(Schema.Literals(['production', 'development']), {
    decode: SchemaGetter.transform((raw: Option.Option<string>) =>
      Option.contains(raw, 'production') ? 'production' : 'development',
    ),
    encode: SchemaGetter.transform(Option.some<'production' | 'development'>),
  }),
);

// Wraps a schema so that a nullish encoded input falls back to `lazyDefault()`.
// Used for parsing env vars where we only ever decode — the encode side is a
// simple wrap into the optional form.
export const Optional =
  <T>(lazyDefault: () => T) =>
  <R>(schema: Schema.Codec<T, string | undefined | null, R>) =>
    Schema.OptionFromNullishOr(schema).pipe(
      Schema.decodeTo(schema as Schema.Codec<T, string | null | undefined, R>, {
        decode: SchemaGetter.transform(
          (opt: Option.Option<T>) =>
            Schema.encodeSync(schema as Schema.Codec<T, string | null | undefined, R>)(
              Option.match(opt, {
                onNone: lazyDefault,
                onSome: (v) => v,
              }),
            ) as unknown as string,
        ),
        encode: SchemaGetter.transform((_s: string | null | undefined) => Option.none<T>()),
      }),
    );

export const DateTimeFromDate = Schema.DateTimeUtcFromDate;

export const DateTimeFromIsoString = Schema.DateTimeUtcFromString;

export const ArrayFromSplitString = (separator: string = ',') =>
  Schema.String.pipe(
    Schema.decodeTo(Schema.Array(Schema.NonEmptyString), {
      decode: SchemaGetter.transform(
        flow(String.split(separator), Array.filter(String.isNonEmpty)),
      ),
      encode: SchemaGetter.transform(Array.join(separator)),
    }),
  );

// LogLevel in Effect 4 is a plain string union, so the literal schema itself
// is the LogLevel schema — no conversion needed.
export const LogLevelFromString = Schema.Literals([
  'All',
  'Fatal',
  'Error',
  'Warn',
  'Info',
  'Debug',
  'Trace',
  'None',
]);
