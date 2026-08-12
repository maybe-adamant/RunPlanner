// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createRouteAddress,
  createTraitOfferAddress,
  createShopOfferAddress,
  semanticAddressKey,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type {
  AutosaveRecoveryAdapter,
  AutosaveScheduler,
} from '@planner/persistence/autosaveRecovery';
import type { ProfileFileAdapter } from '@planner/persistence/profileFile';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { routePanelSelected, semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { semanticOwnerElementId } from '../feedback/semanticOwner';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  createRepresentativeNOPQProject,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures';

afterEach(cleanup);

function configuredBiomeCount(
  application: ReturnType<typeof renderPlannerForInteraction>['application'],
) {
  return application.store.getState().projectWorkspace.history.present.routes[0]?.biomes.length;
}

function projectWithArtemisInErebus() {
  const initial = createCompleteFGProject();
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
    'Encounter',
  );
  return {
    phase,
    project: applyProjectCommand(initial, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'ArtemisCombatF',
    }),
  };
}

describe('planner history interaction', () => {
  it('binds visible history controls to semantic project history', async () => {
    const { application, user } = renderPlannerForInteraction();
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });

    expect(undo.classList.contains('quiet-action')).toBe(true);
    expect(redo.classList.contains('quiet-action')).toBe(true);
    expect(undo).toHaveProperty('disabled', true);
    expect(redo).toHaveProperty('disabled', true);

    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');

    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(1);
    expect(undo).toHaveProperty('disabled', false);
    expect(redo).toHaveProperty('disabled', true);

    await user.click(undo);

    expect(configuredBiomeCount(application)).toBe(0);
    expect(undo).toHaveProperty('disabled', true);
    expect(redo).toHaveProperty('disabled', false);

    await user.click(redo);

    expect(configuredBiomeCount(application)).toBe(1);
    expect(undo).toHaveProperty('disabled', false);
    expect(redo).toHaveProperty('disabled', true);
  });

  it('supports Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl+Y', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z', shiftKey: true })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);

    expect(fireEvent.keyDown(window, { metaKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'y' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);
  });

  it('leaves native text and content-editable undo behavior untouched', async () => {
    const { application, user } = renderPlannerForInteraction({
      companion: (
        <>
          <input aria-label="Project name draft" defaultValue="Draft" />
          <div
            aria-label="Project notes draft"
            contentEditable
            role="textbox"
            suppressContentEditableWarning
          >
            Notes
          </div>
        </>
      ),
    });
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');

    const input = screen.getByRole('textbox', { name: 'Project name draft' });
    expect(fireEvent.keyDown(input, { ctrlKey: true, key: 'z' })).toBe(true);
    expect(configuredBiomeCount(application)).toBe(1);

    const editable = screen.getByRole('textbox', { name: 'Project notes draft' });
    expect(fireEvent.keyDown(editable, { ctrlKey: true, key: 'z' })).toBe(true);
    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(1);
  });

  it('keeps navigation outside authored history', async () => {
    const { application, user } = renderPlannerForInteraction();

    await user.click(screen.getByRole('button', { name: 'Surface' }));

    expect(application.store.getState().editorSession.activeRouteKey).toBe('Surface');
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
  });

  it('activates route and configured-biome navigation from the keyboard', async () => {
    const { application, user } = renderPlannerForInteraction();

    const surface = screen.getByRole('button', { name: 'Surface' });
    surface.focus();
    await user.keyboard('{Enter}');
    expect(application.store.getState().editorSession.activeRouteKey).toBe('Surface');
    expect(surface.getAttribute('aria-current')).toBe('page');

    const underworld = screen.getByRole('button', { name: 'Underworld' });
    underworld.focus();
    await user.keyboard(' ');
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '4');

    const oceanus = screen.getByRole('button', { name: 'Oceanus' });
    oceanus.focus();
    await user.keyboard('{Enter}');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'G',
    });
    expect(oceanus.getAttribute('aria-current')).toBe('page');

    const tartarus = screen.getByRole('button', { name: 'Tartarus' });
    tartarus.focus();
    await user.keyboard(' ');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'I',
    });
    expect(tartarus.getAttribute('aria-current')).toBe('page');

    const route = screen.getByRole('button', { name: 'Route' });
    route.focus();
    await user.keyboard(' ');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'overview',
    });
    expect(route.getAttribute('aria-current')).toBe('page');
  });

  it('opens an NPC index row at its exact room phase without authoring history', async () => {
    const { phase, project } = projectWithArtemisInErebus();
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'NPCs' }));
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history;
    const npcEntry = screen.getByRole('button', {
      name: 'Inspect Artemis combat in Erebus · Encounter',
    });
    npcEntry.focus();
    await view.user.keyboard('{Enter}');

    expect(application.store.getState().editorSession).toMatchObject({
      activeRouteKey: 'Underworld',
      focusedSemanticOwner: phase,
      selectedFinding: null,
    });
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'F',
    });
    expect(application.store.getState().projectWorkspace.history).toBe(historyBeforeNavigation);
    const customize = screen.getByLabelText('Customize') as HTMLDetailsElement;
    await waitFor(() => expect(customize.open).toBe(true));
    const encounter = screen.getByRole('button', { name: 'Encounter' });
    expect(encounter.textContent).toContain('Artemis combat');
    await waitFor(() => expect(document.activeElement).toBe(encounter));

    const traitAddress = createTraitOfferAddress(phase, 'selection');
    const traitLauncher = within(customize).getByRole('button', { name: /Edit Trait:/ });
    await view.user.click(traitLauncher);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe('Artemis');
    expect(application.store.getState().editorSession.traitDialogTarget).toEqual(traitAddress);
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())
        .interactions.traitOffers.get(semanticAddressKey(traitAddress)),
    ).toBeDefined();

    const selectedOption = within(dialog).getAllByLabelText('Selected')[1];
    if (selectedOption === undefined) throw new Error('Artemis option 2 selected radio is missing');
    await view.user.click(selectedOption);
    const save = within(dialog).getByRole('button', { name: 'Save trait offer' });
    await waitFor(() => expect(save).toHaveProperty('disabled', false));
    const historyBeforeSave = application.store.getState().projectWorkspace.history;
    await view.user.click(save);

    const savedInteraction = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.traitOffers.get(semanticAddressKey(traitAddress));
    if (savedInteraction?.value.kind !== 'traits')
      throw new Error('saved Artemis offer must contain traits');
    expect(savedInteraction.value.selectedOptionKey).toBe('option2');
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeSave.past.length + 1,
    );

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    const restoredInteraction = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.traitOffers.get(semanticAddressKey(traitAddress));
    if (restoredInteraction?.value.kind !== 'traits') {
      throw new Error('restored Artemis offer must contain traits');
    }
    expect(restoredInteraction.value.selectedOptionKey).toBe('option1');
  });

  it('hands a route trait row through exact biome navigation and restores focus on Escape', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const launcher = screen.getAllByRole('button', { name: /Edit Trait:/ })[0];
    if (launcher === undefined) throw new Error('route trait launcher is missing');
    launcher.focus();
    await view.user.keyboard('{Enter}');

    const session = application.store.getState().editorSession;
    if (session.focusedSemanticOwner?.kind !== 'traitOffer') {
      throw new Error('route trait navigation did not retain the exact trait owner');
    }
    expect(session.traitDialogTarget).toEqual(session.focusedSemanticOwner);
    expect(session.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: session.focusedSemanticOwner.biomeKey,
    });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.tagName).toBe('DIALOG');
    const appHeader = document.querySelector('.app-header');
    expect(appHeader).not.toBeNull();
    expect((appHeader as HTMLElement & { inert: boolean }).inert).toBe(true);

    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement?.id).toBe(launcher.id);
  });

  it('lets an open trait picker consume Escape before dismissing its dialog draft', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const launcher = screen.getAllByRole('button', { name: /Edit Trait:/ })[0];
    if (launcher === undefined) throw new Error('route trait launcher is missing');
    await view.user.click(launcher);
    const dialog = await screen.findByRole('dialog');
    const selected = within(dialog).getAllByLabelText('Selected')[1];
    if (selected === undefined) throw new Error('option 2 selected radio is missing');
    await view.user.click(selected);
    const traitPicker = within(dialog).getByLabelText('option1 trait');
    await view.user.click(traitPicker);
    expect(screen.getByRole('combobox')).toBeTruthy();

    await view.user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(document.activeElement).toBe(traitPicker);
    expect(selected).toHaveProperty('checked', true);

    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement?.id).toBe(launcher.id);
  });

  it('resets an open trait editor across parent replacement and undo', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const initialWorkspace = application.selectStructuredWorkspace(application.store.getState());
    const traitInteraction = [...initialWorkspace.interactions.traitOffers.values()].find(
      (candidate) => {
        if (
          candidate.owner.owner.kind !== 'incomingReward' ||
          candidate.owner.owner.occurrenceId.includes('start')
        )
          return false;
        const reward = initialWorkspace.interactions.rewards.get(
          semanticAddressKey(candidate.owner.owner),
        );
        return reward?.authoredRewardTypes.includes('Boon') ?? false;
      },
    );
    if (traitInteraction === undefined) throw new Error('incoming trait editor fixture is missing');
    const target = traitInteraction.owner;
    if (target.owner.kind !== 'incomingReward') throw new Error('incoming trait owner is missing');
    const initialValue = traitInteraction.value;
    if (initialValue.kind !== 'traits') throw new Error('incoming trait fixture must offer traits');
    const replacementSource = traitInteraction.giver.key === 'Ares' ? 'ZeusUpgrade' : 'AresUpgrade';
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: target.routeKey }));
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const launcher = document.getElementById(`trait-launcher-${semanticAddressKey(target)}`);
    if (launcher === null) throw new Error('trait editor launcher is missing');
    await view.user.click(launcher);
    const dialog = await screen.findByRole('dialog');
    const traitTrigger = within(dialog).getByLabelText('option1 trait');
    expect(traitTrigger.textContent).toContain(
      application.catalog.traits.byKey[initialValue.options[0]?.traitKey ?? '']?.label,
    );

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceIncomingReward',
        reward: target.owner,
        value: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: replacementSource },
        },
      }),
    );
    const replacement = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.traitOffers.get(semanticAddressKey(target));
    if (replacement === undefined) throw new Error('replacement trait interaction is missing');
    const replacementValue = replacement.value;
    if (replacementValue.kind !== 'traits')
      throw new Error('replacement trait interaction must offer traits');
    await waitFor(() =>
      expect(within(dialog).getByLabelText('option1 trait').textContent).toContain(
        application.catalog.traits.byKey[replacementValue.options[0]?.traitKey ?? '']?.label,
      ),
    );
    expect(replacement.value).not.toEqual(initialValue);
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(
      replacement.giver.label,
    );

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    const restored = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.traitOffers.get(semanticAddressKey(target));
    if (restored === undefined) throw new Error('restored trait interaction is missing');
    const restoredValue = restored.value;
    if (restoredValue.kind !== 'traits')
      throw new Error('restored trait interaction must offer traits');
    await waitFor(() =>
      expect(within(dialog).getByLabelText('option1 trait').textContent).toContain(
        application.catalog.traits.byKey[restoredValue.options[0]?.traitKey ?? '']?.label,
      ),
    );
    expect(restored.value).toEqual(initialValue);
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(
      restored.giver.label,
    );
  });

  it('opens a reached-invalid trait finding with its exact marker and engine reason', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceRouteLoadout',
        route: { kind: 'route', routeKey: 'Underworld' },
        weaponKey: 'WeaponDagger',
        aspectKey: 'DaggerBackstabAspect',
      }),
    );
    const invalid = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (finding) => finding.origin.kind === 'traitOffer',
      );
    if (invalid === undefined) throw new Error('invalid reached Hammer finding is missing');
    const view = renderPlannerForInteraction({ application });
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    const findingButton = within(findings)
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Hammer is incompatible'));
    if (findingButton === undefined) throw new Error('Hammer finding is not presented');
    await view.user.click(findingButton);

    const dialog = await screen.findByRole('dialog');
    expect(dialog.tagName).toBe('DIALOG');
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())
        .focusByOwner.get(semanticAddressKey(invalid.origin)),
    ).toMatchObject({
      ownerAddress: invalid.origin,
      traitDialogTarget: invalid.origin,
    });
    expect(document.getElementById(semanticOwnerElementId(invalid.origin))).toBeTruthy();
    expect(
      within(dialog).getAllByText(/Hammer is incompatible with this loadout/).length,
    ).toBeGreaterThan(0);
    expect(within(dialog).getByRole('status')).toBeTruthy();

    const interaction = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.traitOffers.get(semanticAddressKey(invalid.origin));
    if (interaction === undefined) throw new Error('invalid Hammer interaction is missing');
    const corrected = interaction.giver.defaultsByLoadout?.['WeaponDagger:DaggerBackstabAspect'];
    if (corrected === undefined) throw new Error('Dagger Hammer defaults are missing');
    for (const [index, option] of corrected.options.entries()) {
      await view.user.click(within(dialog).getByLabelText(`option${index + 1} trait`));
      const choice = screen
        .getAllByText(application.catalog.traits.byKey[option.traitKey]?.label ?? option.traitKey)
        .find((element) => element.closest('[cmdk-item]') !== null);
      if (choice === undefined) throw new Error(`Hammer picker has no ${option.traitKey} choice`);
      await view.user.click(choice);
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

  it('edits ordinary, Hermes, room Hammer, and acquired Shop Hammer offers through shared controls', async () => {
    const application = createApplication();
    let project = createRepresentativeNOPQProject();
    project = applyProjectCommand(project, application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat07', 4, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon'),
      value: { rewardType: 'WeaponUpgradeDrop' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: createAcquisitionSiteAddress(
        createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop),
        'roomExit',
      ),
      entryKeys: ['MajorNonBoon'],
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));

    const interactions = application.selectStructuredWorkspace(
      application.store.getState(),
    ).interactions;
    const visibleLauncher = (
      kind: 'olympian' | 'hermes' | 'hammer',
      ownerKind?: string,
      requireVisible = true,
    ) => {
      const interaction = [...interactions.traitOffers.values()].find(
        (candidate) =>
          candidate.giver.providerKind === kind &&
          (ownerKind === undefined || candidate.owner.owner.kind === ownerKind) &&
          (!requireVisible ||
            document.getElementById(`trait-launcher-${semanticAddressKey(candidate.owner)}`) !==
              null),
      );
      if (interaction === undefined) throw new Error(`visible ${kind} trait launcher is missing`);
      return interaction;
    };

    const ordinary = visibleLauncher('olympian');
    await view.user.click(
      document.getElementById(`trait-launcher-${semanticAddressKey(ordinary.owner)}`)!,
    );
    const ordinaryDialog = await screen.findByRole('dialog');
    expect(within(ordinaryDialog).getByLabelText('option1 rarity')).toBeTruthy();
    await view.user.click(
      within(ordinaryDialog).getByRole('button', { name: 'Close trait offer' }),
    );

    const roomHammer = visibleLauncher('hammer', 'incomingReward', false);
    application.store.dispatch(
      routePanelSelected({
        routeKey: roomHammer.owner.routeKey,
        panel: { kind: 'biome', biomeKey: roomHammer.owner.biomeKey },
      }),
    );
    application.store.dispatch(semanticOwnerFocused(roomHammer.owner));
    await waitFor(() =>
      expect(
        document.getElementById(`trait-launcher-${semanticAddressKey(roomHammer.owner)}`),
      ).not.toBeNull(),
    );
    await view.user.click(
      document.getElementById(`trait-launcher-${semanticAddressKey(roomHammer.owner)}`)!,
    );
    const roomHammerDialog = await screen.findByRole('dialog');
    expect(within(roomHammerDialog).queryByLabelText('option1 rarity')).toBeNull();
    expect(within(roomHammerDialog).queryByText('Rarity', { selector: 'span' })).toBeNull();
    await view.user.click(
      within(roomHammerDialog).getByRole('button', { name: 'Close trait offer' }),
    );

    const shopHammer = visibleLauncher('hammer', 'shopOffer', false);
    application.store.dispatch(
      routePanelSelected({
        routeKey: shopHammer.owner.routeKey,
        panel: { kind: 'biome', biomeKey: shopHammer.owner.biomeKey },
      }),
    );
    application.store.dispatch(semanticOwnerFocused(shopHammer.owner));
    await waitFor(() =>
      expect(
        document.getElementById(`trait-launcher-${semanticAddressKey(shopHammer.owner)}`),
      ).not.toBeNull(),
    );
    await view.user.click(
      document.getElementById(`trait-launcher-${semanticAddressKey(shopHammer.owner)}`)!,
    );
    const shopHammerDialog = await screen.findByRole('dialog');
    expect(within(shopHammerDialog).queryByLabelText('option1 rarity')).toBeNull();
  });

  it('edits a reached Hermes offer with the shared rarity-aware editor', async () => {
    const application = createApplication();
    let project = createCompleteFGProject({ prebossSource: 'G_Combat14' });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenGBiome, {
        kind: 'occurrence',
        occurrenceId: goldenGOccurrenceId(7, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit3' },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const interactions = application.selectStructuredWorkspace(
      application.store.getState(),
    ).interactions;
    const hermes = [...interactions.traitOffers.values()].find(
      (candidate) => candidate.giver.providerKind === 'hermes',
    );
    if (hermes === undefined) throw new Error('reached Hermes trait launcher is missing');
    application.store.dispatch(
      routePanelSelected({
        routeKey: hermes.owner.routeKey,
        panel: { kind: 'biome', biomeKey: hermes.owner.biomeKey },
      }),
    );
    application.store.dispatch(semanticOwnerFocused(hermes.owner));
    await waitFor(() =>
      expect(
        document.getElementById(`trait-launcher-${semanticAddressKey(hermes.owner)}`),
      ).not.toBeNull(),
    );
    await view.user.click(
      document.getElementById(`trait-launcher-${semanticAddressKey(hermes.owner)}`)!,
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('option1 rarity')).toBeTruthy();
  });

  it('keeps blocked and cross-route biome pages visible and editable', async () => {
    const { user } = renderPlannerForInteraction();

    await user.selectOptions(screen.getByLabelText('Configure route up to'), '4');
    const oceanus = screen.getByRole('button', { name: 'Oceanus' });
    expect(within(oceanus).getByTitle('Blocked')).toBeTruthy();
    expect(
      document
        .getElementById(oceanus.getAttribute('aria-describedby') ?? '')
        ?.getAttribute('aria-label'),
    ).toBe('Blocked');

    await user.click(oceanus);
    const blockedBanner = screen.getByText(
      'Finish and fix Erebus before Oceanus can be evaluated. You can still edit it.',
    );
    expect(blockedBanner.getAttribute('role')).toBeNull();
    expect(blockedBanner.closest('.editor-panel')?.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('button', { name: 'Start biome' })).toHaveProperty('disabled', false);

    await user.click(screen.getByRole('button', { name: 'Surface' }));
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '4');
    // Route composition blocks the complete suffix at the first incomplete
    // biome. O/P/Q therefore retain their own structural frontiers while
    // each names N/Ephyra as the shared upstream semantic blocker.
    for (const [label, predecessor] of [
      ['Thessaly', 'Ephyra'],
      ['Olympus', 'Ephyra'],
      ['Summit', 'Ephyra'],
    ] as const) {
      const blockedSurfaceBiome = screen.getByRole('button', { name: label });
      expect(within(blockedSurfaceBiome).getByTitle('Blocked')).toBeTruthy();
      await user.click(blockedSurfaceBiome);
      expect(
        screen.getByText(
          new RegExp(`Finish and fix ${predecessor} before ${label} can be evaluated`),
        ),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Start biome' })).toHaveProperty('disabled', false);
    }

    const ephyra = screen.getByRole('button', { name: 'Ephyra' });
    expect(within(ephyra).getByTitle('Incomplete')).toBeTruthy();

    await user.click(ephyra);
    expect(screen.getByText('Ephyra is not evaluated yet. You can still edit it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start biome' })).toHaveProperty('disabled', false);
  });
});

