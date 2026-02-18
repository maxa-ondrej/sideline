import { Runtime } from '@sideline/effect-lib';
import { createEnv } from '@t3-oss/env-core';
import { Schema } from 'effect';

export const env = createEnv({
  server: {
    NODE_ENV: Schema.standardSchemaV1(Runtime.NodeEnvSchema),
    DATABASE_URL: Schema.NonEmptyTrimmedString.pipe(Schema.Redacted, Schema.standardSchemaV1),
    DISCORD_CLIENT_ID: Schema.NonEmptyTrimmedString.pipe(Schema.standardSchemaV1),
    DISCORD_CLIENT_SECRET: Schema.NonEmptyTrimmedString.pipe(
      Schema.Redacted,
      Schema.standardSchemaV1,
    ),
    DISCORD_REDIRECT_URI: Schema.URL.pipe(Schema.standardSchemaV1),
    FRONTEND_URL: Schema.URL.pipe(Schema.standardSchemaV1),
    SERVER_URL: Schema.URL.pipe(Schema.standardSchemaV1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
