import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runFeedTask } from './events-build.mjs';

/**
 * Builds the plan catalog index from authored entry folders with the planner's single catalog
 * builder (apps/planner/src/workspace/catalogFeedBuilder.ts), for the catalog repository's
 * workflows:
 *
 *   npm run catalog:build -- --entries <dir> --categories <file> --out <dir>
 *
 * It writes catalog.json, each listed entry's <slug>.runplanner.json (a byte copy of its plan)
 * and summary.txt; every plan is loaded and compiled to refuse one the planner could not open.
 */
export function parseCatalogBuildArguments(argv) {
  const options = {};
  const valued = new Map([
    ['--entries', 'entries'],
    ['--categories', 'categories'],
    ['--out', 'out'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (valued.has(argument) && index + 1 < argv.length) {
      options[valued.get(argument)] = argv[(index += 1)];
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  if (
    options.entries === undefined ||
    options.categories === undefined ||
    options.out === undefined
  ) {
    throw new Error('--entries, --categories and --out are required.');
  }
  return options;
}

export function catalogBuildEnvironment(options, cwd = process.cwd()) {
  return {
    RUN_PLANNER_CATALOG_ENTRIES: resolve(cwd, options.entries),
    RUN_PLANNER_CATALOG_CATEGORIES: resolve(cwd, options.categories),
    RUN_PLANNER_CATALOG_OUT: resolve(cwd, options.out),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let options;
  try {
    options = parseCatalogBuildArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
  runFeedTask('vitest.catalog-feed.config.ts', catalogBuildEnvironment(options));
}
