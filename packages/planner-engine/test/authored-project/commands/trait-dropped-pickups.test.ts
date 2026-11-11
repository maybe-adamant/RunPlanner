import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createProjectHistory,
  createRoomActionAddress,
  createRouteAddress,
  createTargetAddress,
  createTraitOfferAddress,
  roomActionDomainForOccurrence,
  roomActionKey,
  traitGeneratedPickupSiteKey,
  undoProjectHistory,
  type OccurrenceId,
  type ProjectDocument,
  type RoomActionReference,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHIProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { withItemContents } from '../../support/room-action-content';

const goldenF = createBiomeAddress('Underworld', 'F');
const combatId = createOccurrenceId('golden-f-b2-e1');
const incoming = createIncomingRewardAddress(goldenF, combatId);
const boonTrait = createTraitOfferAddress(incoming, 'source');
const combat = createOccurrenceAddress(goldenF, combatId);

function occurrence(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const found = project.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (found === undefined) throw new Error(`missing ${biomeKey} ${occurrenceId}`);
  return found;
}

/** The generated site holding `entryKey`; encounter sources key it by their encounter. */
function siteOf(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
  entryKey: string,
) {
  const found = Object.entries(
    occurrence(project, biomeKey, occurrenceId).acquisitionSites ?? {},
  ).find(
    ([siteKey, site]) =>
      siteKey.startsWith('traitGenerated:') && Object.hasOwn(site.pickupEntries ?? {}, entryKey),
  );
  if (found === undefined) throw new Error(`no generated site holds ${entryKey}`);
  return found[0];
}

function drops(siteKey: string, entryKeys: readonly string[]): RoomActionReference[] {
  return entryKeys.map((entryKey) => ({ kind: 'interactAcquisitionEntry', siteKey, entryKey }));
}

/** The drops as the engine records them for the room's items now. */
function dropRows(
  project: ProjectDocument,
  room: ReturnType<typeof createOccurrenceAddress>,
  siteKey: string,
  entryKeys: readonly string[],
) {
  return withItemContents(project, room, drops(siteKey, entryKeys));
}

/** The drops of one generated site the room offers as optional actions, placed or not. */
function offeredDrops(
  project: ProjectDocument,
  biome: ReturnType<typeof createBiomeAddress>,
  occurrenceId: OccurrenceId,
  siteKey: string,
) {
  return (
    roomActionDomainForOccurrence(project, catalog, biome, occurrenceId)?.domain.contributions ?? []
  ).flatMap((entry) =>
    entry.kind === 'action' &&
    entry.reference.kind === 'interactAcquisitionEntry' &&
    entry.reference.siteKey === siteKey
      ? [{ reference: entry.reference, participation: entry.participation }]
      : [],
  );
}

/** Picks up each drop at the end of the room, as its owner would. */
function takeDrops(
  project: ProjectDocument,
  biome: ReturnType<typeof createBiomeAddress>,
  occurrenceId: OccurrenceId,
  references: readonly RoomActionReference[],
) {
  let current = project;
  for (const reference of references)
    current = applyProjectCommand(current, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(biome, occurrenceId, roomActionKey(reference)),
      reference,
      index: occurrence(current, biome.biomeKey, occurrenceId).roomActions.order.length,
    });
  return current;
}

/** Places the room's active action that `matches`, which its drops spawn from, at the end. */
function takeSource(
  project: ProjectDocument,
  biome: ReturnType<typeof createBiomeAddress>,
  occurrenceId: OccurrenceId,
  matches: (reference: RoomActionReference) => boolean,
) {
  const source = roomActionDomainForOccurrence(
    project,
    catalog,
    biome,
    occurrenceId,
  )?.domain.contributions.find((entry) => entry.kind === 'action' && matches(entry.reference));
  if (source?.kind !== 'action') throw new Error('the drops have no active source');
  return takeDrops(project, biome, occurrenceId, [source.reference]);
}

const isContact = (reference: RoomActionReference) =>
  reference.kind === 'interactEncounter' && reference.phaseKey === 'Encounter';

const generatedRows = (order: readonly RoomActionReference[]) =>
  order.filter(
    (reference) =>
      reference.kind === 'interactAcquisitionEntry' &&
      reference.siteKey.startsWith('traitGenerated:'),
  );

const buriedTreasureDrops = [
  'smallGold',
  'tinyGold1',
  'tinyGold2',
  'minorHeal1',
  'minorHeal2',
  'bones',
] as const;

