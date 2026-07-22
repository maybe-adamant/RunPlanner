// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import {
  createBatchRewardStoreAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createOccurrenceAddress,
  createTargetAddress,
  encodeProjectDocument,
  simulateProject,
} from '@run-planner/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication, type PlannerApplication } from '../application/createApplication';
import { createProjectSimulationScope } from '../application/capabilityConfiguration';
import type { AutosaveRecoveryAdapter, AutosaveScheduler } from '../application/autosaveRecovery';
import type { ProfileFileAdapter } from '../application/profileFile';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '../application/projectWorkspaceSlice';
import { selectProfileStatus } from '../application/store';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  qBiome,
  qOccurrenceIds,
} from '../testing/surfaceProject';
import { renderPlannerForInteraction } from '../testing/renderPlanner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stubScrollIntoView(): void {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
}

function createPersistence(): {
  readonly profileFile: ProfileFileAdapter;
  readStoredJson(): string | null;
} {
  let storedJson: string | null = null;
  return {
    profileFile: {
      save: (_fileName, json) => {
        storedJson = json;
        return Promise.resolve('saved');
      },
      load: () => Promise.resolve(storedJson),
    },
    readStoredJson: () => storedJson,
  };
}

function createRecoveryPersistence(): {
  readonly adapter: AutosaveRecoveryAdapter;
  readonly scheduler: AutosaveScheduler;
  flush(): void;
  readStoredJson(): string | null;
} {
  let storedJson: string | null = null;
  let pending: { cancelled: boolean; task: () => void } | null = null;
  return {
    adapter: {
      read: () => storedJson,
      write: (json) => {
        storedJson = json;
      },
      clear: () => {
        storedJson = null;
      },
    },
    scheduler: {
      schedule: (_delayMs, task) => {
        if (pending !== null) {
          pending.cancelled = true;
        }
        const scheduled = { cancelled: false, task };
        pending = scheduled;
        return () => {
          scheduled.cancelled = true;
        };
      },
    },
    flush() {
      if (pending === null || pending.cancelled) {
        throw new Error('No recovery autosave is pending');
      }
      const scheduled = pending;
      pending = null;
      scheduled.task();
    },
    readStoredJson: () => storedJson,
  };
}

function assertAccessibleControlSurface(): void {
  const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  expect(new Set(ids).size, `duplicate ids: ${duplicateIds.join(', ')}`).toBe(ids.length);
  for (const control of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    'input, select',
  )) {
    expect(
      control.labels?.length !== 0 ||
        control.hasAttribute('aria-label') ||
        control.hasAttribute('aria-labelledby'),
      `${control.tagName.toLowerCase()}#${control.id} needs an accessible label`,
    ).toBe(true);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
    expect(
      button.textContent?.trim() !== '' ||
        button.hasAttribute('aria-label') ||
        button.hasAttribute('aria-labelledby'),
      'button needs an accessible name',
    ).toBe(true);
  }
}

function presentProject(application: PlannerApplication) {
  return application.store.getState().projectWorkspace.history.present;
}

