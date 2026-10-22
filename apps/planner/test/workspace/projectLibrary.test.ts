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
  type ChosenImportFile,
  type OutsideProjectFile,
  type ProjectLibraryAdapter,
  type ProjectLibraryEntry,
} from '@planner/persistence/projectLibrary';
import { createProjectLibraryOperations } from '@planner/workspace/projectLibrary';
import schema91Json from '../persistence/fixtures/anvil-results.schema-91.runplanner.json';

/**
 * A folder of files keyed by their path, as the desktop host keeps them, with the host's head
 * reader and subfolders.
 */
function createFolder(
  files: Record<string, { readonly json: string; readonly modifiedMs: number }>,
  options: {
    readonly chosen?: readonly ChosenImportFile[];
    readonly previous?: OutsideProjectFile | null;
    readonly folders?: readonly string[];
  } = {},
) {
  const stored = new Map(Object.entries(files));
  const folders = new Set(options.folders ?? []);
  let session: LibrarySession = EMPTY_LIBRARY_SESSION;
  let created = 0;
  const folderOf = (key: string) => key.slice(0, Math.max(0, key.lastIndexOf('/')));
  const nameOf = (key: string) => key.slice(key.lastIndexOf('/') + 1);
  const inside = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`);
  const entry = (key: string): ProjectLibraryEntry => {
    const file = stored.get(key);
    if (file === undefined) throw new Error(`${key} is not in the library.`);
    return {
      key,
      folder: folderOf(key),
      modifiedMs: file.modifiedMs,
      content: summarizeProjectJson(file.json),
    };
  };
  const adapter: ProjectLibraryAdapter = {
    supportsReveal: false,
    list: () =>
      Promise.resolve({
        folders: [...folders].sort(),
        entries: [...stored.keys()].sort().map(entry),
      }),
    read: (key) => Promise.resolve(entry(key) && stored.get(key)!.json),
    create(json, folder) {
      created += 1;
      const key = `${folder === '' ? '' : `${folder}/`}created-${created}.runplanner.json`;
      if (folder !== '') folders.add(folder);
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
    movePlan(key, folder) {
      const file = stored.get(key)!;
      const target = `${folder === '' ? '' : `${folder}/`}${nameOf(key)}`;
      stored.delete(key);
      stored.set(target, file);
      return Promise.resolve(entry(target));
    },
    createFolder(folder) {
      folders.add(folder);
      return Promise.resolve();
    },
    moveFolder: () => Promise.reject(new Error('unused')),
    deleteFolder(folder) {
      for (const path of [...folders]) if (inside(path, folder)) folders.delete(path);
      for (const key of [...stored.keys()]) if (inside(folderOf(key), folder)) stored.delete(key);
      return Promise.resolve();
    },
    preserveOriginal: () => Promise.reject(new Error('unused')),
    reveal: () => Promise.reject(new Error('unused')),
    chooseImportFiles: () => Promise.resolve(options.chosen ?? []),
    previousActiveFile: () => Promise.resolve(options.previous ?? null),
    readSession: () => Promise.resolve(session),
    writeSession(next) {
      session = next;
      return Promise.resolve();
    },
  };
  return { adapter, stored, folders, session: () => session };
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

    const { items } = await operations(adapter).list();
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

    const { items } = await operations(adapter).list();
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
    const { items } = await operations(adapter).list({ openKey: 'open.runplanner.json' });
    expect(items.map((item) => item.kind === 'ready' && [item.key, item.projectId])).toEqual([
      ['older.runplanner.json', 'run-plan-minted-1'],
      ['open.runplanner.json', 'plan-a'],
    ]);
  });

  it('imports a copy and re-identifies it only when its identity is taken', async () => {
    const outside = { fileName: 'Outside.runplanner.json', json: planJson('plan-a', 'Outside') };
    const { adapter, stored } = createFolder({}, { chosen: [outside] });
    const library = operations(adapter);

    expect((await library.importChosenFiles('')).filed[0]?.project).toMatchObject({
      projectId: 'plan-a',
      name: 'Outside',
    });
    expect((await library.importFile(outside)).project.projectId).toBe('run-plan-minted-1');
    expect((await library.importFile(outside, { newIdentity: true })).project.projectId).toBe(
      'run-plan-minted-2',
    );
    expect(stored.size).toBe(3);
  });

  it('imports several files one at a time and reports each file it could not', async () => {
    const outside = { fileName: 'Outside.runplanner.json', json: planJson('plan-a', 'Outside') };
    const { adapter, stored } = createFolder(
      {},
      {
        chosen: [
          outside,
          { fileName: 'locked.runplanner.json', problem: 'Permission denied' },
          { fileName: 'broken.runplanner.json', json: '{not json' },
          { ...outside, fileName: 'Outside copy.runplanner.json' },
        ],
      },
    );
    const report = await operations(adapter).importChosenFiles('Practice');
    // The second copy of one file sees the identity the first took.
    expect(report.filed.map((plan) => plan.project.projectId)).toEqual([
      'plan-a',
      'run-plan-minted-1',
    ]);
    expect(report.filed.every((plan) => plan.key.startsWith('Practice/'))).toBe(true);
    expect(report.failed).toEqual([
      { fileName: 'locked.runplanner.json', message: 'Permission denied' },
      { fileName: 'broken.runplanner.json', message: '$: must be valid JSON' },
    ]);
    expect(stored.size).toBe(2);
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
    expect(await library.importChosenFiles('')).toEqual({ filed: [], failed: [] });
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

  it('keeps identities unique across folders, the copy in a subfolder taking a new one', async () => {
    const { adapter } = createFolder(
      {
        'Practice/Bosses/copy.runplanner.json': {
          json: planJson('plan-a', 'Copy'),
          modifiedMs: 20,
        },
        'original.runplanner.json': { json: planJson('plan-a', 'Original'), modifiedMs: 10 },
      },
      { folders: ['Practice', 'Practice/Bosses'] },
    );
    const listing = await operations(adapter).list();
    expect(listing.folders).toEqual(['Practice', 'Practice/Bosses']);
    expect(
      listing.items.map((item) => item.kind === 'ready' && [item.folder, item.projectId]),
    ).toEqual([
      ['', 'plan-a'],
      ['Practice/Bosses', 'run-plan-minted-1'],
    ]);
  });

  it('files new and imported plans in a folder and moves plans between folders', async () => {
    const outside = { fileName: 'Outside.runplanner.json', json: planJson('plan-a', 'Outside') };
    const { adapter, stored } = createFolder({}, { chosen: [outside] });
    const library = operations(adapter);
    const [imported] = (await library.importChosenFiles('Practice')).filed;
    expect(imported?.key).toMatch(/^Practice\//);
    const created = await library.create(
      createProjectDocument(catalog, { projectId: 'plan-b', name: 'B', routeKey: 'Surface' }),
      'Speedrun',
    );
    const moved = await library.movePlan(created.key, '');
    expect(moved).not.toContain('/');
    expect([...stored.keys()].sort()).toEqual([imported!.key, moved].sort());
  });

  it('keeps a deleted folder with its subfolders and plans in memory so undo restores it', async () => {
    const { adapter, stored, folders } = createFolder(
      {
        'Practice/a.runplanner.json': { json: planJson('plan-a', 'A'), modifiedMs: 1 },
        'Practice/Bosses/b.runplanner.json': { json: planJson('plan-b', 'B'), modifiedMs: 2 },
        'top.runplanner.json': { json: planJson('plan-c', 'Top'), modifiedMs: 3 },
      },
      { folders: ['Practice', 'Practice/Bosses', 'Practice/Empty'] },
    );
    const library = operations(adapter);
    const deleted = await library.deleteFolder('Practice');
    expect(deleted.folders).toEqual(['Practice', 'Practice/Bosses', 'Practice/Empty']);
    expect(deleted.plans.map((plan) => plan.folder)).toEqual(['Practice/Bosses', 'Practice']);
    expect([...stored.keys()]).toEqual(['top.runplanner.json']);
    expect(folders.size).toBe(0);

    await library.undoDeleteFolder(deleted);
    expect([...folders].sort()).toEqual(['Practice', 'Practice/Bosses', 'Practice/Empty']);
    const restored = (await library.list()).items.filter((item) => item.folder !== '');
    expect(restored.map((item) => item.kind === 'ready' && [item.folder, item.projectId])).toEqual(
      expect.arrayContaining([
        ['Practice', 'plan-a'],
        ['Practice/Bosses', 'plan-b'],
      ]),
    );
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
