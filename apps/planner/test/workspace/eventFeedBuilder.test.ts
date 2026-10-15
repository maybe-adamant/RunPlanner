import { createHash } from 'node:crypto';
import { catalog } from '@run-planner/hades2-catalog';
import {
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
} from '@run-planner/engine/authored-project';
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
  events: Record<string, unknown>[];
};

const build = (sources: readonly AuthoredEventSource[], checkEnded = false) =>
  buildEventFeed({ catalog, sources, now: NOW, checkEnded });

describe('event feed builder', () => {
  it('lists active and coming events with their project reference, skipping templates and ended events', async () => {
    const built = await build([
      source('2026-w42', { rules: 'Fear 8.' }),
      source('_template'),
      source('2026-w40', { startsAt: '2026-09-28T00:00:00Z', endsAt: '2026-10-05T00:00:00Z' }),
      source('2026-w44', { startsAt: '2026-10-26T00:00:00Z', endsAt: '2026-11-02T00:00:00Z' }),
    ]);
    const feed = JSON.parse(built.feedJson) as Feed;
    expect(feed.format).toBe('run-planner-event-feed');
    expect(feed.formatVersion).toBe(2);
    expect(feed.events.map((event) => event.id)).toEqual(['2026-w42', '2026-w44']);
    expect(feed.events[0]).toEqual({
      id: '2026-w42',
      title: 'Title 2026-w42',
      description: 'Clear the Underworld.',
      rules: 'Fear 8.',
      startsAt: '2026-10-12T00:00:00Z',
      endsAt: '2026-10-19T00:00:00Z',
      projectUrl:
        'https://github.com/maybe-adamant/RunPlanner-Events/releases/download/events/2026-w42.runplanner.json',
      projectSha256: createHash('sha256').update(projectJson).digest('hex'),
      projectSchemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    });
    expect(Object.keys(feed.events[1]!)).not.toContain('rules');
    expect(built.projects).toEqual([
      { fileName: '2026-w42.runplanner.json', json: projectJson },
      { fileName: '2026-w44.runplanner.json', json: projectJson },
    ]);
    expect(built.summary).toEqual([
      '2026-w40: ended, not published',
      `2026-w42: 2026-10-12T00:00:00Z to 2026-10-19T00:00:00Z, schema ${PROJECT_DOCUMENT_SCHEMA_VERSION}.0`,
      expect.stringMatching(/^2026-w44: /),
      '_template: template, not published',
    ]);
  });

  it('compiles every project, ended ones too when checking, without listing them', async () => {
    const ended = { startsAt: '2026-09-28T00:00:00Z', endsAt: '2026-10-05T00:00:00Z' };
    const checked = await build([source('2026-w40', ended)], true);
    expect(checked.summary).toEqual(['2026-w40: ended, valid, not published']);
    expect((JSON.parse(checked.feedJson) as Feed).events).toEqual([]);
    const broken = { ...source('2026-w40', ended), projectJson: '{"schemaVersion":96}' };
    await expect(build([broken], true)).rejects.toThrow(/^2026-w40: /);
    await expect(build([broken])).resolves.toMatchObject({
      summary: ['2026-w40: ended, not published'],
    });
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
    await expect(build([{ ...source('2026-w42'), projectJson: '{}' }])).rejects.toThrow(
      /names no schemaVersion/,
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
});
