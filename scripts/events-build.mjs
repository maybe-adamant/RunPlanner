import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

/**
 * Builds the community event feed from authored event folders with the planner's single event
 * builder (apps/planner/src/workspace/eventFeedBuilder.ts), for the events repository's
 * workflows:
 *
 *   npm run events:build -- --events <dir> --out <dir> --build-id <id> [--previous <events.json>] [--now <iso>]
 *   npm run events:build -- --events <dir> --out <dir> --check
 *
 * It writes events.json, each listed event's <id>.runplanner.json and summary.txt; --check
 * validates every folder, ended ones included, and writes only the summary. The previous feed
 * must already be verified: its plans for other builds are kept.
 */
export function parseEventsBuildArguments(argv) {
  const options = { check: false };
  const valued = new Map([
    ['--events', 'events'],
    ['--out', 'out'],
    ['--build-id', 'buildId'],
    ['--previous', 'previous'],
    ['--now', 'now'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') {
      options.check = true;
    } else if (valued.has(argument) && index + 1 < argv.length) {
      options[valued.get(argument)] = argv[(index += 1)];
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  if (options.events === undefined || options.out === undefined) {
    throw new Error('--events and --out are required.');
  }
  if (!options.check && !/^[0-9a-f]{64}$/.test(options.buildId ?? '')) {
    throw new Error('--build-id must be a 64-character lower-case hex module build id.');
  }
  if (options.now !== undefined && Number.isNaN(Date.parse(options.now))) {
    throw new Error('--now must be an ISO 8601 instant.');
  }
  return options;
}

/** Refuses a named previous feed that does not exist, which would drop older builds' plans. */
export function assertEventsBuildInputs(options, cwd = process.cwd(), exists = existsSync) {
  if (options.previous !== undefined && !exists(resolve(cwd, options.previous))) {
    throw new Error(`The previous feed ${options.previous} does not exist.`);
  }
}

export function eventsBuildEnvironment(options, cwd = process.cwd()) {
  return {
    RUN_PLANNER_EVENTS_DIR: resolve(cwd, options.events),
    RUN_PLANNER_EVENTS_OUT: resolve(cwd, options.out),
    ...(options.check ? { RUN_PLANNER_EVENTS_CHECK_ONLY: '1' } : {}),
    ...(options.buildId === undefined ? {} : { RUN_PLANNER_EVENTS_BUILD_ID: options.buildId }),
    ...(options.previous === undefined
      ? {}
      : { RUN_PLANNER_EVENTS_PREVIOUS: resolve(cwd, options.previous) }),
    ...(options.now === undefined ? {} : { RUN_PLANNER_EVENTS_NOW: options.now }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let options;
  try {
    options = parseEventsBuildArguments(process.argv.slice(2));
    assertEventsBuildInputs(options);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
  const root = fileURLToPath(new URL('..', import.meta.url));
  const child = spawn(
    process.execPath,
    ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.events.config.ts'],
    {
      cwd: root,
      env: { ...process.env, ...eventsBuildEnvironment(options) },
      stdio: 'inherit',
    },
  );
  child.on('exit', (code) => process.exit(code ?? 1));
}
