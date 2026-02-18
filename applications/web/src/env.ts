import { createEnv } from '@t3-oss/env-core';
import { createServerFn } from '@tanstack/react-start';
import { Schema } from 'effect';

export const fetchEnv = createServerFn().handler(() =>
  createEnv({
    server: {
      SERVER_URL: Schema.NonEmptyTrimmedString.pipe(Schema.standardSchemaV1),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  }),
);
