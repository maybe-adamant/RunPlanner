// @vitest-environment jsdom

import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  encodeProjectDocument,
  semanticAddressKey,
  type TraitOfferOwnerAddress,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import {
  simulateProject,
  traitCandidates,
  type ReachedTraitOfferEvaluation,
} from '@run-planner/engine/simulation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
  type PlannerApplication,
} from '@planner/composition/createApplication';
import type {
  AutosaveRecoveryAdapter,
  AutosaveScheduler,
} from '@planner/persistence/autosaveRecovery';
import type { ProfileFileAdapter } from '@planner/persistence/profileFile';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { selectProfileStatus } from '@planner/state/store';
import {
  appendCompleteN,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
  createGoldenFGHIProject,
  createRepresentativeNOPQProject,
  createRepresentativeNOPQShopTraitProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';
import { semanticOwnerElementId } from '@planner/ui/feedback/semanticOwner';

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
  return screen.getByRole('button', { name: /Hub.*visits/ });
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

    expect(application.store.getState().projectWorkspace.assembly.evaluation).toMatchObject({
      findings: [],
      status: 'valid',
      summary: {
        configuredBiomeCount: 4,
        eligibleForExecutionPlan: true,
        evaluatedBiomeCount: 4,
        validatedBiomeCount: 4,
      },
    });
    expect(screen.getByRole('heading', { name: 'Hub traversal' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: / open$/ })).toHaveLength(26);
    expect(document.querySelectorAll('.hub-open-room-card')).toHaveLength(9);
    expect(document.body.textContent).not.toContain('N_Combat');

    for (const [label, structure] of [
      ['Thessaly', 'Thessaly route structure'],
      ['Olympus', 'Olympus route structure'],
      ['Summit', 'Summit route structure'],
    ] as const) {
      await view.user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('region', { name: structure }).className).toContain(
        'biome-structure-region',
      );
      expect(document.querySelector('.biome-workspace')).not.toBeNull();
    }

    expect(simulateProject(application.catalog, authored)).toEqual(
      application.store.getState().projectWorkspace.assembly.evaluation,
    );
    recovery.flush();
    expect(recovery.readStoredJson()).toBe(encodeProjectDocument(authored));

    await view.user.click(screen.getByRole('button', { name: 'Save Profile' }));
    await screen.findByText('Saved the profile.');
    expect(persistence.readStoredJson()).toBe(encodeProjectDocument(authored));
    expect(selectProfileStatus(application.store.getState())).toBe('Clean');

    await view.user.click(screen.getByRole('button', { name: 'New' }));
    expect(application.store.getState().projectWorkspace.assembly.evaluation.status).toBe('empty');
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

  it('carries a purchased P Shop Hammer through route history and the application projection', async () => {
    const application = createApplication();
    const authored = createRepresentativeNOPQShopTraitProject();
    application.store.dispatch(authoredProjectReplaced(authored));
    expect(application.store.getState().projectWorkspace.assembly.evaluation).toMatchObject({
      status: 'valid',
      summary: { configuredBiomeCount: 4, eligibleForExecutionPlan: true },
    });

    const shopOffer = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon');
    const traitOwner = createTraitOfferAddress(shopOffer, 'weaponUpgrade');
    const surface = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.routes.find((route) => route.routeKey === 'Surface');
    const pEvaluation = surface?.biomes.find((biome) => biome.biomeKey === 'P');
    if (pEvaluation === undefined || !('rewards' in pEvaluation)) {
      throw new Error('complete Surface Shop fixture did not evaluate P rewards');
    }
    const branch = pEvaluation.rewards.branches[0];
    if (branch === undefined) throw new Error('complete Surface Shop fixture has no P branch');
    const event = branch.traitHistory?.events.find(
      (candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(shopOffer),
    );
    expect(event).toMatchObject({ owner: shopOffer, acquisitionPoint: 'purchase' });
    const selected =
      event === undefined
        ? undefined
        : event.options[
            event.selectedOptionKey === 'option1'
              ? 0
              : event.selectedOptionKey === 'option2'
                ? 1
                : 2
          ];
    expect(
      selected === undefined ? undefined : branch.traitHistory?.equippedTraits[selected.traitKey],
    ).toBeDefined();

    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = workspace.interactions.traitOffers.get(semanticAddressKey(traitOwner));
    expect(interaction).toMatchObject({
      owner: traitOwner,
      acquisitionRoleLabel: 'Weapon Upgrade',
    });

    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    await waitFor(() =>
      expect(
        document.getElementById(`trait-launcher-${semanticAddressKey(traitOwner)}`),
      ).not.toBeNull(),
    );
    await view.user.click(
      document.getElementById(`trait-launcher-${semanticAddressKey(traitOwner)}`)!,
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('option1 rarity')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Close trait offer' })).toBeTruthy();
    application.dispose();
  });

  it('records an N Hub order move as one undoable semantic command and autosaves both states', async () => {
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

    const moveFinalVisit = screen.getByRole('button', { name: 'Move Combat 09 earlier' });
    const historyBefore = application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(moveFinalVisit);

    const edited = currentProject(application);
    const nTopology = edited.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    const hub = nTopology?.decisions.find((decision) => decision.kind === 'hub');
    if (hub === undefined || hub.kind !== 'hub') throw new Error('edited Hub is missing');
    expect(hub.visitOrder).toEqual([
      'combat05',
      'miniBoss01',
      'combat02',
      'combat11',
      'combat09',
      'combat23',
    ]);
    expect(
      nTopology?.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(true);
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

    const card = screen.getByRole('article', { name: 'Combat 03 Hub room' });
    const checkbox = within(card).getByRole('checkbox', {
      name: 'Combat 03 open',
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(within(card).queryByText(/Closing this slot removes/)).toBeNull();

    const historyBeforeClose = application.store.getState().projectWorkspace.history.past.length;
    dispatch.mockClear();
    act(() => checkbox.focus());
    await view.user.keyboard('[Space]');

    await waitFor(() =>
      expect(
        (screen.getByRole('checkbox', { name: 'Combat 03 open' }) as HTMLInputElement).checked,
      ).toBe(false),
    );
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
    expect(application.store.getState().projectWorkspace.assembly.evaluation.findings).toEqual(
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

    const card = screen.getByRole('article', { name: 'Combat 04 Hub room' });
    const checkbox = within(card).getByRole('checkbox', {
      name: 'Combat 04 open',
    }) as HTMLInputElement;
    await view.user.pointer({ keys: '[MouseLeft]', target: checkbox });
    await waitFor(() =>
      expect(
        (screen.getByRole('checkbox', { name: 'Combat 04 open' }) as HTMLInputElement).checked,
      ).toBe(true),
    );
    expect(
      within(screen.getByRole('article', { name: 'Combat 04 Hub room' })).queryByText(
        /Closing this slot removes/,
      ),
    ).toBeNull();
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
    act(() =>
      (screen.getByRole('checkbox', { name: 'Combat 04 open' }) as HTMLInputElement).focus(),
    );
    await view.user.keyboard('[Space]');

    await waitFor(() =>
      expect(
        (screen.getByRole('checkbox', { name: 'Combat 04 open' }) as HTMLInputElement).checked,
      ).toBe(false),
    );
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
      .projectWorkspace.assembly.evaluation.routes.find((route) => route.routeKey === 'Surface');
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
    expect(application.store.getState().editorSession.activePanelByRoute.Surface).toEqual({
      kind: 'biome',
      biomeKey: 'P',
    });
    expect(application.store.getState().projectWorkspace.history).toBe(historyBefore);
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
    expect(within(inspector).getByRole('article', { name: 'Combat 02 room offer' })).toBeTruthy();
  });

  it('completes an Olympian replacement through the shared trait editor', async () => {
    const application = createApplication();
    let authored = createRepresentativeNOPQProject();
    const beforeEvaluation = simulateProject(application.catalog, authored);
    let target:
      | {
          readonly address: TraitOfferOwnerAddress;
          readonly trace: ReachedTraitOfferEvaluation;
          readonly candidate: ReturnType<typeof traitCandidates>[number];
        }
      | undefined;
    for (const route of beforeEvaluation.routes) {
      for (const biome of route.biomes) {
        if (!('rewards' in biome)) continue;
        for (const branch of biome.rewards.branches) {
          for (const trace of branch.traitEvaluations ?? []) {
            const replacement = traitCandidates(
              application.catalog,
              trace.offer.giverKey,
              trace.before,
              trace.context,
            ).find(
              (candidate) =>
                candidate.available && candidate.assessment.replacementTransition !== undefined,
            );
            if (replacement === undefined) continue;
            target = {
              address: trace.address as TraitOfferOwnerAddress,
              trace,
              candidate: replacement,
            };
            break;
          }
          if (target !== undefined) break;
        }
        if (target !== undefined) break;
      }
      if (target !== undefined) break;
    }
    if (target === undefined) throw new Error('No reached Olympian replacement candidate found');
    const replacement = target.candidate;
    const transition = replacement.assessment.replacementTransition;
    if (transition === undefined || replacement.rarity === undefined) {
      throw new Error('Replacement candidate is missing its derived transition');
    }
    const options = [...target.trace.offer.options] as Array<
      (typeof target.trace.offer.options)[number]
    >;
    options[0] = Object.freeze({ traitKey: replacement.traitKey, rarity: replacement.rarity });
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(target.address, target.trace.acquisitionRole),
      value: Object.freeze({
        giverKey: target.trace.offer.giverKey,
        options: Object.freeze(options) as typeof target.trace.offer.options,
        selectedOptionKey: 'option1',
      }),
    });
    application.store.dispatch(authoredProjectReplaced(authored));

    const evaluation = application.store.getState().projectWorkspace.assembly.evaluation;
    const route = evaluation.routes.find((candidate) => candidate.routeKey === 'Surface');
    const branches =
      route?.biomes.flatMap((biome) => ('rewards' in biome ? biome.rewards.branches : [])) ?? [];
    const event = branches
      .flatMap((branch) => branch.traitHistory?.events ?? [])
      .find(
        (candidate) =>
          semanticAddressKey(candidate.owner) === semanticAddressKey(target.address) &&
          candidate.acquisitionRole === target.trace.acquisitionRole,
      );
    expect(event?.replacementTransition).toEqual(transition);
    const history = branches[0]?.traitHistory;
    expect(history?.equippedTraits[transition.replacedTraitKey]).toBeUndefined();
    expect(history?.equippedTraits[transition.newTraitKey]).toMatchObject({
      rarity: transition.requiredRarity,
    });

    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const replacedTraitLabel = application.catalog.traits.byKey[transition.replacedTraitKey]?.label;
    if (replacedTraitLabel === undefined) throw new Error('replacement trait label is missing');
    expect(screen.getByText(new RegExp(`Replaces ${replacedTraitLabel}`))).toBeTruthy();
    const launcher = document.getElementById(
      `trait-launcher-${semanticAddressKey(createTraitOfferAddress(target.address, target.trace.acquisitionRole))}`,
    );
    if (launcher === null) {
      throw new Error('replacement trait launcher is missing');
    }
    await view.user.click(launcher);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(new RegExp(`Replaces ${replacedTraitLabel}`))).toBeTruthy();
    application.dispose();
  });

  it('repairs a stale Common offer after a natural Proper Upbringing activation', async () => {
    const application = createApplication();
    const original = createGoldenFGHIProject();
    let authored = original;
    let prepared: ReturnType<typeof simulateProject>;
    const locateTrace = (
      evaluation: ReturnType<typeof simulateProject>,
      address: ReachedTraitOfferEvaluation['address'],
      role: string,
    ) =>
      evaluation.routes
        .flatMap((route) => route.biomes)
        .flatMap((biome) => ('rewards' in biome ? biome.rewards.branches : []))
        .flatMap((branch) => branch.traitEvaluations ?? [])
        .find(
          (trace) =>
            semanticAddressKey(trace.address) === semanticAddressKey(address) &&
            trace.acquisitionRole === role,
        );
    const rewriteWithGiver = (
      trace: ReachedTraitOfferEvaluation,
      giverKey: string,
      preferredTraitKey: string,
    ) => {
      const context = { ...trace.context, resolvedProviderKey: giverKey };
      const candidates = traitCandidates(
        application.catalog,
        giverKey,
        trace.before,
        context,
      ).filter(
        (candidate) =>
          candidate.available &&
          (candidate.rarity === undefined ||
            candidate.rarity === 'Common' ||
            candidate.rarity === 'Rare' ||
            candidate.rarity === 'Epic' ||
            candidate.rarity === 'Legendary'),
      );
      const uniqueCandidates = candidates.filter(
        (candidate, index, all) =>
          all.findIndex((other) => other.traitKey === candidate.traitKey) === index,
      );
      const preferred = uniqueCandidates.find(
        (candidate) => candidate.traitKey === preferredTraitKey,
      );
      if (preferred === undefined) throw new Error(`Missing ${preferredTraitKey} candidate`);
      const options = [
        preferred,
        ...uniqueCandidates.filter((candidate) => candidate.traitKey !== preferredTraitKey),
      ].slice(0, 3);
      if (options.length !== 3) throw new Error(`Insufficient ${giverKey} candidates`);
      return applyProjectCommand(authored, application.catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(
          trace.address as TraitOfferOwnerAddress,
          trace.acquisitionRole,
        ),
        value: {
          giverKey,
          options: options.map((candidate) => ({
            traitKey: candidate.traitKey,
            ...(candidate.rarity === undefined ? {} : { rarity: candidate.rarity }),
          })) as [
            { readonly traitKey: string; readonly rarity?: TraitRarity },
            { readonly traitKey: string; readonly rarity?: TraitRarity },
            { readonly traitKey: string; readonly rarity?: TraitRarity },
          ],
          selectedOptionKey: 'option1',
        },
      });
    };
    const heraOfferPlan = [
      {
        address: createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(2, 1)),
        role: 'source',
        traitKey: 'HeraCastBoon',
      },
      {
        address: createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(6, 1)),
        role: 'source',
        traitKey: 'OmegaHeraProjectileBoon',
      },
      {
        address: createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(1, 1)),
        role: 'source',
        traitKey: 'DamageSharePotencyBoon',
      },
      {
        address: createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(6, 1)),
        role: 'source',
        traitKey: 'HeraSprintBoon',
      },
      {
        address: createIncomingRewardAddress(goldenGBiome, goldenGOccurrenceId(7, 1)),
        role: 'source',
        traitKey: 'AllElementalBoon',
      },
    ] as const;
    for (const plan of heraOfferPlan) {
      authored = applyProjectCommand(authored, application.catalog, {
        kind: 'ReplaceIncomingReward',
        reward: plan.address,
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
      });
      prepared = simulateProject(application.catalog, authored);
      const trace = locateTrace(prepared, plan.address, plan.role);
      if (trace === undefined)
        throw new Error(`Hera preparation offer was not reached: ${plan.role}`);
      authored = rewriteWithGiver(trace, 'Hera', plan.traitKey);
    }
    const properReward = createIncomingRewardAddress(
      goldenHBiome,
      createOccurrenceId('golden-h-miniboss01'),
    );
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward: properReward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    prepared = simulateProject(application.catalog, authored);
    const activationTrace = prepared.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => ('rewards' in biome ? biome.rewards.branches : []))
      .flatMap((branch) => branch.traitEvaluations ?? [])
      .find(
        (trace) =>
          trace.offer.giverKey === 'Hera' &&
          (['Earth', 'Air', 'Fire', 'Water'] as const).every(
            (element) => (trace.before.elementCounts[element] ?? 0) >= 2,
          ),
      );
    if (activationTrace === undefined) throw new Error('No prepared activation frontier found');
    const activationCandidates = traitCandidates(
      application.catalog,
      'Hera',
      activationTrace.before,
      { ...activationTrace.context, resolvedProviderKey: 'Hera' },
    ).filter(
      (candidate) =>
        candidate.available &&
        (candidate.rarity === undefined ||
          candidate.rarity === 'Common' ||
          candidate.rarity === 'Rare' ||
          candidate.rarity === 'Epic'),
    );
    const proper = activationCandidates.find(
      (candidate) => candidate.traitKey === 'ElementalRarityUpgradeBoon',
    );
    if (proper === undefined) throw new Error('Proper Upbringing is not naturally offerable');
    const uniqueActivationCandidates = activationCandidates.filter(
      (candidate, index, all) =>
        all.findIndex((other) => other.traitKey === candidate.traitKey) === index,
    );
    const activationAlternatives = uniqueActivationCandidates.filter(
      (candidate) => candidate.traitKey !== proper.traitKey,
    );
    const activationOptions = [proper, activationAlternatives[0], activationAlternatives[1]];
    if (activationOptions[1] === undefined || activationOptions[2] === undefined)
      throw new Error('Proper Upbringing alternatives are missing');
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        activationTrace.address as TraitOfferOwnerAddress,
        activationTrace.acquisitionRole,
      ),
      value: {
        giverKey: 'Hera',
        options: activationOptions.map((candidate) => ({
          traitKey: candidate!.traitKey,
          ...(candidate!.rarity === undefined
            ? { rarity: 'Common' as const }
            : { rarity: candidate!.rarity }),
        })) as [
          { readonly traitKey: string; readonly rarity: 'Common' | 'Rare' | 'Epic' },
          { readonly traitKey: string; readonly rarity: 'Common' | 'Rare' | 'Epic' },
          { readonly traitKey: string; readonly rarity: 'Common' | 'Rare' | 'Epic' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const activated = simulateProject(application.catalog, authored);
    let stale:
      | {
          readonly address: TraitOfferOwnerAddress;
          readonly trace: ReachedTraitOfferEvaluation;
          readonly options: readonly [
            { readonly traitKey: string; readonly rarity: 'Common' },
            { readonly traitKey: string; readonly rarity: 'Rare' | 'Epic' },
            { readonly traitKey: string; readonly rarity: 'Rare' | 'Epic' },
          ];
        }
      | undefined;
    for (const route of activated.routes) {
      for (const biome of route.biomes) {
        if (!('rewards' in biome)) continue;
        for (const branch of biome.rewards.branches) {
          for (const trace of branch.traitEvaluations ?? []) {
            if (
              trace.before.minimumScalableGodTraitRarity !== 'Rare' ||
              semanticAddressKey(trace.address) === semanticAddressKey(activationTrace.address)
            )
              continue;
            const candidates = traitCandidates(
              application.catalog,
              trace.offer.giverKey,
              trace.before,
              trace.context,
            );
            const common = candidates.find(
              (candidate) =>
                candidate.available === false &&
                candidate.rarity === 'Common' &&
                candidate.assessment.findings.length > 0 &&
                candidate.assessment.findings.every(
                  (finding) => finding.code === 'rarityBelowActiveFloor',
                ),
            );
            const higher = candidates
              .filter(
                (candidate) =>
                  candidate.available &&
                  (candidate.rarity === 'Rare' || candidate.rarity === 'Epic') &&
                  candidate.traitKey !== common?.traitKey,
              )
              .filter(
                (candidate, index, all) =>
                  all.findIndex((other) => other.traitKey === candidate.traitKey) === index,
              );
            const first = higher[0];
            const second = higher[1];
            const firstRarity = first?.rarity;
            const secondRarity = second?.rarity;
            if (
              common === undefined ||
              first === undefined ||
              second === undefined ||
              (firstRarity !== 'Rare' && firstRarity !== 'Epic') ||
              (secondRarity !== 'Rare' && secondRarity !== 'Epic')
            )
              continue;
            const repairedAddress = createTraitOfferAddress(
              trace.address as TraitOfferOwnerAddress,
              trace.acquisitionRole,
            );
            const staleOptions = [
              { traitKey: common.traitKey, rarity: 'Common' as const },
              { traitKey: first.traitKey, rarity: firstRarity },
              { traitKey: second.traitKey, rarity: secondRarity },
            ] as const;
            const repairedOptions = [
              { traitKey: common.traitKey, rarity: 'Rare' as const },
              { traitKey: first.traitKey, rarity: firstRarity },
              { traitKey: second.traitKey, rarity: secondRarity },
            ] as const;
            const repairedProject = applyProjectCommand(authored, application.catalog, {
              kind: 'ReplaceTraitOffer',
              trait: repairedAddress,
              value: {
                giverKey: trace.offer.giverKey,
                options: repairedOptions,
                selectedOptionKey: 'option1',
              },
            });
            if (
              simulateProject(application.catalog, repairedProject).findings.some(
                (finding) =>
                  finding.code === 'rarityBelowActiveFloor' &&
                  semanticAddressKey(finding.origin) === semanticAddressKey(repairedAddress),
              )
            )
              continue;
            stale = {
              address: trace.address as TraitOfferOwnerAddress,
              trace,
              options: staleOptions,
            };
            break;
          }
          if (stale !== undefined) break;
        }
        if (stale !== undefined) break;
      }
      if (stale !== undefined) break;
    }
    if (stale === undefined) throw new Error('No downstream stale Common offer found');
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(stale.address, stale.trace.acquisitionRole),
      value: {
        giverKey: stale.trace.offer.giverKey,
        options: stale.options,
        selectedOptionKey: 'option1',
      },
    });
    application.store.dispatch(authoredProjectReplaced(authored));
    const staleFinding = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (finding) =>
          finding.code === 'rarityBelowActiveFloor' &&
          semanticAddressKey(finding.origin) ===
            semanticAddressKey(
              createTraitOfferAddress(stale!.address, stale!.trace.acquisitionRole),
            ),
      );
    expect(staleFinding).toBeDefined();

    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const launcher = document.getElementById(
      `trait-launcher-${semanticAddressKey(createTraitOfferAddress(stale.address, stale.trace.acquisitionRole))}`,
    );
    if (launcher === null) throw new Error('stale Common trait launcher is missing');
    await view.user.click(launcher);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(
        within(dialog).getAllByText(/Rarity is below the active floor/).length,
      ).toBeGreaterThan(0),
    );
    const rarity = within(dialog).getByLabelText('option1 rarity');
    await view.user.selectOptions(rarity, 'Rare');
    await view.user.click(within(dialog).getByRole('button', { name: 'Save trait offer' }));
    await waitFor(() =>
      expect(
        application.store
          .getState()
          .projectWorkspace.assembly.evaluation.findings.some(
            (finding) =>
              finding.code === 'rarityBelowActiveFloor' &&
              semanticAddressKey(finding.origin) ===
                semanticAddressKey(
                  createTraitOfferAddress(stale!.address, stale!.trace.acquisitionRole),
                ),
          ),
      ).toBe(false),
    );
    const repairedEvaluation = application.store.getState().projectWorkspace.assembly.evaluation;
    const repairedEvent = repairedEvaluation.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => ('rewards' in biome ? biome.rewards.branches : []))
      .flatMap((branch) => branch.traitHistory?.events ?? [])
      .find(
        (event) =>
          semanticAddressKey(event.owner) === semanticAddressKey(stale!.address) &&
          event.acquisitionRole === stale!.trace.acquisitionRole,
      );
    const selectedIndex = repairedEvent?.selectedOptionKey === 'option1' ? 0 : 1;
    expect(repairedEvent?.options[selectedIndex]?.rarity).toBe('Rare');
    application.dispose();
  });

  it('retains and repairs a reached Hammer after a route loadout change', async () => {
    const application = createApplication();
    let authored = createRepresentativeNOPQProject();
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat07', 4, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceRouteLoadout',
      route: { kind: 'route', routeKey: 'Surface' },
      weaponKey: 'WeaponDagger',
      aspectKey: 'DaggerBackstabAspect',
    });
    application.store.dispatch(authoredProjectReplaced(authored));
    const invalid = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (finding) => finding.origin.kind === 'traitOffer',
      );
    if (invalid === undefined) throw new Error('reached Hammer finding is missing');

    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    const findingButton = within(findings)
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Hammer is incompatible'));
    if (findingButton === undefined) throw new Error('Hammer finding is not presented');
    await view.user.click(findingButton);

    const dialog = await screen.findByRole('dialog');
    expect(document.getElementById(semanticOwnerElementId(invalid.origin))).toBeTruthy();
    expect(
      within(dialog).getAllByText(/Hammer is incompatible with this loadout/),
    ).not.toHaveLength(0);

    const interaction = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.traitOffers.get(semanticAddressKey(invalid.origin));
    if (interaction === undefined) throw new Error('invalid Hammer interaction is missing');
    const corrected = interaction.giver.defaultsByLoadout?.['WeaponDagger:DaggerBackstabAspect'];
    if (corrected === undefined) throw new Error('Dagger Hammer defaults are missing');
    for (const [index, option] of corrected.options.entries()) {
      await view.user.selectOptions(
        within(dialog).getByLabelText(`option${index + 1} trait`),
        option.traitKey,
      );
    }
    const save = within(dialog).getByRole('button', { name: 'Save trait offer' });
    await waitFor(() => expect(save).toHaveProperty('disabled', false));
    await view.user.click(save);
    expect(
      application.store
        .getState()
        .projectWorkspace.assembly.evaluation.findings.some(
          (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(invalid.origin),
        ),
    ).toBe(false);
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
    const structure = screen.getByRole('region', { name: 'Thessaly route structure' });
    const decisionOwner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.intro,
    });
    const decisionRail = Array.from(
      structure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.dataset.workspaceNode === semanticAddressKey(decisionOwner));
    if (decisionRail === undefined) throw new Error('Thessaly Decision 1 rail node is missing');
    const historyBefore = application.store.getState().projectWorkspace.history;
    const evaluationBefore = application.store.getState().projectWorkspace.assembly.evaluation;
    work.length = 0;

    await view.user.click(decisionRail);

    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(decisionOwner);
    expect(application.store.getState().projectWorkspace.history).toBe(historyBefore);
    expect(application.store.getState().projectWorkspace.assembly.evaluation).toBe(
      evaluationBefore,
    );
    expect(recovery.hasPendingAutosave()).toBe(false);
    expect(work.filter((event) => event.kind === 'projectEvaluation')).toEqual([]);
    expect(work.filter((event) => event.kind === 'queryBatch')).toEqual([]);
    expect(screen.getByRole('heading', { level: 2, name: 'Decision 1' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Combat 04 room offer' })).toBeTruthy();
  });
});
