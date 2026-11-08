#!/usr/bin/env node
// Measures how wide the room workbench's left column must be: opens every gallery case's
// Timeline and Overview (pickers closed) at each viewport width, and for each finds the
// narrowest column at which no row wraps, no name is cut short and nothing sticks out past
// the column, against the same room laid out unconstrained. Reports per width the widest
// case and its binding element, what wraps or overflows at the column the stylesheet gives,
// and the row kinds never seen.
//
//   npm run gallery:measure-columns -- [--case <substring>[,<substring>…]]
//                                      [--widths 1280,1440,1680,1920] [--json <file>]
//
// The browser is found as gallery:capture finds it.
import console from 'node:console';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URLSearchParams } from 'node:url';

import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plannerRoot = join(repositoryRoot, 'apps/planner');

function parseArguments(argv) {
  const options = { widths: [1280, 1440, 1680, 1920], filter: '', json: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) throw new Error(`${argument} needs a value`);
      index += 1;
      return next;
    };
    if (argument === '--case') options.filter = value();
    else if (argument === '--json') options.json = resolve(value());
    else if (argument === '--widths')
      options.widths = value()
        .split(',')
        .map((width) => Number(width.trim()))
        .filter((width) => Number.isInteger(width) && width > 0);
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

/**
 * The row kinds the left column can hold. Timeline rows are keyed by their row kind; the
 * rest by the element that lays one line out. Trait outcome and encounter customization
 * rows open in popovers and dialogs, outside the column.
 */
const rowKinds = [
  ['Timeline boundary row', '.timeline-row[data-timeline-row-kind="boundary"]'],
  ['Timeline action row', '.timeline-row[data-timeline-row-kind="action"]'],
  ['Timeline checkpoint row', '.timeline-row[data-timeline-row-kind="checkpoint"]'],
  ['Timeline continuation row', '.timeline-row[data-timeline-row-kind="continuation"]'],
  ['Timeline effect row', '.timeline-row[data-timeline-row-kind="effect"]'],
  ['Timeline insertion row', '.timeline-row[data-timeline-row-kind="insertion"]'],
  ['Timeline Leave room row', '.timeline-row.timeline-leave-row'],
  ['Timeline repair row', '.room-action-repairs .timeline-row'],
  ['Timeline door chips', '.timeline-door-chips'],
  ['Combat order header', '.fields-cage-order'],
  ['Door row', '.door-row'],
  ['Add area line', '.room-add-line'],
  ['Overview labelled row', '.room-layout-row'],
  ['Overview position chips', '.room-layout-chips'],
  ['Overview field line', '.room-overview-workbench .field-control-inline'],
  ['Object presence row', '.room-feature-presence-row'],
  ['Object inventory line', '.room-inventory-line'],
  ['Numbered slots', '.numbered-slots'],
  ['Icon toggle row', '.icon-toggle-row'],
  ['Encounter settings', '.encounter-phase-settings'],
  ['Shop offer row', '.shop-family-offer-row'],
  ['Shrine slot', '.hermes-shrine-slot'],
  ['Pedestal', '.room-contract-pedestal'],
  ['Reroll row', '.room-reroll-row-inline'],
  ['Ship phase', '.ship-phase'],
  ['Ship combat editor', '.ship-combat-editor'],
];

/**
 * Runs in the page: measures one case view. The column is forced to a width by the map
 * grid's first track, or by the panel itself for a room without a map; a width fits when no
 * row is taller than unconstrained and no element ends past the column's right edge.
 */
