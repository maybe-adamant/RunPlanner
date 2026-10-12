import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assertEventsBuildInputs,
  eventsBuildEnvironment,
  parseEventsBuildArguments,
} from './events-build.mjs';

const buildId = 'a'.repeat(64);

test('event feed builds name their events, output and module build', () => {
  const options = parseEventsBuildArguments([
    '--events',
    'events',
    '--out',
    'out',
    '--build-id',
    buildId,
    '--previous',
    'published/events.json',
    '--now',
    '2026-10-14T00:00:00Z',
  ]);
  assert.deepEqual(eventsBuildEnvironment(options, '/repo'), {
    RUN_PLANNER_EVENTS_DIR: '/repo/events',
    RUN_PLANNER_EVENTS_OUT: '/repo/out',
    RUN_PLANNER_EVENTS_BUILD_ID: buildId,
    RUN_PLANNER_EVENTS_PREVIOUS: '/repo/published/events.json',
    RUN_PLANNER_EVENTS_NOW: '2026-10-14T00:00:00Z',
  });
});

test('a check needs no module build and writes only the summary', () => {
  const options = parseEventsBuildArguments(['--events', 'e', '--out', 'o', '--check']);
  assert.deepEqual(eventsBuildEnvironment(options, '/repo'), {
    RUN_PLANNER_EVENTS_DIR: '/repo/e',
    RUN_PLANNER_EVENTS_OUT: '/repo/o',
    RUN_PLANNER_EVENTS_CHECK_ONLY: '1',
  });
});

test('incomplete or malformed arguments are refused', () => {
  for (const argv of [
    ['--events', 'e'],
    ['--events', 'e', '--out', 'o'],
    ['--events', 'e', '--out', 'o', '--build-id', 'short'],
    ['--events', 'e', '--out', 'o', '--check', '--now', 'tomorrow'],
    ['--events', 'e', '--out', 'o', '--check', '--unknown'],
    ['--events'],
  ]) {
    assert.throws(() => parseEventsBuildArguments(argv), undefined, argv.join(' '));
  }
});

test('a named previous feed must exist', () => {
  const options = parseEventsBuildArguments([
    '--events',
    'e',
    '--out',
    'o',
    '--build-id',
    buildId,
    '--previous',
    'published/events.json',
  ]);
  assert.throws(
    () => assertEventsBuildInputs(options, '/repo', () => false),
    /previous feed published\/events\.json does not exist/,
  );
  assert.doesNotThrow(() => assertEventsBuildInputs(options, '/repo', () => true));
  const without = parseEventsBuildArguments(['--events', 'e', '--out', 'o', '--check']);
  assert.doesNotThrow(() => assertEventsBuildInputs(without, '/repo', () => false));
});
