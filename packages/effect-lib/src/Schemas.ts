import { Option, Schema } from 'effect';

export const NodeEnv = Schema.OptionFromNullishOr(Schema.String, null).pipe(
  Schema.transform(Schema.Literal('production', 'development'), {
    strict: true,
    decode: (raw) => (Option.contains(raw, 'production') ? 'production' : 'development'),
    encode: Option.some,
  }),
);

export const Optional =
  <T, E>(targetSchema: Schema.Schema<T>, lazyDefault: () => T) =>
  (schema: Schema.Schema<T, E>) =>
    Schema.transform(Schema.OptionFromNullishOr(schema, null), targetSchema, {
      strict: true,
      decode: Option.getOrElse(lazyDefault),
      encode: Option.some,
    });