describe('route loadout interaction', () => {
  it('authors Arcana and Fear through bounded controls with undo and redo', async () => {
    const { application, user } = renderPlannerForInteraction();

    const arcana = screen.getByRole('group', { name: 'Arcana, 0 active' });
    const arcanaSummary = arcana.querySelector('summary');
    if (arcanaSummary === null) throw new Error('Arcana summary is missing');
    await user.click(arcanaSummary);
    expect(screen.getByRole('checkbox', { name: 'The Moon (automatic)' })).toHaveProperty(
      'disabled',
      true,
    );
    await user.click(screen.getByRole('checkbox', { name: /The Sorceress/ }));

    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .manualArcanaKeys,
    ).toEqual(['ChanneledCast']);
    expect(screen.getByRole('group', { name: 'Arcana, 3 active' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .manualArcanaKeys,
    ).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .manualArcanaKeys,
    ).toEqual(['ChanneledCast']);

    const fear = screen.getByRole('group', { name: 'Fear, 0 total' });
    const fearSummary = fear.querySelector('summary');
    if (fearSummary === null) throw new Error('Fear summary is missing');
    await user.click(fearSummary);
    await user.selectOptions(screen.getByLabelText('Vow of Pain rank'), '3');

    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout.fearRanks
        .EnemyDamageShrineUpgrade,
    ).toBe(3);
    expect(screen.getByRole('group', { name: 'Fear, 5 total' })).toBeTruthy();
  });
});

