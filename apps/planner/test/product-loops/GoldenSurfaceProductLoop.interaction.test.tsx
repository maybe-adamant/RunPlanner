// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import {
  createBatchRewardStoreAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createOccurrenceAddress,
  createTargetAddress,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createApplication,
  type PlannerApplication,
} from '../../src/composition/createApplication';
import { createCandidateSessionFactory } from '../../src/projections/candidateProjection';
import type {
  AutosaveRecoveryAdapter,
  AutosaveScheduler,
} from '../../src/persistence/autosaveRecovery';
import type { ProfileFileAdapter } from '../../src/persistence/profileFile';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '../../src/state/projectWorkspaceSlice';
import { selectProfileStatus } from '../../src/state/store';
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
} from '../fixtures/surfaceProject';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

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

async function collectLinearBiomeText(
  user: ReturnType<typeof renderPlannerForInteraction>['user'],
  structureName: string,
): Promise<string> {
  const structure = screen.getByRole('region', { name: structureName });
  let text = structure.textContent ?? '';
  const focusableNodes = [
    ...structure.querySelectorAll<HTMLElement>(
      '.linear-entry-node, .linear-decision-node, button.linear-terminal-node',
    ),
  ];
  for (const node of focusableNodes) {
    await user.click(node);
    text += screen.getByRole('complementary', { name: 'Focused inspector' }).textContent ?? '';
  }
  return text;
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

    expect(application.editorNavigation.routes.byKey.Surface).toMatchObject({
      biomePanels: [
        { biomeKey: 'N', label: 'Ephyra' },
        { biomeKey: 'O', label: 'Thessaly' },
        { biomeKey: 'P', label: 'Olympus' },
        { biomeKey: 'Q', label: 'Summit' },
      ],
    });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));

    const evaluated = application.store.getState().projectWorkspace.evaluation;
    const candidates = createCandidateSessionFactory(application.catalog).bind(authored, evaluated);
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
      processing: {
        completeValidPrefix: ['N', 'O', 'P', 'Q'],
        active: null,
        blockedSuffix: [],
      },
      biomes: [
        { biomeKey: 'N', authoring: 'complete', validity: 'valid' },
        { biomeKey: 'O', authoring: 'complete', validity: 'valid' },
        { biomeKey: 'P', authoring: 'complete', validity: 'valid' },
        { biomeKey: 'Q', authoring: 'complete', validity: 'valid' },
      ],
    });
    expect(screen.getByRole('heading', { name: 'Ephyra' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: / open$/ })).toHaveLength(26);
    expect(screen.getAllByLabelText(/^Visit \d room$/)).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Ephyra' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(document.body.textContent).not.toContain('N_Combat');
    expect(document.body.textContent).not.toContain('editor-n-');
    assertAccessibleControlSurface();

    await view.user.click(screen.getByRole('button', { name: 'Thessaly' }));
    expect(screen.getByRole('heading', { name: 'Thessaly' })).toBeTruthy();
    const oStructure = screen.getByRole('region', { name: 'Thessaly structure' });
    let shipCombatEncounterCount = 0;
    for (const node of oStructure.querySelectorAll<HTMLElement>('.linear-decision-node')) {
      await view.user.click(node);
      shipCombatEncounterCount += screen.queryAllByLabelText('Ship combat encounters').length;
    }
    expect(shipCombatEncounterCount).toBe(4);
    const oText = await collectLinearBiomeText(view.user, 'Thessaly structure');
    expect(oText).toContain('Preboss from Combat 02');
    expect(screen.getByRole('button', { name: 'Thessaly' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(oText).not.toContain('O_Combat');
    expect(oText).not.toContain('editor-o-');
    assertAccessibleControlSurface();

    const encounterCandidates = candidates.shipEncounterCounts(
      createOccurrenceAddress(oBiome, oOccurrenceIds.combat04),
      [2, 3],
    );
    expect(encounterCandidates.map((candidate) => candidate.evaluation)).toMatchObject([
      { context: 'evaluated', support: 'forced' },
      { context: 'evaluated', support: 'impossible' },
    ]);

    await view.user.click(screen.getByRole('button', { name: 'Olympus' }));
    expect(screen.getByRole('heading', { name: 'Olympus' })).toBeTruthy();
    const pText = await collectLinearBiomeText(view.user, 'Olympus structure');
    expect(pText).toContain('Preboss from Combat 12');
    expect(pText).toContain('Free Reward');
    expect(screen.getByRole('button', { name: 'Olympus' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(pText).not.toContain('P_Combat');
    expect(pText).not.toContain('editor-p-');
    assertAccessibleControlSurface();

    expect(
      candidates.batchRewardStores(
        createBatchRewardStoreAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
        ['RunProgress', 'MetaProgress'],
      ),
    ).toMatchObject([
      { value: 'RunProgress', evaluation: { context: 'evaluated', support: 'impossible' } },
      { value: 'MetaProgress', evaluation: { context: 'evaluated', support: 'forced' } },
    ]);

    await view.user.click(screen.getByRole('button', { name: 'Summit' }));
    expect(screen.getByRole('heading', { name: 'Summit' })).toBeTruthy();
    const qText = await collectLinearBiomeText(view.user, 'Summit structure');
    expect(qText).toContain('Preboss from Tail');
    expect(qText).toContain('Preboss Shop');
    expect(screen.getByRole('button', { name: 'Summit' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(qText).not.toContain('Q_Combat');
    expect(qText).not.toContain('editor-q-');
    assertAccessibleControlSurface();

    const qFoyer = application.catalog.rooms.byKey.Q_Combat10;
    const qOrdinary = application.catalog.rooms.byKey.Q_Combat01;
    if (qFoyer === undefined || qOrdinary === undefined) {
      throw new Error('Q candidate rooms are missing');
    }
    expect(
      candidates.roomTargets(createTargetAddress(qBiome, qOccurrenceIds.intro, 1), [
        qFoyer,
        qOrdinary,
      ]),
    ).toMatchObject([
      { value: { gameName: 'Q_Combat10' }, evaluation: { support: 'possible' } },
      { value: { gameName: 'Q_Combat01' }, evaluation: { support: 'impossible' } },
    ]);

    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));

    const candidateStarted = performance.now();
    const minibossCandidates = candidates.hubSlots(
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
      ['1', 'Ephyra'],
      ['2', 'Thessaly'],
      ['3', 'Olympus'],
      ['4', 'Summit'],
    ]);
    await view.user.click(
      screen.getAllByRole('button', { name: /Hub room cannot be open together/ })[0]!,
    );
    expect(application.store.getState().editorSession.activeRouteKey).toBe('Surface');
    expect(application.store.getState().editorSession.activeBiomeKeyByRoute.Surface).toBe('N');
    expect(screen.getByRole('button', { name: 'Ephyra' }).getAttribute('aria-current')).toBe(
      'page',
    );
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(presentProject(application)).toEqual(authored);

    const rebuildStarted = performance.now();
    expect(simulateProject(application.catalog, authored)).toEqual(evaluated);
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
      routes: [
        { status: 'empty' },
        { status: 'incomplete', processing: { completeValidPrefix: [] } },
      ],
    });
    expect(screen.getByRole('button', { name: 'Ephyra' })).toBeTruthy();
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
