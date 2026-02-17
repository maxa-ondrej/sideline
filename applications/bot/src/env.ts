import { Runtime } from '@sideline/effect-lib';
import { createEnv } from '@t3-oss/env-core';
import { Schema } from 'effect';

export const env = createEnv({
  server: {
    NODE_ENV: Schema.standardSchemaV1(Runtime.NodeEnvSchema),
    DISCORD_BOT_TOKEN: Schema.NonEmptyTrimmedString.pipe(Schema.Redacted, Schema.standardSchemaV1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
