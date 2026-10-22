import {
  createProjectDocument,
  parseProjectDocument,
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_REVISION,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  summarizeProjectJson,
  type OutsideProjectFile,
  type ProjectLibraryAdapter,
  type ProjectLibraryEntry,
} from '@planner/persistence/projectLibrary';
import { createProjectLibraryOperations } from '@planner/workspace/projectLibrary';
import schema91Json from '../persistence/fixtures/anvil-results.schema-91.runplanner.json';

/** A folder of named files, as the desktop host keeps them, with the host's head reader. */
function createFolder(
  files: Record<string, { readonly json: string; readonly modifiedMs: number }>,
  options: {
    readonly chosen?: OutsideProjectFile | null;
    readonly previous?: OutsideProjectFile | null;
  } = {},
) {
  const stored = new Map(Object.entries(files));
  let created = 0;
  const entry = (key: string): ProjectLibraryEntry => {
    const file = stored.get(key);
    if (file === undefined) throw new Error(`${key} is not in the library.`);
    return { key, modifiedMs: file.modifiedMs, content: summarizeProjectJson(file.json) };
  };
  const adapter: ProjectLibraryAdapter = {
    supportsReveal: false,
    list: () => Promise.resolve([...stored.keys()].sort().map(entry)),
    read: (key) => Promise.resolve(entry(key) && stored.get(key)!.json),
    create(json) {
      created += 1;
      const key = `created-${created}.runplanner.json`;
      stored.set(key, { json, modifiedMs: 10_000 + created });
      return Promise.resolve(entry(key));
    },
    write(key, json) {
      stored.set(key, { json, modifiedMs: stored.get(key)?.modifiedMs ?? 0 });
      return Promise.resolve(entry(key));
    },
    delete: () => Promise.reject(new Error('unused')),
    restore: () => Promise.reject(new Error('unused')),
    reveal: () => Promise.reject(new Error('unused')),
    chooseImportFile: () => Promise.resolve(options.chosen ?? null),
    previousActiveFile: () => Promise.resolve(options.previous ?? null),
  };
  return { adapter, stored };
}

function planJson(projectId: string, name = 'Surface plan'): string {
  return encodeProjectDocument(
    createProjectDocument(catalog, { projectId, name, routeKey: 'Surface' }),
  );
}

function operations(adapter: ProjectLibraryAdapter) {
  let minted = 0;
  return createProjectLibraryOperations({
    adapter,
    catalog,
    mintProjectId: () => `run-plan-minted-${(minted += 1)}`,
  });
}

