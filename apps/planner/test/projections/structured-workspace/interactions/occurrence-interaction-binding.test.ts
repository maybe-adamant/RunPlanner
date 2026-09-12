import { describe, expect, it } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';

const {
  bind,
  enteredShopProject,
  catalog,
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createShopOfferAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  loadSurfaceNOPQProject,
  loadSurfaceNOPProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
} = support;

describe('structured workspace interaction binding', () => {
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
    const major = createShopOfferAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId(enteredShop.shopId),
      'MajorNonBoon',
    );
    const participation = shop.shopPurchaseParticipations.get(semanticAddressKey(major));
    expect(participation).toMatchObject({ owner: major, purchased: false });
    expect(participation?.intentFor(true)).toMatchObject({
      command: {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: major,
        purchased: true,
      },
    });
  });
});
