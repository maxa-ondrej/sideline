import { fileURLToPath } from 'node:url';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';

const config = defineConfig({
  resolve: {
    alias: {
      // vite-tsconfig-paths would redirect @sideline/domain to source files that use ~/
      // which vite can't resolve outside the project root. Override to use the built dist.
      '@sideline/domain': fileURLToPath(
        new URL('../../packages/domain/dist/dist/esm/index.js', import.meta.url),
      ),
    },
  },
  plugins: [
    devtools(),
    nitro(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['localStorage', 'cookie', 'baseLocale'],
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: false,
      },
    }),
    viteReact(),
  ],
});

export default config;
