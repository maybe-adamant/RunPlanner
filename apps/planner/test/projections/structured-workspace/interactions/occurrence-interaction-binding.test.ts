import { describe, expect, it } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';

const {
  bind,
  enteredShopProject,
  catalog,
  applyProjectCommand,
  createBiomeAddress,
  createCompleteFGProject,
  createEncounterPhaseAddress,
  createGoldenFGHIProject,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRouteStartKeepsakeSelectionAddress,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenIBiome,
  semanticAddressKey,
  loadSurfaceNOPQProject,
  loadSurfaceNOPProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
} = support;

describe('structured workspace interaction binding', () => {
  it('offers no generated edits or pickers for a generated phase without its context', () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    const reached = bind(createCompleteFGProject(), 'Underworld', 'F').interactions;
    const reachedPhase = reached.encounterCustomizations.get(semanticAddressKey(phase));
    expect(reachedPhase?.generatedAssessment).toBeDefined();
    expect(reachedPhase?.generatedEdits).toBeDefined();
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
        'Encounter',
      ),
      encounterKey: 'ArtemisCombatF',
    });
    const withheld = bind(project, 'Underworld', 'F').interactions.encounterCustomizations.get(
      semanticAddressKey(phase),
    );
    expect(withheld?.generatedComposition?.editable).toBe(true);
    for (const key of [
      'generatedAssessment',
      'generatedEdits',
      'generatedHighlightPicker',
      'initializeGenerated',
      'generatedWaveDraftFor',
      'generatedFangsDraftFor',
    ])
      expect(withheld).not.toHaveProperty(key);
  });

  it('binds the exact Gorgon condition replacement command', () => {
    const project = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
      'Combat',
    );
    const { interactions } = bind(project, 'Surface', 'P');
    const interaction = interactions.gorgonConditions.get(semanticAddressKey(phase));
    expect(interaction?.supported).toBe(true);
    expect(interaction?.intentFor(true).command).toEqual({
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
  });

  it('binds the Nemesis kill-race outcome only while the phase holds a bet combat', () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    const key = semanticAddressKey(phase);
    expect(
      bind(createCompleteFGProject(), 'Underworld', 'F').interactions.nemesisBets.has(key),
    ).toBe(false);
    const nemesis = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisCombatF',
    });
    const unstored = bind(nemesis, 'Underworld', 'F');
    expect(
      [...unstored.assembly.occurrenceInteractionRequirements.values()].some(
        (requirement) =>
          requirement.kind === 'encounterPhases' &&
          requirement.phases.some(
            (entry) =>
              semanticAddressKey(entry.owner) === key &&
              entry.nemesisBet !== undefined &&
              entry.nemesisBet.outcome === undefined,
          ),
      ),
    ).toBe(true);
    const interaction = unstored.interactions.nemesisBets.get(key);
    expect(interaction?.outcome).toBe('win');
    expect(interaction?.choices.map((choice) => choice.label)).toEqual(['Win', 'Tie', 'Loss']);
    expect(interaction?.intentFor('loss').command).toEqual({
      kind: 'ReplaceNemesisBetOutcome',
      phase,
      value: 'loss',
    });
    const lost = applyProjectCommand(nemesis, catalog, interaction!.intentFor('loss').command);
    expect(bind(lost, 'Underworld', 'F').interactions.nemesisBets.get(key)?.outcome).toBe('loss');
    const dormant = applyProjectCommand(lost, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'ArtemisCombatF',
    });
    expect(bind(dormant, 'Underworld', 'F').interactions.nemesisBets.has(key)).toBe(false);
  });

  it('binds the Nemesis kill-race outcome on a Tartarus Nemesis combat', () => {
    const phase = createEncounterPhaseAddress(
      goldenIBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-i-combat01') },
      'Encounter',
    );
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisCombatI',
    });
    const interaction = bind(project, 'Underworld', 'I').interactions.nemesisBets.get(
      semanticAddressKey(phase),
    );
    expect(interaction?.outcome).toBe('win');
    expect(interaction?.intentFor('tie').command).toEqual({
      kind: 'ReplaceNemesisBetOutcome',
      phase,
      value: 'tie',
    });
  });

  it('withholds dormant Ship Combat2 and binds its active declaration-invalid multi-choice semantic', () => {
    const initial = loadSurfaceNOPQProject();
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const combat2 = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
      'Combat2',
    );

    expect(
      bind(initial, 'Surface', 'O').interactions.encounterPhases.has(semanticAddressKey(combat2)),
    ).toBe(false);

    const expanded = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const { assembly, interactions } = bind(expanded, 'Surface', 'O');
    const interaction = interactions.encounterPhases.get(semanticAddressKey(combat2));
    const node = assembly.nodes.find(
      (candidate) =>
        candidate.kind === 'occurrenceWorkbench' &&
        candidate.room.occurrenceId === oOccurrenceIds.combat04,
    );

    expect(interaction).toMatchObject({
      owner: combat2,
      selected: 'GeneratedO',
    });
    expect(node).toMatchObject({
      kind: 'occurrenceWorkbench',
      room: {
        encounterPhases: expect.arrayContaining([
          expect.objectContaining({
            address: combat2,
            customizable: true,
            marker: expect.any(Object),
          }),
        ]),
      },
    });
    expect(assembly.preliminaryFocusDestinations.has(semanticAddressKey(combat2))).toBe(true);
  });

  it('binds Ship-wheel values and Shop actions from occurrence requirements', () => {
    const surface = loadSurfaceNOPQProject();
    const ship = bind(surface, 'Surface', 'O').interactions;
    const enteredShop = enteredShopProject();
    const shop = bind(enteredShop.project, 'Underworld', 'F').interactions;
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const shopOwner = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId(enteredShop.shopId),
    );

    expect(
      ship.shipCombatPhaseCounts.get(
        semanticAddressKey(createOccurrenceAddress(oBiome, oOccurrenceIds.combat04)),
      ),
    ).toMatchObject({ selected: 2 });
    expect(ship.rewardWheelOfferCounts.get(semanticAddressKey(wheel))).toMatchObject({
      owner: wheel,
      selected: 1,
    });
    expect(ship.rewardWheelStores.get(semanticAddressKey(wheel))).toMatchObject({
      owner: wheel,
      selected: 'RunProgress',
    });
    expect(ship.rewardWheelPicks.get(semanticAddressKey(wheel))).toMatchObject({
      owner: wheel,
      selected: 1,
    });
    expect(shop.roomActions.get(semanticAddressKey(shopOwner))).toMatchObject({
      owner: shopOwner,
    });
    // The Shop's entry binds even while its room's actions are unreached.
    const entry = shop.roomObjectEntries.get(
      `roomObject:worldShop:${semanticAddressKey(shopOwner)}`,
    );
    expect(entry).toMatchObject({ owner: shopOwner });
    expect(() => entry?.intentFor('buy:MajorNonBoon')).toThrow(/is not an option/);
  });
});