function poseidonBoonRoom(): ProjectDocument {
  return applyProjectCommand(createGoldenFGHIProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward: incoming,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
  });
}

const poseidonOffer = (selectedOptionKey: 'option1' | 'option2') => ({
  kind: 'traits' as const,
  giverKey: 'Poseidon',
  options: [
    { traitKey: 'RoomRewardBonusBoon', rarity: 'Common' as const },
    { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' as const },
    { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' as const },
  ] as const,
  selectedOptionKey,
  rarificationActions: [],
});

describe('trait-dropped pickups', () => {
  it('offers Buried Treasure’s drops with default payloads without placing them, as one Undo step', () => {
    const before = poseidonBoonRoom();
    const history = applyProjectHistoryCommand(createProjectHistory(before), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: boonTrait,
      value: poseidonOffer('option1'),
    });
    const room = occurrence(history.present, 'F', combatId);
    const siteKey = traitGeneratedPickupSiteKey(boonTrait, 'option1');
    expect(generatedRows(room.roomActions.order)).toEqual([]);
    expect(offeredDrops(history.present, goldenF, combatId, siteKey)).toEqual(
      dropRows(history.present, combat, siteKey, buriedTreasureDrops).map((reference) => ({
        reference,
        participation: 'optional',
      })),
    );
    expect(room.acquisitionSites?.[siteKey]?.pickupEntries).toMatchObject({
      smallGold: { offer: { rewardType: 'RoomMoneySmallDrop' } },
      tinyGold1: { offer: { rewardType: 'RoomMoneyTinyDrop' } },
      minorHeal1: { offer: { rewardType: 'HealDropMinor' } },
      bones: { offer: { rewardType: 'MetaCurrencyDrop' } },
    });
    expect(undoProjectHistory(history).present).toBe(before);
  });

  it('removes the taken drops with their option and offers them where the trait is offered again', () => {
    const buried = traitGeneratedPickupSiteKey(boonTrait, 'option1');
    let project = takeDrops(
      applyProjectCommand(poseidonBoonRoom(), catalog, {
        kind: 'ReplaceTraitOffer',
        trait: boonTrait,
        value: poseidonOffer('option1'),
      }),
      goldenF,
      combatId,
      drops(buried, buriedTreasureDrops),
    );
    const taken = (document: ProjectDocument) =>
      generatedRows(occurrence(document, 'F', combatId).roomActions.order);
    expect(taken(project)).toEqual(dropRows(project, combat, buried, buriedTreasureDrops));

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: boonTrait,
      selectedOptionKey: 'option2',
    });
    expect(taken(project)).toEqual([]);
    expect(occurrence(project, 'F', combatId).acquisitionSites?.[buried]).toBeUndefined();

    // The same trait offered again at another option drops under that option.
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: boonTrait,
      value: {
        ...poseidonOffer('option2'),
        options: [
          { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' },
          { traitKey: 'RoomRewardBonusBoon', rarity: 'Common' },
          { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
        ],
      },
    });
    const again = traitGeneratedPickupSiteKey(boonTrait, 'option2');
    expect(taken(project)).toEqual([]);
    expect(
      offeredDrops(project, goldenF, combatId, again).map(({ reference }) => reference),
    ).toEqual(dropRows(project, combat, again, buriedTreasureDrops));
  });

  it('offers Quick Buck’s gold without placing it', () => {
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: incoming,
      value: { rewardType: 'HermesUpgrade' },
    });
    const state = occurrence(project, 'F', combatId).state;
    if (state.kind !== 'counted') throw new Error('expected a counted room');
    const [role] = Object.keys(state.reward?.traitOffersByAcquisitionRole ?? {});
    const trait = createTraitOfferAddress(incoming, role!);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'DodgeChanceBoon', rarity: 'Common' },
          { traitKey: 'MoneyMultiplierBoon', rarity: 'Common' },
          { traitKey: 'SlowProjectileBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
        rarificationActions: [],
      },
    });
    // The gold drops once the Hermes reward is picked up.
    project = takeSource(
      project,
      goldenF,
      combatId,
      (reference) =>
        reference.kind === 'interactIncomingReward' && reference.acquisitionRole === role,
    );
    const room = occurrence(project, 'F', combatId);
    const siteKey = traitGeneratedPickupSiteKey(trait, 'option2');
    expect(generatedRows(room.roomActions.order)).toEqual([]);
    expect(offeredDrops(project, goldenF, combatId, siteKey)).toEqual([
      {
        reference: dropRows(project, combat, siteKey, ['quickBuckGold'])[0],
        participation: 'optional',
      },
    ]);
    expect(room.acquisitionSites?.[siteKey]?.pickupEntries).toMatchObject({
      quickBuckGold: { offer: { rewardType: 'RoomMoneyDrop' } },
    });
  });

  it('keeps a removed drop out through later edits of the same room', () => {
    const siteKey = traitGeneratedPickupSiteKey(boonTrait, 'option1');
    let project = takeDrops(
      applyProjectCommand(poseidonBoonRoom(), catalog, {
        kind: 'ReplaceTraitOffer',
        trait: boonTrait,
        value: poseidonOffer('option1'),
      }),
      goldenF,
      combatId,
      drops(siteKey, buriedTreasureDrops),
    );
    const bones = drops(siteKey, ['bones'])[0]!;
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(goldenF, combatId, roomActionKey(bones)),
    });
    const smallGold = drops(siteKey, ['smallGold'])[0]!;
    const order = occurrence(project, 'F', combatId).roomActions.order;
    project = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(goldenF, combatId, roomActionKey(smallGold)),
      toIndex: order.length - 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(createOccurrenceAddress(goldenF, combatId), siteKey),
        'smallGold',
      ),
      value: { rewardType: 'RoomMoneySmallDrop' },
    });
    expect(occurrence(project, 'F', combatId).roomActions.order).not.toContainEqual(
      dropRows(project, combat, siteKey, ['bones'])[0],
    );
  });

  it('installs a route whose Buried Treasure drops were removed without taking them again', () => {
    const siteKey = traitGeneratedPickupSiteKey(boonTrait, 'option1');
    let authored = takeDrops(
      applyProjectCommand(poseidonBoonRoom(), catalog, {
        kind: 'ReplaceTraitOffer',
        trait: boonTrait,
        value: poseidonOffer('option1'),
      }),
      goldenF,
      combatId,
      drops(siteKey, buriedTreasureDrops),
    );
    for (const drop of drops(siteKey, buriedTreasureDrops))
      authored = applyProjectCommand(authored, catalog, {
        kind: 'RemoveRoomAction',
        action: createRoomActionAddress(goldenF, combatId, roomActionKey(drop)),
      });
    const authoredOrder = occurrence(authored, 'F', combatId).roomActions.order;
    expect(authoredOrder).not.toEqual(
      expect.arrayContaining([...dropRows(authored, combat, siteKey, ['smallGold'])]),
    );

    const { runModifiers: _runModifiers, ...loadout } = authored.route.loadout;
    void _runModifiers;
    const installed = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceRoute',
      route: createRouteAddress(authored.route.routeKey),
      loadout,
      biomes: authored.route.biomes,
    });
    expect(occurrence(installed, 'F', combatId).roomActions.order).toEqual(authoredOrder);
    expect(installed.route.biomes).toEqual(authored.route.biomes);
  });

  it('takes no clocked Supply Chain drop', () => {
    let project = loadSurfaceNOProject();
    const phase = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat01 },
      'Combat1',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'IcarusCombatO',
    });
    const before = occurrence(project, 'O', oOccurrenceIds.combat01).roomActions.order;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(phase, 'selection'),
      value: {
        kind: 'traits',
        giverKey: 'Icarus',
        options: [
          { traitKey: 'SupplyDropBoon' },
          { traitKey: 'OmegaExplodeBoon' },
          { traitKey: 'CastHazardBoon' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    expect(occurrence(project, 'O', oOccurrenceIds.combat01).roomActions.order).toEqual(before);
  });
});

