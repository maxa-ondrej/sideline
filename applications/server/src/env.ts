import { createEnv } from '@t3-oss/env-core';
import { Option, Schema } from 'effect';

export const env = createEnv({
  server: {
    NODE_ENV: Schema.OptionFromNullishOr(Schema.String, null).pipe(
      Schema.transform(Schema.Literal('production', 'development'), {
        strict: true,
        decode: (raw) => (Option.contains(raw, 'production') ? 'production' : 'development'),
        encode: Option.some,
      }),
      Schema.standardSchemaV1,
    ),
    DATABASE_URL: Schema.NonEmptyTrimmedString.pipe(Schema.Redacted, Schema.standardSchemaV1),
    DISCORD_CLIENT_ID: Schema.NonEmptyTrimmedString.pipe(Schema.standardSchemaV1),
    DISCORD_CLIENT_SECRET: Schema.NonEmptyTrimmedString.pipe(
      Schema.Redacted,
      Schema.standardSchemaV1,
    ),
    DISCORD_REDIRECT_URI: Schema.URL.pipe(Schema.standardSchemaV1),
    FRONTEND_URL: Schema.URL.pipe(Schema.standardSchemaV1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
