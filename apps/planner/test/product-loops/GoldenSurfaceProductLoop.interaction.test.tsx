// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import {
  applyProjectCommand,
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
import { authoredProjectReplaced } from '../../src/state/projectWorkspaceSlice';
import { selectProfileStatus } from '../../src/state/store';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
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
    await view.user.click(screen.getByRole('button', { name: /Hub decision.*Ephyra Hub/ }));

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
  }, 45_000);

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
    await view.user.click(screen.getByRole('button', { name: /Hub decision.*Ephyra Hub/ }));

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
  });

  it('routes an actual Project Findings click to the exact shared-workspace target inspector', async () => {
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

    const findingIndex = application.store
      .getState()
      .projectWorkspace.evaluation.findings.findIndex(
        (finding) =>
          finding.code === 'targetRoomUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(target),
      );
    if (findingIndex < 0) throw new Error('The guaranteed Olympus target finding is missing');
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Project Findings is missing its section');
    const historyBefore = application.store.getState().projectWorkspace.history;
    const findingButton = within(findings).getAllByRole('button')[findingIndex];
    if (findingButton === undefined) throw new Error('Project Findings omitted the target finding');
    await view.user.click(findingButton);

    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(target);
    expect(application.store.getState().editorSession.activeRouteKey).toBe('Surface');
    expect(application.store.getState().editorSession.activeBiomeKeyByRoute.Surface).toBe('P');
    expect(application.store.getState().projectWorkspace.history).toBe(historyBefore);
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(within(inspector).getByRole('heading', { level: 3, name: 'Combat 02' })).toBeTruthy();
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
    const combat04Rail = Array.from(
      structure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.textContent?.includes('Combat 04'));
    if (combat04Rail === undefined) throw new Error('Thessaly Combat 04 rail node is missing');
    const historyBefore = application.store.getState().projectWorkspace.history;
    const evaluationBefore = application.store.getState().projectWorkspace.evaluation;
    work.length = 0;

    await view.user.click(combat04Rail);

    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createTargetAddress(
        oBiome,
        { kind: 'occurrence', occurrenceId: oOccurrenceIds.intro },
        'exit1',
      ),
    );
    expect(application.store.getState().projectWorkspace.history).toBe(historyBefore);
    expect(application.store.getState().projectWorkspace.evaluation).toBe(evaluationBefore);
    expect(recovery.hasPendingAutosave()).toBe(false);
    expect(work.filter((event) => event.kind === 'projectEvaluation')).toEqual([]);
    expect(work.filter((event) => event.kind === 'queryBatch')).toEqual([]);
    expect(screen.getByRole('heading', { level: 3, name: 'Combat 04' })).toBeTruthy();
  });
});
