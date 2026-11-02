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

const goldenF = createBiomeAddress('Underworld', 'F');
const combatId = createOccurrenceId('golden-f-b2-e1');
const incoming = createIncomingRewardAddress(goldenF, combatId);
const boonTrait = createTraitOfferAddress(incoming, 'source');

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

/** The room's order from its source acquisition on. */
function fromSource(order: readonly RoomActionReference[], source: RoomActionReference) {
  const index = order.findIndex((reference) => roomActionKey(reference) === roomActionKey(source));
  expect(index).toBeGreaterThanOrEqual(0);
  return order.slice(index);
}

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
  it('takes Buried Treasure’s drops right after its source with default payloads, as one Undo step', () => {
    const before = poseidonBoonRoom();
    const history = applyProjectHistoryCommand(createProjectHistory(before), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: boonTrait,
      value: poseidonOffer('option1'),
    });
    const room = occurrence(history.present, 'F', combatId);
    const siteKey = traitGeneratedPickupSiteKey(boonTrait, 'option1');
    const source = room.roomActions.order.find((reference) =>
      reference.kind === 'interactIncomingReward' ? reference.acquisitionRole === 'source' : false,
    )!;
    expect(source).toBeDefined();
    expect(fromSource(room.roomActions.order, source).slice(0, 7)).toEqual([
      source,
      ...drops(siteKey, buriedTreasureDrops),
    ]);
    expect(room.acquisitionSites?.[siteKey]?.pickupEntries).toMatchObject({
      smallGold: { offer: { rewardType: 'RoomMoneySmallDrop' } },
      tinyGold1: { offer: { rewardType: 'RoomMoneyTinyDrop' } },
      minorHeal1: { offer: { rewardType: 'HealDropMinor' } },
      bones: { offer: { rewardType: 'MetaCurrencyDrop' } },
    });
    expect(undoProjectHistory(history).present).toBe(before);
  });

  it('removes the drops with their option and takes them where the trait is offered again', () => {
    let project = applyProjectCommand(poseidonBoonRoom(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: boonTrait,
      value: poseidonOffer('option1'),
    });
    const buried = traitGeneratedPickupSiteKey(boonTrait, 'option1');
    const taken = (document: ProjectDocument) =>
      occurrence(document, 'F', combatId).roomActions.order.filter(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey.startsWith('traitGenerated:'),
      );
    expect(taken(project)).toEqual(drops(buried, buriedTreasureDrops));

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
    expect(taken(project)).toEqual(
      drops(traitGeneratedPickupSiteKey(boonTrait, 'option2'), buriedTreasureDrops),
    );
  });

  it('takes Quick Buck’s gold right after its Hermes source', () => {
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
    const room = occurrence(project, 'F', combatId);
    const siteKey = traitGeneratedPickupSiteKey(trait, 'option2');
    const source = room.roomActions.order.find(
      (reference) =>
        reference.kind === 'interactIncomingReward' && reference.acquisitionRole === role,
    )!;
    expect(fromSource(room.roomActions.order, source).slice(0, 2)).toEqual([
      source,
      ...drops(siteKey, ['quickBuckGold']),
    ]);
    expect(room.acquisitionSites?.[siteKey]?.pickupEntries).toMatchObject({
      quickBuckGold: { offer: { rewardType: 'RoomMoneyDrop' } },
    });
  });

  it('keeps a removed drop out through later edits of the same room', () => {
    let project = applyProjectCommand(poseidonBoonRoom(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: boonTrait,
      value: poseidonOffer('option1'),
    });
    const siteKey = traitGeneratedPickupSiteKey(boonTrait, 'option1');
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
    expect(occurrence(project, 'F', combatId).roomActions.order).not.toContainEqual(bones);
  });

  it('installs a route whose Buried Treasure drops were removed without taking them again', () => {
    let authored = applyProjectCommand(poseidonBoonRoom(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: boonTrait,
      value: poseidonOffer('option1'),
    });
    const siteKey = traitGeneratedPickupSiteKey(boonTrait, 'option1');
    for (const drop of drops(siteKey, buriedTreasureDrops))
      authored = applyProjectCommand(authored, catalog, {
        kind: 'RemoveRoomAction',
        action: createRoomActionAddress(goldenF, combatId, roomActionKey(drop)),
      });
    const authoredOrder = occurrence(authored, 'F', combatId).roomActions.order;
    expect(authoredOrder).not.toEqual(expect.arrayContaining(drops(siteKey, ['smallGold'])));

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
    it(`takes Verdure Sampler’s ${poms.length} Pom drops at biome ordinal ${ordinal} at room exit`, () => {
      const { project, trait, storyId } = narcissusAtOrdinal(ordinal);
      const taken = applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait,
        value: narcissusOffer('NarcissusA'),
      });
      const order = occurrence(taken, 'G', storyId).roomActions.order;
      const siteKey = siteOf(taken, 'G', storyId, 'pom');
      expect(
        order.filter(
          (reference) =>
            reference.kind === 'interactAcquisitionEntry' && reference.siteKey === siteKey,
        ),
      ).toEqual(drops(siteKey, poms));
      expect(order.at(-1)).toEqual(drops(siteKey, poms).at(-1));
    });

  it('drops the taken pickups with a reset offer', () => {
    const { project, trait, storyId } = narcissusAtOrdinal(1);
    const taken = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: narcissusOffer('NarcissusE'),
    });
    const siteKey = siteOf(taken, 'G', storyId, 'maxHealth');
    expect(occurrence(taken, 'G', storyId).roomActions.order).toEqual(
      expect.arrayContaining(drops(siteKey, ['bones', 'maxHealth'])),
    );
    const reset = applyProjectCommand(taken, catalog, { kind: 'ResetEncounterTraitOffer', trait });
    expect(
      occurrence(reset, 'G', storyId).roomActions.order.some(
        (reference) => reference.kind === 'interactAcquisitionEntry',
      ),
    ).toBe(false);
  });

  it('takes Buried Treasure’s drops without Bones from a Story room Mystery Boon', () => {
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
    const hiddenSource = createTraitOfferAddress(mysteryBoon, 'hiddenSource');
    taken = applyProjectCommand(taken, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: hiddenSource,
      value: poseidonOffer('option1'),
    });
    const siteKey = traitGeneratedPickupSiteKey(hiddenSource, 'option1');
    const source = drops(narcissusSite, ['mysteryBoon'])[0]!;
    expect(
      fromSource(occurrence(taken, 'G', storyId).roomActions.order, source).slice(0, 6),
    ).toEqual([source, ...drops(siteKey, buriedTreasureDrops.slice(0, 5))]);
  });
});
