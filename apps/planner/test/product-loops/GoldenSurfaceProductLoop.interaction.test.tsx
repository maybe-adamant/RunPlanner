// @vitest-environment jsdom

import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createHubFountainAddress,
  createHubSlotAddress,
  createOccurrenceAddress,
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  encodeProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
  type TraitOfferOwnerAddress,
  hubVisitSlotKeys,
} from '@run-planner/engine/authored-project';
import { simulateProject, type SelectedTraitOfferAssessment } from '@run-planner/engine/simulation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
  type PlannerApplication,
} from '@planner/composition/createApplication';
import { prepareTraitOptionDomain } from '@planner/projections/rewards/traitDomainProjection';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  authorLegalTraitOffers,
  hubVisitActions,
  reachedTraitOffers,
  traitCandidateOptions,
  type TraitCandidateProbe,
} from '@run-planner/test-fixtures/shared';
import {
  loadSurfaceNProject,
  loadSurfaceNOPQProject,
  createRepresentativeNOPQShopTraitProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  nVisitSlotKeys,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';
import {
  createManualSaveScheduler,
  createMemoryProjectLibrary,
} from '@planner-test/support/memoryProjectLibrary';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { loadSurfaceNNaturalSelectionFrontierCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** An application saving to an in-memory library whose debounced writes the test runs. */
function createSavingApplication(options: Parameters<typeof createApplication>[0] = {}) {
  const library = createMemoryProjectLibrary();
  const saves = createManualSaveScheduler();
  const application = createApplication({
    ...options,
    projectLibrary: library.adapter,
    saveScheduler: saves.scheduler,
  });
  return {
    application,
    library,
    saves,
    async open(project: ProjectDocument) {
      const result = await application.projectOperations.openPlan(await library.file(project));
      if (result.status !== 'success') throw new Error(result.message);
    },
    /** Writes the pending edit and returns the stored document. */
    async write(): Promise<string> {
      saves.run();
      await application.projectOperations.flush();
      return library.writes.at(-1)!.json;
    },
  };
}

function currentProject(application: PlannerApplication) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('expected an open project');
  return workspace.history.present;
}

function currentEvaluation(application: PlannerApplication) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('expected an open project');
  return workspace.assembly.evaluation;
}

function currentHistory(application: PlannerApplication) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('expected an open project');
  return workspace.history;
}

function nHub(project: ReturnType<typeof currentProject>) {
  const hub = project.route.biomes
    .find((biome) => biome.biomeKey === 'N')
    ?.topology?.decisions.find((decision) => decision.kind === 'hub');
  if (hub?.kind !== 'hub') throw new Error('N Hub is missing');
  return hub;
}

function hubRailButton(): HTMLElement {
  return screen.getByRole('button', { name: /Hub.*visits/ });
}

