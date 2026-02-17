import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    env: {
      DATABASE_URL: 'postgres://test:test@localhost/test',
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
      DISCORD_REDIRECT_URI: 'http://localhost:3000/auth/callback',
      FRONTEND_URL: 'http://localhost:5173',
    },
  },
});
