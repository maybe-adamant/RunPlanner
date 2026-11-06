#!/usr/bin/env node
// Captures the Timeline row gallery: starts its Vite server on a free port, screenshots
// every case at each width, and exits.
//
//   npm run gallery:capture -- [--out <dir>] [--case <substring>[,<substring>…]]
//                              [--widths 1440,960] [--full]
//
// The browser is Playwright's Chromium headless shell: PLAYWRIGHT_CHROMIUM_EXECUTABLE, the
// one this Playwright version installs, or the newest in the Playwright cache.
import console from 'node:console';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plannerRoot = join(repositoryRoot, 'apps/planner');

function parseArguments(argv) {
  const options = {
    out: join(plannerRoot, 'test-results/gallery'),
    widths: [1440, 960],
    filter: '',
    full: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) throw new Error(`${argument} needs a value`);
      index += 1;
      return next;
    };
    if (argument === '--out') options.out = resolve(value());
    else if (argument === '--case') options.filter = value();
    else if (argument === '--widths')
      options.widths = value()
        .split(',')
        .map((width) => Number(width.trim()))
        .filter((width) => Number.isInteger(width) && width > 0);
    else if (argument === '--full') options.full = true;
    else throw new Error(`Unknown argument ${argument}`);
  }
  if (options.widths.length === 0) throw new Error('--widths names no width');
  return options;
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function chromiumExecutable() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (explicit !== undefined && explicit !== '') return explicit;
  const bundled = chromium.executablePath();
  if (existsSync(bundled)) return bundled;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), '.cache/ms-playwright');
  const shells = existsSync(cache)
    ? readdirSync(cache)
        .filter((name) => name.startsWith('chromium_headless_shell-'))
        .sort((left, right) => Number(right.split('-')[1]) - Number(left.split('-')[1]))
        .map((name) => join(cache, name, 'chrome-headless-shell-linux64/chrome-headless-shell'))
        .filter((path) => existsSync(path))
    : [];
  if (shells[0] !== undefined) return shells[0];
  throw new Error(
    'No Chromium found: run `npx playwright-core install chromium-headless-shell` or set PLAYWRIGHT_CHROMIUM_EXECUTABLE.',
  );
}

const options = parseArguments(process.argv.slice(2));
process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING ??= 'true';
const port = await freePort();
const server = await createServer({
  configFile: join(plannerRoot, 'vite.gallery.config.ts'),
  server: { port, strictPort: true, hmr: false },
  logLevel: 'warn',
});
let browser;
let failed = false;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: chromiumExecutable() });
  const query = options.filter === '' ? '' : `?case=${encodeURIComponent(options.filter)}`;
  const url = `http://127.0.0.1:${port}/${query}`;
  for (const width of options.widths) {
    const directory = join(options.out, String(width));
    rmSync(directory, { force: true, recursive: true });
    mkdirSync(directory, { recursive: true });
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.on('pageerror', (error) => {
      failed = true;
      console.error(`[${width}] page error: ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(`[${width}] console: ${message.text()}`);
    });
    await page.goto(url, { waitUntil: 'load', timeout: 300_000 });
    await page.waitForSelector('body[data-gallery-ready="true"]', { timeout: 300_000 });
    await page.waitForLoadState('networkidle');
    await page.evaluate(() =>
      Promise.all(
        [...globalThis.document.images].map((image) =>
          image.complete ? undefined : new Promise((done) => image.addEventListener('load', done)),
        ),
      ),
    );
    const cases = await page.$$eval('[data-gallery-case]', (sections) =>
      sections.map((section) => ({
        id: section.getAttribute('data-gallery-case'),
        error: section.querySelector('[data-gallery-error]')?.textContent ?? null,
      })),
    );
    if (cases.length === 0) {
      failed = true;
      console.error(`No gallery case matches ${options.filter}`);
    }
    for (const { id, error } of cases) {
      if (error !== null) {
        failed = true;
        console.error(`[${width}] ${id} failed: ${error.split('\n')[0]}`);
      }
      const section = page.locator(`[data-gallery-case="${id}"]`);
      await section.screenshot({ path: join(directory, `${id}.png`), animations: 'disabled' });
    }
    if (options.full)
      await page.screenshot({ path: join(directory, 'gallery.png'), fullPage: true });
    await page.close();
    console.log(`${width}: ${cases.length} case(s) in ${directory}`);
  }
} finally {
  await browser?.close();
  await server.close();
}
process.exitCode = failed ? 1 : 0;
