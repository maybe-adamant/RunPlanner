import { createProjectAddress, encodeProjectDocument } from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it, vi } from 'vitest';

import { loadProjectDocument } from '@planner/persistence/projectDocumentLoader';
import { createProjectLibraryOperations } from '@planner/workspace/projectLibrary';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';

// The seam: the upgrade settlement throws as an engine defect would.
vi.mock('@planner/persistence/project-102-to-103.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@planner/persistence/project-102-to-103.js')>()),
  settleUpgradedProject: () => {
    throw new TypeError('settlement defect');
  },
}));

describe('a plan saved before schema 103 whose settlement throws', () => {
  it('opens as saved, carrying the throw as a settlement fault', () => {
    const saved = createGoldenFGHProject();
    const json = JSON.stringify({
      ...JSON.parse(encodeProjectDocument(saved)),
      schemaVersion: 102,
    });
    const loaded = loadProjectDocument(json, catalog);
    expect(loaded.project).toEqual(saved);
    expect(loaded.upgrade).toEqual({
      before: loaded.project,
      fault: { key: 'upgradeSettlement:settlement defect', owner: createProjectAddress() },
    });
  });

  it('imports as a copy whose plan as saved is the copy itself', async () => {
    const saved = createGoldenFGHProject();
    const json = JSON.stringify({
      ...JSON.parse(encodeProjectDocument(saved)),
      schemaVersion: 102,
    });
    const library = createMemoryProjectLibrary();
    const operations = createProjectLibraryOperations({
      adapter: library.adapter,
      catalog,
      mintProjectId: () => 'minted',
    });
    const filed = await operations.importFile(
      { fileName: 'old.runplanner.json', json },
      { newIdentity: true },
    );
    expect(filed.project).toEqual({ ...saved, projectId: 'minted' });
    expect(filed.upgrade?.before).toBe(filed.project);
    expect(filed.upgrade?.fault?.key).toBe('upgradeSettlement:settlement defect');
  });

  it('imports a renamed copy with no history step behind it', async () => {
    const saved = createGoldenFGHProject();
    const json = JSON.stringify({
      ...JSON.parse(encodeProjectDocument(saved)),
      schemaVersion: 102,
    });
    const library = createMemoryProjectLibrary();
    const operations = createProjectLibraryOperations({
      adapter: library.adapter,
      catalog,
      mintProjectId: () => 'minted',
    });
    const filed = await operations.importFile(
      { fileName: 'old.runplanner.json', json },
      { newIdentity: true, name: 'Renamed' },
    );
    expect(filed.project).toEqual({ ...saved, projectId: 'minted', name: 'Renamed' });
    expect(filed.upgrade?.before).toBe(filed.project);
  });
});
