import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { fieldsBatchFacts, simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenHBiome,
} from '@run-planner/test-fixtures';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures';
import { assembleWorkspaceOccurrence } from './occurrence-assembly';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from './occurrence-facts';
import { createWorkspaceBiomeMarkerDestinationBuilder } from '../navigation/marker-builder';
import { createWorkspaceProjectSourceIndex } from '../source-index';

function biomeSource(project: ProjectDocument, routeKey: string, biomeKey: string) {
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    simulateProject(catalog, project),
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function fieldsFactsForOccurrence(
  source: ReturnType<typeof biomeSource>,
  occurrenceId: OccurrenceId,
) {
  const decision = source.exitDecisions.find(
    (candidate) =>
      candidate.normal.kind === 'batch' &&
      candidate.normal.targets.some((target) => target.occurrenceId === occurrenceId),
  );
  return decision === undefined
    ? undefined
    : fieldsBatchFacts(catalog, source.layout, source.occurrence, decision);
}

function assemble(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: OccurrenceId,
) {
  const source = biomeSource(project, routeKey, biomeKey);
  const occurrence = source.occurrence(occurrenceId);
  if (occurrence === undefined) throw new Error(`${occurrenceId} occurrence is missing`);
  const facts = createWorkspaceBiomeOccurrenceAssemblyFacts(source).occurrence(occurrenceId);
  if (facts === undefined) throw new Error(`${occurrenceId} facts are missing`);
  const fieldsFacts = fieldsFactsForOccurrence(source, occurrenceId);
  const markers = createWorkspaceBiomeMarkerDestinationBuilder({
    assessmentFor: (address) =>
      source.evaluation === undefined
        ? 'blocked'
        : source.isAssessed(address) || source.findingsFor(address).length > 0
          ? 'assessed'
          : 'unassessed',
    biome: source.biome,
    findingCountFor: (address) => source.findingsFor(address).length,
    routeKey,
  });
  const assembly = assembleWorkspaceOccurrence({
    biome: source.biome,
    catalog,
    ...(fieldsFacts === undefined ? {} : { fieldsBatchFacts: fieldsFacts }),
    facts,
    markerDestinations: markers.emitter,
    occurrence,
  });
  return { assembly, markers, source };
}

function withFPrebossSelection(
  project: ProjectDocument,
  exitKey: 'exit1' | 'exit2',
): ProjectDocument {
  const sourceOccurrenceId = goldenFOccurrenceId(10, 1);
  return {
    ...project,
    routes: project.routes.map((route) =>
      route.routeKey !== 'Underworld'
        ? route
        : {
            ...route,
            biomes: route.biomes.map((plan) =>
              plan.biomeKey !== 'F' || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      decisions: plan.topology.decisions.map((decision) =>
                        decision.kind === 'exit' &&
                        semanticAddressKey(
                          createExitDecisionAddress(goldenFBiome, decision.source),
                        ) ===
                          semanticAddressKey(
                            createExitDecisionAddress(goldenFBiome, {
                              kind: 'occurrence',
                              occurrenceId: sourceOccurrenceId,
                            }),
                          )
                          ? { ...decision, selection: { kind: 'normal' as const, exitKey } }
                          : decision,
                      ),
                    },
                  },
            ),
          },
    ),
  };
}