function measureFrame({ frameIndex, kinds }) {
  const frames = [...globalThis.document.querySelectorAll('[data-gallery-case] .editor-workspace')];
  const frame = frames[frameIndex];
  const caseId = frame.closest('[data-gallery-case]').getAttribute('data-gallery-case');
  const section = frame.closest('[data-gallery-case]');
  const view =
    [...section.querySelectorAll('.editor-workspace')].indexOf(frame) === 0
      ? 'timeline'
      : 'overview';
  const room = frame.querySelector('.biome-occurrence-workbench');
  if (room === null) return { caseId, view, skipped: 'no room workbench' };
  const panel = room.querySelector('.room-workbench-panel');
  // Side rooms lay their map out beside their own doors, in no measured column.
  if (panel.querySelector('.ephyra-side-layout') !== null)
    return { caseId, view, skipped: 'side rooms' };
  const columns = panel.querySelector('.room-map-columns');
  const column = columns?.querySelector(':scope > .room-map-controls-column') ?? panel;
  const mapColumn = columns?.querySelector(':scope > .room-map-column');
  const natural = {
    column: Math.round(column.getBoundingClientRect().width),
    map:
      mapColumn === undefined || mapColumn === null
        ? 0
        : Math.round(mapColumn.getBoundingClientRect().width),
    stacked:
      mapColumn !== undefined &&
      mapColumn !== null &&
      mapColumn.getBoundingClientRect().top > column.getBoundingClientRect().top + 1,
  };
  const rows = kinds.flatMap(([kind, selector]) =>
    [...column.querySelectorAll(selector)].map((element) => ({ kind, element })),
  );
  const describe = (element) => {
    const classes = [...element.classList]
      .slice(0, 2)
      .map((name) => `.${name}`)
      .join('');
    const rowKind = element.getAttribute('data-timeline-row-kind');
    const label =
      element.getAttribute('aria-label') ??
      element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 40) ??
      '';
    return `${element.tagName.toLowerCase()}${classes}${rowKind === null ? '' : `[${rowKind}]`} "${label}"`;
  };
  const visible = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  const leaves = () => [...column.querySelectorAll('*')].filter(visible);
  const force = (width) => {
    if (width === undefined) {
      if (columns) columns.style.removeProperty('grid-template-columns');
      else panel.style.removeProperty('width');
      return;
    }
    if (columns) columns.style.gridTemplateColumns = `${width}px 400px`;
    else panel.style.width = `${width}px`;
  };
  // A doors table gives its rows two lines only where it does not fit, measured as it
  // resizes; the forced widths below come and go before it measures, so every table is held
  // on one line while they apply and takes its own layout back at the stylesheet's column.
  const tables = [...column.querySelectorAll('.door-rows')].map((table) => ({
    table,
    layout: table.getAttribute('data-layout'),
  }));
  const twoLineTables = tables.filter(({ layout }) => layout === 'two-line').length;
  for (const { table } of tables) table.removeAttribute('data-layout');
  // What the room needs where it is free to lay everything on one line.
  const unconstrained = 1600;
  force(unconstrained);
  const baseHeights = rows.map(({ element }) => element.getBoundingClientRect().height);
  // Text cut short: a name a picker ellipsizes, which it does not where the room is free.
  const truncated = () =>
    new Set(
      leaves().filter(
        (element) =>
          element.scrollWidth > element.clientWidth + 1 &&
          globalThis.getComputedStyle(element).overflowX !== 'visible',
      ),
    );
  const baseTruncated = truncated();
  // Rows taller than unconstrained, names cut short, and content past the column, where a
  // map room's map stands.
  const failures = () => {
    const right = column.getBoundingClientRect().right;
    const wrapped = rows.flatMap(({ kind, element }, index) =>
      visible(element) && element.getBoundingClientRect().height > baseHeights[index] + 1
        ? [{ kind, element }]
        : [],
    );
    const overflow = leaves().flatMap((element) =>
      element.getBoundingClientRect().right > right + 1 ? [{ kind: 'overflow', element }] : [],
    );
    const cut = [...truncated()]
      .filter((element) => !baseTruncated.has(element))
      .map((element) => ({ kind: 'truncated', element }));
    return [...wrapped, ...cut, ...overflow];
  };
  const unconstrainedFailures = failures().filter((failure) => failure.kind === 'overflow');
  let low = 160;
  let high = unconstrained;
  let binding = [];
  while (high - low > 2) {
    const middle = Math.floor((low + high) / 2);
    force(middle);
    const failed = failures();
    if (failed.length === 0) high = middle;
    else {
      low = middle;
      binding = failed;
    }
  }
  // The layout as the stylesheet gives it, against the unconstrained heights.
  force(undefined);
  for (const { table, layout } of tables)
    if (layout !== null) table.setAttribute('data-layout', layout);
  const atNatural = failures();
  return {
    caseId,
    view,
    hasMap: columns !== null,
    natural,
    required: high,
    binding: binding.slice(0, 3).map((failure) => `${failure.kind}: ${describe(failure.element)}`),
    unconstrainedOverflow: unconstrainedFailures.length,
    atNatural: atNatural
      .slice(0, 3)
      .map((failure) => `${failure.kind}: ${describe(failure.element)}`),
    atNaturalCount: atNatural.length,
    twoLineTables,
    seen: [...new Set(rows.map((row) => row.kind))],
  };
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
const report = [];
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: chromiumExecutable() });
  const search = new URLSearchParams({ views: 'all', pickers: 'closed' });
  if (options.filter !== '') search.set('case', options.filter);
  const url = `http://127.0.0.1:${port}/?${search}`;
  for (const width of options.widths) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.on('pageerror', (error) => console.error(`[${width}] page error: ${error.message}`));
    await page.goto(url, { waitUntil: 'load', timeout: 300_000 });
    await page.waitForSelector('body[data-gallery-ready="true"]', { timeout: 300_000 });
    await page.waitForLoadState('networkidle');
    const frameCount = await page.locator('[data-gallery-case] .editor-workspace').count();
    const results = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      // Only the measured case lays out, so each forced width reflows one room.
      await page.evaluate((index) => {
        const frames = [
          ...globalThis.document.querySelectorAll('[data-gallery-case] .editor-workspace'),
        ];
        frames.forEach((frame, other) => {
          frame.style.display = other === index ? '' : 'none';
        });
      }, frameIndex);
      // Components that size themselves from a resize observer settle once it reports.
      await page.evaluate(
        () =>
          new Promise((settled) =>
            globalThis.requestAnimationFrame(() =>
              globalThis.requestAnimationFrame(() => globalThis.setTimeout(settled, 50)),
            ),
          ),
      );
      results.push(await page.evaluate(measureFrame, { frameIndex, kinds: rowKinds }));
    }
    await page.close();
    report.push({ width, results });
  }
} finally {
  await browser?.close();
  await server.close();
}

