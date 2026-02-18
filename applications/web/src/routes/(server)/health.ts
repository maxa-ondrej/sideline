import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(server)/health')({
  server: {
    handlers: {
      GET: () => Response.json({ status: 'ok' as const }),
    },
  },
});
