import { createEnv } from '@t3-oss/env-core';
import { Schema } from 'effect';

export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_SERVER_URL: Schema.OptionFromNullishOr(Schema.NonEmptyTrimmedString, null).pipe(
      Schema.standardSchemaV1,
    ),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
