import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';

import { sharedVitestConfig } from '../../vitest.shared';
import base from './vite.config';

// The Timeline row gallery: a dev-only page under test support, never part of the app build.
export default mergeConfig(
  base,
  defineConfig({
    root: fileURLToPath(new URL('./test/support/gallery', import.meta.url)),
    // Its own dependency cache, so a running app dev server keeps its own.
    cacheDir:
      process.env.GALLERY_VITE_CACHE ??
      fileURLToPath(new URL('./node_modules/.vite-gallery', import.meta.url)),
    resolve: { alias: sharedVitestConfig.resolve?.alias ?? [] },
    server: {
      host: '127.0.0.1',
      port: Number(process.env.GALLERY_PORT ?? 5470),
      strictPort: true,
    },
  }),
);
