import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  semanticAddressKey,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type {
  Catalog,
  CatalogCollection,
  EncounterDefinition,
  EncounterSet,
} from '@run-planner/engine/catalog-schema';
import {
  createEncounterCommandAuthorization,
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
  type CanonicalAuthoredRoom,
  type EncounterHistoryEntry,
  type HistoryStateView,
  type RoomAppearanceHistoryEntry,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
  nBiome,
  nOccurrenceId,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  createRepresentativeNOPQProject,
  oBiome,
} from '@run-planner/test-fixtures';
import { prepareRoomEncounterPhases } from '../../src/simulation/encounters/preparation';

function phase(biome: BiomeAddress, occurrenceId: OccurrenceId, phaseKey = 'Encounter') {
  return createEncounterPhaseAddress(biome, { kind: 'occurrence', occurrenceId }, phaseKey);
}

function support(project: ProjectDocument, owner: ReturnType<typeof phase>) {
  return encounterPhaseCandidateSupportForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, project),
    owner,
  );
}

function select(project: ProjectDocument, owner: ReturnType<typeof phase>, encounterKey: string) {
  const assembly = simulateProjectAssembly(catalog, project);
  return applyProjectCommand(
    project,
    catalog,
    { kind: 'SelectEncounter', phase: owner, encounterKey },
    { encounterAuthorization: createEncounterCommandAuthorization(catalog, assembly) },
  );
}

function evaluatedBiome(project: ProjectDocument, biomeKey: 'F' | 'G') {
  const result = simulateProject(catalog, project);
  const biome = result.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome?.authoring !== 'complete') {
    throw new Error(`${biomeKey} did not produce a complete evaluated biome`);
  }
  return { result, biome };
}

function evaluatedSurfaceBiome(project: ProjectDocument, biomeKey: 'N' | 'O' | 'P') {
  const result = simulateProject(catalog, project);
  const biome = result.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome?.authoring !== 'complete') {
    throw new Error(`${biomeKey} did not produce a complete evaluated biome`);
  }
  return { result, biome };
}

function authoredOccurrence(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: OccurrenceId,
) {
  const occurrence = project.routes
    .flatMap((route) => route.biomes)
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) {
    throw new Error(`missing ${biomeKey} occurrence ${occurrenceId}`);
  }
  return occurrence;
}

function replaceCollectionEntry<T extends { readonly key: string }>(
  collection: CatalogCollection<T>,
  replacement: T,
): CatalogCollection<T> {
  return Object.freeze({
    values: Object.freeze(
      collection.values.map((entry) => (entry.key === replacement.key ? replacement : entry)),
    ),
    byKey: Object.freeze({ ...collection.byKey, [replacement.key]: replacement }),
  });
}

function historyProbeCatalog(): Catalog {
  const ordinaryCombat = catalog.encounterDefinitions.byKey.GeneratedO;
  const defaultSet = catalog.encounterSets.byKey.OEncountersDefault;
  if (ordinaryCombat === undefined || defaultSet === undefined) {
    throw new Error('O encounter declarations are missing');
  }
  const selfRecordGuard = Object.freeze<EncounterDefinition>({
    ...ordinaryCombat,
    requirements: Object.freeze({
      kind: 'encounterKeyCount',
      scope: 'route',
      encounterKeys: Object.freeze(['GeneratedO_Intro01']),
      range: Object.freeze({ max: 0 }),
    }),
  });
  const previousRoomProbe = Object.freeze<EncounterDefinition>({
    key: 'PreviousRoomProbe',
    label: 'Previous room probe',
    kind: 'combat',
    countsEncounterDepth: true,
    requirements: Object.freeze({
      kind: 'all',
      requirements: Object.freeze([
        Object.freeze({
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: Object.freeze(['ArachneCombatF']),
          roomWindow: 5,
          range: Object.freeze({ max: 0 }),
        }),
        Object.freeze({
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: Object.freeze(['GeneratedO_Intro01']),
          roomWindow: 5,
          range: Object.freeze({ max: 0 }),
        }),
      ]),
    }),
  });
  const probeSet = Object.freeze<EncounterSet>({
    ...defaultSet,
    encounterDefinitionKeys: Object.freeze(['GeneratedO', 'PreviousRoomProbe']),
  });
  const encounterDefinitions = replaceCollectionEntry(
    catalog.encounterDefinitions,
    selfRecordGuard,
  );
  return Object.freeze({
    ...catalog,
    encounterDefinitions: Object.freeze({
      values: Object.freeze([...encounterDefinitions.values, previousRoomProbe]),
      byKey: Object.freeze({
        ...encounterDefinitions.byKey,
        [previousRoomProbe.key]: previousRoomProbe,
      }),
    }),
    encounterSets: replaceCollectionEntry(catalog.encounterSets, probeSet),
  });
}

