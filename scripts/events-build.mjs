import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

/**
 * Builds the community event feed from authored event folders with the planner's single event
 * builder (apps/planner/src/workspace/eventFeedBuilder.ts), for the events repository's
 * workflows:
 *
 *   npm run events:build -- --events <dir> --out <dir> [--now <iso>]
 *   npm run events:build -- --events <dir> --out <dir> --check
 *
 * It writes events.json, each listed event's <id>.runplanner.json and summary.txt; every
 * listed event's project is compiled to refuse one that would not play. --check validates
 * every folder, ended ones included, and writes only the summary.
 */
export function parseEventsBuildArguments(argv) {
  const options = { check: false };
  const valued = new Map([
    ['--events', 'events'],
    ['--out', 'out'],
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
  if (options.now !== undefined && Number.isNaN(Date.parse(options.now))) {
    throw new Error('--now must be an ISO 8601 instant.');
  }
  return options;
}

export function eventsBuildEnvironment(options, cwd = process.cwd()) {
  return {
    RUN_PLANNER_EVENTS_DIR: resolve(cwd, options.events),
    RUN_PLANNER_EVENTS_OUT: resolve(cwd, options.out),
    ...(options.check ? { RUN_PLANNER_EVENTS_CHECK_ONLY: '1' } : {}),
    ...(options.now === undefined ? {} : { RUN_PLANNER_EVENTS_NOW: options.now }),
  };
}

/** Runs a feed builder task through vitest from the repository root, exiting with its code. */
export function runFeedTask(config, environment) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const child = spawn(
    process.execPath,
    ['node_modules/vitest/vitest.mjs', 'run', '--config', config],
    {
      cwd: root,
      env: { ...process.env, ...environment },
      stdio: 'inherit',
    },
  );
  child.on('exit', (code) => process.exit(code ?? 1));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let options;
  try {
    options = parseEventsBuildArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
  runFeedTask('vitest.events.config.ts', eventsBuildEnvironment(options));
}