describe('N/O/P/Q Surface product loop', () => {
  it('closes activation, profiles, recovery, findings, candidates, accessibility, and responsiveness', async () => {
    stubScrollIntoView();
    const persistence = createPersistence();
    const recovery = createRecoveryPersistence();
    const application = createApplication({
      autosaveRecovery: recovery.adapter,
      autosaveScheduler: recovery.scheduler,
      profileFile: persistence.profileFile,
    });
    const authored = createRepresentativeNOPQProject();
    application.store.dispatch(authoredProjectReplaced(authored));
    const view = renderPlannerForInteraction({ application });

    expect(application.capabilities.byBiomeKey.N).toMatchObject({
      authorable: true,
      simulatable: true,
      editable: true,
    });
    expect(application.capabilities.byBiomeKey.O).toMatchObject({
      authorable: true,
      simulatable: true,
      editable: true,
    });
    expect(application.capabilities.byBiomeKey.P).toMatchObject({
      authorable: true,
      simulatable: true,
      editable: true,
    });
    expect(application.capabilities.byBiomeKey.Q).toMatchObject({
      authorable: true,
      simulatable: true,
      editable: true,
    });
    expect(application.editorNavigation.routes.Surface).toMatchObject({
      biomePanels: [
        { biomeKey: 'N', label: 'City of Ephyra' },
        { biomeKey: 'O', label: 'Rift of Thessaly' },
        { biomeKey: 'P', label: 'Mount Olympus' },
        { biomeKey: 'Q', label: 'Summit' },
      ],
      configurablePrefixBiomePanels: [
        { biomeKey: 'N', label: 'City of Ephyra' },
        { biomeKey: 'O', label: 'Rift of Thessaly' },
        { biomeKey: 'P', label: 'Mount Olympus' },
        { biomeKey: 'Q', label: 'Summit' },
      ],
    });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'City of Ephyra' }));

    const evaluated = application.store.getState().projectWorkspace.evaluation;
    expect(evaluated.status).toBe('valid');
    expect(evaluated.findings).toEqual([]);
    expect(evaluated.summary).toMatchObject({
      configuredBiomeCount: 4,
      evaluatedBiomeCount: 4,
      validatedBiomeCount: 4,
      eligibleForExecutionPlan: true,
    });
    expect(evaluated.routes[1]).toMatchObject({
      status: 'valid',
      validatedPrefix: ['N', 'O', 'P', 'Q'],
      horizon: { kind: 'routeEnd' },
      biomes: [
        { biomeKey: 'N', completion: 'complete', validity: 'valid' },
        { biomeKey: 'O', completion: 'complete', validity: 'valid' },
        { biomeKey: 'P', completion: 'complete', validity: 'valid' },
        { biomeKey: 'Q', completion: 'complete', validity: 'valid' },
      ],
    });
    expect(screen.getByRole('heading', { name: 'City of Ephyra' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: / open$/ })).toHaveLength(26);
    expect(screen.getAllByLabelText(/^Visit \d room$/)).toHaveLength(6);
    expect(
      screen.getByRole('button', { name: 'City of Ephyra' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(document.body.textContent).not.toContain('N_Combat');
    expect(document.body.textContent).not.toContain('editor-n-');
    assertAccessibleControlSurface();

    await view.user.click(screen.getByRole('button', { name: 'Rift of Thessaly' }));
    expect(screen.getByRole('heading', { name: 'Rift of Thessaly' })).toBeTruthy();
    expect(screen.getAllByLabelText('Ship combat encounters')).toHaveLength(4);
    expect(screen.getByRole('heading', { name: 'Preboss from Combat 02' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Rift of Thessaly' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(document.body.textContent).not.toContain('O_Combat');
    expect(document.body.textContent).not.toContain('editor-o-');
    assertAccessibleControlSurface();

    const encounterCandidates = application.candidateProjection.shipEncounterCounts(
      authored,
      createOccurrenceAddress(oBiome, oOccurrenceIds.combat04),
      [2, 3],
    );
    expect(encounterCandidates.map((candidate) => candidate.evaluation)).toMatchObject([
      { context: 'evaluated', support: 'forced' },
      { context: 'evaluated', support: 'impossible' },
    ]);

    await view.user.click(screen.getByRole('button', { name: 'Mount Olympus' }));
    expect(screen.getByRole('heading', { name: 'Mount Olympus' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Preboss from Combat 15' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Free Reward' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mount Olympus' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(document.body.textContent).not.toContain('P_Combat');
    expect(document.body.textContent).not.toContain('editor-p-');
    assertAccessibleControlSurface();

    expect(
      application.candidateProjection.batchRewardStores(
        authored,
        createBatchRewardStoreAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
        ['RunProgress', 'MetaProgress'],
      ),
    ).toMatchObject([
      { value: 'RunProgress', evaluation: { context: 'evaluated', support: 'impossible' } },
      { value: 'MetaProgress', evaluation: { context: 'evaluated', support: 'forced' } },
    ]);

    await view.user.click(screen.getByRole('button', { name: 'Summit' }));
    expect(screen.getByRole('heading', { name: 'Summit' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Preboss from Tail' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Preboss Shop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Summit' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(document.body.textContent).not.toContain('Q_Combat');
    expect(document.body.textContent).not.toContain('editor-q-');
    assertAccessibleControlSurface();

    const qFoyer = application.catalog.rooms.byKey.Q_Combat10;
    const qOrdinary = application.catalog.rooms.byKey.Q_Combat01;
    if (qFoyer === undefined || qOrdinary === undefined) {
      throw new Error('Q candidate rooms are missing');
    }
    expect(
      application.candidateProjection.roomTargets(
        authored,
        createTargetAddress(qBiome, qOccurrenceIds.intro, 1),
        [qFoyer, qOrdinary],
      ),
    ).toMatchObject([
      { value: { gameName: 'Q_Combat10' }, evaluation: { support: 'possible' } },
      { value: { gameName: 'Q_Combat01' }, evaluation: { support: 'impossible' } },
    ]);

    await view.user.click(screen.getByRole('button', { name: 'City of Ephyra' }));

    const candidateStarted = performance.now();
    const minibossCandidates = application.candidateProjection.hubSlots(
      authored,
      createHubSlotAddress(nBiome, 'miniBoss02'),
      nOccurrenceId('candidate-miniBoss02'),
      [false, true],
    );
    const candidateDurationMs = performance.now() - candidateStarted;
    expect(minibossCandidates).toHaveLength(2);
    expect(minibossCandidates.find((candidate) => candidate.value)).toMatchObject({
      evaluation: {
        context: 'evaluated',
        support: 'impossible',
        findings: [{ code: 'hubOpenSlotUnavailable' }],
      },
    });

    const boarSlot = screen.getByRole('article', { name: 'Erymanthian Boar Hub slot' });
    await view.user.click(
      within(boarSlot).getByRole('checkbox', { name: 'Erymanthian Boar open' }),
    );
    expect(application.store.getState().projectWorkspace.evaluation.status).toBe('invalid');
    await view.user.click(screen.getByRole('button', { name: 'Route' }));
    expect(
      Array.from((screen.getByLabelText('Configured biomes') as HTMLSelectElement).options).map(
        (option) => [option.value, option.textContent],
      ),
    ).toEqual([
      ['0', 'None'],
      ['1', 'City of Ephyra'],
      ['2', 'Rift of Thessaly'],
      ['3', 'Mount Olympus'],
      ['4', 'Summit'],
    ]);
    await view.user.click(
      screen.getAllByRole('button', { name: /Hub room cannot be open together/ })[0]!,
    );
    expect(application.store.getState().editorSession.activeSection).toBe('surface');
    expect(application.store.getState().editorSession.activeSurfacePanel).toBe('N');
    expect(
      screen.getByRole('button', { name: 'City of Ephyra' }).getAttribute('aria-current'),
    ).toBe('page');
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(presentProject(application)).toEqual(authored);

    const rebuildStarted = performance.now();
    expect(
      simulateProject(
        application.catalog,
        authored,
        createProjectSimulationScope(application.capabilities),
      ),
    ).toEqual(evaluated);
    const rebuildDurationMs = performance.now() - rebuildStarted;
    const editStarted = performance.now();
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceHubVisit',
        visit: createHubVisitAddress(nBiome, 1),
        hubSlotKey: 'combat01',
      }),
    );
    const editDurationMs = performance.now() - editStarted;
    const undoStarted = performance.now();
    application.store.dispatch(authoredProjectUndoRequested());
    const undoDurationMs = performance.now() - undoStarted;
    expect(rebuildDurationMs, `N rebuild took ${rebuildDurationMs.toFixed(1)} ms`).toBeLessThan(
      750,
    );
    expect(
      candidateDurationMs,
      `N candidate projection took ${candidateDurationMs.toFixed(1)} ms`,
    ).toBeLessThan(750);
    expect(editDurationMs, `N edit publication took ${editDurationMs.toFixed(1)} ms`).toBeLessThan(
      750,
    );
    expect(undoDurationMs, `N undo publication took ${undoDurationMs.toFixed(1)} ms`).toBeLessThan(
      50,
    );
    expect(presentProject(application)).toEqual(authored);

    recovery.flush();
    expect(recovery.readStoredJson()).toBe(encodeProjectDocument(authored));
    await view.user.click(screen.getByRole('button', { name: 'Save Profile' }));
    await screen.findByText('Saved the profile.');
    expect(persistence.readStoredJson()).toBe(encodeProjectDocument(authored));
    expect(selectProfileStatus(application.store.getState())).toBe('Clean');
    await view.user.click(screen.getByRole('button', { name: 'New' }));
    expect(application.store.getState().projectWorkspace.evaluation.status).toBe('empty');
    await view.user.selectOptions(screen.getByLabelText('Configured biomes'), '1');
    expect(application.store.getState().projectWorkspace.evaluation).toMatchObject({
      status: 'incomplete',
      routes: [{ status: 'empty' }, { status: 'incomplete', validatedPrefix: [] }],
    });
    expect(screen.getByRole('button', { name: 'City of Ephyra' })).toBeTruthy();
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.evaluation.status).toBe('empty');
    await view.user.click(screen.getByRole('button', { name: 'Load Profile' }));
    await screen.findByText('Loaded the profile.');
    expect(presentProject(application)).toEqual(authored);
    expect(application.store.getState().projectWorkspace.evaluation).toEqual(evaluated);

    application.dispose();
    view.unmount();
    const recoveredApplication = createApplication({
      autosaveRecovery: recovery.adapter,
      autosaveScheduler: recovery.scheduler,
    });
    renderPlannerForInteraction({ application: recoveredApplication });
    expect(selectProfileStatus(recoveredApplication.store.getState())).toBe('Recovered');
    expect(presentProject(recoveredApplication)).toEqual(authored);
    expect(recoveredApplication.store.getState().projectWorkspace.evaluation).toEqual(evaluated);
  }, 90_000);
});
