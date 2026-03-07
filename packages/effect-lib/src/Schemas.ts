import { Array, DateTime, flow, LogLevel, Option, Schema, String } from 'effect';

export const NodeEnv = Schema.OptionFromNullishOr(Schema.String, null).pipe(
  Schema.transform(Schema.Literal('production', 'development'), {
    strict: true,
    decode: (raw) => (Option.contains(raw, 'production') ? 'production' : 'development'),
    encode: Option.some,
  }),
);

export const Optional =
  <T>(lazyDefault: () => T) =>
  <R>(schema: Schema.Schema<T, R>) =>
    Schema.transform(Schema.OptionFromNullishOr(schema, null), schema, {
      strict: true,
      decode: (opt) => opt.pipe(Option.getOrElse(lazyDefault), Schema.encodeSync(schema)),
      encode: (_, a) => Option.some(a),
    });

export const DateTimeFromDate = Schema.transform(Schema.DateFromSelf, Schema.DateTimeUtcFromSelf, {
  decode: (date) => DateTime.unsafeFromDate(date),
  encode: (dt) => new Date(DateTime.toEpochMillis(dt)),
});

export const ArrayFromSplitString = (separator: string = ',') =>
  Schema.String.pipe(
    Schema.transform(Schema.Array(Schema.NonEmptyString), {
      strict: true,
      decode: flow(String.split(separator), Array.filter(String.isNonEmpty)),
      encode: Array.join(separator),
    }),
  );

const LogLevelLiteral = Schema.Literal(
  'All',
  'Fatal',
  'Error',
  'Warning',
  'Info',
  'Debug',
  'Trace',
  'None',
);

export const LogLevelFromString = Schema.transform(
  LogLevelLiteral,
  Schema.declare(
    (u): u is LogLevel.LogLevel =>
      typeof u === 'object' && u !== null && '_tag' in u && 'ordinal' in u,
  ),
  {
    strict: true,
    decode: (s) => LogLevel.fromLiteral(s),
    encode: (level) => level._tag as typeof LogLevelLiteral.Type,
  },
);