describe('project profile interaction', () => {
  it('renames the project through one undoable semantic command', async () => {
    const { application, user } = renderPlannerForInteraction();

    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Ocean Route');
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    expect(application.store.getState().projectWorkspace.history.present.name).toBe('Ocean Route');
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.history.present.name).toBe('Run Plan');
    expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveProperty(
      'value',
      'Run Plan',
    );
  });

  it('saves, replaces, and reloads the project through the visible profile controls', async () => {
    let profileJson: string | null = null;
    const profileFile: ProfileFileAdapter = {
      save: (_fileName, json) => {
        profileJson = json;
        return Promise.resolve('saved');
      },
      load: () => Promise.resolve(profileJson),
    };
    const application = createApplication({ profileFile });
    const { user } = renderPlannerForInteraction({ application });

    expect(screen.getByRole('button', { name: 'New' }).classList.contains('danger-action')).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: 'Save Profile' }).classList.contains('secondary-action'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Load Profile' }).classList.contains('danger-action'),
    ).toBe(true);
    expect(screen.getByText('Unsaved')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceManualArcanaSelection',
        route: createRouteAddress('Underworld'),
        arcanaKeys: ['ChanneledCast'],
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceFearVowRank',
        route: createRouteAddress('Underworld'),
        vowKey: 'EnemyDamageShrineUpgrade',
        rank: 3,
      }),
    );
    const savedEvaluation = application.store.getState().projectWorkspace.assembly.evaluation;
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(await screen.findByText('Saved the profile.')).toBeTruthy();
    expect(screen.getByText('Clean')).toBeTruthy();

    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Edited after save');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByText('Dirty')).toBeTruthy();
    expect(profileJson).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(configuredBiomeCount(application)).toBe(0);
    expect(screen.getByText('Created a new project.')).toBeTruthy();
    expect(screen.getByText('Unsaved')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Load Profile' }));
    expect(await screen.findByText('Loaded the profile.')).toBeTruthy();
    expect(configuredBiomeCount(application)).toBe(1);
    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout,
    ).toMatchObject({
      manualArcanaKeys: ['ChanneledCast'],
      fearRanks: { EnemyDamageShrineUpgrade: 3 },
    });
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
    expect(application.store.getState().projectWorkspace.history.future).toEqual([]);
    expect(application.store.getState().projectWorkspace.assembly.evaluation).toEqual(
      savedEvaluation,
    );
    expect(screen.getByText('Clean')).toBeTruthy();
  });

  it('presents a restored startup project as recovered', () => {
    const source = createApplication();
    const json = encodeProjectDocument(source.store.getState().projectWorkspace.history.present);
    const application = createApplication({
      autosaveRecovery: {
        read: () => json,
        write: () => {},
        clear: () => {},
      },
      autosaveScheduler: { schedule: () => () => {} },
    });

    renderPlannerForInteraction({ application });

    expect(screen.getByText('Recovered')).toBeTruthy();
  });

  it('presents corrupt recovery and exposes its explicit discard action', async () => {
    let recoveryJson: string | null = '{not json';
    const recovery: AutosaveRecoveryAdapter = {
      read: () => recoveryJson,
      write: (json) => {
        recoveryJson = json;
      },
      clear: () => {
        recoveryJson = null;
      },
    };
    const scheduler: AutosaveScheduler = {
      schedule: () => () => {},
    };
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: scheduler,
    });
    const { user } = renderPlannerForInteraction({ application });

    expect(screen.getByRole('alert').textContent).toBe(
      'Autosave recovery failed: $: must be valid JSON',
    );
    expect(screen.getByText('Unsaved')).toBeTruthy();
    const discard = screen.getByRole('button', { name: 'Discard Autosave' });
    expect(discard.classList.contains('danger-action')).toBe(true);
    await user.click(discard);

    expect(recoveryJson).toBeNull();
    expect(screen.queryByText('Autosave recovery failed: $: must be valid JSON')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard Autosave' })).toBeNull();
    expect(screen.getByText('Discarded the unreadable autosave.')).toBeTruthy();
  });

  it('presents a load failure and retains the current workspace', async () => {
    const application = createApplication({
      profileFile: {
        save: () => Promise.resolve('saved'),
        load: () => Promise.resolve('{not json'),
      },
    });
    const workspace = application.store.getState().projectWorkspace;
    const { user } = renderPlannerForInteraction({ application });

    await user.click(screen.getByRole('button', { name: 'Load Profile' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Load Profile failed: $: must be valid JSON',
    );
    expect(application.store.getState().projectWorkspace).toBe(workspace);
  });
});