describe('surface product loop', () => {
  it('renders every Surface biome through the shared workspace and persists the complete route', async () => {
    const saving = createSavingApplication();
    const { application, library } = saving;
    const authored = loadSurfaceNOPQProject();
    await saving.open(authored);
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(hubRailButton());

    expect(currentEvaluation(application)).toMatchObject({
      findings: [],
      status: 'valid',
      summary: {
        configuredBiomeCount: 4,
        eligibleForExecutionPlan: true,
        evaluatedBiomeCount: 4,
        validatedBiomeCount: 4,
      },
    });
    expect(screen.getByRole('tab', { name: 'Hub Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('region', { name: 'Ephyra Hub map' })).toBeTruthy();
    await view.user.click(screen.getByRole('button', { name: 'Details →' }));
    expect(screen.getByRole('group', { name: 'Hub room set' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: / open$/ })).toHaveLength(26);
    expect(
      document.querySelectorAll('[data-hub-card-presentation="overview"][data-open="true"]'),
    ).toHaveLength(9);
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

    expect(simulateProject(application.catalog, authored)).toEqual(currentEvaluation(application));
    // Viewing every biome is no edit, so nothing is written.
    expect(saving.saves.hasPending()).toBe(false);
    expect(await library.plans(application.catalog)).toEqual([authored]);

    // Home creates and imports plans; the open plan stays open until another opens.
    await view.user.click(screen.getByRole('button', { name: 'Home' }));
    await view.user.click(screen.getByRole('button', { name: 'New plan' }));
    expect(currentEvaluation(application).status).toBe('valid');
    await view.user.click(await screen.findByRole('button', { name: 'Create Surface plan' }));
    await waitFor(() => expect(currentEvaluation(application).status).toBe('incomplete'));
    expect((await library.plans(application.catalog)).map((plan) => plan.route.routeKey)).toEqual([
      'Surface',
      'Surface',
    ]);
    const held = new Set((await library.plans(application.catalog)).map((plan) => plan.projectId));
    library.choose({ fileName: 'surface.runplanner.json', json: encodeProjectDocument(authored) });
    await view.user.click(screen.getByRole('button', { name: 'Home' }));
    await view.user.click(screen.getByRole('button', { name: 'Import…' }));
    expect((await screen.findByRole('status')).textContent).toBe(`Imported “${authored.name}”`);
    // Importing opens nothing; the library already held the file's identity, so the copy took a
    // new one.
    const stored = await library.plans(application.catalog);
    const imported = stored.find((plan) => !held.has(plan.projectId))!;
    expect(imported).toEqual({ ...authored, projectId: imported.projectId });

    application.dispose();
    view.unmount();
    // A later start shows the library, which holds all three plans.
    const reopened = createApplication({ projectLibrary: library.adapter });
    await reopened.startupReady;
    renderPlannerForInteraction({ application: reopened });
    expect(reopened.store.getState().projectWorkspace.kind).toBe('noProject');
    const { items } = await reopened.projectOperations.listLibrary();
    expect(items.map((item) => item.kind === 'ready' && item.projectId)).toContain(
      imported.projectId,
    );
  });

  it('carries a purchased P Shop Hammer through route history and the application projection', async () => {
    const application = createApplication();
    const authored = createRepresentativeNOPQShopTraitProject();
    application.store.dispatch(authoredProjectReplaced(authored));
    expect(currentEvaluation(application)).toMatchObject({
      status: 'valid',
      summary: { configuredBiomeCount: 4, eligibleForExecutionPlan: true },
    });

    const shopOffer = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon');
    const traitOwner = createTraitOfferAddress(shopOffer, 'weaponUpgrade');
    const surface = currentEvaluation(application).route;
    const pEvaluation = surface?.biomes.find((biome) => biome.biomeKey === 'P');
    if (pEvaluation === undefined || !('rewards' in pEvaluation)) {
      throw new Error('complete Surface Shop fixture did not evaluate P rewards');
    }
    const branch = pEvaluation.rewards.branches[0];
    if (branch === undefined) throw new Error('complete Surface Shop fixture has no P branch');
    const event = branch.state.traitHistory?.events.find(
      (candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(shopOffer),
    );
    expect(event).toMatchObject({
      kind: 'traitOffer',
      owner: shopOffer,
      acquisitionPoint: 'purchase',
    });
    const selected =
      event?.kind !== 'traitOffer'
        ? undefined
        : event.options[
            event.selectedOptionKey === 'option1'
              ? 0
              : event.selectedOptionKey === 'option2'
                ? 1
                : 2
          ];
    expect(
      selected === undefined
        ? undefined
        : branch.state.traitHistory?.equippedTraits[selected.traitKey],
    ).toBeDefined();

    const workspace = application.selectStructuredWorkspace(application.store.getState());
    if (workspace === undefined) throw new Error('workspace projection is unavailable');
    const interaction = workspace.interactions.traitOffers.get(semanticAddressKey(traitOwner));
    expect(interaction).toMatchObject({
      owner: traitOwner,
      acquisitionRoleLabel: 'Weapon Upgrade',
    });

    const view = renderPlannerForInteraction({ application });
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
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    application.dispose();
  });

  it('records an N Hub Reset visits edit as one undoable semantic command and saves both states', async () => {
    const saving = createSavingApplication();
    const { application } = saving;
    const authored = loadSurfaceNProject();
    await saving.open(authored);
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(hubRailButton());
    await view.user.click(screen.getByRole('tab', { name: 'Hub Timeline' }));

    const historyBefore = currentHistory(application).past.length;

    await view.user.click(screen.getByRole('button', { name: 'Reset visits' }));

    const edited = currentProject(application);
    const nTopology = edited.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    const hub = nTopology?.decisions.find((decision) => decision.kind === 'hub');
    if (hub === undefined || hub.kind !== 'hub') throw new Error('edited Hub is missing');
    expect(hub.actions).toEqual([]);
    expect(
      nTopology?.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(true);
    expect(edited).not.toEqual(authored);
    expect(currentHistory(application).past).toHaveLength(historyBefore + 1);
    expect(saving.saves.hasPending()).toBe(true);
    expect(await saving.write()).toBe(encodeProjectDocument(edited));

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(currentProject(application)).toEqual(authored);
    expect(currentHistory(application).past).toHaveLength(historyBefore);
    expect(saving.saves.hasPending()).toBe(true);
    expect(await saving.write()).toBe(encodeProjectDocument(authored));

    await view.user.click(screen.getByRole('button', { name: 'Redo' }));

    expect(currentProject(application)).toEqual(edited);
    expect(currentHistory(application).past).toHaveLength(historyBefore + 1);
    expect(saving.saves.hasPending()).toBe(true);
    expect(await saving.write()).toBe(encodeProjectDocument(edited));
  });

  it('closes a ninth unvisited Hub member, keeping its Preboss chain, as one undoable saved command', async () => {
    const saving = createSavingApplication();
    const { application } = saving;
    const authored = loadSurfaceNProject();
    await saving.open(authored);
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    await view.user.click(hubRailButton());

    await view.user.click(screen.getByRole('button', { name: 'Details →' }));
    const card = screen.getByRole('article', { name: 'Combat 03 Hub room' });
    const checkbox = within(card).getByRole('checkbox', {
      name: 'Combat 03 open',
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(within(card).queryByText(/Closing this slot removes/)).toBeNull();

    const historyBeforeClose = currentHistory(application).past.length;
    dispatch.mockClear();
    act(() => checkbox.focus());
    await view.user.keyboard('[Space]');

    await waitFor(() =>
      expect(
        (screen.getByRole('checkbox', { name: 'Combat 03 open' }) as HTMLInputElement).checked,
      ).toBe(false),
    );
    const topology = currentProject(application).route?.biomes.find(
      (biome) => biome.biomeKey === 'N',
    )?.topology;
    const hub = topology?.decisions.find((decision) => decision.kind === 'hub');
    if (topology === null || topology === undefined || hub?.kind !== 'hub') {
      throw new Error('N Hub topology is missing after closing Combat 03');
    }
    expect(hub.openTargets).toHaveLength(8);
    expect(hubVisitSlotKeys(hub)).toHaveLength(6);
    expect(
      topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(true);
    expect(
      topology.occurrences.some(
        (occurrence) => occurrence.occurrenceId === nOccurrenceId('combat03'),
      ),
    ).toBe(false);
    expect(
      topology.occurrences.find((occurrence) => occurrence.occurrenceId === nOccurrenceIds.preboss),
    ).toEqual(
      authored.route.biomes
        .find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === nOccurrenceIds.preboss,
        ),
    );
    expect(currentEvaluation(application).findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'hubOpenSetIncomplete' })]),
    );
    expect(currentHistory(application).past).toHaveLength(historyBeforeClose + 1);
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
    expect(saving.saves.hasPending()).toBe(true);
    expect(await saving.write()).toBe(encodeProjectDocument(currentProject(application)));

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(currentProject(application)).toEqual(authored));
    expect(saving.saves.hasPending()).toBe(true);
    expect(await saving.write()).toBe(encodeProjectDocument(authored));
  });

  it('routes the selected issue to the owning decision inspector', async () => {
    const application = createApplication();
    const target = createTargetAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceIds.intro },
      'exit1',
    );
    const invalidProject = applyProjectCommand(
      authorLegalTraitOffers(loadSurfaceNOPQProject()),
      application.catalog,
      {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
        gameName: 'P_Combat02',
      },
    );
    application.store.dispatch(authoredProjectReplaced(invalidProject));
    const view = renderPlannerForInteraction({ application });
    const issue = currentEvaluation(application).issue;
    if (issue === undefined || semanticAddressKey(issue.owner) !== semanticAddressKey(target)) {
      throw new Error('Olympus target must be the selected assessment issue');
    }
    const historyBefore = currentHistory(application);
    const repair = screen.getByRole('heading', { name: 'Next repair' }).closest('section');
    if (repair === null) throw new Error('selected repair banner is missing');
    await view.user.click(within(repair).getByRole('button'));

    expect(application.store.getState().editorSession.selectedFinding).toMatchObject({
      key: issue.regionKey,
      origin: issue.owner,
    });
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(target);
    expect(application.store.getState().editorSession.activeSection).toBe('route');
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: 'P',
    });
    expect(currentHistory(application)).toBe(historyBefore);
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(inspector.querySelector('.biome-batch-workbench')).not.toBeNull();
    expect(within(inspector).getByRole('article', { name: 'Combat 02 room offer' })).toBeTruthy();
  });

  it('repairs a Hub Phial target on the Hub timeline fountain row and returns to the Hub map', async () => {
    const application = createApplication();
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const outcome = createFountainRarityOutcomeAddress(createHubFountainAddress(nBiome, 'hub'));
    const withPhial = applyProjectCommand(loadSurfaceNProject(), application.catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'FountainRarityKeepsake',
    });
    application.store.dispatch(
      authoredProjectReplaced(
        applyProjectCommand(withPhial, application.catalog, {
          kind: 'ReplaceHubActionOrder',
          hub,
          actions: hubVisitActions(nVisitSlotKeys, 3),
        }),
      ),
    );
    expect(currentEvaluation(application).issue?.owner).toEqual(outcome);
    const view = renderPlannerForInteraction({ application });
    const repair = screen.getByRole('heading', { name: 'Next repair' }).closest('section');
    if (repair === null) throw new Error('selected repair banner is missing');
    await view.user.click(within(repair).getByRole('button'));

    // The repair opens the fountain row's Phial target in the Hub timeline.
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    expect(within(inspector).getByRole('region', { name: 'Ephyra Hub timeline' })).toBeTruthy();
    await view.user.click(
      await screen.findByText(application.catalog.traits.byKey['HermesWeaponBoon']!.label),
    );
    await waitFor(() => expect(currentEvaluation(application).findings).toEqual([]));

    const historyBefore = currentHistory(application).past.length;
    await view.user.click(screen.getByRole('button', { name: 'Back to Map' }));
    act(() =>
      application.store.dispatch(semanticOwnerFocused(createHubFountainAddress(nBiome, 'hub'))),
    );
    expect(await screen.findByRole('region', { name: 'Ephyra Hub timeline map' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Fountain order' })).toBeNull();
    expect(nHub(currentProject(application)).actions).toEqual(hubVisitActions(nVisitSlotKeys, 3));
    expect(nHub(currentProject(application)).fountainRarityResult).toEqual({
      targetTraitKey: 'HermesWeaponBoon',
    });
    expect(currentHistory(application).past).toHaveLength(historyBefore);
  });

  it('routes the selected nested Natural Selection issue to its Timeline pickup without opening a dialog', async () => {
    const application = createApplication();
    application.store.dispatch(
      authoredProjectReplaced(loadSurfaceNNaturalSelectionFrontierCheckpoint()),
    );
    const issue = currentEvaluation(application).issue;
    if (
      issue?.owner.kind !== 'traitOffer' ||
      !issue.reasons.some((reason) => reason.code === 'naturalSelectionResultMissing')
    ) {
      throw new Error('Natural Selection result must be the selected assessment issue');
    }
    const destination = application
      .selectStructuredWorkspace(application.store.getState())!
      .focusByOwner.get(semanticAddressKey(issue.owner));
    if (destination === undefined) throw new Error('Natural Selection destination is missing');

    const view = renderPlannerForInteraction({ application });
    const repair = screen.getByRole('heading', { name: 'Next repair' }).closest('section');
    if (repair === null) throw new Error('selected repair banner is missing');
    await view.user.click(within(repair).getByRole('button'));

    expect(application.store.getState().editorSession.selectedFinding).toMatchObject({
      key: issue.regionKey,
      origin: issue.owner,
    });
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      destination.focusAddress,
    );
    expect(application.store.getState().editorSession.traitDialogTarget).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(
        document.getElementById(semanticOwnerControlElementId(destination.focusAddress)),
      ).toBeTruthy(),
    );
  });

  it('completes an Olympian replacement through the shared trait editor', async () => {
    const work: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => work.push(event),
    });
    let authored = loadSurfaceNOPQProject();
    let target:
      | {
          readonly address: TraitOfferOwnerAddress;
          readonly trace: SelectedTraitOfferAssessment;
          readonly candidate: TraitCandidateProbe;
        }
      | undefined;
    for (const trace of reachedTraitOffers(authored)) {
      const replacement = traitCandidateOptions(authored, trace.address, trace.offer.giverKey).find(
        (candidate) => candidate.assessment.replacementTransition !== undefined,
      );
      if (replacement === undefined) continue;
      target = {
        address: trace.address.owner,
        trace,
        candidate: replacement,
      };
      break;
    }
    if (target === undefined) throw new Error('No reached Olympian replacement candidate found');
    if (target.trace.offer.kind !== 'traits') throw new Error('replacement must start from traits');
    const replacement = target.candidate;
    const transition = replacement.assessment.replacementTransition;
    if (transition === undefined || replacement.option.rarity === undefined) {
      throw new Error('Replacement candidate is missing its derived transition');
    }
    const options = [...target.trace.offer.options] as Array<
      (typeof target.trace.offer.options)[number]
    >;
    options[0] = Object.freeze({
      traitKey: replacement.option.traitKey,
      rarity: replacement.option.rarity,
    });
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(target.address, target.trace.acquisitionRole),
      value: Object.freeze({
        kind: 'traits',
        giverKey: target.trace.offer.giverKey,
        options: Object.freeze(options) as typeof target.trace.offer.options,
        selectedOptionKey: 'option1',
      }),
    });
    application.store.dispatch(authoredProjectReplaced(authored));

    const evaluation = currentEvaluation(application);
    const route = evaluation.route;
    const branches =
      route?.biomes.flatMap((biome) => ('rewards' in biome ? biome.rewards.branches : [])) ?? [];
    const event = branches
      .flatMap((branch) => branch.state.traitHistory?.events ?? [])
      .find(
        (candidate) =>
          semanticAddressKey(candidate.owner) === semanticAddressKey(target.address) &&
          candidate.acquisitionRole === target.trace.acquisitionRole,
      );
    expect(event?.kind === 'traitOffer' ? event.replacementTransition : undefined).toEqual(
      transition,
    );
    const history = branches[0]?.state.traitHistory;
    expect(history?.equippedTraits[transition.replacedTraitKey]).toBeUndefined();
    expect(history?.equippedTraits[transition.newTraitKey]).toMatchObject({
      rarity: transition.requiredRarity,
    });

    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const replacedTraitLabel = application.catalog.traits.byKey[transition.replacedTraitKey]?.label;
    if (replacedTraitLabel === undefined) throw new Error('replacement trait label is missing');
    expect(screen.getByText(new RegExp(`Replaces ${replacedTraitLabel}`))).toBeTruthy();
    const traitAddress = createTraitOfferAddress(target.address, target.trace.acquisitionRole);
    const launcher = document.getElementById(`trait-launcher-${semanticAddressKey(traitAddress)}`);
    if (launcher === null) {
      throw new Error('replacement trait launcher is missing');
    }
    await view.user.click(launcher);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(new RegExp(`Replaces ${replacedTraitLabel}`))).toBeTruthy();
    const interaction = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.traitOffers.get(semanticAddressKey(traitAddress));
    if (interaction?.value?.kind !== 'traits')
      throw new Error('replacement trait interaction is missing');
    const prepared = prepareTraitOptionDomain(
      application.catalog,
      interaction.giver,
      interaction.value,
      'option1',
    );
    work.length = 0;
    await view.user.click(within(dialog).getByLabelText('option1 rarity'));
    expect(work.filter((event) => event.kind === 'queryBatch')).toEqual([
      expect.objectContaining({ queryCount: prepared.variants.length }),
    ]);
    expect(
      Array.from(document.querySelectorAll<HTMLElement>('[cmdk-item]')).map((item) =>
        item.textContent?.replace(/^✓/, '').trim(),
      ),
    ).toEqual([transition.requiredRarity]);
    application.dispose();
  });

  it('retains and repairs a reached Hammer after a route loadout change', async () => {
    const application = createApplication();
    let authored = createRepresentativeNOPQShopTraitProject();
    authored = applyProjectCommand(authored, application.catalog, {
      kind: 'ReplaceRouteLoadout',
      route: { kind: 'route', routeKey: 'Surface' },
      weaponKey: 'WeaponDagger',
      aspectKey: 'DaggerBackstabAspect',
    });
    application.store.dispatch(authoredProjectReplaced(authored));
    const invalid = currentEvaluation(application).findings.find(
      (finding) => finding.origin.kind === 'traitOffer',
    );
    if (invalid === undefined) throw new Error('reached Hammer finding is missing');
    const issue = currentEvaluation(application).issue;
    if (
      issue === undefined ||
      semanticAddressKey(issue.owner) !== semanticAddressKey(invalid.origin)
    ) {
      throw new Error('Hammer must be the selected assessment issue');
    }

    const view = renderPlannerForInteraction({ application });
    const repair = screen.getByRole('heading', { name: 'Next repair' }).closest('section');
    if (repair === null) throw new Error('selected repair banner is missing');
    await view.user.click(within(repair).getByRole('button'));

    const destination = application
      .selectStructuredWorkspace(application.store.getState())!
      .focusByOwner.get(semanticAddressKey(invalid.origin));
    if (destination === undefined) throw new Error('invalid Hammer destination is missing');
    expect(destination).toMatchObject({
      ownerAddress: invalid.origin,
      focusAddress: { kind: 'roomAction' },
    });
    expect(destination).not.toHaveProperty('traitDialogTarget');
    expect(application.store.getState().editorSession.selectedFinding).toMatchObject({
      key: issue.regionKey,
      origin: issue.owner,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      document.getElementById(semanticOwnerControlElementId(destination.focusAddress)),
    ).toBeTruthy();
    const action = document.getElementById(semanticOwnerControlElementId(destination.focusAddress));
    if (action === null) throw new Error('invalid Hammer pickup action is missing');
    await view.user.click(within(action).getByRole('button', { name: /Edit Trait/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(/Hammer incompatible with loadout/)).not.toHaveLength(0);

    const interaction = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.traitOffers.get(semanticAddressKey(invalid.origin));
    if (interaction === undefined) throw new Error('invalid Hammer interaction is missing');
    const correctedTraitKeys = [
      'DaggerBlinkAoETrait',
      'DaggerSpecialJumpTrait',
      'DaggerSpecialLineTrait',
    ] as const;
    for (const [index, traitKey] of correctedTraitKeys.entries()) {
      await view.user.click(within(dialog).getByLabelText(`option${index + 1} trait`));
      const choice = screen
        .getAllByText(application.catalog.traits.byKey[traitKey]?.label ?? traitKey)
        .find((element) => element.closest('[cmdk-item]') !== null);
      if (choice === undefined) throw new Error(`Hammer picker has no ${traitKey} choice`);
      await view.user.click(choice);
    }
    const save = within(dialog).getByRole('button', { name: 'Save trait offer' });
    await waitFor(() => expect(save).toHaveProperty('disabled', false));
    await view.user.click(save);
    expect(
      currentEvaluation(application).findings.some(
        (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(invalid.origin),
      ),
    ).toBe(false);
  });

  it('treats a shared-workspace rail focus as session-only work', async () => {
    const work: ApplicationEvaluationEvent[] = [];
    const saving = createSavingApplication({
      observeEvaluationWork: (event) => work.push(event),
    });
    const { application } = saving;
    await saving.open(loadSurfaceNOPQProject());
    const view = renderPlannerForInteraction({ application });

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
    const historyBefore = currentHistory(application);
    const evaluationBefore = currentEvaluation(application);
    work.length = 0;

    await view.user.click(decisionRail);

    expect(application.store.getState().editorSession.focusedSemanticOwner?.kind).toBe(
      'occurrence',
    );
    expect(currentHistory(application)).toBe(historyBefore);
    expect(currentEvaluation(application)).toBe(evaluationBefore);
    expect(saving.saves.hasPending()).toBe(false);
    expect(work.filter((event) => event.kind === 'projectEvaluation')).toEqual([]);
    expect(work.filter((event) => event.kind === 'queryBatch')).toEqual([]);
    expect(
      screen
        .getByRole('complementary', { name: 'Details' })
        .querySelector('.biome-occurrence-workbench > header h3'),
    ).not.toBeNull();
  });
});
