import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import * as compilation from '@planner/workspace/projectFileCompilation';
import { createFakeGameModuleHost } from '@planner-test/fixtures/gameModuleHost';
import {
  createManualSaveScheduler,
  createMemoryProjectLibrary,
} from '@planner-test/support/memoryProjectLibrary';

vi.mock('@planner/workspace/projectFileCompilation', { spy: true });

function libraryApplication() {
  const library = createMemoryProjectLibrary();
  const game = createFakeGameModuleHost();
  let minted = 0;
  const application = createApplication({
    gameModuleHost: game.host,
    mintProjectId: () => `minted-${(minted += 1)}`,
    projectLibrary: library.adapter,
    saveScheduler: createManualSaveScheduler().scheduler,
  });
  return { application, game, library };
}

function erebusOpener() {
  const complete = createCompleteFGProject();
  return {
    ...complete,
    name: 'Erebus opener',
    route: { ...complete.route, biomes: complete.route.biomes.slice(0, 1) },
  };
}

describe('library game sends', () => {
  it('sends a stored plan as stored, reusing the compile while its file is unchanged', async () => {
    const { application, game, library } = libraryApplication();
    const key = await library.file(erebusOpener());
    const operations = application.projectOperations;
    const compile = vi.mocked(compilation.compileProjectFile);
    compile.mockClear();

    const inspected = await operations.inspectLibraryGamePlan(key);
    expect(inspected).toMatchObject({ kind: 'publishable', projectId: erebusOpener().projectId });
    await expect(operations.publishLibraryPlan(key, 4)).resolves.toEqual({
      operation: 'publishGame',
      status: 'success',
      message: 'Published to game, Slot 4.',
      blocked: null,
      activationProblem: null,
    });
    expect(compile).toHaveBeenCalledTimes(1);
    expect(JSON.parse(game.published[0]!.json)).toMatchObject({
      planFingerprint: inspected.kind === 'publishable' ? inspected.planFingerprint : null,
      displayName: 'Erebus opener',
    });
    // Nothing is opened, and the editor's send session is untouched.
    expect(application.store.getState().projectWorkspace.kind).toBe('noProject');
    expect(application.store.getState().gameSendSession.lastSentSlot).toBeNull();

    // A changed file is compiled again.
    await library.adapter.write(
      key,
      JSON.stringify({ ...JSON.parse(await library.adapter.read(key)), name: 'Renamed' }),
    );
    await operations.publishLibraryPlan(key, 5);
    expect(compile).toHaveBeenCalledTimes(2);
    expect(JSON.parse(game.published[1]!.json)).toMatchObject({ displayName: 'Renamed' });
  });

  it('says why a stored plan cannot be sent, without writing a slot', async () => {
    const { application, game, library } = libraryApplication();
    await application.projectOperations.createNew('Underworld');
    const unfinished = application.projectOperations.openKey()!;
    await application.projectOperations.flush();
    const broken = await library.file(erebusOpener());
    // Made by a newer planner.
    await library.adapter.write(
      broken,
      JSON.stringify({ ...JSON.parse(await library.adapter.read(broken)), schemaVersion: 999 }),
    );
    // Another plan is open, so both are read as stored.
    const other = await library.file({ ...erebusOpener(), projectId: 'other' });
    await application.projectOperations.openPlan(other);
    const operations = application.projectOperations;

    const findings = { kind: 'notPublishable', code: 'notEligible' };
    await expect(operations.inspectLibraryGamePlan(unfinished)).resolves.toEqual(findings);
    await expect(operations.publishLibraryPlan(unfinished, 1)).resolves.toMatchObject({
      status: 'cancelled',
      blocked: findings,
    });
    await expect(operations.inspectLibraryGamePlan(broken)).resolves.toMatchObject({
      kind: 'unreadable',
      message: expect.any(String),
    });
    await expect(operations.publishLibraryPlan(broken, 1)).resolves.toMatchObject({
      status: 'cancelled',
      blocked: { kind: 'unreadable' },
    });
    expect(game.published).toHaveLength(0);
  });

  it('sends the open plan as it is now through the editor’s send', async () => {
    const { application, game, library } = libraryApplication();
    const key = await library.file(erebusOpener());
    await application.projectOperations.openPlan(key);
    expect(await application.projectOperations.inspectLibraryGamePlan(key)).toBe(
      application.projectOperations.inspectCurrentGamePlan(),
    );
    await expect(application.projectOperations.publishLibraryPlan(key, 2)).resolves.toMatchObject({
      status: 'success',
      blocked: null,
    });
    expect(game.published).toHaveLength(1);
    expect(application.store.getState().gameSendSession.lastSentSlot).toBe(2);
  });
});
