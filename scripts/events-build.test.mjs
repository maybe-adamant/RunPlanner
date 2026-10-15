import assert from 'node:assert/strict';
import { test } from 'node:test';

import { eventsBuildEnvironment, parseEventsBuildArguments } from './events-build.mjs';

test('event feed builds name their events, output and time', () => {
  const options = parseEventsBuildArguments([
    '--events',
    'events',
    '--out',
    'out',
    '--now',
    '2026-10-14T00:00:00Z',
  ]);
  assert.deepEqual(eventsBuildEnvironment(options, '/repo'), {
    RUN_PLANNER_EVENTS_DIR: '/repo/events',
    RUN_PLANNER_EVENTS_OUT: '/repo/out',
    RUN_PLANNER_EVENTS_NOW: '2026-10-14T00:00:00Z',
  });
});

test('a check writes only the summary', () => {
  const options = parseEventsBuildArguments(['--events', 'e', '--out', 'o', '--check']);
  assert.deepEqual(eventsBuildEnvironment(options, '/repo'), {
    RUN_PLANNER_EVENTS_DIR: '/repo/e',
    RUN_PLANNER_EVENTS_OUT: '/repo/o',
    RUN_PLANNER_EVENTS_CHECK_ONLY: '1',
  });
});

test('incomplete, malformed and retired arguments are refused', () => {
  for (const argv of [
    ['--events', 'e'],
    ['--events', 'e', '--out', 'o', '--build-id', 'a'.repeat(64)],
    ['--events', 'e', '--out', 'o', '--previous', 'published/events.json'],
    ['--events', 'e', '--out', 'o', '--check', '--now', 'tomorrow'],
    ['--events', 'e', '--out', 'o', '--check', '--unknown'],
    ['--events'],
  ]) {
    assert.throws(() => parseEventsBuildArguments(argv), undefined, argv.join(' '));
  }
});