function oCombatPreparationFixture(): {
  readonly preparation: HistoryStateView;
  readonly room: CanonicalAuthoredRoom;
} {
  const result = simulateProject(catalog, createRepresentativeNOPQProject());
  const biome = result.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'O');
  if (biome?.authoring !== 'complete') {
    throw new Error('O did not produce a complete history fixture');
  }
  const firstDecision = biome.snapshot.decisions[0];
  if (firstDecision?.kind !== 'batch') {
    throw new Error('O fixture lost its opening batch');
  }
  const room = firstDecision.targets[0]?.room;
  if (room === undefined) {
    throw new Error('O fixture lost its first combat room');
  }
  const preparation = biome.history.rooms.find(
    (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
  )?.preparation;
  if (preparation === undefined) {
    throw new Error('O fixture lost its first combat preparation');
  }
  return Object.freeze({ preparation, room });
}

function predecessorWindow(preparation: HistoryStateView, count: number): HistoryStateView {
  const origins = Array.from({ length: count }, (_, index) =>
    createOccurrenceAddress(oBiome, createOccurrenceId(`npc-spacing-predecessor-${index + 1}`)),
  );
  const firstOrigin = origins[0];
  if (firstOrigin === undefined) throw new Error('spacing fixture needs one predecessor');
  const appearances: readonly RoomAppearanceHistoryEntry[] = Object.freeze(
    origins.map((origin, index) =>
      Object.freeze({
        sequence: preparation.sequence + index + 1,
        origin,
        gameName: 'O_Combat01',
      }),
    ),
  );
  const arachneRecord: EncounterHistoryEntry = Object.freeze({
    sequence: preparation.sequence + 1,
    origin: firstOrigin,
    gameName: 'O_Combat01',
    encounterEnvelopeKey: 'ShipEncounter',
    slotKey: 'Combat1',
    encounterKey: 'ArachneCombatF',
    phaseKind: 'combat',
  });
  return Object.freeze({
    sequence: preparation.sequence,
    ledgers: Object.freeze({
      ...preparation.ledgers,
      encounterRecords: Object.freeze([arachneRecord]),
      roomAppearances: appearances,
    }),
  });
}

function combatOneCandidates(
  room: CanonicalAuthoredRoom,
  preparation: HistoryStateView,
): readonly string[] {
  const candidate = prepareRoomEncounterPhases(
    historyProbeCatalog(),
    room,
    preparation,
  ).candidates.find((phase) => phase.origin.phaseKey === 'Combat1');
  if (candidate === undefined) throw new Error('O Combat1 candidate support is missing');
  return candidate.candidateEncounterKeys;
}

