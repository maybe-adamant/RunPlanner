import { createHash } from 'node:crypto';
import { catalog } from '@run-planner/hades2-catalog';
import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';

import { buildEventFeed, type AuthoredEventSource } from '@planner/workspace/eventFeedBuilder';

const NOW = new Date('2026-10-14T00:00:00Z');
const projectJson = encodeProjectDocument(createGoldenFGHProject());

function source(folder: string, fields: Record<string, unknown> = {}): AuthoredEventSource {
  return {
    folder,
    eventJson: JSON.stringify({
      id: folder,
      title: `Title ${folder}`,
      description: 'Clear the Underworld.',
      startsAt: '2026-10-12T00:00:00Z',
      endsAt: '2026-10-19T00:00:00Z',
      ...fields,
    }),
    projectJson,
  };
}

type Feed = {
  format: string;
  formatVersion: number;
  events: {
    id: string;
    projectUrl: string;
    projectSha256: string;
    plans: Record<string, { planFingerprint: string }>;
  }[];
};

const build = (sources: readonly AuthoredEventSource[], previousFeedJson: string | null = null) =>
  buildEventFeed({ catalog, sources, buildId: 'build-b', previousFeedJson, now: NOW });

describe('event feed builder', () => {
  it('publishes active events with their exact project URL and hash, skipping templates and ended events', async () => {
    const built = await build([
      source('2026-w42'),
      source('_template'),
      source('2026-w40', { startsAt: '2026-09-28T00:00:00Z', endsAt: '2026-10-05T00:00:00Z' }),
      source('2026-w44', { startsAt: '2026-10-26T00:00:00Z', endsAt: '2026-11-02T00:00:00Z' }),
    ]);
    const feed = JSON.parse(built.feedJson) as Feed;
    expect(feed.format).toBe('run-planner-event-feed');
    expect(feed.formatVersion).toBe(1);
    expect(feed.events.map((event) => event.id)).toEqual(['2026-w42', '2026-w44']);
    expect(feed.events[0]!.projectUrl).toBe(
      'https://github.com/maybe-adamant/RunPlanner-Events/releases/download/events/2026-w42.runplanner.json',
    );
    expect(feed.events[0]!.projectSha256).toBe(
      createHash('sha256').update(projectJson).digest('hex'),
    );
    expect(Object.keys(feed.events[0]!.plans)).toEqual(['build-b']);
    expect(built.projects).toEqual([
      { fileName: '2026-w42.runplanner.json', json: projectJson },
      { fileName: '2026-w44.runplanner.json', json: projectJson },
    ]);
    expect(built.summary).toEqual([
      expect.stringMatching(/^2026-w40: ended/),
      expect.stringMatching(/^2026-w42: .*builds build-b$/),
      expect.stringMatching(/^2026-w44: /),
      '_template: template, not published',
    ]);
  });

  it('keeps plans for older builds while the project file is unchanged', async () => {
    const first = await buildEventFeed({
      catalog,
      sources: [source('2026-w42')],
      buildId: 'build-a',
      previousFeedJson: null,
      now: NOW,
    });
    const merged = JSON.parse((await build([source('2026-w42')], first.feedJson)).feedJson) as Feed;
    const plans = merged.events[0]!.plans;
    expect(Object.keys(plans)).toEqual(['build-a', 'build-b']);
    expect(plans['build-a']).toEqual(
      (JSON.parse(first.feedJson) as Feed).events[0]!.plans['build-a'],
    );

    // A changed project drops plans compiled from the old one.
    const changed = { ...source('2026-w42'), projectJson: `${projectJson}\n` };
    const replaced = JSON.parse((await build([changed], first.feedJson)).feedJson) as Feed;
    expect(Object.keys(replaced.events[0]!.plans)).toEqual(['build-b']);

    // An event removed from the authored folders leaves the feed.
    const removed = JSON.parse((await build([], first.feedJson)).feedJson) as Feed;
    expect(removed.events).toEqual([]);
  });

  it('refuses authored metadata the host would refuse', async () => {
    for (const [folder, fields, message] of [
      ['2026-w42', { id: 'other' }, /id must equal its folder name/],
      ['2026-w42', { extra: 1 }, /unexpected extra/],
      ['2026-w42', { title: 'Two\nlines' }, /title/],
      ['2026-w42', { endsAt: '2026-10-12T00:00:00Z' }, /end after it starts/],
      ['Week 42', { id: 'Week 42' }, /event id/],
    ] as const) {
      await expect(build([source(folder, fields)])).rejects.toThrow(message);
    }
    await expect(build([{ ...source('2026-w42'), projectJson: '{}' }])).rejects.toThrow();
    await expect(build([source('2026-w42')], '{"format":"other"}')).rejects.toThrow(
      'not a run-planner-event-feed',
    );
  });

  it('names every folder with a problem before failing', async () => {
    await expect(
      build([
        source('2026-w40', { title: '' }),
        source('2026-w41'),
        { ...source('2026-w42'), projectJson: '{}' },
      ]),
    ).rejects.toThrow(/^2026-w40: event\.json: An event title .*\n2026-w42: /s);
  });

  it('renames older plans to the current title and drops the oldest past the size bound', async () => {
    const hash = createHash('sha256').update(projectJson).digest('hex');
    const bulky = (displayName: string) => ({
      displayName,
      planFingerprint: 'old',
      padding: 'x'.repeat(400_000),
    });
    const previous = JSON.stringify({
      format: 'run-planner-event-feed',
      formatVersion: 1,
      events: [
        {
          id: '2026-w42',
          projectSha256: hash,
          plans: Object.fromEntries(
            Array.from({ length: 15 }, (_, index) => [`build-old-${index}`, bulky('Old title')]),
          ),
        },
      ],
    });
    const built = await build([source('2026-w42')], previous);
    expect(built.feedJson.length).toBeLessThan(4 * 1_048_576);
    const plans = (JSON.parse(built.feedJson) as Feed).events[0]!.plans as Record<
      string,
      { displayName?: string }
    >;
    const builds = Object.keys(plans);
    expect(builds.at(-1)).toBe('build-b');
    expect(builds.length).toBeLessThan(16);
    expect(builds[0]).not.toBe('build-old-0');
    expect(builds).toContain('build-old-14');
    expect(plans['build-old-14']!.displayName).toBe('Title 2026-w42');
  });
});
