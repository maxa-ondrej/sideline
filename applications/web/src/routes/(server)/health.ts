import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(server)/health')({
  ssr: true,
  server: {
    handlers: {
      GET: () => Response.json({ status: 'ok' as const }),
    },
  },
});