describe('project library operations', () => {
  it('lists openable, too-new and unreadable plans without dropping any', async () => {
    const legacy = JSON.stringify(schema91Json);
    const { adapter } = createFolder({
      'a.runplanner.json': { json: planJson('plan-a', 'Ready'), modifiedMs: 1 },
      'b.runplanner.json': {
        json: JSON.stringify({ schemaVersion: 120, projectId: 'f', name: 'Future' }),
        modifiedMs: 2,
      },
      'c.runplanner.json': {
        json: JSON.stringify({
          ...JSON.parse(planJson('plan-c')),
          schemaRevision: PROJECT_DOCUMENT_SCHEMA_REVISION + 1,
        }),
        modifiedMs: 3,
      },
      'd.runplanner.json': { json: '{ broken', modifiedMs: 4 },
      'e.runplanner.json': { json: '{"schemaVersion":40,"projectId":"x"}', modifiedMs: 5 },
      'My old plan.runplanner.json': { json: legacy, modifiedMs: 6 },
    });

    const items = await operations(adapter).list();
    expect(items.map((item) => [item.key, item.kind])).toEqual([
      ['a.runplanner.json', 'ready'],
      ['b.runplanner.json', 'tooNew'],
      ['c.runplanner.json', 'tooNew'],
      ['d.runplanner.json', 'unreadable'],
      ['e.runplanner.json', 'unreadable'],
      ['My old plan.runplanner.json', 'ready'],
    ]);
    expect(items[0]).toMatchObject({
      name: 'Ready',
      projectId: 'plan-a',
      routeKey: 'Surface',
      aspectKey: expect.any(String),
      biomeCount: expect.any(Number),
    });
    expect(items[1]).toMatchObject({ name: 'Future', schemaVersion: 120 });
    expect(items[5]).toMatchObject({ name: 'My old plan', projectId: 'golden-fg' });
  });

  it('gives a newer copy sharing an identity a new one through the engine', async () => {
    const { adapter, stored } = createFolder({
      'copy.runplanner.json': { json: planJson('plan-a', 'Copy'), modifiedMs: 20 },
      'original.runplanner.json': { json: planJson('plan-a', 'Original'), modifiedMs: 10 },
      'other.runplanner.json': { json: planJson('plan-b'), modifiedMs: 30 },
    });

    const items = await operations(adapter).list();
    expect(items.map((item) => item.kind === 'ready' && [item.key, item.projectId])).toEqual([
      ['original.runplanner.json', 'plan-a'],
      ['copy.runplanner.json', 'run-plan-minted-1'],
      ['other.runplanner.json', 'plan-b'],
    ]);
    const copy = parseProjectDocument(stored.get('copy.runplanner.json')!.json, catalog);
    expect(copy).toEqual({
      ...parseProjectDocument(planJson('plan-a', 'Copy'), catalog),
      projectId: 'run-plan-minted-1',
    });
    expect(stored.get('original.runplanner.json')!.json).toBe(planJson('plan-a', 'Original'));
    // A second scan finds nothing left to re-identify.
    await operations(adapter).list();
    expect(parseProjectDocument(stored.get('copy.runplanner.json')!.json, catalog).projectId).toBe(
      'run-plan-minted-1',
    );
  });

  it('imports a copy and re-identifies it only when its identity is taken', async () => {
    const outside = { fileName: 'Outside.runplanner.json', json: planJson('plan-a', 'Outside') };
    const { adapter, stored } = createFolder({}, { chosen: outside });
    const library = operations(adapter);

    expect(await library.importChosenFile()).toMatchObject({
      status: 'imported',
      reidentified: false,
      item: { kind: 'ready', projectId: 'plan-a', name: 'Outside' },
    });
    expect(await library.importFile(outside)).toMatchObject({
      status: 'imported',
      reidentified: true,
      item: { kind: 'ready', projectId: 'run-plan-minted-1', name: 'Outside' },
    });
    expect(stored.size).toBe(2);
  });

  it('names an imported plan from before plans had names after its file', async () => {
    const { adapter } = createFolder({});
    const result = await operations(adapter).importFile({
      fileName: 'C:\\Plans\\Gorgon run.runplanner.json',
      json: JSON.stringify(schema91Json),
    });
    expect(result).toMatchObject({
      status: 'imported',
      item: { kind: 'ready', name: 'Gorgon run', projectId: 'golden-fg' },
    });
  });

  it('reports an import it cannot open and a cancelled pick', async () => {
    const { adapter, stored } = createFolder({});
    const library = operations(adapter);
    expect(await library.importChosenFile()).toEqual({ status: 'cancelled' });
    const failed = await library.importFile({ fileName: 'bad.runplanner.json', json: '{}' });
    expect(failed.status).toBe('failure');
    expect(failed.status === 'failure' && failed.message).toMatch(/^Could not import bad/);
    expect(stored.size).toBe(0);
  });

  it('offers the previously open file until the library holds it', async () => {
    const previous = { fileName: 'Last.runplanner.json', json: planJson('plan-last', 'Last') };
    expect(await operations(createFolder({}).adapter).previousActiveImportOffer()).toBeNull();

    const { adapter } = createFolder({}, { previous });
    const library = operations(adapter);
    expect(await library.previousActiveImportOffer()).toBe(previous);
    expect(await library.importFile(previous)).toMatchObject({ status: 'imported' });
    expect(await library.previousActiveImportOffer()).toBeNull();
  });
});
