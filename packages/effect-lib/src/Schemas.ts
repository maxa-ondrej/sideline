import { Array, flow, Option, Schema, String } from 'effect';

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

export const ArrayFromSplitString = (separator: string = ',') =>
  Schema.String.pipe(
    Schema.transform(Schema.Array(Schema.NonEmptyString), {
      strict: true,
      decode: flow(String.split(separator), Array.filter(String.isNonEmpty)),
      encode: Array.join(separator),
    }),
  );
