// Run by `npm run events:build` (scripts/events-build.mjs) through vitest, which resolves the
// planner's aliases and catalog as the application does. It is a task, not a test: it reads the
// authored events and writes the feed and project files to publish.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { catalog } from '@run-planner/hades2-catalog';
import { expect, it } from 'vitest';

import {
  buildEventFeed,
  isTemplateFolder,
  type AuthoredEventSource,
} from '@planner/workspace/eventFeedBuilder';

const environment = process.env;

function required(name: string): string {
  const value = environment[name];
  if (value === undefined || value === '') throw new Error(`${name} is required.`);
  return value;
}

// A named previous feed must exist: building without it would drop older builds' plans.
function previousFeed(path: string | undefined): string | null {
  if (path === undefined || path === '') return null;
  if (!existsSync(path)) throw new Error(`The previous feed ${path} does not exist.`);
  return readFileSync(path, 'utf8');
}

it('builds the community event feed', async () => {
  const eventsDirectory = required('RUN_PLANNER_EVENTS_DIR');
  const out = required('RUN_PLANNER_EVENTS_OUT');
  const checkOnly = environment.RUN_PLANNER_EVENTS_CHECK_ONLY === '1';
  const previous = environment.RUN_PLANNER_EVENTS_PREVIOUS;
  const sources: AuthoredEventSource[] = readdirSync(eventsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    // A template folder is never read; the builder lists it as not published.
    .map((entry) =>
      isTemplateFolder(entry.name)
        ? { folder: entry.name, eventJson: '', projectJson: '' }
        : {
            folder: entry.name,
            eventJson: readFileSync(join(eventsDirectory, entry.name, 'event.json'), 'utf8'),
            projectJson: readFileSync(
              join(eventsDirectory, entry.name, 'project.runplanner.json'),
              'utf8',
            ),
          },
    );
  const built = await buildEventFeed({
    catalog,
    sources,
    buildId: checkOnly ? 'check-only' : required('RUN_PLANNER_EVENTS_BUILD_ID'),
    previousFeedJson: previousFeed(previous),
    now: new Date(environment.RUN_PLANNER_EVENTS_NOW ?? Date.now()),
    checkEnded: checkOnly,
  });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'summary.txt'), `${built.summary.join('\n')}\n`);
  if (!checkOnly) {
    writeFileSync(join(out, 'events.json'), built.feedJson);
    for (const project of built.projects) {
      writeFileSync(join(out, project.fileName), project.json);
    }
  }
  expect(built.summary.length).toBe(sources.length);
});
