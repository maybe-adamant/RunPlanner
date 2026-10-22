import { catalog } from '@run-planner/hades2-catalog';
import { encodeProjectDocument } from '@run-planner/engine/authored-project';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type { CatalogFeedSnapshot } from '@planner/persistence/catalogFeedHost';
import { NEEDS_NEWER_PLANNER } from '@planner/workspace/catalogFeed';
import {
  catalogEntry,
  catalogSnapshot,
  createFakeCatalogFeedHost,
} from '@planner-test/fixtures/catalogFeedHost';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';

const planJson = encodeProjectDocument(createGoldenFGHProject());

async function setup(snapshot: CatalogFeedSnapshot, plans: Record<string, string> = {}) {
  const feed = createFakeCatalogFeedHost(snapshot, plans);
  const library = createMemoryProjectLibrary();
  let ids = 0;
  const application = createApplication({
    catalogFeedHost: feed.host,
    mintProjectId: () => `catalog-copy-${(ids += 1)}`,
    projectLibrary: library.adapter,
  });
  await application.startupReady;
  return { application, controller: application.planCatalog!, feed, library };
}

describe('plan catalog controller', () => {
  it('needs a library and a host', () => {
    expect(
      createApplication({ projectLibrary: createMemoryProjectLibrary().adapter }).planCatalog,
    ).toBe(undefined);
  });

  it('reads the index, offline from the cache, and reports a catalog that could not load', async () => {
    const entry = catalogEntry();
    const { controller, feed } = await setup(catalogSnapshot([entry]));
    expect(controller.getSnapshot()).toEqual({ kind: 'loading' });
    await controller.sync();
    expect(feed.host.refresh).toHaveBeenLastCalledWith(false);
    expect(controller.getSnapshot()).toMatchObject({
      kind: 'ready',
      entries: [entry],
      offline: false,
    });

    feed.answer(catalogSnapshot([entry], { source: 'cache', problem: 'offline' }));
    await controller.sync('screen');
    expect(feed.host.refresh).toHaveBeenLastCalledWith(true);
    expect(controller.getSnapshot()).toMatchObject({ kind: 'ready', offline: true });

    feed.answer(catalogSnapshot([], { source: 'none', problem: 'Could not download.' }));
    await controller.sync('screen');
    expect(controller.getSnapshot()).toEqual({
      kind: 'unavailable',
      problem: 'Could not download.',
    });

    feed.answer(catalogSnapshot([], { source: 'disabled' }));
    await controller.sync();
    expect(controller.getSnapshot()).toEqual({ kind: 'disabled' });
  });

  it('adds an entry at the top of the library as its own copy named after the entry', async () => {
    const entry = catalogEntry({ title: 'Underworld WR' });
    const { application, controller, library } = await setup(catalogSnapshot([entry]), {
      [entry.id]: planJson,
    });
    const result = await controller.addToLibrary(entry);
    expect(result).toEqual({
      operation: 'addCatalog',
      status: 'success',
      message: 'Added “Underworld WR” to the library.',
    });
    const [stored] = await library.plans(catalog);
    expect(stored).toMatchObject({ name: 'Underworld WR', projectId: 'catalog-copy-1' });
    const listing = await application.projectOperations.listLibrary();
    expect(listing.items.map((item) => item.folder)).toEqual(['']);
    expect(await application.projectOperations.catalogCopies()).toEqual({
      [entry.id]: 'catalog-copy-1',
    });
    // Adding does not open the copy.
    expect(application.store.getState().projectWorkspace.kind).toBe('noProject');
  });

  it('refuses an entry saved by a newer planner without downloading it, and reports a failed download', async () => {
    const future = catalogEntry({ id: 'future', planSchemaVersion: 999 });
    const broken = catalogEntry({ id: 'broken' });
    const { controller, feed, library } = await setup(catalogSnapshot([future, broken]));
    expect(await controller.addToLibrary(future)).toMatchObject({
      status: 'failure',
      message: NEEDS_NEWER_PLANNER,
    });
    expect(feed.host.downloadPlan).not.toHaveBeenCalled();
    expect(await controller.addToLibrary(broken)).toMatchObject({
      status: 'failure',
      message: 'Add to library failed: The downloaded plan does not match the catalog.',
    });
    expect(await library.plans(catalog)).toEqual([]);
  });
});
