import { createEnv } from '@t3-oss/env-core';
import { createFileRoute } from '@tanstack/react-router';
import { schema } from '../../env';

export const Route = createFileRoute('/(server)/config')({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          createEnv({
            server: schema,
            runtimeEnv: import.meta.env,
            emptyStringAsUndefined: true,
          }),
        ),
    },
  },
});