describe('Narcissus drops', () => {
  function narcissusAtOrdinal(ordinal: 1 | 3 | 4) {
    const itinerary = { 1: ['G', 'F', 'H', 'I'], 3: ['F', 'H', 'G', 'I'], 4: ['F', 'H', 'I', 'G'] }[
      ordinal
    ];
    const biome = createBiomeAddress('Dream', 'G');
    const storyId = createOccurrenceId(`dream-narcissus-${ordinal}`);
    let project = createProjectDocument(catalog, {
      projectId: `dream-narcissus-${ordinal}`,
      routeKey: 'Dream',
      itineraryBiomeKeys: itinerary,
      configuredBiomeCount: 4,
    });
    const plan = project.route.biomes.find((candidate) => candidate.biomeKey === 'G')!;
    const decision = createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: plan.topology!.startOccurrenceId,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, decision.source),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, 'exit1'),
      occurrenceId: storyId,
      gameName: 'G_Story01',
    });
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        biome,
        { kind: 'occurrence', occurrenceId: storyId },
        'Encounter',
      ),
      'selection',
    );
    // Narcissus's drops spawn from talking to him.
    project = takeSource(project, biome, storyId, isContact);
    return { project, trait, storyId };
  }

  const narcissusOffer = (first: string) => ({
    kind: 'traits' as const,
    giverKey: 'Narcissus',
    options: [{ traitKey: first }, { traitKey: 'NarcissusB' }, { traitKey: 'NarcissusC' }] as const,
    selectedOptionKey: 'option1' as const,
  });

  for (const [ordinal, poms] of [
    [1, ['pom']],
    [3, ['pom', 'pom2']],
    [4, ['pom', 'pom2', 'pom3', 'pom4']],
  ] as const)
    it(`offers Verdure Sampler’s ${poms.length} Pom drops at biome ordinal ${ordinal} without placing them`, () => {
      const { project, trait, storyId } = narcissusAtOrdinal(ordinal);
      const taken = applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait,
        value: narcissusOffer('NarcissusA'),
      });
      const siteKey = siteOf(taken, 'G', storyId, 'pom');
      expect(generatedRows(occurrence(taken, 'G', storyId).roomActions.order)).toEqual([]);
      expect(
        offeredDrops(taken, createBiomeAddress('Dream', 'G'), storyId, siteKey).map(
          ({ reference }) => reference,
        ),
      ).toEqual(
        dropRows(
          taken,
          createOccurrenceAddress(createBiomeAddress('Dream', 'G'), storyId),
          siteKey,
          poms,
        ),
      );
    });

  it('drops the taken pickups with a reset offer', () => {
    const { project, trait, storyId } = narcissusAtOrdinal(1);
    const taken = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: narcissusOffer('NarcissusE'),
    });
    const siteKey = siteOf(taken, 'G', storyId, 'maxHealth');
    const picked = takeDrops(
      taken,
      createBiomeAddress('Dream', 'G'),
      storyId,
      drops(siteKey, ['bones', 'maxHealth']),
    );
    expect(occurrence(picked, 'G', storyId).roomActions.order).toEqual(
      expect.arrayContaining([
        ...dropRows(
          picked,
          createOccurrenceAddress(createBiomeAddress('Dream', 'G'), storyId),
          siteKey,
          ['bones', 'maxHealth'],
        ),
      ]),
    );
    const reset = applyProjectCommand(picked, catalog, { kind: 'ResetEncounterTraitOffer', trait });
    expect(
      occurrence(reset, 'G', storyId).roomActions.order.some(
        (reference) => reference.kind === 'interactAcquisitionEntry',
      ),
    ).toBe(false);
  });

  it('offers Buried Treasure’s drops without Bones from a Story room Mystery Boon', () => {
    const project = createGoldenFGHIProject();
    const story = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')!
      .topology!.occurrences.find((candidate) => candidate.gameName === 'G_Story01')!;
    const storyId: OccurrenceId = story.occurrenceId;
    const trait: TraitOfferAddress = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId: storyId },
        'Encounter',
      ),
      'selection',
    );
    let taken = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: narcissusOffer('NarcissusI'),
    });
    const narcissusSite = siteOf(taken, 'G', storyId, 'mysteryBoon');
    const mysteryBoon = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(createOccurrenceAddress(goldenGBiome, storyId), narcissusSite),
      'mysteryBoon',
    );
    taken = applyProjectCommand(taken, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: mysteryBoon,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    });
    taken = takeDrops(taken, goldenGBiome, storyId, drops(narcissusSite, ['mysteryBoon']));
    const hiddenSource = createTraitOfferAddress(mysteryBoon, 'hiddenSource');
    taken = applyProjectCommand(taken, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: hiddenSource,
      value: poseidonOffer('option1'),
    });
    const siteKey = traitGeneratedPickupSiteKey(hiddenSource, 'option1');
    expect(
      offeredDrops(taken, goldenGBiome, storyId, siteKey).map(({ reference }) => reference),
    ).toEqual(
      dropRows(
        taken,
        createOccurrenceAddress(goldenGBiome, storyId),
        siteKey,
        buriedTreasureDrops.slice(0, 5),
      ),
    );
  });
});
