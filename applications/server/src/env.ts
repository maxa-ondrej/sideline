import { Schemas } from '@sideline/effect-lib';
import { createEnv } from '@t3-oss/env-core';
import { Schema } from 'effect';

export const env = createEnv({
  server: {
    NODE_ENV: Schema.standardSchemaV1(Schemas.NodeEnv),
    PORT: Schema.NumberFromString.pipe(
      Schemas.Optional(Schema.Number, () => 80),
      Schema.standardSchemaV1,
    ),
    HEALTH_PORT: Schema.NumberFromString.pipe(
      Schemas.Optional(Schema.Number, () => 9000),
      Schema.standardSchemaV1,
    ),
    API_PREFIX: Schema.String.pipe(
      Schemas.Optional(Schema.String, () => ''),
      Schema.standardSchemaV1,
    ),
    SERVER_URL: Schema.URL.pipe(Schema.standardSchemaV1),
    DATABASE_URL: Schema.NonEmptyTrimmedString.pipe(Schema.Redacted, Schema.standardSchemaV1),
    DISCORD_CLIENT_ID: Schema.NonEmptyTrimmedString.pipe(Schema.standardSchemaV1),
    DISCORD_CLIENT_SECRET: Schema.NonEmptyTrimmedString.pipe(
      Schema.Redacted,
      Schema.standardSchemaV1,
    ),
    DISCORD_REDIRECT: Schema.URL.pipe(Schema.standardSchemaV1),
    FRONTEND_URL: Schema.URL.pipe(Schema.standardSchemaV1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
