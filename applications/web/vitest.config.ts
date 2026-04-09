import path from 'node:path';
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    environment: 'jsdom',
    alias: { '~': path.resolve(__dirname, 'src') },
    setupFiles: [path.resolve(__dirname, 'test/setup.ts')],
  },
});
