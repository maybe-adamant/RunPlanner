// @vitest-environment jsdom

import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubSlotAddress,
  createOccurrenceAddress,
  createProjectDocument,
  createTargetAddress,
  encodeProjectDocument,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
  type PlannerApplication,
} from '../../src/composition/createApplication';
import type {
  AutosaveRecoveryAdapter,
  AutosaveScheduler,
} from '../../src/persistence/autosaveRecovery';
import type { ProfileFileAdapter } from '../../src/persistence/profileFile';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '../../src/state/projectWorkspaceSlice';
import { selectProfileStatus } from '../../src/state/store';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '../fixtures/surfaceProject';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
  hasPendingAutosave(): boolean;
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
        if (pending !== null) pending.cancelled = true;
        const next = { cancelled: false, task };
        pending = next;
        return () => {
          next.cancelled = true;
        };
      },
    },
    flush() {
      if (pending === null || pending.cancelled) {
        throw new Error('No recovery autosave is pending');
      }
      const next = pending;
      pending = null;
      next.task();
    },
    hasPendingAutosave: () => pending !== null && !pending.cancelled,
    readStoredJson: () => storedJson,
  };
}

function currentProject(application: PlannerApplication) {
  return application.store.getState().projectWorkspace.history.present;
}

function hubRailButton(): HTMLElement {
  return screen.getByRole('button', { name: /Persistent board.*Hub/ });
}

