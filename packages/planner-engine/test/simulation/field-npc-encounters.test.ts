import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createTraitOfferAddress,
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
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  createPreparedProjectCandidateSession,
  simulateProject,
  simulateProjectAssembly,
  targetedAcquisitionTargetKeys,
  traitCandidates,
  createTraitHistoryState,
  type CanonicalAuthoredRoom,
  type EncounterHistoryEntry,
  type HistoryStateView,
  type RoomAppearanceHistoryEntry,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createCompleteFGProject,
  createGoldenFGHProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenHBiome,
  goldenIBiome,
  nBiome,
  nOccurrenceId,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  createRepresentativeNProject,
  createRepresentativeNOPQProject,
  authorLegalTraitOffers,
  oBiome,
} from '@run-planner/test-fixtures';
import { prepareRoomEncounterPhases } from '../../src/simulation/encounters/preparation';
import { createCompleteNProject } from '../authored-project/support/complete-n-project';

function phase(biome: BiomeAddress, occurrenceId: OccurrenceId, phaseKey = 'Encounter') {
  return createEncounterPhaseAddress(biome, { kind: 'occurrence', occurrenceId }, phaseKey);
}

const nCombatId = createOccurrenceId('round-trip-n-combat02');
const nLocalPhase = createEncounterPhaseAddress(
  nBiome,
  { kind: 'localChild', occurrenceId: nCombatId, groupKey: 'sideRooms', slotKey: 'sideDoor1' },
  'Encounter',
);
const nDormantLocalPhase = createEncounterPhaseAddress(
  nBiome,
  { kind: 'localChild', occurrenceId: nCombatId, groupKey: 'sideRooms', slotKey: 'sideDoor2' },
  'Encounter',
);

function support(project: ProjectDocument, owner: ReturnType<typeof phase>) {
  return encounterPhaseCandidateSupportForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, project),
    owner,
  );
}

function sequenceStatus(project: ProjectDocument, owner: ReturnType<typeof phase>) {
  return encounterPhaseSequenceStatusForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, project),
    owner,
  );
}

function select(project: ProjectDocument, owner: ReturnType<typeof phase>, encounterKey: string) {
  return applyProjectCommand(project, catalog, {
    kind: 'SelectEncounter',
    phase: owner,
    encounterKey,
  });
}

function surfaceProjectWithEnteredRankIHammer(): ProjectDocument {
  const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    hubSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'combat03'],
  });
  return authorLegalTraitOffers(project);
}

function reachedPOutdoorIcarusFixture(): {
  readonly project: ProjectDocument;
  readonly occurrenceId: OccurrenceId;
  readonly encounter: ReturnType<typeof phase>;
} {
  const occurrenceId = pOccurrenceId('P_Combat07', 4, 1);
  let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat11', 4, 2)),
    gameName: 'P_Combat07',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(pBiome, occurrenceId),
    gameName: 'P_Combat11',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat09', 5, 2)),
    gameName: 'P_Combat13',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat13', 6, 2)),
    gameName: 'P_Combat09',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(pBiome, occurrenceId),
    value: { rewardType: 'TalentDrop' },
  });
  return Object.freeze({ project, occurrenceId, encounter: phase(pBiome, occurrenceId, 'Combat') });
}

