import { createHash } from 'node:crypto';
import { catalog } from '@run-planner/hades2-catalog';
import {
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_REVISION,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';

import {
  buildCatalogFeed,
  type AuthoredCatalogSource,
} from '@planner/workspace/catalogFeedBuilder';

const project = createGoldenFGHProject();
const planBytes = new TextEncoder().encode(encodeProjectDocument(project));
const categoriesJson = JSON.stringify({
  categories: [
    { id: 'speedrun', label: 'Speedrun' },
    { id: 'fresh-file', label: 'Fresh File' },
  ],
});

function source(folder: string, fields: Record<string, unknown> = {}): AuthoredCatalogSource {
  return {
    folder,
    entryJson: JSON.stringify({
      title: `Title ${folder}`,
      description: 'Persephone Skull on Apollo and Hera.',
      category: 'speedrun',
      tags: ['skull', 'apollo'],
      author: 'Hippo',
      ...fields,
    }),
    planBytes,
  };
}

const build = (sources: readonly AuthoredCatalogSource[], categories = categoriesJson) =>
  buildCatalogFeed({ catalog, categoriesJson: categories, sources });

describe('catalog feed builder', () => {
  it('lists each entry with its plan route, schema, URL and hash, and copies the plan bytes', async () => {
    const built = await build([source('underworld-wr'), source('_template'), source('a-first')]);
    const feed = JSON.parse(built.feedJson) as {
      format: string;
      formatVersion: number;
      categories: unknown[];
      entries: Record<string, unknown>[];
    };
    expect(feed.format).toBe('run-planner-catalog-feed');
    expect(feed.formatVersion).toBe(1);
    expect(feed.categories).toEqual(JSON.parse(categoriesJson).categories);
    expect(feed.entries.map((entry) => entry.id)).toEqual(['a-first', 'underworld-wr']);
    expect(feed.entries[1]).toEqual({
      id: 'underworld-wr',
      title: 'Title underworld-wr',
      description: 'Persephone Skull on Apollo and Hera.',
      category: 'speedrun',
      tags: ['skull', 'apollo'],
      author: 'Hippo',
      routeKey: project.route.routeKey,
      biomeCount: project.route.biomes.length,
      planSchemaVersion: project.schemaVersion,
      ...(PROJECT_DOCUMENT_SCHEMA_REVISION === 0
        ? {}
        : { planSchemaRevision: PROJECT_DOCUMENT_SCHEMA_REVISION }),
      planUrl:
        'https://github.com/maybe-adamant/RunPlanner-Catalog/releases/download/catalog/underworld-wr.runplanner.json',
      planSha256: createHash('sha256').update(planBytes).digest('hex'),
    });
    expect(built.plans).toEqual([
      { fileName: 'a-first.runplanner.json', bytes: planBytes },
      { fileName: 'underworld-wr.runplanner.json', bytes: planBytes },
    ]);
    expect(built.summary).toEqual([
      '_template: template, not published',
      expect.stringMatching(/^a-first: speedrun, Underworld \d biomes?, schema \d+\.\d+$/),
      expect.stringMatching(/^underworld-wr: /),
    ]);
    // The same entries build the same bytes.
    expect((await build([source('a-first'), source('underworld-wr')])).feedJson).toBe(
      built.feedJson,
    );
  });

  it('refuses entry metadata the host would refuse', async () => {
    for (const [folder, fields, message] of [
      ['Bad Slug', {}, /slug/],
      ['a'.repeat(65), {}, /slug/],
      ['wr', { extra: 1 }, /unexpected extra/],
      ['wr', { title: 'Two\nlines' }, /title/],
      ['wr', { title: 't'.repeat(81) }, /title/],
      ['wr', { description: 'd'.repeat(201) }, /description/],
      ['wr', { description: 'Hidden​mark' }, /description/],
      ['wr', { author: '' }, /author/],
      ['wr', { category: 'other' }, /category/],
      ['wr', { tags: Array.from({ length: 9 }, (_, index) => `t${index}`) }, /tags/],
      ['wr', { tags: ['skull', 'skull'] }, /tags/],
      ['wr', { tags: ['Skull'] }, /tags/],
      ['wr', { tags: ['t'.repeat(25)] }, /tags/],
      ['wr', { tags: ['speedrun'] }, /tags/],
      ['wr', { category: 'fresh-file', tags: ['fresh-file'] }, /tags/],
      ['wr', { tags: undefined }, /tags/],
    ] as const) {
      await expect(
        build([source(folder, fields)]),
        `${folder} ${JSON.stringify(fields)}`,
      ).rejects.toThrow(message);
    }
    // A tag may name another category.
    await expect(build([source('wr', { tags: ['fresh-file'] })])).resolves.toBeTruthy();
  });

  it('refuses a plan that is too large, not text, unloadable or unsendable', async () => {
    const plan = (bytes: Uint8Array) => ({ ...source('wr'), planBytes: bytes });
    const text = (json: string) => plan(new TextEncoder().encode(json));
    for (const [candidate, message] of [
      [plan(new Uint8Array(1_048_577)), /exceeds/],
      [plan(new Uint8Array([0xff, 0xfe])), /not UTF-8/],
      [plan(new Uint8Array([0xef, 0xbb, 0xbf, ...planBytes])), /JSON|schemaVersion/],
      [text('{}'), /names no schemaVersion/],
      [text('{"schemaVersion":999}'), /./],
    ] as const) {
      await expect(build([candidate])).rejects.toThrow(message);
    }
  });

  it('refuses a malformed category list and names every folder with a problem', async () => {
    for (const categories of [
      '{"categories":[]}',
      '{"categories":[{"id":"Bad","label":"Bad"}]}',
      '{"categories":[{"id":"a","label":"A"},{"id":"a","label":"B"}]}',
      '{"categories":[{"id":"a","label":"A","extra":1}]}',
      '{"categories":[],"extra":1}',
    ]) {
      await expect(build([source('wr')], categories)).rejects.toThrow(/categories\.json/);
    }
    await expect(
      build([
        source('first', { title: '' }),
        source('second'),
        source('third', { tags: ['speedrun'] }),
      ]),
    ).rejects.toThrow(/^first: entry\.json: title .*\nthird: entry\.json: tags /s);
  });
});