describe('surface product loop', () => {
  it('renders every Surface biome through the shared workspace and persists the complete route', async () => {
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

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(hubRailButton());

    expect(application.store.getState().projectWorkspace.evaluation).toMatchObject({
      findings: [],
      status: 'valid',
      summary: {
        configuredBiomeCount: 4,
        eligibleForExecutionPlan: true,
        evaluatedBiomeCount: 4,
        validatedBiomeCount: 4,
      },
    });
    expect(screen.getByRole('heading', { name: 'Open Ephyra rooms' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: / open$/ })).toHaveLength(26);
    expect(document.querySelectorAll('.hub-visit-row')).toHaveLength(6);
    expect(document.body.textContent).not.toContain('N_Combat');

    for (const [label, structure] of [
      ['Thessaly', 'Thessaly structure'],
      ['Olympus', 'Olympus structure'],
      ['Summit', 'Summit structure'],
    ] as const) {
      await view.user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('region', { name: structure }).className).toContain(
        'biome-structure-region',
      );
      expect(document.querySelector('.biome-workspace')).not.toBeNull();
    }

    expect(simulateProject(application.catalog, authored)).toEqual(
      application.store.getState().projectWorkspace.evaluation,
    );
    recovery.flush();
    expect(recovery.readStoredJson()).toBe(encodeProjectDocument(authored));

    await view.user.click(screen.getByRole('button', { name: 'Save Profile' }));
    await screen.findByText('Saved the profile.');
    expect(persistence.readStoredJson()).toBe(encodeProjectDocument(authored));
    expect(selectProfileStatus(application.store.getState())).toBe('Clean');

    await view.user.click(screen.getByRole('button', { name: 'New' }));
    expect(application.store.getState().projectWorkspace.evaluation.status).toBe('empty');
    await view.user.click(screen.getByRole('button', { name: 'Load Profile' }));
    await screen.findByText('Loaded the profile.');
    expect(currentProject(application)).toEqual(authored);

    application.dispose();
    view.unmount();
    const recovered = createApplication({
      autosaveRecovery: recovery.adapter,
      autosaveScheduler: recovery.scheduler,
    });
    renderPlannerForInteraction({ application: recovered });
    expect(selectProfileStatus(recovered.store.getState())).toBe('Recovered');
    expect(currentProject(recovered)).toEqual(authored);
  });

  it('records an N Hub visit edit as one undoable semantic command and autosaves both states', async () => {
    const recovery = createRecoveryPersistence();
    const application = createApplication({
      autosaveRecovery: recovery.adapter,
      autosaveScheduler: recovery.scheduler,
    });
    const authored = appendCompleteN(
      createProjectDocument(application.catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Hub undo surface',
        projectId: 'surface-product-hub-undo',
      }),
    );
    application.store.dispatch(authoredProjectReplaced(authored));
    recovery.flush();
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(hubRailButton());

    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const removeFinalVisit = screen.getByRole('button', { name: 'Remove visits from Visit 6' });
    const historyBefore = application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(removeFinalVisit);

    const edited = currentProject(application);
    expect(document.querySelectorAll('.hub-visit-row[data-authoring="authored"]')).toHaveLength(5);
    const nTopology = edited.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    expect(
      nTopology?.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
    expect(edited).not.toEqual(authored);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(recovery.hasPendingAutosave()).toBe(true);
    recovery.flush();
    expect(recovery.readStoredJson()).toBe(encodeProjectDocument(edited));

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(currentProject(application)).toEqual(authored);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(historyBefore);
    expect(recovery.hasPendingAutosave()).toBe(true);
    recovery.flush();
    expect(recovery.readStoredJson()).toBe(encodeProjectDocument(authored));

    await view.user.click(screen.getByRole('button', { name: 'Redo' }));

    expect(currentProject(application)).toEqual(edited);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(recovery.hasPendingAutosave()).toBe(true);
    recovery.flush();
    expect(recovery.readStoredJson()).toBe(encodeProjectDocument(edited));
  });

  it('closes a ninth unvisited Hub member and its completed handoff as one undoable autosaved command', async () => {
    const recovery = createRecoveryPersistence();
    const application = createApplication({
      autosaveRecovery: recovery.adapter,
      autosaveScheduler: recovery.scheduler,
    });
    const authored = appendCompleteN(
      createProjectDocument(application.catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Completed Hub membership repair surface',
        projectId: 'surface-product-completed-hub-membership-repair',
      }),
    );
    application.store.dispatch(authoredProjectReplaced(authored));
    recovery.flush();
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(hubRailButton());

    const card = screen.getByRole('article', { name: 'Combat 03 Hub slot' });
    const checkbox = within(card).getByRole('checkbox', {
      name: 'Combat 03 open',
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(within(card).queryByText(/Closing this slot removes/)).toBeNull();

    const historyBeforeClose = application.store.getState().projectWorkspace.history.past.length;
    dispatch.mockClear();
    act(() => checkbox.focus());
    await view.user.keyboard('[Space]');

    await waitFor(() => expect(checkbox.checked).toBe(false));
    const topology = currentProject(application)
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    const hub = topology?.decisions.find((decision) => decision.kind === 'hub');
    if (topology === null || topology === undefined || hub?.kind !== 'hub') {
      throw new Error('N Hub topology is missing after closing Combat 03');
    }
    expect(hub.openTargets).toHaveLength(8);
    expect(hub.visitOrder).toHaveLength(6);
    expect(
      topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
    expect(
      topology.occurrences.some(
        (occurrence) => occurrence.occurrenceId === nOccurrenceId('combat03'),
      ),
    ).toBe(false);
    expect(
      topology.occurrences.some((occurrence) => occurrence.occurrenceId === nOccurrenceIds.preboss),
    ).toBe(false);
    expect(application.store.getState().projectWorkspace.evaluation.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'hubOpenSetIncomplete' })]),
    );
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeClose + 1,
    );
    expect(
      dispatch.mock.calls
        .map(([action]) => action)
        .filter(authoredProjectCommandDispatched.match)
        .map((action) => action.payload),
    ).toEqual([
      {
        kind: 'CloseHubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'combat03'),
      },
    ]);
    expect(recovery.hasPendingAutosave()).toBe(true);
    recovery.flush();
    expect(recovery.readStoredJson()).toBe(encodeProjectDocument(currentProject(application)));

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(currentProject(application)).toEqual(authored));
    expect(recovery.hasPendingAutosave()).toBe(true);
    recovery.flush();
    expect(recovery.readStoredJson()).toBe(encodeProjectDocument(authored));
  });

  it('closes an unvisited Hub member as one undoable autosaved command', async () => {
    const recovery = createRecoveryPersistence();
    const application = createApplication({
      autosaveRecovery: recovery.adapter,
      autosaveScheduler: recovery.scheduler,
    });
    const authored = appendCompleteN(
      createProjectDocument(application.catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Hub membership repair surface',
        projectId: 'surface-product-hub-membership-repair',
      }),
    );
    application.store.dispatch(authoredProjectReplaced(authored));
    recovery.flush();
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(hubRailButton());

    const card = screen.getByRole('article', { name: 'Combat 04 Hub slot' });
    const checkbox = within(card).getByRole('checkbox', {
      name: 'Combat 04 open',
    }) as HTMLInputElement;
    await view.user.pointer({ keys: '[MouseLeft]', target: checkbox });
    await waitFor(() => expect(checkbox.checked).toBe(true));
    expect(within(card).queryByText(/Closing this slot removes/)).toBeNull();
    const hub = application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.topology?.decisions.find((decision) => decision.kind === 'hub');
    const openedOccurrenceId =
      hub?.kind === 'hub'
        ? hub.openTargets.find((target) => target.hubSlotKey === 'combat04')?.occurrenceId
        : undefined;
    if (openedOccurrenceId === undefined) throw new Error('Combat 04 was not opened');
    const retainedOccurrenceId =
      hub?.kind === 'hub'
        ? hub.openTargets.find((target) => target.hubSlotKey === 'combat05')?.occurrenceId
        : undefined;
    if (retainedOccurrenceId === undefined)
      throw new Error('Combat 05 must remain an open Hub slot');

    const historyBeforeClose = application.store.getState().projectWorkspace.history.past.length;
    dispatch.mockClear();
    act(() => checkbox.focus());
    await view.user.keyboard('[Space]');

    await waitFor(() => expect(checkbox.checked).toBe(false));
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeClose + 1,
    );
    const topologyAfterClose = application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    expect(
      topologyAfterClose?.occurrences.some(
        (occurrence) => occurrence.occurrenceId === openedOccurrenceId,
      ),
    ).toBe(false);
    expect(
      topologyAfterClose?.occurrences.some(
        (occurrence) => occurrence.occurrenceId === retainedOccurrenceId,
      ),
    ).toBe(true);
    expect(
      topologyAfterClose?.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(true);
    expect(
      topologyAfterClose?.occurrences.some(
        (occurrence) => occurrence.occurrenceId === nOccurrenceIds.preboss,
      ),
    ).toBe(true);
    expect(
      dispatch.mock.calls
        .map(([action]) => action)
        .filter(authoredProjectCommandDispatched.match)
        .map((action) => action.payload),
    ).toEqual([
      {
        kind: 'CloseHubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'combat04'),
      },
    ]);
    expect(recovery.hasPendingAutosave()).toBe(true);
    recovery.flush();
    expect(recovery.readStoredJson()).toBe(encodeProjectDocument(currentProject(application)));
  });

  it('routes a selected-route Findings click to the owning decision inspector', async () => {
    const application = createApplication();
    const target = createTargetAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
      'exit1',
    );
    const invalidProject = applyProjectCommand(
      createRepresentativeNOPQProject(),
      application.catalog,
      {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
        gameName: 'P_Combat02',
      },
    );
    application.store.dispatch(authoredProjectReplaced(invalidProject));
    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Surface' }));

    const surfaceEvaluation = application.store
      .getState()
      .projectWorkspace.evaluation.routes.find((route) => route.routeKey === 'Surface');
    if (surfaceEvaluation === undefined) throw new Error('Surface evaluation is missing');
    const findingIndex = surfaceEvaluation.findings.findIndex(
      (finding) =>
        finding.code === 'targetRoomUnavailable' &&
        semanticAddressKey(finding.origin) === semanticAddressKey(target),
    );
    if (findingIndex < 0) {
      throw new Error('The selected Surface Findings panel omitted the Olympus target finding');
    }
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings is missing its section');
    const historyBefore = application.store.getState().projectWorkspace.history;
    const findingButton = within(findings).getAllByRole('button')[findingIndex];
    if (findingButton === undefined) throw new Error('Findings omitted the target finding');
    await view.user.click(findingButton);

    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(target);
    expect(application.store.getState().editorSession.activeRouteKey).toBe('Surface');
    expect(application.store.getState().editorSession.activeBiomeKeyByRoute.Surface).toBe('P');
    expect(application.store.getState().projectWorkspace.history).toBe(historyBefore);
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
    expect(within(inspector).getByRole('article', { name: 'Combat 02 room offer' })).toBeTruthy();
  });

  it('treats a shared-workspace rail focus as session-only work', async () => {
    const recovery = createRecoveryPersistence();
    const work: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      autosaveRecovery: recovery.adapter,
      autosaveScheduler: recovery.scheduler,
      observeEvaluationWork: (event) => work.push(event),
    });
    application.store.dispatch(authoredProjectReplaced(createRepresentativeNOPQProject()));
    recovery.flush();
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Thessaly' }));
    const structure = screen.getByRole('region', { name: 'Thessaly structure' });
    const decisionOwner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.intro,
    });
    const decisionRail = Array.from(
      structure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.dataset.workspaceNode === semanticAddressKey(decisionOwner));
    if (decisionRail === undefined) throw new Error('Thessaly Decision 1 rail node is missing');
    const historyBefore = application.store.getState().projectWorkspace.history;
    const evaluationBefore = application.store.getState().projectWorkspace.evaluation;
    work.length = 0;

    await view.user.click(decisionRail);

    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(decisionOwner);
    expect(application.store.getState().projectWorkspace.history).toBe(historyBefore);
    expect(application.store.getState().projectWorkspace.evaluation).toBe(evaluationBefore);
    expect(recovery.hasPendingAutosave()).toBe(false);
    expect(work.filter((event) => event.kind === 'projectEvaluation')).toEqual([]);
    expect(work.filter((event) => event.kind === 'queryBatch')).toEqual([]);
    expect(screen.getByRole('heading', { level: 2, name: 'Decision 1' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Combat 04 room offer' })).toBeTruthy();
  });
});
