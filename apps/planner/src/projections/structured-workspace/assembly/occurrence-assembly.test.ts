import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createTraitOfferAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  fieldsBatchFacts,
  simulateProjectAssembly,
  type GorgonPhaseCandidateSupport,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { authorRequiredTestRoomActions } from '@run-planner/test-fixtures/shared';
import {
  createGoldenFGHIProject,
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  loadSurfaceNOPProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { assembleWorkspaceOccurrence } from './occurrence-assembly';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from './occurrence-facts';
import { createWorkspaceBiomeMarkerDestinationBuilder } from '../navigation/marker-builder';
import { createWorkspaceProjectSourceIndex } from '../source-index';

function biomeSource(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  gorgonSupport?: (
    phase: import('@run-planner/engine/authored-project').EncounterPhaseAddress,
  ) => GorgonPhaseCandidateSupport | undefined,
) {
  const authoredProject = authorRequiredTestRoomActions(project, catalog);
  const assembly = simulateProjectAssembly(catalog, authoredProject);
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    authoredProject,
    assembly.evaluation,
    (phase) => encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase),
    undefined,
    gorgonSupport,
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
  gorgonSupport?: (
    phase: import('@run-planner/engine/authored-project').EncounterPhaseAddress,
  ) => GorgonPhaseCandidateSupport | undefined,
  derivedAcquisitionEntries?: Parameters<
    typeof assembleWorkspaceOccurrence
  >[0]['derivedAcquisitionEntries'],
  evaluatedRoomTransform?: (
    room: NonNullable<Parameters<typeof assembleWorkspaceOccurrence>[0]['evaluatedRoom']>,
  ) => NonNullable<Parameters<typeof assembleWorkspaceOccurrence>[0]['evaluatedRoom']>,
) {
  const source = biomeSource(project, routeKey, biomeKey, gorgonSupport);
  const occurrence = source.occurrence(occurrenceId);
  if (occurrence === undefined) throw new Error(`${occurrenceId} occurrence is missing`);
  const evaluatedRoom = (() => {
    if (source.entryRoom?.occurrenceId === occurrenceId) return source.entryRoom;
    for (const decision of source.exitDecisions) {
      const batch = source.evaluatedBatch(
        createExitDecisionAddress(source.biome, decision.source),
      )?.batch;
      const room = batch?.targets.find((target) => target.room.occurrenceId === occurrenceId)?.room;
      if (room !== undefined) return room;
    }
    return undefined;
  })();
  const projectedEvaluatedRoom =
    evaluatedRoom === undefined || evaluatedRoomTransform === undefined
      ? evaluatedRoom
      : evaluatedRoomTransform(evaluatedRoom);
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
    encounterPhaseStatus: source.encounterPhaseStatus,
    ...(gorgonSupport === undefined ? {} : { gorgonSupport }),
    ...(fieldsFacts === undefined ? {} : { fieldsBatchFacts: fieldsFacts }),
    facts,
    levelResolutionAssessment: source.levelResolutionAssessment,
    derivedAcquisitionEntries: derivedAcquisitionEntries ?? source.derivedAcquisitionEntries,
    ...(projectedEvaluatedRoom === undefined ? {} : { evaluatedRoom: projectedEvaluatedRoom }),
    markerDestinations: markers.emitter,
    ordinaryRewardForfeited: (owner) => source.ordinaryRewardForfeited(owner.address),
    occurrence,
    runState: source.runState,
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
  it('publishes pending Gorgon support and retains a context-invalid child for repair', () => {
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
      'Combat',
    );
    let project = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    let engineAssembly = simulateProjectAssembly(
      catalog,
      authorRequiredTestRoomActions(project, catalog),
    );
    expect(
      encounterPhaseGorgonSupportForProjectEvaluationAssembly(engineAssembly, phase)?.supported,
    ).toBe(true);
    const support = (
      candidate: import('@run-planner/engine/authored-project').EncounterPhaseAddress,
    ) => encounterPhaseGorgonSupportForProjectEvaluationAssembly(engineAssembly, candidate);
    const pending = assemble(
      project,
      'Surface',
      'P',
      pOccurrenceId('P_Combat12', 8, 1),
      support,
    ).assembly;
    const pendingPhase = pending.node.room.encounterPhases.find(
      (candidate) => candidate.address.phaseKey === 'Combat',
    );
    expect(pendingPhase?.gorgonCondition).toMatchObject({ supported: true, selected: false });
    expect(pendingPhase?.gorgonAthena).toBeUndefined();

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonAthenaOffer',
      trait: createTraitOfferAddress(createGorgonPhaseAddress(phase), 'gorgonAthena'),
      value: {
        traitKeys: [
          'InvulnerabilityDashBoon',
          'RetaliateInvulnerabilityBoon',
          'FocusLastStandBoon',
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'AthenaCombatP',
    });
    engineAssembly = simulateProjectAssembly(
      catalog,
      authorRequiredTestRoomActions(project, catalog),
    );
    const retained = assemble(
      project,
      'Surface',
      'P',
      pOccurrenceId('P_Combat12', 8, 1),
      (candidate) =>
        encounterPhaseGorgonSupportForProjectEvaluationAssembly(engineAssembly, candidate),
    ).assembly.node.room.encounterPhases.find(
      (candidate) => candidate.address.phaseKey === 'Combat',
    );
    expect(retained?.gorgonCondition).toMatchObject({ supported: false, selected: true });
    expect(retained?.gorgonAthena).toMatchObject({
      rarityEditable: false,
      offer: {
        kind: 'traits',
        giverKey: 'Athena',
        selectedOptionKey: 'option1',
      },
    });
    if (retained?.gorgonAthena?.offer?.kind !== 'traits')
      throw new Error('retained Gorgon Athena offer is missing');
    expect(retained.gorgonAthena.offer.options.every((option) => option.rarity === undefined)).toBe(
      true,
    );
  });

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
      loadSurfaceNOPQProject(),
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

  it('publishes the selected Artemis phase offer as an encounter-owned trait control', () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'ArtemisCombatF',
    });
    const assembly = assemble(project, 'Underworld', 'F', goldenFOccurrenceId(5, 1)).assembly;
    const encounter = assembly.node.room.encounterPhases.find(
      (candidate) => candidate.address.phaseKey === 'Encounter',
    );
    expect(encounter?.traitOffer).toMatchObject({
      acquisitionRoleLabel: 'Selection',
      giver: { key: 'Artemis' },
      offer: null,
    });
    expect(encounter?.traitOffer?.address.owner).toEqual(phase);
  });

  it('exposes a picked Arachne Story offer through the direct Encounter surface', () => {
    const occurrenceId = goldenFOccurrenceId(7, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, occurrenceId),
      gameName: 'F_Story01',
    });
    const assembly = assemble(project, 'Underworld', 'F', occurrenceId).assembly;
    const encounter = assembly.node.room.encounterPhases.find(
      (candidate) => candidate.address.phaseKey === 'Encounter',
    );

    expect(encounter).toMatchObject({
      customizable: false,
      selectedEncounter: { key: 'Story_Arachne_01' },
      traitOffer: {
        address: createTraitOfferAddress(phase, 'selection'),
        acquisitionRoleLabel: 'Selection',
        giver: { key: 'Arachne' },
      },
    });
    expect(assembly.node.room.workbench).toMatchObject({
      kind: 'standard',
      encounterPhases: [expect.objectContaining({ traitOffer: encounter?.traitOffer })],
    });
  });

  it('retains published dormant Fields and Ship controls with their occurrence-owned requirements', () => {
    const fields = assemble(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      createOccurrenceId('golden-h-combat02'),
    ).assembly;
    const ship = assemble(
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      oOccurrenceIds.combat04,
    ).assembly;

    expect(fields.node.room.roomLocal.kind).toBe('fields');
    if (fields.node.room.roomLocal.kind !== 'fields') throw new Error('Fields surface is missing');
    expect(Object.isFrozen(fields.node.room.roomLocal)).toBe(true);
    expect(Object.isFrozen(fields.node.room.roomLocal.cages)).toBe(true);
    expect(fields.node.room.roomLocal.cages.map((cage) => [cage.key, cage.label])).toEqual([
      ['cage1', 'Cage 1'],
      ['cage2', 'Cage 2'],
    ]);
    expect(fields.node.room.roomLocal.cages[0]?.control.owner.address).toEqual(
      createLocalRewardAddress(
        goldenHBiome,
        createOccurrenceId('golden-h-combat02'),
        'cages',
        'cage1',
      ),
    );
    const dormantCage = createLocalRewardAddress(
      goldenHBiome,
      createOccurrenceId('golden-h-combat02'),
      'cages',
      'cage3',
    );
    expect(
      fields.node.room.rewardControls.some(
        (control) => semanticAddressKey(control.owner.address) === semanticAddressKey(dormantCage),
      ),
    ).toBe(false);
    expect(
      fields.node.room.localDetailMarkers.some(
        (marker) => semanticAddressKey(marker.address) === semanticAddressKey(dormantCage),
      ),
    ).toBe(false);
    expect(fields.node.room.localDetailMarkers).toContain(
      fields.node.room.roomLocal.cages[0]?.control.marker,
    );
    expect(fields.node.room.workbench).toMatchObject({
      kind: 'fields',
      fields: fields.node.room.roomLocal,
    });
    expect(
      fields.node.room.roomLocal.cages.every(
        (cage) => Object.isFrozen(cage) && Object.isFrozen(cage.control),
      ),
    ).toBe(true);
    const roomActions = fields.node.room.roomActions;
    if (roomActions === undefined) throw new Error('Fields room actions are withheld');
    expect(roomActions.rows.map((row) => row.reference.kind)).toEqual([
      'completeFieldsCage',
      'interactLocalReward',
      'completeFieldsCage',
      'interactLocalReward',
      'interactLocalReward',
      'interactLocalReward',
    ]);
    const cageOne = roomActions.rows.find(
      (row) =>
        row.reference.kind === 'interactLocalReward' &&
        row.reference.groupKey === 'cages' &&
        row.reference.slotKey === 'cage1',
    );
    expect(cageOne?.rewardPayload?.control.owner.address).toEqual(
      createLocalRewardAddress(
        goldenHBiome,
        createOccurrenceId('golden-h-combat02'),
        'cages',
        'cage1',
      ),
    );
    expect(cageOne?.rewardPayload?.showOffer).toBe(false);
    expect(
      roomActions.rows.find(
        (row) => row.reference.kind === 'interactLocalReward' && row.reference.groupKey !== 'cages',
      )?.rewardPayload?.showOffer,
    ).toBe(false);
    expect(roomActions.proposals.length).toBeGreaterThan(0);
    expect(fields.node.room.localDetailMarkers).toContain(roomActions.rows[0]?.marker);
    expect(fields.occurrenceInteractionRequirements).toContainEqual(
      expect.objectContaining({
        kind: 'roomActions',
        owner: fields.node.room.address,
      }),
    );
    const fieldsEntry = roomActions.timeline.entries.find(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'roomEntered',
    );
    expect(fieldsEntry?.kind === 'boundary' && fieldsEntry.runState).toMatchObject({
      availability: 'available',
      owner: { kind: 'roomRunStateCheckpoint', checkpoint: { kind: 'roomEntered' } },
    });
    expect(fields.node.room.beforeExitRunState).toMatchObject({
      availability: 'available',
      owner: { kind: 'roomRunStateCheckpoint', checkpoint: { kind: 'beforeRoomExit' } },
    });
    expect(fields.runStateLaunchers).toHaveLength(2);

    expect(ship.node.room.roomLocal.kind).toBe('ship');
    if (ship.node.room.roomLocal.kind !== 'ship') throw new Error('Ship surface is missing');
    expect(Object.isFrozen(ship.node.room.roomLocal)).toBe(true);
    expect(Object.isFrozen(ship.node.room.roomLocal.wheels)).toBe(true);
    expect(ship.node.room.roomLocal.combatPhaseCount).toBe(2);
    expect(
      ship.node.room.roomLocal.wheels.map((wheel) => [
        wheel.key,
        wheel.encounterPhaseKey,
        wheel.label,
        wheel.active,
        wheel.offerCount,
        wheel.pickedOfferIndex,
        wheel.storeKey,
      ]),
    ).toEqual([
      ['wheel1', 'Combat1', 'Combat 1 reward', true, 1, 1, 'RunProgress'],
      ['wheel2', 'Combat2', 'Combat 2 reward', false, 1, 1, 'RunProgress'],
    ]);
    expect(ship.node.room.roomLocal.wheels[0]?.address).toEqual(
      createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
    );
    expect(ship.node.room.localDetailMarkers).toContain(ship.node.room.roomLocal.wheels[0]?.marker);
    expect(ship.node.room.workbench).toMatchObject({
      kind: 'ship',
      combatPhaseCount: 2,
      phases: [
        expect.objectContaining({
          key: 'Intro',
          label: 'Intro',
          wheel: ship.node.room.roomLocal.wheels[0],
        }),
        expect.objectContaining({
          key: 'Combat1',
          label: 'Combat 1',
        }),
      ],
      repairRows: [],
    });
    if (ship.node.room.workbench.kind !== 'ship') throw new Error('Ship workbench is missing');
    expect(ship.node.room.workbench.phases[1]?.wheel).toBeUndefined();
    const shipActions = ship.node.room.roomActions;
    if (shipActions === undefined) throw new Error('Ship room actions are withheld');
    expect(
      ship.node.room.workbench.phases.flatMap((phase) => phase.actionRows.map((row) => row.key)),
    ).toEqual(shipActions.rows.filter((row) => !row.stale).map((row) => row.key));
    expect(
      ship.node.room.workbench.phases.flatMap((phase) =>
        phase.checkpoints.map((checkpoint) => checkpoint.key),
      ),
    ).toEqual(
      expect.arrayContaining(
        shipActions.checkpoints
          .filter((checkpoint) => checkpoint.key !== 'exitUsable')
          .map((checkpoint) => checkpoint.key),
      ),
    );
    expect(
      ship.node.room.workbench.phases.flatMap((phase) =>
        phase.checkpoints.map((checkpoint) => checkpoint.key),
      ),
    ).toHaveLength(
      shipActions.checkpoints.filter((checkpoint) => checkpoint.key !== 'exitUsable').length,
    );
    expect(
      ship.node.room.workbench.phases
        .find((phase) => phase.key === 'Intro')
        ?.checkpoints.map((checkpoint) => checkpoint.key),
    ).not.toContain('outgoingGeneration');
    expect(
      ship.node.room.workbench.phases
        .find((phase) => phase.key === 'Combat1')
        ?.checkpoints.map((checkpoint) => checkpoint.key),
    ).toContain('outgoingGeneration');
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
    const shipBoundaryLaunchers = shipActions.timeline.entries.flatMap((entry) =>
      entry.kind === 'boundary' && entry.runState !== undefined ? [entry.runState] : [],
    );
    expect(shipBoundaryLaunchers.map((launcher) => launcher.owner)).toEqual(
      ship.node.room.encounterPhases.map((phase) => ({
        kind: 'roomRunStateCheckpoint',
        routeKey: oBiome.routeKey,
        biomeKey: oBiome.biomeKey,
        occurrenceId: oOccurrenceIds.combat04,
        checkpoint: { kind: 'beforeEncounterStart', phaseKey: phase.address.phaseKey },
      })),
    );
    expect(ship.runStateLaunchers).toHaveLength(ship.node.room.encounterPhases.length + 1);
    expect(
      ship.runStateLaunchers.some(
        (launcher) =>
          launcher.owner.kind === 'roomRunStateCheckpoint' &&
          launcher.owner.checkpoint.kind === 'roomEntered',
      ),
    ).toBe(false);
  });

  it('derives a three-phase Ship presentation and places outgoing generation in Combat 2', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const ship = assemble(project, 'Surface', 'O', oOccurrenceIds.combat07).assembly.node.room;
    if (ship.roomLocal.kind !== 'ship' || ship.workbench.kind !== 'ship') {
      throw new Error('Three-phase Ship workbench is missing');
    }

    expect(ship.roomLocal.phases).toEqual([
      { key: 'Intro', label: 'Intro' },
      { key: 'Combat1', label: 'Combat 1', rewardWheelKey: 'wheel1' },
      { key: 'Combat2', label: 'Combat 2', rewardWheelKey: 'wheel2' },
    ]);
    expect(ship.workbench.phases.map((phase) => [phase.key, phase.label])).toEqual([
      ['Intro', 'Intro'],
      ['Combat1', 'Combat 1'],
      ['Combat2', 'Combat 2'],
    ]);
    expect(ship.workbench.phases.map((phase) => phase.wheel?.key)).toEqual([
      'wheel1',
      'wheel2',
      undefined,
    ]);
    expect(
      ship.workbench.phases
        .find((phase) => phase.key === 'Combat1')
        ?.checkpoints.map((checkpoint) => checkpoint.key),
    ).not.toContain('outgoingGeneration');
    expect(
      ship.workbench.phases
        .find((phase) => phase.key === 'Combat2')
        ?.checkpoints.map((checkpoint) => checkpoint.key),
    ).toContain('outgoingGeneration');
  });

  it.each([
    {
      name: 'before-combat standard',
      window: { kind: 'standard' as const, phase: 'beforeCombat' as const },
    },
    {
      name: 'Fields',
      window: { kind: 'fields' as const, phaseKey: 'Combat1' },
    },
  ])('keeps the engine timeline authoritative for a $name checkpoint window', ({ window }) => {
    const assembled = assemble(
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      oOccurrenceIds.combat04,
      undefined,
      undefined,
      (evaluatedRoom) => {
        const roster = evaluatedRoom.roomActionRoster;
        if (roster === undefined || roster.checkpoints[0] === undefined) {
          throw new Error('Ship Room Action checkpoint is missing');
        }
        return {
          ...evaluatedRoom,
          roomActionRoster: {
            ...roster,
            checkpoints: [{ ...roster.checkpoints[0], window }, ...roster.checkpoints.slice(1)],
          },
        };
      },
    ).assembly.node.room;
    expect(assembled.workbench.kind).toBe('ship');
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
    expect(selected.node.room.roomLocal.offers.map((offer) => [offer.key, offer.label])).toEqual([
      ['Boon', 'Offer 1'],
      ['MajorNonBoon', 'Offer 2'],
      ['Minor', 'Offer 3'],
    ]);
    expect(
      selected.node.room.roomLocal.offers.every(
        (offer) =>
          Object.isFrozen(offer) &&
          Object.isFrozen(offer.purchase) &&
          Object.isFrozen(offer.rewardControl),
      ),
    ).toBe(true);
    expect(selected.occurrenceInteractionRequirements).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'roomActions' })]),
    );
    const selectedOffer = selected.node.room.roomLocal.offers.find(
      (offer) => offer.key === 'MajorNonBoon',
    );
    expect(selectedOffer).toMatchObject({
      label: 'Offer 2',
      purchase: {
        address: createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(createOccurrenceAddress(goldenFBiome, shop), 'roomExit'),
          'MajorNonBoon',
        ),
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

  it('projects a reached Gold duplicate as one supplemental row and ordered peer pickup', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenFBiome, shopId),
      'roomExit',
    );
    let project = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const initialOccurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    const source =
      initialOccurrence?.state.kind === 'shop'
        ? initialOccurrence.state.shop?.offers.Boon
        : undefined;
    if (source === undefined) throw new Error('selected Shop Boon is missing');
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectDerivedShopEntry',
      site,
      entryKey: 'echoDoubleShopReward',
      sourceOfferKey: 'Boon',
    });
    const duplicate = createAcquisitionEntryAddress(site, 'echoDoubleShopReward');
    const projected = assemble(project, 'Underworld', 'F', shopId, undefined, (candidateSite) =>
      semanticAddressKey(candidateSite) !== semanticAddressKey(site)
        ? []
        : [
            {
              address: duplicate,
              kind: 'echoDoubleShopReward' as const,
              sourceOfferKey: 'Boon',
              rewardTypes: ['RandomLoot'],
              eligibleSourceOfferKeys: ['Minor', 'Boon', 'MajorNonBoon'],
            },
          ],
    );
    const result = projected.assembly;

    const actions = result.node.room.roomActions;
    if (actions === undefined) throw new Error('Shop room actions are withheld');
    const derived = actions.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.siteKey === 'roomExit' &&
        row.reference.entryKey === 'echoDoubleShopReward',
    );
    expect(derived).toMatchObject({
      reference: {
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: 'echoDoubleShopReward',
      },
    });
    expect(derived?.rewardPayload?.control).toMatchObject({
      kind: 'explicitReward',
      owner: { kind: 'acquisitionEntry', address: duplicate },
    });
    expect(result.node.room.roomLocal.kind).toBe('shop');
    if (result.node.room.roomLocal.kind !== 'shop') throw new Error('Shop summary is missing');
    expect(result.node.room.roomLocal.supplementalOffers).toContainEqual(
      expect.objectContaining({
        kind: 'echoDoubleShopReward',
        sourceOfferKey: 'Boon',
        rewardControl: expect.objectContaining({
          kind: 'explicitReward',
          owner: { kind: 'acquisitionEntry', address: duplicate },
          rewardTypes: ['RandomLoot'],
        }),
      }),
    );
    expect(result.occurrenceInteractionRequirements).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'roomActions' })]),
    );
    expect(
      result.occurrenceInteractionRequirements.filter(
        (requirement) => requirement.kind === 'shopPurchaseParticipation',
      ),
    ).toHaveLength(3);
    expect(projected.markers.destinations().get(semanticAddressKey(duplicate))).toMatchObject({
      ownerAddress: duplicate,
      focusAddress: duplicate,
      nodeKey: result.node.key,
    });
  });

  it('projects active Contract and generated Travel rows but never the disabled placeholder', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const project = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const shopOccurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    const shop = shopOccurrence?.state.kind === 'shop' ? shopOccurrence.state.shop : undefined;
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenFBiome, shopId),
      'roomExit',
    );
    if (shop === undefined) throw new Error('Gate B Shop state is missing');
    const contractAddress = createAcquisitionEntryAddress(site, 'infernalContractReward');
    const travelAddress = createAcquisitionEntryAddress(site, 'travelDealRefill');
    const projectWith = (entries: Parameters<typeof assemble>[5]) =>
      assemble(project, 'Underworld', 'F', shopId, undefined, entries).assembly.node.room.roomLocal;

    const contractOnly = projectWith((candidateSite) =>
      semanticAddressKey(candidateSite) !== semanticAddressKey(site)
        ? []
        : [
            {
              address: contractAddress,
              kind: 'infernalContractReward' as const,
              rewardTypes: ['BlindBoxLoot', 'StackUpgrade'],
            },
          ],
    );
    expect(contractOnly).toMatchObject({
      kind: 'shop',
      supplementalOffers: [
        {
          kind: 'infernalContractReward',
          rewardControl: { rewardTypes: ['BlindBoxLoot', 'StackUpgrade'] },
        },
      ],
    });

    const placeholder = projectWith((candidateSite) =>
      semanticAddressKey(candidateSite) !== semanticAddressKey(site)
        ? []
        : [
            {
              address: contractAddress,
              kind: 'infernalContractReward' as const,
              rewardTypes: ['BlindBoxLoot', 'StackUpgrade'],
            },
            { address: travelAddress, kind: 'travelDealPlaceholder' as const },
          ],
    );
    expect(placeholder).toMatchObject({
      kind: 'shop',
      supplementalOffers: [{ kind: 'travelDealPlaceholder' }, { kind: 'infernalContractReward' }],
    });

    const active = projectWith((candidateSite) =>
      semanticAddressKey(candidateSite) !== semanticAddressKey(site)
        ? []
        : [
            {
              address: contractAddress,
              kind: 'infernalContractReward' as const,
              rewardTypes: ['BlindBoxLoot', 'StackUpgrade'],
            },
            {
              address: travelAddress,
              kind: 'travelDealRefill' as const,
              sourceOfferKey: 'MajorNonBoon',
              slotIndex: 1,
              rewardTypes: ['WeaponUpgradeDrop', 'MaxHealthDrop'],
            },
          ],
    );
    expect(active).toMatchObject({
      kind: 'shop',
      supplementalOffers: [
        {
          kind: 'travelDealRefill',
          sourceOfferKey: 'MajorNonBoon',
          rewardControl: { rewardTypes: ['WeaponUpgradeDrop', 'MaxHealthDrop'] },
        },
        { kind: 'infernalContractReward' },
      ],
    });
  });

  it('retains an inactive unranked Infernal Contract action for repair', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const project = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const room = assemble(project, 'Underworld', 'F', shopId, undefined, () => Object.freeze([]))
      .assembly.node.room;
    const isContract = (
      reference: import('@run-planner/engine/authored-project').RoomActionReference,
    ) =>
      reference.kind === 'interactAcquisitionEntry' &&
      reference.entryKey === 'infernalContractReward';

    expect(room.roomActions?.rows.some((row) => isContract(row.reference))).toBe(true);
    expect(room.roomActions?.repairRows.some((row) => isContract(row.reference))).toBe(true);
    expect(room.roomActions?.proposals.some((proposal) => isContract(proposal.reference))).toBe(
      true,
    );
  });

  it('projects a Gold duplicate ordered after its Travel refill source', () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const base = withFPrebossSelection(createGoldenFGHIProject(), 'exit1');
    const occurrenceAddress = createOccurrenceAddress(goldenFBiome, shopId);
    const site = createAcquisitionSiteAddress(occurrenceAddress, 'roomExit');
    const occurrence = base.routes
      .flatMap((route) => route.biomes)
      .find((plan) => plan.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    const source =
      occurrence?.state.kind === 'shop' ? occurrence.state.shop?.offers.Boon?.reward : undefined;
    if (source === undefined) throw new Error('F Preboss Boon default is missing');
    const duplicate = createAcquisitionEntryAddress(site, 'echoDoubleShopReward');
    const project: ProjectDocument = {
      ...base,
      routes: base.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((biome): typeof biome => {
                const topology = biome.topology;
                return biome.biomeKey !== 'F' || topology === null
                  ? biome
                  : {
                      ...biome,
                      topology: {
                        ...topology,
                        occurrences: topology.occurrences.map((candidate): typeof candidate =>
                          candidate.occurrenceId !== shopId
                            ? candidate
                            : {
                                ...candidate,
                                roomActions: {
                                  order: [
                                    { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
                                    {
                                      kind: 'interactAcquisitionEntry',
                                      siteKey: 'roomExit',
                                      entryKey: 'travelDealRefill',
                                    },
                                    {
                                      kind: 'interactAcquisitionEntry',
                                      siteKey: 'roomExit',
                                      entryKey: 'echoDoubleShopReward',
                                    },
                                  ],
                                },
                                acquisitionSites: {
                                  ...(candidate.acquisitionSites ?? {}),
                                  roomExit: {
                                    pickupEntries: {
                                      travelDealRefill: source,
                                      echoDoubleShopReward: source,
                                    },
                                  },
                                },
                              },
                        ),
                      },
                    };
              }),
            },
      ),
    };
    const result = assemble(project, 'Underworld', 'F', shopId, undefined, (candidateSite) =>
      semanticAddressKey(candidateSite) !== semanticAddressKey(site)
        ? []
        : [
            {
              address: createAcquisitionEntryAddress(site, 'travelDealRefill'),
              kind: 'travelDealRefill' as const,
              sourceOfferKey: 'MajorNonBoon',
              slotIndex: 1,
              rewardTypes: ['RandomLoot'],
            },
            {
              address: duplicate,
              kind: 'echoDoubleShopReward' as const,
              sourceOfferKey: 'travelDealRefill',
              rewardTypes: ['RandomLoot'],
              eligibleSourceOfferKeys: ['travelDealRefill'],
            },
          ],
    ).assembly.node.room;
    expect(
      result.roomActions?.rows.flatMap((row) => {
        if (row.rank === null) return [];
        if (row.reference.kind === 'interactShopOffer') return [row.reference.offerKey];
        if (row.reference.kind === 'interactAcquisitionEntry') return [row.reference.entryKey];
        return [];
      }),
    ).toEqual(['MajorNonBoon', 'travelDealRefill', 'echoDoubleShopReward']);
  });

  it('projects the active Narcissus reward editor before its independent pickup choice', () => {
    const project = createGoldenFGHIProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    const result = assemble(project, 'Underworld', 'G', occurrence.occurrenceId).assembly;
    const action = result.node.room.roomActions?.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' && row.reference.entryKey === 'pom',
    );
    expect(action?.rewardPayload?.control).toMatchObject({
      kind: 'explicitReward',
      offer: { rewardType: 'StoreRewardRandomStack' },
      rewardTypes: ['StoreRewardRandomStack'],
    });
    expect(result.occurrenceInteractionRequirements).toContainEqual(
      expect.objectContaining({ kind: 'roomActions' }),
    );
  });

  it('projects Psyche and Max Magick as distinct Narcissus action payloads', () => {
    let project = createCompleteFGProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenGBiome,
          { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Narcissus',
        options: [
          { traitKey: 'NarcissusD' },
          { traitKey: 'NarcissusB' },
          { traitKey: 'NarcissusE' },
        ],
        selectedOptionKey: 'option1',
        deathDefianceConditionMet: false,
      },
    });
    const actions = assemble(project, 'Underworld', 'G', occurrence.occurrenceId).assembly.node.room
      .roomActions;
    expect(
      actions?.rows
        .filter((row) => row.reference.kind === 'interactAcquisitionEntry')
        .map((row) => [
          row.reference.kind === 'interactAcquisitionEntry' ? row.reference.entryKey : '',
          row.label,
        ])
        .sort(([left], [right]) => left!.localeCompare(right!)),
    ).toEqual([
      ['maxMana', 'Pick up Max Magick'],
      ['psyche', 'Pick up Psyche'],
    ]);
    expect(
      actions?.rows
        .flatMap((row) =>
          row.reference.kind === 'interactAcquisitionEntry'
            ? [[row.reference.entryKey, row.rewardPayload?.control.offer] as const]
            : [],
        )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, offer]) => offer),
    ).toEqual([{ rewardType: 'MaxManaDrop' }, { rewardType: 'MemPointsCommonDrop' }]);
  });

  it('projects one picked Narcissus pickup with its fixed type and unresolved payload', () => {
    let project = createCompleteFGProject();
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
    if (occurrence === undefined) throw new Error('Golden G has no Narcissus story');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenGBiome,
          { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Narcissus',
        options: [
          { traitKey: 'NarcissusI' },
          { traitKey: 'NarcissusB' },
          { traitKey: 'NarcissusC' },
        ],
        selectedOptionKey: 'option1',
        deathDefianceConditionMet: false,
      },
    });
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
      'roomExit',
    );
    const result = assemble(project, 'Underworld', 'G', occurrence.occurrenceId).assembly;
    const entry = result.node.room.roomActions?.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.entryKey === 'mysteryBoon',
    );
    expect(entry?.rewardPayload?.control).toMatchObject({
      owner: {
        kind: 'acquisitionEntry',
        address: createAcquisitionEntryAddress(site, 'mysteryBoon'),
      },
      offer: null,
      rewardTypes: ['BlindBoxLoot'],
      authoringStartStep: 'source',
      authoringSeed: { rewardType: 'BlindBoxLoot' },
    });
    expect(entry?.rewardPayload?.control.traitOffers).toEqual([]);
  });

  it('publishes fixed Devotion and Story payloads without inventing editable controls', () => {
    const project = loadSurfaceNOPQProject();
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

  it('projects the applicable Shop condition as one repairable occurrence capability', () => {
    const project = createGoldenFGHIProject();
    const shopOccurrence = project.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.gameName === 'I_PreBoss02');
    if (shopOccurrence === undefined) throw new Error('missing I shop fixture');
    const assembled = assemble(
      project,
      'Underworld',
      goldenIBiome.biomeKey,
      shopOccurrence.occurrenceId,
    ).assembly;
    expect(assembled.node.room.roomLocal).toMatchObject({
      kind: 'shop',
      deathDefianceCondition: { value: false },
    });
    expect(assembled.occurrenceInteractionRequirements).toContainEqual({
      kind: 'shopDeathDefianceCondition',
      owner: expect.objectContaining({ occurrenceId: shopOccurrence.occurrenceId }),
      value: false,
    });
  });

  it('does not need evaluation entry to preserve authored room-local controls', () => {
    const { assembly } = assemble(
      loadSurfaceNOPQProject(),
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