describe('field NPC encounter requirements', () => {
  const fNpcPhase = phase(goldenFBiome, goldenFOccurrenceId(5, 1));
  const gNpcPhase = phase(goldenGBiome, goldenGOccurrenceId(4, 1));

  it('makes Artemis route-exclusive while retaining a downstream selected invalid choice', () => {
    let project = createCompleteFGProject();

    expect(support(project, fNpcPhase)?.candidateEncounterKeys).toContain('ArtemisCombatF');
    expect(support(project, gNpcPhase)?.candidateEncounterKeys).toContain('ArtemisCombatG');

    project = select(project, gNpcPhase, 'ArtemisCombatG');
    expect(support(project, fNpcPhase)?.candidateEncounterKeys).toContain('ArtemisCombatF');

    project = select(project, fNpcPhase, 'ArtemisCombatF');
    const gSupport = support(project, gNpcPhase);

    expect(gSupport).toMatchObject({
      active: true,
      selectedEncounterKey: 'ArtemisCombatG',
      selectedPossible: false,
    });
    expect(gSupport?.candidateEncounterKeys).not.toContain('ArtemisCombatG');

    const { result, biome } = evaluatedBiome(project, 'G');
    expect(result.status).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'encounterUnavailable',
        origin: gNpcPhase,
      }),
    );
  });

  it('keeps Arachne non-counting, biome-scoped, and eligible again in G after its five-room gap', () => {
    const fArachnePhase = fNpcPhase;
    const gArachnePhase = phase(goldenGBiome, goldenGOccurrenceId(2, 1));
    const laterGPhase = gNpcPhase;
    let project = createCompleteFGProject();

    expect(support(project, fArachnePhase)?.candidateEncounterKeys).toContain('ArachneCombatF');
    project = select(project, fArachnePhase, 'ArachneCombatF');

    const { biome: f } = evaluatedBiome(project, 'F');
    const fRoom = f.history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(5, 1))),
    );
    if (fRoom?.postCommit === undefined) {
      throw new Error('F Arachne room lost its completed history view');
    }
    expect(fRoom.postCommit.ledgers.counters.biomeEncounterDepth).toBe(
      fRoom.entry.ledgers.counters.biomeEncounterDepth,
    );

    expect(support(project, gArachnePhase)?.candidateEncounterKeys).toContain('ArachneCombatG');
    project = select(project, gArachnePhase, 'ArachneCombatG');
    expect(support(project, gArachnePhase)).toMatchObject({
      selectedEncounterKey: 'ArachneCombatG',
      selectedPossible: true,
    });
    expect(support(project, laterGPhase)?.candidateEncounterKeys).not.toContain('ArachneCombatG');
    const evaluation = evaluatedBiome(project, 'G');
    expect(evaluation.biome.findings).not.toContainEqual(
      expect.objectContaining({ code: 'encounterUnavailable', origin: gArachnePhase }),
    );
  });

  it('applies exact predecessor-room spacing without treating an earlier current-room phase as a predecessor', () => {
    const { preparation, room } = oCombatPreparationFixture();

    const insideFive = combatOneCandidates(room, predecessorWindow(preparation, 5));
    expect(insideFive).not.toContain('PreviousRoomProbe');
    expect(insideFive).not.toContain('GeneratedO');

    const outsideFive = combatOneCandidates(room, predecessorWindow(preparation, 6));
    expect(outsideFive).toContain('PreviousRoomProbe');
    expect(outsideFive).not.toContain('GeneratedO');
  });

  it('keeps Heracles O counting without terminating the Ship suffix, while Icarus excludes its later same-room slot', () => {
    const occurrenceId = oOccurrenceIds.combat01;
    const room = createOccurrenceAddress(oBiome, occurrenceId);
    const intro = phase(oBiome, occurrenceId, 'Intro');
    const combat1 = phase(oBiome, occurrenceId, 'Combat1');
    const combat2 = phase(oBiome, occurrenceId, 'Combat2');
    const withThreePhases = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: room,
      encounterCount: 3,
    });
    const originalState = authoredOccurrence(withThreePhases, 'O', occurrenceId).state;

    expect(support(withThreePhases, intro)?.candidateEncounterKeys).toContain('HeraclesCombatO');
    expect(support(withThreePhases, combat1)?.candidateEncounterKeys).toContain('IcarusCombatO');

    let project = select(withThreePhases, intro, 'HeraclesCombatO');
    expect(support(project, combat1)?.candidateEncounterKeys).toContain('IcarusCombatO');

    project = select(project, combat1, 'IcarusCombatO');
    expect(support(project, combat2)?.candidateEncounterKeys).not.toContain('IcarusCombatO');
    expect(authoredOccurrence(project, 'O', occurrenceId).state).toEqual(originalState);

    const ordinary = evaluatedSurfaceBiome(withThreePhases, 'O').biome.history.rooms.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room),
    );
    const selected = evaluatedSurfaceBiome(project, 'O').biome.history.rooms.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room),
    );
    if (
      ordinary === undefined ||
      selected === undefined ||
      ordinary.postCommit === undefined ||
      selected.postCommit === undefined
    ) {
      throw new Error('O fixture lost its selected Ship room');
    }
    const ordinaryPostCommit = ordinary.postCommit;
    const selectedPostCommit = selected.postCommit;

    const selectedRecords = selectedPostCommit.ledgers.encounterRecords
      .filter((entry) => semanticAddressKey(entry.origin) === semanticAddressKey(room))
      .map((entry) => entry.encounterKey);
    expect(selectedRecords).toEqual(['HeraclesCombatO', 'IcarusCombatO', 'GeneratedO']);
    expect(
      selectedPostCommit.ledgers.counters.biomeEncounterDepth -
        selected.preparation.ledgers.counters.biomeEncounterDepth,
    ).toBe(
      ordinaryPostCommit.ledgers.counters.biomeEncounterDepth -
        ordinary.preparation.ledgers.counters.biomeEncounterDepth +
        1,
    );
  });

  it('uses declaration-owned P Indoor and Outdoor tags for Heracles, Icarus, and Athena', () => {
    const indoorOccurrenceId = pOccurrenceId('P_Combat10', 6, 1);
    const indoorIntro = phase(pBiome, pOccurrenceId('P_Combat02', 2, 1), 'Intro');
    const indoorCombat = phase(pBiome, indoorOccurrenceId, 'Combat');
    const initial = createRepresentativeNOPQProject();

    expect(support(initial, indoorIntro)?.candidateEncounterKeys).toContain('HeraclesCombatP');
    expect(support(initial, indoorIntro)?.candidateEncounterKeys).not.toContain('IcarusCombatP');
    expect(support(initial, indoorIntro)?.candidateEncounterKeys).not.toContain('AthenaCombatP');
    expect(support(initial, indoorCombat)?.candidateEncounterKeys).not.toContain('HeraclesCombatP');
    expect(support(initial, indoorCombat)?.candidateEncounterKeys).toContain('AthenaCombatP');
    expect(support(initial, indoorCombat)?.candidateEncounterKeys).not.toContain('IcarusCombatP');

    const outdoorOccurrenceId = pOccurrenceId('P_Combat11', 4, 2);
    const outdoorCombat = phase(pBiome, outdoorOccurrenceId, 'Combat');
    let outdoor = applyProjectCommand(initial, catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat07', 4, 1),
      }),
    });
    outdoor = applyProjectCommand(outdoor, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat04', 3, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    outdoor = applyProjectCommand(outdoor, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(pBiome, outdoorOccurrenceId),
      value: { rewardType: 'MaxHealthDrop' },
    });

    expect(support(outdoor, outdoorCombat)?.candidateEncounterKeys).toContain('IcarusCombatP');
  });

  it('trims P Combat only for valid Heracles, retains its selection dormant, and restores it exactly', () => {
    const occurrenceId = pOccurrenceId('P_Combat02', 2, 1);
    const room = createOccurrenceAddress(pBiome, occurrenceId);
    const intro = phase(pBiome, occurrenceId, 'Intro');
    const combat = phase(pBiome, occurrenceId, 'Combat');
    let project = createRepresentativeNOPQProject();
    const originalState = authoredOccurrence(project, 'P', occurrenceId).state;
    const retainedCombat = authoredOccurrence(project, 'P', occurrenceId).encounters
      .encounterKeyByPhase.Combat;

    expect(retainedCombat).toBe('GeneratedP');
    expect(support(project, intro)?.candidateEncounterKeys).toContain('HeraclesCombatP');
    expect(support(project, combat)).toMatchObject({
      active: true,
      selectedEncounterKey: 'GeneratedP',
      selectedPossible: true,
    });

    project = select(project, intro, 'HeraclesCombatP');
    expect(support(project, combat)).toBeUndefined();
    expect(authoredOccurrence(project, 'P', occurrenceId).state).toEqual(originalState);
    expect(
      authoredOccurrence(project, 'P', occurrenceId).encounters.encounterKeyByPhase,
    ).toMatchObject({
      Intro: 'HeraclesCombatP',
      Combat: retainedCombat,
    });

    const selected = evaluatedSurfaceBiome(project, 'P').biome.history.rooms.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room),
    );
    if (selected?.postCommit === undefined) {
      throw new Error('P fixture lost its selected combat room');
    }
    const selectedPostCommit = selected.postCommit;
    expect(
      selectedPostCommit.ledgers.encounterRecords
        .filter((entry) => semanticAddressKey(entry.origin) === semanticAddressKey(room))
        .map((entry) => entry.encounterKey),
    ).toEqual(['HeraclesCombatP']);
    expect(
      selectedPostCommit.ledgers.counters.biomeEncounterDepth -
        selected.preparation.ledgers.counters.biomeEncounterDepth,
    ).toBe(1);

    const nHeracles = phase(nBiome, nOccurrenceId('combat05'));
    expect(support(project, nHeracles)?.candidateEncounterKeys).toContain('HeraclesCombatN');
    project = select(project, nHeracles, 'HeraclesCombatN');
    expect(support(project, intro)).toMatchObject({
      active: true,
      selectedEncounterKey: 'HeraclesCombatP',
      selectedPossible: false,
    });
    expect(support(project, combat)).toMatchObject({
      active: true,
      selectedEncounterKey: retainedCombat,
      selectedPossible: true,
    });

    project = select(project, intro, 'GeneratedP_PreCombat');
    expect(support(project, combat)).toMatchObject({
      active: true,
      selectedEncounterKey: retainedCombat,
      selectedPossible: true,
    });
  });
});
