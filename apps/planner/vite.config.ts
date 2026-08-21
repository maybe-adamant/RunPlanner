import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

import {
  DEV_BROWSER_ERROR_EVENT,
  type DevBrowserErrorPayload,
} from './src/diagnostics/devBrowserErrorReporter';

function browserErrorRelay(): Plugin {
  return {
    apply: 'serve',
    configureServer(server) {
      server.ws.on(DEV_BROWSER_ERROR_EVENT, (candidate: unknown) => {
        if (!isBrowserErrorPayload(candidate)) {
          server.config.logger.warn('[browser] Ignored malformed diagnostic payload.');
          return;
        }

        const payload = candidate;
        const location =
          payload.source === undefined
            ? ''
            : `\n  at ${payload.source}${payload.line === undefined ? '' : `:${payload.line}:${payload.column ?? 0}`}`;
        const componentStack =
          payload.componentStack === undefined
            ? ''
            : `\nReact component stack:${payload.componentStack}`;
        const stack = payload.stack === undefined ? '' : `\n${payload.stack}`;

        server.config.logger.error(
          `\n[browser:${payload.kind}] ${payload.name === undefined ? '' : `${payload.name}: `}${payload.message}${location}${componentStack}${stack}\n  page: ${payload.pageUrl}`,
        );
      });
    },
    name: 'run-planner-browser-error-relay',
  };
}

function isBrowserErrorPayload(candidate: unknown): candidate is DevBrowserErrorPayload {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }

  const payload = candidate as Partial<DevBrowserErrorPayload>;
  return (
    typeof payload.kind === 'string' &&
    typeof payload.message === 'string' &&
    typeof payload.pageUrl === 'string' &&
    typeof payload.timestamp === 'string' &&
    typeof payload.userAgent === 'string'
  );
}

export default defineConfig({
  plugins: [react(), browserErrorRelay()],
  resolve: {
    alias: {
      '@planner': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
