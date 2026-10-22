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
    /** Keys whose bytes cannot be read. */
    readonly unreadable?: readonly string[];
    /** Keys a restore fails to write. */
    readonly failRestore?: readonly string[];
    readonly autosave?: string;
  } = {},
) {
  const stored = new Map(Object.entries(files));
  const folders = new Set(options.folders ?? []);
  const calls: string[] = [];
  let autosave: string | null = options.autosave ?? null;
  const legacyAutosave = {
    read: () => autosave,
    clear: () => {
      autosave = null;
    },
  };
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
    readBytes(key) {
      if (options.unreadable?.includes(key) === true) {
        return Promise.reject(new Error('Permission denied'));
      }
      return Promise.resolve(new TextEncoder().encode(entry(key) && stored.get(key)!.json));
    },
    restore(key, folder, bytes) {
      if (stored.has(key)) return Promise.reject(new Error(`${key} is already in the library.`));
      if (options.failRestore?.includes(key) === true) {
        return Promise.reject(new Error('Disk full'));
      }
      if (folder !== '') folders.add(folder);
      stored.set(key, { json: new TextDecoder().decode(bytes), modifiedMs: 50_000 });
      return Promise.resolve(entry(key));
    },
    create(json, folder) {
      created += 1;
      const key = `${folder === '' ? '' : `${folder}/`}created-${created}.runplanner.json`;
      if (folder !== '') folders.add(folder);
      stored.set(key, { json, modifiedMs: 10_000 + created });
      return Promise.resolve(entry(key));
    },
    write(key, json) {
      calls.push(`write ${key}`);
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
    preserveOriginal(key) {
      calls.push(`preserve ${key}`);
      return Promise.resolve();
    },
    reveal: () => Promise.reject(new Error('unused')),
    chooseImportFiles: () => Promise.resolve(options.chosen ?? []),
    previousActiveFile: () => Promise.resolve(options.previous ?? null),
    readSession: () => Promise.resolve(session),
    writeSession(next) {
      session = next;
      return Promise.resolve();
    },
  };
  return {
    adapter,
    stored,
    folders,
    calls,
    legacyAutosave,
    autosave: () => autosave,
    session: () => session,
  };
}

function planJson(projectId: string, name = 'Surface plan'): string {
  return encodeProjectDocument(
    createProjectDocument(catalog, { projectId, name, routeKey: 'Surface' }),
  );
}