function evaluatedBiome(project: ProjectDocument, biomeKey: 'F' | 'G' | 'H' | 'I') {
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

function fieldsCages(project: ProjectDocument, occurrenceId: OccurrenceId) {
  const state = authoredOccurrence(project, 'H', occurrenceId).state;
  if (state.kind !== 'fieldsCombat') {
    throw new Error(`H ${occurrenceId} is not a Fields combat room`);
  }
  return state.cages;
}

function replaceCollectionEntry<T>(
  collection: CatalogCollection<T>,
  replacement: T,
  keyFor: (entry: T) => string,
): CatalogCollection<T> {
  const replacementKey = keyFor(replacement);
  return Object.freeze({
    values: Object.freeze(
      collection.values.map((entry) => (keyFor(entry) === replacementKey ? replacement : entry)),
    ),
    byKey: Object.freeze({ ...collection.byKey, [replacementKey]: replacement }),
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
    ({ key }) => key,
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
    encounterSets: replaceCollectionEntry(catalog.encounterSets, probeSet, ({ key }) => key),
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
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
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

function pCombatPreparationFixture(): {
  readonly preparation: HistoryStateView;
  readonly room: CanonicalAuthoredRoom;
} {
  const result = simulateProject(catalog, createRepresentativeNOPQProject());
  const biome = result.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'P');
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
    throw new Error('P did not produce a complete history fixture');
  }
  const room = biome.snapshot.decisions
    .filter(
      (
        decision,
      ): decision is Extract<(typeof biome.snapshot.decisions)[number], { kind: 'batch' }> =>
        decision.kind === 'batch',
    )
    .flatMap((decision) => decision.targets.map((target) => target.room))
    .find((candidate) => candidate.gameName === 'P_Combat02');
  if (room === undefined) throw new Error('P fixture lost Combat 02');
  const preparation = biome.history.rooms.find(
    (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
  )?.preparation;
  if (preparation === undefined) throw new Error('P fixture lost Combat 02 preparation');
  return Object.freeze({ preparation, room });
}

function fixedTerminatorCatalog(room: CanonicalAuthoredRoom, failActivation: boolean): Catalog {
  const declaration = catalog.rooms.byKey[room.gameName];
  if (declaration === undefined) throw new Error(`${room.gameName} declaration is missing`);
  const envelope = catalog.encounterEnvelopes.byKey[declaration.encounterEnvelopeKey];
  if (envelope === undefined) throw new Error(`${room.gameName} envelope is missing`);
  const fixedDeclaration = Object.freeze({
    ...declaration,
    encounterSlotBindings: Object.freeze(
      declaration.encounterSlotBindings.map((binding) =>
        binding.slotKey === 'Intro'
          ? Object.freeze({
              encounterDefinitionKey: 'HeraclesCombatP',
              kind: 'fixed' as const,
              slotKey: binding.slotKey,
            })
          : binding,
      ),
    ),
  });
  const fixedEnvelope = Object.freeze({
    ...envelope,
    slots: Object.freeze(
      envelope.slots.map((slot) =>
        slot.key !== 'Intro' || !failActivation
          ? slot
          : Object.freeze({
              ...slot,
              activationRequirement: Object.freeze({
                axis: 'biomeEncounterDepth' as const,
                kind: 'counterRange' as const,
                range: Object.freeze({ max: -1 }),
              }),
            }),
      ),
    ),
  });
  return Object.freeze({
    ...catalog,
    encounterEnvelopes: replaceCollectionEntry(
      catalog.encounterEnvelopes,
      fixedEnvelope,
      ({ key }) => key,
    ),
    rooms: replaceCollectionEntry(catalog.rooms, fixedDeclaration, ({ gameName }) => gameName),
  });
}

function fixedTerminatingIntro(room: CanonicalAuthoredRoom): CanonicalAuthoredRoom {
  const definition = catalog.encounterDefinitions.byKey.HeraclesCombatP;
  const intro = room.encounterPhases[0];
  if (definition === undefined || intro === undefined) {
    throw new Error('P fixed-terminator fixture is missing Heracles or Intro');
  }
  return Object.freeze({
    ...room,
    encounterPhases: Object.freeze([
      Object.freeze({
        ...intro,
        countsEncounterDepth: definition.countsEncounterDepth,
        encounterKey: definition.key,
        kind: definition.kind,
        label: definition.label,
        ...(definition.sequenceEffect === undefined
          ? {}
          : { sequenceEffect: definition.sequenceEffect }),
      }),
      ...room.encounterPhases.slice(1),
    ]),
  });
}

function sideRoomFieldNpcCatalog(): Catalog {
  const definition = catalog.encounterDefinitions.byKey.ArtemisCombatN;
  const set = catalog.encounterSets.byKey.NEncountersSubRoom;
  if (definition === undefined || set === undefined) {
    throw new Error('N side-room Artemis fixture is missing its declarations');
  }
  const definitionWithoutRequirements = { ...definition };
  delete definitionWithoutRequirements.requirements;
  const relaxedDefinition = Object.freeze(definitionWithoutRequirements);
  const sideRoomSet = Object.freeze({
    ...set,
    encounterDefinitionKeys: Object.freeze([...set.encounterDefinitionKeys, definition.key]),
  });
  return Object.freeze({
    ...catalog,
    encounterDefinitions: replaceCollectionEntry(
      catalog.encounterDefinitions,
      relaxedDefinition,
      ({ key }) => key,
    ),
    encounterSets: replaceCollectionEntry(catalog.encounterSets, sideRoomSet, ({ key }) => key),
  });
}

function enteredNLocalProjectForArtemis(): ProjectDocument {
  let project = createCompleteNProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(nBiome, createOccurrenceId('round-trip-n-prehub')),
      'source',
    ),
    value: {
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nCombatId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceSideRoomGeneration',
    sideRoom: createLocalChildAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor2'),
    generation: 'generated',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceSideRoomGeneration',
    sideRoom: createLocalChildAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor1'),
    generation: 'generated',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceLocalReward',
    reward: createLocalRewardAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor1'),
    value: { rewardType: 'MaxHealthDropSmall' },
  });
  return authorLegalTraitOffers(
    applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nCombatId, 'sideRooms'),
      enteredSlotKeys: ['sideDoor1'],
    }),
  );
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

  it('authors Artemis offers by concrete encounter, retains dormant edits, and equips only when reached', () => {
    let project = createCompleteFGProject();
    project = select(project, fNpcPhase, 'ArtemisCombatF');
    const selected = authoredOccurrence(project, 'F', goldenFOccurrenceId(5, 1));
    const initialOffer = selected.encounters.traitOffersByPhase?.Encounter?.ArtemisCombatF;
    expect(initialOffer).toMatchObject({ giverKey: 'Artemis', selectedOptionKey: 'option1' });
    expect(initialOffer?.options.map((option) => option.traitKey)).toEqual([
      'SupportingFireBoon',
      'CritBonusBoon',
      'DashOmegaBuffBoon',
    ]);

    const traitAddress = createTraitOfferAddress(fNpcPhase, 'selection');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: traitAddress,
      selectedOptionKey: 'option2',
    });
    expect(
      authoredOccurrence(project, 'F', goldenFOccurrenceId(5, 1)).encounters.traitOffersByPhase
        ?.Encounter?.ArtemisCombatF?.selectedOptionKey,
    ).toBe('option2');

    project = select(project, fNpcPhase, 'GeneratedF');
    expect(
      authoredOccurrence(project, 'F', goldenFOccurrenceId(5, 1)).encounters.traitOffersByPhase
        ?.Encounter?.ArtemisCombatF?.selectedOptionKey,
    ).toBe('option2');
    project = select(project, fNpcPhase, 'ArtemisCombatF');
    expect(
      authoredOccurrence(project, 'F', goldenFOccurrenceId(5, 1)).encounters.traitOffersByPhase
        ?.Encounter?.ArtemisCombatF?.selectedOptionKey,
    ).toBe('option2');

    const { result, biome } = evaluatedBiome(project, 'F');
    expect(result.status).toBe('valid');
    if (!('rewards' in biome)) throw new Error('F reward evaluation is missing');
    const trace = biome.rewards.selectedTraitOffers.find(
      (candidate) => semanticAddressKey(candidate.address.owner) === semanticAddressKey(fNpcPhase),
    );
    expect(trace).toMatchObject({ acquisitionRole: 'selection' });
    expect(biome.rewards.branches[0]?.traitHistory?.equippedTraits.CritBonusBoon).toBeDefined();
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({ kind: 'traitOffer', trait: traitAddress, value: initialOffer! }),
    ).toMatchObject({ kind: 'traitOffer', result: { supported: true } });
  });

  it('reuses the encounter-owned offer path for fixed Arachne Story choices', () => {
    const occurrenceId = goldenFOccurrenceId(7, 1);
    const storyPhase = phase(goldenFBiome, occurrenceId);
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, occurrenceId),
      gameName: 'F_Story01',
    });
    const selected = authoredOccurrence(project, 'F', occurrenceId);
    const initialOffer = selected.encounters.traitOffersByPhase?.Encounter?.Story_Arachne_01;
    expect(initialOffer).toMatchObject({
      giverKey: 'Arachne',
      selectedOptionKey: 'option1',
      options: [
        { traitKey: 'AgilityCostume', rarity: 'Common' },
        { traitKey: 'ManaCostume', rarity: 'Common' },
        { traitKey: 'VitalityCostume', rarity: 'Common' },
      ],
    });
    const traitAddress = createTraitOfferAddress(storyPhase, 'selection');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: traitAddress,
      selectedOptionKey: 'option2',
    });
    const result = simulateProject(catalog, project);
    const biome = result.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (biome?.authoring !== 'complete') throw new Error(JSON.stringify(biome?.findings));
    if (!('rewards' in biome)) throw new Error('F reward evaluation is missing');
    expect(biome.rewards.selectedTraitOffers).toContainEqual(
      expect.objectContaining({ address: expect.objectContaining({ owner: storyPhase }) }),
    );
    expect(biome.rewards.branches[0]?.traitHistory?.equippedTraits.ManaCostume).toMatchObject({
      giverKey: 'Arachne',
      providerKind: 'npc',
      rarity: 'Common',
    });
    expect(biome.rewards.branches[0]?.traitHistory?.equippedTraits.VitalityCostume).toBeUndefined();
  });

  it('gates Medea Death Defiance curse candidates and acquires the selected Story curse chronologically', () => {
    const project = createRepresentativeNProject({
      openSlotKeys: [
        'combat11',
        'combat10',
        'combat09',
        'combat05',
        'story',
        'combat02',
        'combat01',
        'miniBoss01',
        'combat23',
      ],
      visitSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'story'],
    });
    const history = createTraitHistoryState();
    expect(
      traitCandidates(catalog, 'Medea', history, { deathDefianceConditionMet: false }).find(
        (candidate) => candidate.traitKey === 'DeathDefianceRetaliateCurse',
      ),
    ).toMatchObject({ available: false });
    expect(
      traitCandidates(catalog, 'Medea', history, { deathDefianceConditionMet: true }).find(
        (candidate) => candidate.traitKey === 'DeathDefianceRetaliateCurse',
      ),
    ).toMatchObject({ available: true, rarity: 'Common' });

    const storyId = nOccurrenceId('story');
    const storyPhase = phase(nBiome, storyId);
    const storyOffer = authoredOccurrence(project, 'N', storyId).encounters.traitOffersByPhase
      ?.Encounter?.Story_Medea_01;
    expect(storyOffer).toMatchObject({ giverKey: 'Medea', deathDefianceConditionMet: false });
    const editedOffer = {
      ...storyOffer!,
      options: [
        { traitKey: 'DeathDefianceRetaliateCurse', rarity: 'Common' as const },
        { traitKey: 'MoneyOnDeathCurse', rarity: 'Common' as const },
        { traitKey: 'ManaOverTimeCurse', rarity: 'Common' as const },
      ] as const,
      selectedOptionKey: 'option1' as const,
      deathDefianceConditionMet: true,
    };
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'traitOffer',
        trait: createTraitOfferAddress(storyPhase, 'selection'),
        value: editedOffer,
      }),
    ).toMatchObject({ kind: 'traitOffer', result: { supported: true, findings: [] } });
    const edited = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(storyPhase, 'selection'),
      value: editedOffer,
    });
    const { biome } = evaluatedSurfaceBiome(edited, 'N');
    if (!('rewards' in biome)) throw new Error('N reward evaluation is missing');
    const branch = biome.rewards.branches[0];
    expect(branch?.traitHistory?.equippedTraits.DeathDefianceRetaliateCurse).toMatchObject({
      giverKey: 'Medea',
      providerKind: 'npc',
      rarity: 'Common',
    });
    expect(
      biome.rewards.selectedTraitOffers.find(
        (trace) => semanticAddressKey(trace.address.owner) === semanticAddressKey(storyPhase),
      ),
    ).toMatchObject({ acquisitionRole: 'selection', chronologicalIndex: expect.any(Number) });
  });

  it('keeps an invalid Artemis selection authored at its exact phase trait owner', () => {
    let project = select(createCompleteFGProject(), fNpcPhase, 'ArtemisCombatF');
    const traitAddress = createTraitOfferAddress(fNpcPhase, 'selection');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: traitAddress,
      value: {
        giverKey: 'Artemis',
        options: [
          { traitKey: 'SupportingFireBoon', rarity: 'Common' },
          { traitKey: 'CritBonusBoon', rarity: 'Common' },
          { traitKey: 'SorceryCritBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option3',
      },
    });
    const { result, biome } = evaluatedBiome(project, 'F');
    expect(result.status).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({ origin: traitAddress, code: 'missingPrerequisite' }),
    );
  });

  it('acquires an entered N side-room Artemis offer at its local-child phase address', () => {
    const sideCatalog = sideRoomFieldNpcCatalog();
    const initial = enteredNLocalProjectForArtemis();
    let project = applyProjectCommand(initial, sideCatalog, {
      kind: 'SelectEncounter',
      phase: nLocalPhase,
      encounterKey: 'ArtemisCombatN',
    });
    project = applyProjectCommand(project, sideCatalog, {
      kind: 'SelectEncounter',
      phase: nDormantLocalPhase,
      encounterKey: 'ArtemisCombatN',
    });
    const selected = authoredOccurrence(project, 'N', nCombatId);
    if (selected.state.kind !== 'ephyraCombat') throw new Error('N side-room state is missing');
    const sideOffer =
      selected.state.sideRooms.sideDoor1?.encounters.traitOffersByPhase?.Encounter?.ArtemisCombatN;
    expect(sideOffer).toMatchObject({ giverKey: 'Artemis', selectedOptionKey: 'option1' });
    const dormantOffer =
      selected.state.sideRooms.sideDoor2?.encounters.traitOffersByPhase?.Encounter?.ArtemisCombatN;
    expect(dormantOffer).toMatchObject({ giverKey: 'Artemis', selectedOptionKey: 'option1' });
    project = applyProjectCommand(project, sideCatalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(nLocalPhase, 'selection'),
      value: {
        giverKey: 'Artemis',
        options: [
          { traitKey: 'SupportingFireBoon', rarity: 'Common' },
          { traitKey: 'CritBonusBoon', rarity: 'Common' },
          { traitKey: 'DashOmegaBuffBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option3',
      },
    });
    project = applyProjectCommand(project, sideCatalog, {
      kind: 'ReplaceTraitSelection',
      trait: createTraitOfferAddress(nLocalPhase, 'selection'),
      selectedOptionKey: 'option2',
    });
    const edited = authoredOccurrence(project, 'N', nCombatId);
    if (edited.state.kind !== 'ephyraCombat') throw new Error('N side-room edit lost its state');
    expect(
      edited.state.sideRooms.sideDoor1?.encounters.traitOffersByPhase?.Encounter?.ArtemisCombatN
        ?.selectedOptionKey,
    ).toBe('option2');

    const evaluation = simulateProject(sideCatalog, project);
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    if (biome?.authoring !== 'complete' || !('rewards' in biome)) {
      throw new Error('N side-room Artemis did not produce a complete reward evaluation');
    }
    const traitAddress = createTraitOfferAddress(nLocalPhase, 'selection');
    const trace = biome.rewards.selectedTraitOffers.find(
      (candidate) => semanticAddressKey(candidate.address) === semanticAddressKey(traitAddress),
    );
    expect(trace).toMatchObject({ acquisitionRole: 'selection' });
    expect(biome.rewards.branches[0]?.traitHistory?.equippedTraits.CritBonusBoon).toBeDefined();
    expect(
      biome.rewards.selectedTraitOffers.some(
        (candidate) =>
          candidate.address.owner.kind === 'encounterPhase' &&
          candidate.address.owner.owner.kind === 'localChild' &&
          candidate.address.owner.owner.slotKey === 'sideDoor2',
      ),
    ).toBe(false);
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
    for (const occurrenceId of [
      goldenGOccurrenceId(3, 2),
      goldenGOccurrenceId(3, 3),
      goldenGOccurrenceId(4, 1),
    ]) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(goldenGBiome, occurrenceId),
        gameName: 'G_Combat04',
      });
    }
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

  it('keeps Nemesis combat route-once, shared-six spaced, and independent from ordinary rewards', () => {
    const nemesisF = phase(goldenFBiome, goldenFOccurrenceId(5, 1));
    const followingArtemis = phase(goldenFBiome, goldenFOccurrenceId(7, 1));
    const nemesisG = phase(goldenGBiome, goldenGOccurrenceId(4, 1));
    const nemesisI = phase(goldenIBiome, createOccurrenceId('golden-i-combat09'));
    const initial = createGoldenFGHIProject();
    const retainedIncomingReward = authoredOccurrence(
      initial,
      'F',
      goldenFOccurrenceId(5, 1),
    ).state;
    const retainedGIncomingReward = authoredOccurrence(
      initial,
      'G',
      goldenGOccurrenceId(4, 1),
    ).state;
    const retainedIIncomingReward = authoredOccurrence(
      initial,
      'I',
      createOccurrenceId('golden-i-combat09'),
    ).state;

    expect(support(initial, nemesisF)?.candidateEncounterKeys).toContain('NemesisCombatF');
    expect(support(initial, nemesisG)?.candidateEncounterKeys).toContain('NemesisCombatG');
    expect(support(initial, nemesisI)?.candidateEncounterKeys).toContain('NemesisCombatI');

    const withNemesisG = select(initial, nemesisG, 'NemesisCombatG');
    expect(authoredOccurrence(withNemesisG, 'G', goldenGOccurrenceId(4, 1)).state).toEqual(
      retainedGIncomingReward,
    );
    const withNemesisI = select(initial, nemesisI, 'NemesisCombatI');
    expect(
      authoredOccurrence(withNemesisI, 'I', createOccurrenceId('golden-i-combat09')).state,
    ).toEqual(retainedIIncomingReward);

    const withNemesis = select(initial, nemesisF, 'NemesisCombatF');
    expect(authoredOccurrence(withNemesis, 'F', goldenFOccurrenceId(5, 1)).state).toEqual(
      retainedIncomingReward,
    );
    expect(support(withNemesis, followingArtemis)?.candidateEncounterKeys).not.toContain(
      'ArtemisCombatF',
    );
    expect(support(withNemesis, nemesisG)?.candidateEncounterKeys).not.toContain('NemesisCombatG');
    expect(support(withNemesis, nemesisI)?.candidateEncounterKeys).not.toContain('NemesisCombatI');

    const withArachne = select(initial, nemesisF, 'ArachneCombatF');
    expect(support(withArachne, followingArtemis)?.candidateEncounterKeys).toContain(
      'ArtemisCombatF',
    );
  });

  it('records Nemesis Cage01 before evaluating Cage02 without starting its depth effect', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const room = createOccurrenceAddress(goldenHBiome, occurrenceId);
    const passive = phase(goldenHBiome, occurrenceId, 'Passive');
    const cage1 = phase(goldenHBiome, occurrenceId, 'Cage01');
    const cage2 = phase(goldenHBiome, occurrenceId, 'Cage02');
    const cage3 = phase(goldenHBiome, occurrenceId, 'Cage03');
    const initial = createGoldenFGHProject();
    const retainedCageRewards = fieldsCages(initial, occurrenceId);

    expect(support(initial, passive)?.candidateEncounterKeys).not.toContain('NemesisCombatH');
    expect(support(initial, cage1)?.candidateEncounterKeys).toContain('NemesisCombatH');
    expect(support(initial, cage2)?.candidateEncounterKeys).toContain('NemesisCombatH');
    expect(support(initial, cage3)).toBeUndefined();

    let blocked = select(initial, cage2, 'NemesisCombatH');
    blocked = select(blocked, cage1, 'NemesisCombatH');
    expect(fieldsCages(blocked, occurrenceId)).toEqual(retainedCageRewards);
    expect(support(blocked, cage1)).toMatchObject({
      active: true,
      selectedEncounterKey: 'NemesisCombatH',
      selectedPossible: true,
    });
    expect(support(blocked, cage2)).toMatchObject({
      active: true,
      selectedEncounterKey: 'NemesisCombatH',
      selectedPossible: false,
    });

    const baseline = evaluatedBiome(initial, 'H').biome;
    const baselineRoom = baseline.history.rooms.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room),
    );
    const blockedBiome = evaluatedBiome(blocked, 'H').biome;
    if (baselineRoom === undefined) throw new Error('H fixture lost its first Fields room');
    expect(blockedBiome.coverage).toMatchObject({ kind: 'prefix', blockedAt: cage2 });
    expect(blockedBiome.history.ledgers.encounterRecords).toContainEqual(
      expect.objectContaining({
        origin: room,
        slotKey: 'Cage01',
        encounterKey: 'NemesisCombatH',
      }),
    );
    expect(blockedBiome.history.ledgers.encounterStarts).not.toContainEqual(
      expect.objectContaining({ origin: room, slotKey: 'Cage01' }),
    );
    expect(blockedBiome.history.ledgers.counters.biomeEncounterDepth).toBe(
      baselineRoom.preparation.ledgers.counters.biomeEncounterDepth,
    );

    const valid = select(initial, cage1, 'NemesisCombatH');
    const validBiome = evaluatedBiome(valid, 'H').biome;
    if (validBiome.validity !== 'valid') throw new Error('H Nemesis fixture must be valid');
    const validRoom = validBiome.history.rooms.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room),
    );
    const materializedRoom = validBiome.snapshot.decisions
      .filter((decision) => decision.kind === 'batch')
      .flatMap((decision) => decision.targets.map((target) => target.room))
      .find((candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room));
    const nemesisStart = validBiome.history.ledgers.encounterStarts.find(
      (entry) =>
        semanticAddressKey(entry.origin) === semanticAddressKey(room) &&
        entry.slotKey === 'Cage01' &&
        entry.encounterKey === 'NemesisCombatH',
    );
    const nemesisAdvance = validBiome.history.events.find(
      (event) =>
        event.kind === 'encounterDepthAdvanced' &&
        semanticAddressKey(event.origin) === semanticAddressKey(room) &&
        event.phaseKey === 'Cage01',
    );
    if (
      validRoom?.postCommit === undefined ||
      materializedRoom === undefined ||
      nemesisStart === undefined
    ) {
      throw new Error('valid H Nemesis room lost its lifecycle products');
    }
    expect(nemesisAdvance?.sequence).toBeGreaterThan(nemesisStart.sequence);
    expect(
      validRoom.postCommit.ledgers.counters.biomeEncounterDepth -
        validRoom.preparation.ledgers.counters.biomeEncounterDepth,
    ).toBe(2);
    expect(
      materializedRoom.localRewards?.find((reward) => reward.slotKey === 'cage1')?.offer,
    ).toEqual(retainedCageRewards.cage1?.offer);
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
    const withThreePhases = authorLegalTraitOffers(
      applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
        kind: 'ReplaceShipEncounterCount',
        occurrence: room,
        encounterCount: 3,
      }),
    );
    const originalState = authoredOccurrence(withThreePhases, 'O', occurrenceId).state;

    expect(support(withThreePhases, intro)?.candidateEncounterKeys).toContain('HeraclesCombatO');
    expect(support(withThreePhases, combat1)?.candidateEncounterKeys).toContain('IcarusCombatO');

    let project = select(withThreePhases, intro, 'HeraclesCombatO');
    expect(support(project, combat1)?.candidateEncounterKeys).toContain('IcarusCombatO');

    project = select(project, combat1, 'IcarusCombatO');
    expect(
      authoredOccurrence(project, 'O', occurrenceId).encounters.traitOffersByPhase?.Combat1
        ?.IcarusCombatO,
    ).toMatchObject({
      giverKey: 'Icarus',
      selectedOptionKey: 'option1',
    });
    expect(support(project, combat2)?.candidateEncounterKeys).not.toContain('IcarusCombatO');
    expect(authoredOccurrence(project, 'O', occurrenceId).state).toEqual(originalState);

    const ordinary = evaluatedSurfaceBiome(withThreePhases, 'O').biome.history.rooms.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room),
    );
    const selectedEvaluation = evaluatedSurfaceBiome(project, 'O').biome;
    const selected = selectedEvaluation.history.rooms.find(
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
    if (!('rewards' in selectedEvaluation)) {
      throw new Error('O Icarus fixture lost its reward evaluation');
    }
    const traitAddress = createTraitOfferAddress(combat1, 'selection');
    expect(
      selectedEvaluation.rewards.selectedTraitOffers.find(
        (candidate) => semanticAddressKey(candidate.address) === semanticAddressKey(traitAddress),
      ),
    ).toMatchObject({ acquisitionRole: 'selection', reached: true });
    expect(
      selectedEvaluation.rewards.branches[0]?.traitHistory?.equippedTraits.FocusAttackDamageTrait,
    ).toMatchObject({ giverKey: 'Icarus', providerKind: 'npc', rarity: 'Common' });
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
      value: { rewardType: 'TalentDrop' },
    });

    expect(support(outdoor, outdoorCombat)?.candidateEncounterKeys).toContain('IcarusCombatP');
  });

  it('retains a dormant P Icarus offer and acquires its selected trait when reached again', () => {
    const fixture = reachedPOutdoorIcarusFixture();
    let project = fixture.project;
    expect(support(project, fixture.encounter)?.candidateEncounterKeys).toContain('IcarusCombatP');
    project = select(project, fixture.encounter, 'IcarusCombatP');

    const traitAddress = createTraitOfferAddress(fixture.encounter, 'selection');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: traitAddress,
      selectedOptionKey: 'option3',
    });
    project = select(project, fixture.encounter, 'GeneratedP');
    expect(
      authoredOccurrence(project, 'P', fixture.occurrenceId).encounters.traitOffersByPhase?.Combat
        ?.IcarusCombatP?.selectedOptionKey,
    ).toBe('option3');
    project = select(project, fixture.encounter, 'IcarusCombatP');
    expect(
      authoredOccurrence(project, 'P', fixture.occurrenceId).encounters.traitOffersByPhase?.Combat
        ?.IcarusCombatP?.selectedOptionKey,
    ).toBe('option3');

    const pEvaluation = evaluatedSurfaceBiome(project, 'P').biome;
    if (!('rewards' in pEvaluation)) {
      throw new Error('P Icarus fixture lost its reward evaluation');
    }
    expect(
      pEvaluation.rewards.selectedTraitOffers.find(
        (candidate) => semanticAddressKey(candidate.address) === semanticAddressKey(traitAddress),
      ),
    ).toMatchObject({ acquisitionRole: 'selection', reached: true });
    expect(
      pEvaluation.rewards.branches[0]?.traitHistory?.equippedTraits.OmegaExplodeBoon,
    ).toMatchObject({ giverKey: 'Icarus', providerKind: 'npc', rarity: 'Common' });
  });

  it('applies reached Latest Model through the encounter-owned offer and exhausts its exact Hammer target', () => {
    const occurrenceId = oOccurrenceIds.combat01;
    const icarusPhase = phase(oBiome, occurrenceId, 'Combat1');
    const traitAddress = createTraitOfferAddress(icarusPhase, 'selection');
    let project = surfaceProjectWithEnteredRankIHammer();

    expect(support(project, icarusPhase)?.candidateEncounterKeys).toContain('IcarusCombatO');
    project = select(project, icarusPhase, 'IcarusCombatO');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: traitAddress,
      value: {
        giverKey: 'Icarus',
        options: [
          {
            traitKey: 'UpgradeHammerBoon',
            rarity: 'Common',
            targetTraitKey: 'StaffDoubleAttackTrait',
          },
          { traitKey: 'OmegaExplodeBoon', rarity: 'Common' },
          { traitKey: 'CastHazardBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });

    const evaluation = evaluatedSurfaceBiome(project, 'O').biome;
    if (!('rewards' in evaluation) || evaluation.validity !== 'valid') {
      throw new Error('O Latest Model fixture did not produce a valid reward evaluation');
    }
    const trace = evaluation.rewards.selectedTraitOffers.find(
      (candidate) => semanticAddressKey(candidate.address) === semanticAddressKey(traitAddress),
    );
    expect(trace?.branches[0]?.targetedAcquisition).toMatchObject({
      applies: true,
      legal: true,
      sourceTraitKey: 'UpgradeHammerBoon',
      targetTraitKey: 'StaffDoubleAttackTrait',
      transition: {
        kind: 'upgradeHammerToRank2',
        sourceTraitKey: 'UpgradeHammerBoon',
        targetTraitKey: 'StaffDoubleAttackTrait',
        oldHammerRank: 'RankI',
        newHammerRank: 'RankII',
      },
    });
    const history = evaluation.rewards.branches[0]?.traitHistory;
    if (history === undefined) throw new Error('O Latest Model trait history is missing');
    expect(history.equippedTraits.UpgradeHammerBoon).toMatchObject({
      giverKey: 'Icarus',
      providerKind: 'npc',
      rarity: 'Common',
    });
    expect(history.equippedTraits.StaffDoubleAttackTrait).toMatchObject({
      giverKey: 'WeaponUpgrade',
      hammerRank: 'RankII',
    });
    expect(
      Object.values(history.equippedTraits)
        .filter(({ traitKey }) => catalog.traits.byKey[traitKey]?.hammerCompatibility !== undefined)
        .map(({ traitKey, hammerRank }) => [traitKey, hammerRank]),
    ).toEqual([['StaffDoubleAttackTrait', 'RankII']]);
    expect(targetedAcquisitionTargetKeys(catalog, 'UpgradeHammerBoon', history)).toEqual([]);
  });

  it('uses the shared encounter-owned trait path for Athena across P phase dormancy and completion', () => {
    const occurrenceId = pOccurrenceId('P_Combat10', 6, 1);
    const athenaPhase = phase(pBiome, occurrenceId, 'Combat');
    let project = createRepresentativeNOPQProject();

    expect(support(project, athenaPhase)?.candidateEncounterKeys).toContain('AthenaCombatP');
    project = select(project, athenaPhase, 'AthenaCombatP');
    const selected = authoredOccurrence(project, 'P', occurrenceId);
    expect(selected.encounters.traitOffersByPhase?.Combat?.AthenaCombatP).toMatchObject({
      giverKey: 'Athena',
      selectedOptionKey: 'option1',
    });
    expect(
      selected.encounters.traitOffersByPhase?.Combat?.AthenaCombatP?.options.map(
        (option) => option.traitKey,
      ),
    ).toEqual(['InvulnerabilityDashBoon', 'RetaliateInvulnerabilityBoon', 'FocusLastStandBoon']);

    project = select(project, athenaPhase, 'GeneratedP');
    expect(
      authoredOccurrence(project, 'P', occurrenceId).encounters.traitOffersByPhase?.Combat
        ?.AthenaCombatP?.selectedOptionKey,
    ).toBe('option1');
    expect(support(project, athenaPhase)).toMatchObject({
      selectedEncounterKey: 'GeneratedP',
      selectedPossible: true,
    });

    project = select(project, athenaPhase, 'AthenaCombatP');
    const evaluation = evaluatedSurfaceBiome(project, 'P').biome;
    if (!('rewards' in evaluation) || evaluation.validity !== 'valid') {
      throw new Error('P Athena fixture did not produce a valid reward evaluation');
    }
    const traitHistory = evaluation.rewards.branches[0]?.traitHistory;
    if (traitHistory === undefined) throw new Error('P Athena trait history is missing');
    expect(traitHistory?.equippedTraits.InvulnerabilityDashBoon).toMatchObject({
      giverKey: 'Athena',
      providerKind: 'npc',
    });
    expect(traitHistory?.elementCounts.Fire).toBeGreaterThan(0);
    expect(
      traitCandidates(catalog, 'Athena', traitHistory).find(
        (candidate) => candidate.traitKey === 'OlympianSpellCountBoon',
      ),
    ).toMatchObject({ available: false });
  });

  it('marks only a valid fixed terminating Intro as a dormant Combat suffix', () => {
    const { preparation, room } = pCombatPreparationFixture();
    const fixedRoom = fixedTerminatingIntro(room);

    const valid = prepareRoomEncounterPhases(
      fixedTerminatorCatalog(room, false),
      fixedRoom,
      preparation,
    );
    expect(valid.statuses.map(({ origin, status }) => [origin.phaseKey, status.kind])).toEqual([
      ['Intro', 'active'],
      ['Combat', 'dormantSuffix'],
    ]);
    expect(valid.candidates.find(({ origin }) => origin.phaseKey === 'Combat')).toBeUndefined();

    const failed = prepareRoomEncounterPhases(
      fixedTerminatorCatalog(room, true),
      fixedRoom,
      preparation,
    );
    expect(failed.statuses.map(({ origin, status }) => [origin.phaseKey, status.kind])).toEqual([
      ['Intro', 'active'],
      ['Combat', 'active'],
    ]);
    expect(failed.candidates.find(({ origin }) => origin.phaseKey === 'Combat')).toBeUndefined();
    expect(failed.findings).toContainEqual(
      expect.objectContaining({
        code: 'encounterSlotActivationUnavailable',
        origin: expect.objectContaining({ phaseKey: 'Intro' }),
      }),
    );
  });

  it('trims P Combat only for valid Heracles, retains its selection dormant, and restores it exactly', () => {
    const occurrenceId = pOccurrenceId('P_Combat02', 2, 1);
    const room = createOccurrenceAddress(pBiome, occurrenceId);
    const intro = phase(pBiome, occurrenceId, 'Intro');
    const combat = phase(pBiome, occurrenceId, 'Combat');
    const unavailable = phase(pBiome, pOccurrenceId('P_Combat06', 2, 2), 'Combat');
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
    expect(sequenceStatus(project, combat)).toEqual({ kind: 'active' });
    expect(sequenceStatus(project, unavailable)).toBeUndefined();

    project = select(project, intro, 'HeraclesCombatP');
    expect(support(project, combat)).toBeUndefined();
    expect(sequenceStatus(project, intro)).toEqual({ kind: 'active' });
    expect(sequenceStatus(project, combat)).toEqual({ kind: 'dormantSuffix' });
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
    expect(support(project, combat)).toBeUndefined();
    expect(sequenceStatus(project, intro)).toEqual({ kind: 'active' });
    expect(sequenceStatus(project, combat)).toEqual({ kind: 'active' });
    expect(evaluatedSurfaceBiome(project, 'P').biome.findings).not.toContainEqual(
      expect.objectContaining({ origin: combat }),
    );

    project = select(project, intro, 'GeneratedP_PreCombat');
    expect(support(project, combat)).toMatchObject({
      active: true,
      selectedEncounterKey: retainedCombat,
      selectedPossible: true,
    });
  });
});
