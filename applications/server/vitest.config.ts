import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    env: {
      DATABASE_URL: 'postgres://test:test@localhost/test',
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
      DISCORD_REDIRECT: 'http://localhost',
      FRONTEND_URL: 'http://localhost:5173',
      SERVER_URL: 'http://localhost',
    },
  },
});