function operations(
  adapter: ProjectLibraryAdapter,
  legacyAutosave?: { read(): string | null; clear(): void },
) {
  let minted = 0;
  return createProjectLibraryOperations({
    adapter,
    catalog,
    ...(legacyAutosave === undefined ? {} : { legacyAutosave }),
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
    expect(restored).toMatchObject({ kind: 'ready', key: 'kept.runplanner.json' });
    expect(stored.get(restored.key)?.json).toBe(planJson('plan-a', 'Kept'));
  });

  it('restores a deleted older or unreadable file byte for byte at its key', async () => {
    const legacy = JSON.stringify(schema91Json);
    const { adapter, stored } = createFolder({
      'Old.runplanner.json': { json: legacy, modifiedMs: 1 },
      'Broken.runplanner.json': { json: '{ broken', modifiedMs: 2 },
    });
    const library = operations(adapter);
    const old = await library.deletePlan('Old.runplanner.json');
    const broken = await library.deletePlan('Broken.runplanner.json');
    expect(stored.size).toBe(0);
    expect(await library.undoDelete(old)).toMatchObject({
      kind: 'ready',
      key: 'Old.runplanner.json',
      name: 'Old',
    });
    expect(await library.undoDelete(broken)).toMatchObject({
      kind: 'unreadable',
      key: 'Broken.runplanner.json',
    });
    expect(stored.get('Old.runplanner.json')?.json).toBe(legacy);
    expect(stored.get('Broken.runplanner.json')?.json).toBe('{ broken');
  });

  it('keeps the original of an older copy before re-identifying it', async () => {
    const legacy = JSON.stringify(schema91Json);
    const { adapter, calls, stored } = createFolder({
      'original.runplanner.json': { json: legacy, modifiedMs: 10 },
      'copy.runplanner.json': { json: legacy, modifiedMs: 20 },
    });
    await operations(adapter).list();
    expect(calls).toEqual(['preserve copy.runplanner.json', 'write copy.runplanner.json']);
    expect(stored.get('original.runplanner.json')?.json).toBe(legacy);
    expect(parseProjectDocument(stored.get('copy.runplanner.json')!.json, catalog).projectId).toBe(
      'run-plan-minted-1',
    );
  });

  it('scans without re-identifying anything', async () => {
    const { adapter, calls } = createFolder({
      'copy.runplanner.json': { json: planJson('plan-a', 'Copy'), modifiedMs: 20 },
      'original.runplanner.json': { json: planJson('plan-a', 'Original'), modifiedMs: 10 },
    });
    const { items } = await operations(adapter).scan();
    expect(items.map((item) => item.kind === 'ready' && item.projectId)).toEqual([
      'plan-a',
      'plan-a',
    ]);
    expect(calls).toEqual([]);
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
    expect(deleted.unkept).toEqual([]);
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

  it('deletes a folder holding a file it cannot read, keeping the rest for undo', async () => {
    const { adapter, stored } = createFolder(
      {
        'Practice/a.runplanner.json': { json: planJson('plan-a', 'A'), modifiedMs: 1 },
        'Practice/locked.runplanner.json': { json: '{}', modifiedMs: 2 },
      },
      { folders: ['Practice'], unreadable: ['Practice/locked.runplanner.json'] },
    );
    const library = operations(adapter);
    const deleted = await library.deleteFolder('Practice');
    expect(stored.size).toBe(0);
    expect(deleted.plans.map((plan) => plan.key)).toEqual(['Practice/a.runplanner.json']);
    expect(deleted.unkept).toEqual(['Practice/locked.runplanner.json']);
    await library.undoDeleteFolder(deleted);
    expect([...stored.keys()]).toEqual(['Practice/a.runplanner.json']);
  });

  it('restores a folder completely or not at all', async () => {
    const files = {
      'Practice/a.runplanner.json': { json: planJson('plan-a', 'A'), modifiedMs: 1 },
      'Practice/b.runplanner.json': { json: JSON.stringify(schema91Json), modifiedMs: 2 },
      'Practice/c.runplanner.json': { json: '{ broken', modifiedMs: 3 },
    };
    const failing = createFolder(files, {
      folders: ['Practice'],
      failRestore: ['Practice/c.runplanner.json'],
    });
    const library = operations(failing.adapter);
    const deleted = await library.deleteFolder('Practice');
    await expect(library.undoDeleteFolder(deleted)).rejects.toThrow('Disk full');
    expect(failing.stored.size).toBe(0);
    expect(failing.folders.size).toBe(0);

    const clashing = createFolder(files, { folders: ['Practice'] });
    const clashed = operations(clashing.adapter);
    const removed = await clashed.deleteFolder('Practice');
    clashing.stored.set('Practice/b.runplanner.json', { json: '{}', modifiedMs: 9 });
    await expect(clashed.undoDeleteFolder(removed)).rejects.toThrow(/already in the library/);
    expect([...clashing.stored.keys()]).toEqual(['Practice/b.runplanner.json']);

    const working = createFolder(files, { folders: ['Practice'] });
    const restoring = operations(working.adapter);
    await restoring.undoDeleteFolder(await restoring.deleteFolder('Practice'));
    expect(Object.fromEntries([...working.stored].map(([key, file]) => [key, file.json]))).toEqual(
      Object.fromEntries(Object.entries(files).map(([key, file]) => [key, file.json])),
    );
  });

  it('offers the unsaved autosave from before the library unless it repeats the previous file', async () => {
    const edited = planJson('plan-last', 'Edited');
    const previous = { fileName: 'Last.runplanner.json', json: planJson('plan-last', 'Last') };

    const differing = createFolder({}, { previous, autosave: edited });
    const library = operations(differing.adapter, differing.legacyAutosave);
    expect(await library.recoveredPlanOffer()).toEqual({
      fileName: 'Last.runplanner.json',
      json: edited,
      legacyName: 'Last',
    });
    // Declining the previous file leaves the differing autosave on offer.
    await library.settlePreviousFileOffer();
    expect(differing.autosave()).toBe(edited);
    await library.settleRecoveredPlanOffer();
    expect(differing.autosave()).toBeNull();
    expect(await library.recoveredPlanOffer()).toBeNull();

    const repeating = createFolder({}, { previous, autosave: previous.json });
    const repeated = operations(repeating.adapter, repeating.legacyAutosave);
    expect(await repeated.recoveredPlanOffer()).toBeNull();
    await repeated.settlePreviousFileOffer();
    expect(repeating.autosave()).toBeNull();

    const alone = createFolder({}, { autosave: JSON.stringify(schema91Json) });
    expect(await operations(alone.adapter, alone.legacyAutosave).recoveredPlanOffer()).toEqual(
      expect.objectContaining({ legacyName: 'Recovered plan' }),
    );
    const broken = createFolder({}, { autosave: '{ broken' });
    expect(await operations(broken.adapter, broken.legacyAutosave).recoveredPlanOffer()).toBeNull();
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
    expect(await library.previousFileOffer()).toEqual({ ...previous, legacyName: 'Last' });
    await library.settlePreviousFileOffer();
    expect(folder.session().previousFileOffered).toBe(true);
    expect(await operations(folder.adapter).previousFileOffer()).toBeNull();
  });
});