const seen = new Set(
  report.flatMap(({ results }) => results.flatMap((result) => result.seen ?? [])),
);
for (const { width, results } of report) {
  const measured = results.filter((result) => result.skipped === undefined);
  const mapped = measured.filter((result) => result.hasMap);
  const widest = [...measured].sort((left, right) => right.required - left.required);
  const naturalColumns = mapped.map((result) => result.natural.column);
  const naturalMaps = mapped.map((result) => result.natural.map);
  console.log(
    `\n== ${width}px viewport: ${measured.length} views measured, ${results.length - measured.length} skipped`,
  );
  if (mapped.length > 0)
    console.log(
      `   map rooms: left column ${Math.min(...naturalColumns)}–${Math.max(...naturalColumns)}px, map ${Math.min(...naturalMaps)}–${Math.max(...naturalMaps)}px, stacked in ${mapped.filter((result) => result.natural.stacked).length}`,
    );
  console.log('   widest required (case/view: px, binding element just below it):');
  for (const result of widest.slice(0, 8))
    console.log(
      `   ${String(result.required).padStart(5)}  ${result.caseId}/${result.view}${result.hasMap ? '' : ' (no map)'}\n          ${result.binding.join('\n          ')}`,
    );
  const twoLine = measured.filter((result) => result.twoLineTables > 0);
  console.log(
    `   doors tables on two lines: ${twoLine.length === 0 ? 'none' : twoLine.map((result) => `${result.caseId}/${result.view}`).join(', ')}`,
  );
  const wrappedNow = measured.filter((result) => result.atNaturalCount > 0);
  console.log(`   wrapping or overflowing at today's column: ${wrappedNow.length}`);
  for (const result of wrappedNow.slice(0, 12))
    console.log(
      `     ${result.caseId}/${result.view} (column ${result.natural.column}px, needs ${result.required}px): ${result.atNatural[0]}`,
    );
  const brokenAlways = measured.filter((result) => result.unconstrainedOverflow > 0);
  if (brokenAlways.length > 0)
    console.log(
      `   overflowing even unconstrained: ${brokenAlways.map((result) => `${result.caseId}/${result.view}`).join(', ')}`,
    );
}
const unseen = rowKinds.map(([kind]) => kind).filter((kind) => !seen.has(kind));
console.log(`\nRow kinds never seen: ${unseen.length === 0 ? 'none' : unseen.join(', ')}`);
const skipped = [
  ...new Set(
    report.flatMap(({ results }) =>
      results
        .filter((result) => result.skipped !== undefined)
        .map((result) => `${result.caseId}/${result.view}`),
    ),
  ),
];
if (skipped.length > 0)
  console.log(`Skipped (no room workbench, or side rooms): ${skipped.join(', ')}`);
if (options.json !== undefined) writeFileSync(options.json, JSON.stringify(report, null, 2));
