import {
  createProjectDocument,
  parseProjectDocument,
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_REVISION,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_LIBRARY_SESSION,
  summarizeProjectJson,
  type LibrarySession,
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
  let session: LibrarySession = EMPTY_LIBRARY_SESSION;
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
    delete(key) {
      entry(key);
      stored.delete(key);
      return Promise.resolve();
    },
    preserveOriginal: () => Promise.reject(new Error('unused')),
    reveal: () => Promise.reject(new Error('unused')),
    chooseImportFile: () => Promise.resolve(options.chosen ?? null),
    previousActiveFile: () => Promise.resolve(options.previous ?? null),
    readSession: () => Promise.resolve(session),
    writeSession(next) {
      session = next;
      return Promise.resolve();
    },
  };
  return { adapter, stored, session: () => session };
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
    // Only a plan read from an older schema rewrites its original on the first write.
    const library = operations(adapter);
    expect((await library.read('My old plan.runplanner.json')).olderOnDisk).toBe(true);
    expect((await library.read('a.runplanner.json')).olderOnDisk).toBe(false);
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

  it('keeps the open plan identity even when it is the newer copy', async () => {
    const { adapter } = createFolder({
      'open.runplanner.json': { json: planJson('plan-a', 'Open'), modifiedMs: 20 },
      'older.runplanner.json': { json: planJson('plan-a', 'Older'), modifiedMs: 10 },
    });
    const items = await operations(adapter).list({ openKey: 'open.runplanner.json' });
    expect(items.map((item) => item.kind === 'ready' && [item.key, item.projectId])).toEqual([
      ['older.runplanner.json', 'run-plan-minted-1'],
      ['open.runplanner.json', 'plan-a'],
    ]);
  });

  it('imports a copy and re-identifies it only when its identity is taken', async () => {
    const outside = { fileName: 'Outside.runplanner.json', json: planJson('plan-a', 'Outside') };
    const { adapter, stored } = createFolder({}, { chosen: outside });
    const library = operations(adapter);

    expect((await library.importChosenFile())?.project).toMatchObject({
      projectId: 'plan-a',
      name: 'Outside',
    });
    expect((await library.importFile(outside)).project.projectId).toBe('run-plan-minted-1');
    expect((await library.importFile(outside, { newIdentity: true })).project.projectId).toBe(
      'run-plan-minted-2',
    );
    expect(stored.size).toBe(3);
  });

  it('names an imported plan from before plans had names after its file', async () => {
    const { adapter } = createFolder({});
    const plan = await operations(adapter).importFile({
      fileName: 'C:\\Plans\\Gorgon run.runplanner.json',
      json: JSON.stringify(schema91Json),
    });
    expect(plan.project).toMatchObject({ name: 'Gorgon run', projectId: 'golden-fg' });
    expect(plan.migrationProvenance.length).toBeGreaterThan(0);
  });

  it('files nothing for an import it cannot open or a cancelled pick', async () => {
    const { adapter, stored } = createFolder({});
    const library = operations(adapter);
    expect(await library.importChosenFile()).toBeNull();
    await expect(
      library.importFile({ fileName: 'bad.runplanner.json', json: '{}' }),
    ).rejects.toThrow();
    expect(stored.size).toBe(0);
  });

  it('keeps a deleted plan in memory so undo files it again', async () => {
    const { adapter, stored } = createFolder({
      'kept.runplanner.json': { json: planJson('plan-a', 'Kept'), modifiedMs: 1 },
    });
    const library = operations(adapter);
    const deleted = await library.deletePlan('kept.runplanner.json');
    expect(stored.size).toBe(0);
    const restored = await library.undoDelete(deleted);
    expect(restored.project.projectId).toBe('plan-a');
    expect(stored.get(restored.key)?.json).toBe(planJson('plan-a', 'Kept'));
  });

  it('reopens the last plan by key, or by identity once a rename moved it', async () => {
    const { adapter } = createFolder({
      'moved.runplanner.json': { json: planJson('plan-a', 'Moved'), modifiedMs: 1 },
    });
    const library = operations(adapter);
    expect(await library.readLastOpened()).toBeNull();
    await library.rememberOpened({ key: 'moved.runplanner.json', projectId: 'plan-a' });
    expect((await library.readLastOpened())?.key).toBe('moved.runplanner.json');
    await library.rememberOpened({ key: 'gone.runplanner.json', projectId: 'plan-a' });
    expect((await library.readLastOpened())?.key).toBe('moved.runplanner.json');
    await library.rememberOpened({ key: 'gone.runplanner.json', projectId: 'plan-b' });
    expect(await library.readLastOpened()).toBeNull();
  });

  it('offers the previously open file once, unless the library holds it', async () => {
    const previous = { fileName: 'Last.runplanner.json', json: planJson('plan-last', 'Last') };
    expect(await operations(createFolder({}).adapter).previousFileOffer()).toBeNull();

    const held = createFolder(
      { 'last.runplanner.json': { json: planJson('plan-last', 'Last'), modifiedMs: 1 } },
      { previous },
    );
    expect(await operations(held.adapter).previousFileOffer()).toBeNull();

    const folder = createFolder({}, { previous });
    const library = operations(folder.adapter);
    expect(await library.previousFileOffer()).toBe(previous);
    await library.settlePreviousFileOffer();
    expect(folder.session().previousFileOffered).toBe(true);
    expect(await operations(folder.adapter).previousFileOffer()).toBeNull();
  });
});
