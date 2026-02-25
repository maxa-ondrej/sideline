import path from 'node:path';
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    alias: { '~': path.resolve(__dirname, 'src') },
    env: {
      DISCORD_BOT_TOKEN: 'token',
      SERVER_URL: 'http://localhost:3000',
    },
  },
});