describe('structured workspace occurrence assembly', () => {
  it('returns immutable ordinary and fixed workbenches with their exact marker destinations', () => {
    const project = createGoldenFGHIProject();
    const fixed = assemble(project, 'Underworld', 'F', goldenFStartId);
    const ordinary = assemble(project, 'Underworld', 'F', goldenFOccurrenceId(1, 1));

    expect(fixed.assembly.node.room.occurrenceId).toBe(goldenFStartId);
    expect(ordinary.assembly.node.room.rewardControls).toHaveLength(1);
    expect(fixed.markers.destinations().get(fixed.assembly.node.marker.focusKey)?.nodeKey).toBe(
      fixed.assembly.node.key,
    );
    expect(
      ordinary.markers.destinations().get(ordinary.assembly.node.marker.focusKey)?.nodeKey,
    ).toBe(ordinary.assembly.node.key);
  });

  it('publishes authored encounter choices without candidate support', () => {
    const nCombat = assemble(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      nOccurrenceId('combat05'),
    ).assembly;
    const nPhase = nCombat.node.room.encounterPhases.find((phase) => phase.label === 'Encounter');
    expect(nPhase?.selectedEncounter.key).toBe('GeneratedN');
    expect(nPhase?.candidateChoices.length).toBeGreaterThan(1);
    const nRequirement = nCombat.occurrenceInteractionRequirements.find(
      (requirement) => requirement.kind === 'encounterPhases',
    );
    expect(nRequirement?.kind).toBe('encounterPhases');
    if (nRequirement?.kind === 'encounterPhases') {
      expect(nRequirement.phases[0]?.candidateChoices.length).toBeGreaterThan(1);
    }
  });

  it('publishes active Ephyra side details but withholds dormant side details without hiding incoming rewards', () => {
    const project = createRepresentativeNOPQProject();
    const active = assemble(project, 'Surface', 'N', nOccurrenceId('combat05')).assembly;
    const dormant = assemble(project, 'Surface', 'N', nOccurrenceId('combat10')).assembly;

    expect(active.node.room.roomLocal.kind).toBe('ephyra');
    if (active.node.room.roomLocal.kind !== 'ephyra') throw new Error('active Ephyra is missing');
    const activeSideRooms = active.node.room.roomLocal.sideRooms;
    expect(activeSideRooms.kind).toBe('published');
    if (activeSideRooms.kind !== 'published') throw new Error('active Ephyra sides are withheld');
    expect(active.occurrenceInteractionRequirements).toHaveLength(5);
    expect(
      active.occurrenceInteractionRequirements.some(
        (requirement) => requirement.kind === 'ephyraSideRooms',
      ),
    ).toBe(true);
    const group = activeSideRooms.group;
    const sideDoor2 = group.slots.find((slot) => slot.key === 'sideDoor2');
    const sideDoor3 = group.slots.find((slot) => slot.key === 'sideDoor3');
    if (sideDoor2 === undefined || sideDoor3 === undefined) {
      throw new Error('active Ephyra side-room positions are missing');
    }
    expect(sideDoor2.entryOrder.options).toEqual([
      {
        key: 'notEntered',
        label: 'Not visited',
        position: null,
        proposedEnteredSlotKeys: ['sideDoor1'],
      },
      {
        key: 'position:1',
        label: '1st',
        position: 1,
        proposedEnteredSlotKeys: ['sideDoor2', 'sideDoor1'],
      },
      {
        key: 'position:2',
        label: '2nd',
        position: 2,
        proposedEnteredSlotKeys: ['sideDoor1', 'sideDoor2'],
      },
    ]);
    expect(sideDoor3.entryOrder.options.map((option) => option.proposedEnteredSlotKeys)).toEqual([
      ['sideDoor2', 'sideDoor1'],
      ['sideDoor3', 'sideDoor2', 'sideDoor1'],
      ['sideDoor2', 'sideDoor3', 'sideDoor1'],
      ['sideDoor2', 'sideDoor1', 'sideDoor3'],
    ]);

    expect(dormant.node.room.roomLocal.kind).toBe('ephyra');
    if (dormant.node.room.roomLocal.kind !== 'ephyra') throw new Error('dormant Ephyra is missing');
    expect(dormant.node.room.rewardControls).toHaveLength(1);
    expect(dormant.node.room.roomLocal.sideRooms.kind).toBe('withheld');
    expect(dormant.occurrenceInteractionRequirements).toHaveLength(0);
  });

  it('keeps active Ephyra side details, controls, and requirements when its incoming reward is invalid', () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat05')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const { assembly, source } = assemble(project, 'Surface', 'N', nOccurrenceId('combat05'));
    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));

    expect(source.evaluation).toMatchObject({ authoring: 'complete', validity: 'invalid' });
    expect(source.findingsFor(incoming)).toHaveLength(1);
    expect(assembly.node.room.detailsActive).toBe(true);
    expect(assembly.node.room.roomLocal.kind).toBe('ephyra');
    if (
      assembly.node.room.roomLocal.kind !== 'ephyra' ||
      assembly.node.room.roomLocal.sideRooms.kind !== 'published'
    ) {
      throw new Error('invalid active Ephyra side rooms are withheld');
    }
    const { group } = assembly.node.room.roomLocal.sideRooms;
    const sideDoor1 = group.slots.find((slot) => slot.key === 'sideDoor1');
    if (sideDoor1?.generation !== 'generated') {
      throw new Error('invalid active Ephyra side reward is missing');
    }

    expect(
      assembly.node.room.rewardControls.some(
        (control) => semanticAddressKey(control.owner.address) === semanticAddressKey(incoming),
      ),
    ).toBe(true);
    expect(
      assembly.node.room.rewardControls.some(
        (control) =>
          semanticAddressKey(control.owner.address) ===
          semanticAddressKey(sideDoor1.rewardControl.owner.address),
      ),
    ).toBe(true);
    expect(
      assembly.node.room.rewardControls.find(
        (control) => semanticAddressKey(control.owner.address) === semanticAddressKey(incoming),
      )?.marker.findingCount,
    ).toBe(1);
    expect(assembly.occurrenceInteractionRequirements).toHaveLength(5);
    const requirement = assembly.occurrenceInteractionRequirements.find(
      (candidate) => candidate.kind === 'ephyraSideRooms',
    );
    if (requirement?.kind !== 'ephyraSideRooms') {
      throw new Error('invalid active Ephyra side-room requirement is missing');
    }
    expect(requirement.owner).toEqual(group.address);
    expect(requirement.sideRooms.map((sideRoom) => sideRoom.address)).toContainEqual(
      sideDoor1.address,
    );
  });

  it('orders Ephyra sides by availability rank and publishes rewards only after generation', () => {
    const sideDoor1 = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor1',
    );
    const sideDoor2 = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor2',
    );
    const sideDoor2Reward = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor2',
    );
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat02'), 'sideRooms'),
      enteredSlotKeys: [],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: sideDoor1,
      generation: 'notGenerated',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: sideDoor2,
      generation: 'generated',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward: sideDoor2Reward,
      value: { rewardType: 'AirBoost' },
    });

    const generated = assemble(project, 'Surface', 'N', nOccurrenceId('combat02')).assembly;
    if (
      generated.node.room.roomLocal.kind !== 'ephyra' ||
      generated.node.room.roomLocal.sideRooms.kind !== 'published'
    ) {
      throw new Error('generated Ephyra sides are missing');
    }
    const generatedSlots = generated.node.room.roomLocal.sideRooms.group.slots;
    expect(generatedSlots.map((slot) => [slot.key, slot.availabilityRank])).toEqual([
      ['sideDoor2', 1],
      ['sideDoor1', 2],
    ]);
    expect(generatedSlots[0]?.generation).toBe('generated');
    expect(
      generatedSlots[0]?.generation === 'generated' && generatedSlots[0].rewardControl.offer,
    ).toEqual({ rewardType: 'AirBoost' });
    expect(generatedSlots[1]?.generation).toBe('notGenerated');
    expect(
      generated.node.room.rewardControls.some(
        (control) =>
          semanticAddressKey(control.owner.address) === semanticAddressKey(sideDoor2Reward),
      ),
    ).toBe(true);

    const inactive = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: sideDoor2,
      generation: 'notGenerated',
    });
    const inactiveAssembly = assemble(inactive, 'Surface', 'N', nOccurrenceId('combat02')).assembly;
    if (
      inactiveAssembly.node.room.roomLocal.kind !== 'ephyra' ||
      inactiveAssembly.node.room.roomLocal.sideRooms.kind !== 'published'
    ) {
      throw new Error('inactive Ephyra sides are missing');
    }
    const inactiveSlot = inactiveAssembly.node.room.roomLocal.sideRooms.group.slots.find(
      (slot) => slot.key === 'sideDoor2',
    );
    expect(inactiveSlot?.generation).toBe('notGenerated');
    expect(
      inactiveAssembly.node.room.rewardControls.some(
        (control) =>
          semanticAddressKey(control.owner.address) === semanticAddressKey(sideDoor2Reward),
      ),
    ).toBe(false);

    const restored = applyProjectCommand(inactive, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: sideDoor2,
      generation: 'generated',
    });
    const restoredAssembly = assemble(restored, 'Surface', 'N', nOccurrenceId('combat02')).assembly;
    if (
      restoredAssembly.node.room.roomLocal.kind !== 'ephyra' ||
      restoredAssembly.node.room.roomLocal.sideRooms.kind !== 'published'
    ) {
      throw new Error('restored Ephyra sides are missing');
    }
    const restoredSlot = restoredAssembly.node.room.roomLocal.sideRooms.group.slots.find(
      (slot) => slot.key === 'sideDoor2',
    );
    if (restoredSlot?.generation !== 'generated') {
      throw new Error('restored Ephyra side reward is missing');
    }
    expect(restoredSlot.rewardControl.offer).toEqual({ rewardType: 'AirBoost' });
  });

  it('retains published dormant Fields and Ship controls with their occurrence-owned requirements', () => {
    const fields = assemble(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      createOccurrenceId('golden-h-combat02'),
    ).assembly;
    const ship = assemble(
      createRepresentativeNOPQProject(),
      'Surface',
      'O',
      oOccurrenceIds.combat04,
    ).assembly;

    expect(fields.node.room.roomLocal.kind).toBe('fields');
    if (fields.node.room.roomLocal.kind !== 'fields') throw new Error('Fields surface is missing');
    expect(Object.isFrozen(fields.node.room.roomLocal)).toBe(true);
    expect(Object.isFrozen(fields.node.room.roomLocal.cages)).toBe(true);
    expect(
      fields.node.room.roomLocal.cages.map((cage) => [cage.key, cage.label, cage.active]),
    ).toEqual([
      ['cage1', 'Cage 1', true],
      ['cage2', 'Cage 2', true],
      ['cage3', 'Cage 3', false],
    ]);
    expect(fields.node.room.roomLocal.cages[0]?.control.owner.address).toEqual(
      createLocalRewardAddress(
        goldenHBiome,
        createOccurrenceId('golden-h-combat02'),
        'cages',
        'cage1',
      ),
    );
    expect(
      fields.node.room.roomLocal.cages.every(
        (cage) => Object.isFrozen(cage) && Object.isFrozen(cage.control),
      ),
    ).toBe(true);

    expect(ship.node.room.roomLocal.kind).toBe('ship');
    if (ship.node.room.roomLocal.kind !== 'ship') throw new Error('Ship surface is missing');
    expect(Object.isFrozen(ship.node.room.roomLocal)).toBe(true);
    expect(Object.isFrozen(ship.node.room.roomLocal.wheels)).toBe(true);
    expect(ship.node.room.roomLocal.combatPhaseCount).toBe(2);
    expect(
      ship.node.room.roomLocal.wheels.map((wheel) => [
        wheel.key,
        wheel.label,
        wheel.active,
        wheel.offerCount,
        wheel.pickedOfferIndex,
        wheel.storeKey,
      ]),
    ).toEqual([
      ['wheel1', 'Reward wheel 1', true, 1, 1, 'RunProgress'],
      ['wheel2', 'Reward wheel 2', false, 1, 1, 'RunProgress'],
    ]);
    expect(ship.node.room.roomLocal.wheels[0]?.address).toEqual(
      createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
    );
    expect(ship.node.room.roomLocal.wheels[0]?.offers[0]?.control.owner.address).toEqual(
      createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
    );
    expect(
      ship.node.room.roomLocal.wheels[0]?.offers.map((offer) => [
        offer.key,
        offer.label,
        offer.active,
      ]),
    ).toEqual([
      ['offer1', 'Offer 1', true],
      ['offer2', 'Offer 2', false],
    ]);
    expect(
      ship.node.room.roomLocal.wheels.every(
        (wheel) =>
          Object.isFrozen(wheel) &&
          Object.isFrozen(wheel.offers) &&
          wheel.offers.every((offer) => Object.isFrozen(offer) && Object.isFrozen(offer.control)),
      ),
    ).toBe(true);
    expect(
      ship.occurrenceInteractionRequirements.some(
        (requirement) => requirement.kind === 'shipCombatPhaseCount',
      ),
    ).toBe(true);
  });

  it('keeps a selected Shop editable and withholds retained unpicked Shop inventory', () => {
    const shop = createOccurrenceId('golden-f-preboss-shop');
    const selected = assemble(
      withFPrebossSelection(createGoldenFGHIProject(), 'exit1'),
      'Underworld',
      'F',
      shop,
    ).assembly;
    const dormant = assemble(
      withFPrebossSelection(createGoldenFGHIProject(), 'exit2'),
      'Underworld',
      'F',
      shop,
    ).assembly;

    expect(selected.node.room.roomLocal.kind).toBe('shop');
    if (selected.node.room.roomLocal.kind !== 'shop') throw new Error('selected Shop is missing');
    expect(selected.node.room.roomLocal.materialized).toBe(true);
    expect(Object.isFrozen(selected.node.room.roomLocal)).toBe(true);
    expect(Object.isFrozen(selected.node.room.roomLocal.offers)).toBe(true);
    expect(selected.node.room.roomLocal.purchaseOrder).toEqual([]);
    expect(
      selected.node.room.roomLocal.offers.map((offer) => [
        offer.key,
        offer.label,
        offer.purchase.purchased,
      ]),
    ).toEqual([
      ['Boon', 'Offer 1', false],
      ['MajorNonBoon', 'Offer 2', false],
      ['Minor', 'Offer 3', false],
    ]);
    expect(
      selected.node.room.roomLocal.offers.every(
        (offer) =>
          Object.isFrozen(offer) &&
          Object.isFrozen(offer.purchase) &&
          Object.isFrozen(offer.rewardControl),
      ),
    ).toBe(true);
    expect(selected.occurrenceInteractionRequirements[0]?.kind).toBe('shopPurchaseOrders');
    const selectedOffer = selected.node.room.roomLocal.offers.find(
      (offer) => offer.key === 'MajorNonBoon',
    );
    expect(selectedOffer).toMatchObject({
      label: 'Offer 2',
      purchase: {
        address: createShopPurchaseAddress(goldenFBiome, shop, 'MajorNonBoon'),
        purchased: false,
        position: null,
        toggleOfferKeys: ['MajorNonBoon'],
        positionOptions: [],
        proposalOfferKeys: [[], ['MajorNonBoon']],
      },
      rewardControl: {
        owner: { address: createShopOfferAddress(goldenFBiome, shop, 'MajorNonBoon') },
      },
    });

    expect(dormant.node.room.roomLocal.kind).toBe('shop');
    if (dormant.node.room.roomLocal.kind !== 'shop') throw new Error('dormant Shop is missing');
    expect(dormant.node.room.roomLocal.materialized).toBe(false);
    expect(dormant.occurrenceInteractionRequirements).toHaveLength(0);
  });

  it('publishes fixed Devotion and Story payloads without inventing editable controls', () => {
    const project = createRepresentativeNOPQProject();
    const devotion = assemble(project, 'Surface', 'O', oOccurrenceIds.devotion).assembly.node.room;
    const story = assemble(project, 'Surface', 'P', pOccurrenceId('P_Story01', 7, 1)).assembly.node
      .room;

    expect(devotion.roomLocal.kind).toBe('fixed');
    if (devotion.roomLocal.kind !== 'fixed') throw new Error('Devotion fixed payload is missing');
    expect(devotion.roomLocal.offer).toEqual({
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'AresUpgrade',
        spurnedSource: 'HephaestusUpgrade',
      },
    });
    expect(devotion.roomLocal.control).toMatchObject({
      kind: 'explicitReward',
      owner: { address: createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion) },
      rewardTypes: ['Devotion'],
    });
    expect(story.roomLocal.kind).toBe('fixed');
    if (story.roomLocal.kind !== 'fixed') throw new Error('Story fixed payload is missing');
    expect(story.roomLocal.marker.address).toEqual(
      createIncomingRewardAddress(pBiome, pOccurrenceId('P_Story01', 7, 1)),
    );
    expect(story.roomLocal.control).toBeUndefined();
  });

  it('does not need evaluation entry to preserve authored room-local controls', () => {
    const { assembly } = assemble(
      createRepresentativeNOPQProject(),
      'Surface',
      'N',
      nOccurrenceId('combat05'),
    );
    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));

    expect(assembly.node.room.entered).toBe(false);
    expect(
      assembly.node.room.rewardControls.some(
        (control) => semanticAddressKey(control.owner.address) === semanticAddressKey(incoming),
      ),
    ).toBe(true);
  });
});
