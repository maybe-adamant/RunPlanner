import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  createStartingRewardAddress,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  loadUnderworldFGHICheckpoint,
  loadUnderworldGeneratedCompositionCheckpoint,
} from '../checkpoints/underworld';
import { authorLegalTraitOffers } from '../shared';

export const freshFileFBiome = createBiomeAddress('FreshFile', 'F');
const biome = freshFileFBiome;
const boon = (source: string): ResolvedRewardOffer => ({
  rewardType: 'Boon',
  payload: { kind: 'BoonSource', source },
});
const shopOffers: Readonly<Record<string, ResolvedRewardOffer>> = {
  Boon: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  MajorNonBoon: { rewardType: 'RoomRewardHealDrop' },
  Minor: { rewardType: 'MaxManaDrop' },
};

/** A complete valid Fresh File F: each batch selects its first exit. */
const freshF: readonly {
  readonly storeKey: 'RunProgress' | 'MetaProgress';
  readonly targets: readonly (readonly [string, ResolvedRewardOffer | null])[];
}[] = [
  { storeKey: 'RunProgress', targets: [['F_Combat01', boon('ApolloUpgrade')]] },
  {
    storeKey: 'MetaProgress',
    targets: [['F_Combat02', { rewardType: 'MetaCardPointsCommonDrop' }]],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      ['F_Combat03', { rewardType: 'RoomMoneyDrop' }],
      ['F_Combat04', { rewardType: 'MaxManaDrop' }],
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      ['F_Combat07', boon('ApolloUpgrade')],
      ['F_Combat06', boon('PoseidonUpgrade')],
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      ['F_Combat19', { rewardType: 'MaxHealthDrop' }],
      ['F_Combat08', { rewardType: 'MaxManaDrop' }],
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      ['F_Shop01', null],
      ['F_MiniBoss01', boon('ApolloUpgrade')],
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      ['F_Combat11', { rewardType: 'MetaCardPointsCommonDrop' }],
      ['F_Combat12', { rewardType: 'MetaCurrencyDrop' }],
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      ['F_Combat13', { rewardType: 'RoomMoneyDrop' }],
      ['F_Combat14', boon('ApolloUpgrade')],
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      ['F_Combat15', { rewardType: 'StackUpgrade' }],
      ['F_Combat16', { rewardType: 'MaxHealthDrop' }],
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      ['F_Combat17', { rewardType: 'MetaCardPointsCommonDrop' }],
      ['F_Combat18', { rewardType: 'MetaCurrencyDrop' }],
    ],
  },
];
export const freshFileFMidshopId = createOccurrenceId('fresh-5-0');
const prebossShop = createOccurrenceId('fresh-preboss-shop');
export const freshFileFPostbossId = createOccurrenceId('fresh-preboss-shop:postboss');

function authorShop(
  project: ProjectDocument,
  occurrenceId: typeof freshFileFMidshopId,
): ProjectDocument {
  return Object.entries(shopOffers).reduce(
    (next, [offerKey, value]) =>
      applyProjectCommand(next, catalog, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(biome, occurrenceId, offerKey),
        value,
      }),
    project,
  );
}

/** A complete valid Fresh File F ending in its automatic Boss and Postboss. */
export function createFreshFileFProject(): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'fresh-f',
    routeKey: 'FreshFile',
    configuredBiomeCount: 1,
  });
  let parent = project.route.biomes[0]!.topology!.startOccurrenceId;
  const selectFirst = (decision: ReturnType<typeof createExitDecisionAddress>) => {
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, decision.source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
  };
  freshF.forEach(({ storeKey, targets }, depth) => {
    const decision = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: parent });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, decision.source),
      storeKey,
    });
    targets.forEach(([gameName, offer], index) => {
      const occurrenceId = createOccurrenceId(`fresh-${depth}-${index}`);
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, decision.source, `exit${index + 1}`),
        occurrenceId,
        gameName,
      });
      if (offer !== null)
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(biome, occurrenceId),
          value: offer,
        });
    });
    if (targets.length > 1) selectFirst(decision);
    parent = createOccurrenceId(`fresh-${depth}-0`);
    if (targets[0]![0] === 'F_Shop01') project = authorShop(project, parent);
  });
  const decision = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: parent });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision,
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: { exit1: prebossShop, exit2: createOccurrenceId('fresh-preboss-free') },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, createOccurrenceId('fresh-preboss-free')),
    value: { rewardType: 'StackUpgrade' },
  });
  selectFirst(decision);
  return authorLegalTraitOffers(authorShop(project, prebossShop));
}

/**
 * The same F with Postboss state a save made before Fresh File excluded the
 * rack, Pool and Wells could still hold.
 */
export function withRetainedFreshFilePostboss(
  project: ProjectDocument,
  retained: {
    readonly well?: boolean;
    readonly poolSaleTraitKey?: string | null;
    readonly rackKeepsakeKey?: string;
  },
): ProjectDocument {
  const encoded = JSON.parse(encodeProjectDocument(project));
  const raw = encoded.route.biomes[0].topology.occurrences.find(
    (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === freshFileFPostbossId,
  );
  const order = [...raw.roomActions.order];
  if (retained.well === true)
    raw.stygianWell = {
      interacted: false,
      offerKeyBySlot: { healing: null, secondLeft: null, secondRight: null },
    };
  if (retained.poolSaleTraitKey !== undefined) {
    raw.purgingPool = {
      interacted: true,
      traitKeyBySlot: { left: retained.poolSaleTraitKey, middle: null, right: null },
    };
    if (retained.poolSaleTraitKey !== null)
      order.push({ kind: 'sellPurgingPoolTrait', slotKey: 'left' });
  }
  if (retained.rackKeepsakeKey !== undefined) {
    raw.keepsakeRack = { keepsakeKey: retained.rackKeepsakeKey };
    order.push({ kind: 'interactKeepsakeRack' });
  }
  raw.roomActions = { order };
  return decodeProjectDocument(encoded, catalog);
}

export const freshFileIntroId = createOccurrenceId('fresh-intro');

/** A Fresh File opening followed by the forced F_Combat01 and its Apollo boon. */
export function createFreshFileFirstSequence(projectId = 'fresh-first-sequence'): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId,
    routeKey: 'FreshFile',
    configuredBiomeCount: 1,
  });
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: project.route.biomes[0]!.topology!.startOccurrenceId,
  });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, decision.source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, decision.source, 'exit1'),
    occurrenceId: freshFileIntroId,
    gameName: 'F_Combat01',
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, freshFileIntroId),
    value: boon('ApolloUpgrade'),
  });
}

export const matureCombat01Biome = createBiomeAddress('Underworld', 'F');
export const matureCombat01StartId = createOccurrenceId('mature-start');
export const matureCombat01Id = createOccurrenceId('mature-combat01');

/** The mature counterpart: F_Combat01 after the opening, carrying a counted Apollo boon. */
export function createMatureCombat01Sequence(): ProjectDocument {
  const mature = matureCombat01Biome;
  let project = createProjectDocument(catalog, {
    projectId: 'mature-combat01',
    routeKey: 'Underworld',
    configuredBiomeCount: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Underworld'),
    value: boon('PoseidonUpgrade'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: mature,
    occurrenceId: matureCombat01StartId,
    gameName: 'F_Opening01',
  });
  const decision = createExitDecisionAddress(mature, {
    kind: 'occurrence',
    occurrenceId: matureCombat01StartId,
  });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(mature, decision.source),
    // F_Combat01's ForcedRewardStore still resolves its reward from RunProgress.
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(mature, decision.source, 'exit1'),
    occurrenceId: matureCombat01Id,
    gameName: 'F_Combat01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(mature, matureCombat01Id),
    value: boon('ApolloUpgrade'),
  });
  return authorLegalTraitOffers(project);
}

/** A fresh profile's Nectar grants no boon level, so its authored child goes. */
function withoutNectarLevels(value: unknown): void {
  if (Array.isArray(value)) return value.forEach(withoutNectarLevels);
  if (value === null || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if ((record.offer as { rewardType?: string } | undefined)?.rewardType === 'GiftDrop')
    delete record.levelResolutionsByAcquisitionRole;
  Object.values(record).forEach(withoutNectarLevels);
}

/**
 * The mature generated-composition F prefix, made fresh-legal and continued
 * from the Fresh first sequence; it keeps its retained customization.
 */
export function createFreshFileGeneratedComposition(): ProjectDocument {
  // A fresh bag holds no Bones before the first Ashes pickup, and no Zeus or Hera.
  const mature = JSON.parse(
    encodeProjectDocument(loadUnderworldGeneratedCompositionCheckpoint())
      .replaceAll('"MetaCurrencyDrop"', '"MetaCardPointsCommonDrop"')
      .replaceAll('"Zeus', '"Poseidon')
      .replaceAll('"Hera', '"Demeter'),
  );
  withoutNectarLevels(mature);
  const fresh = JSON.parse(encodeProjectDocument(createFreshFileFirstSequence()));
  const [matureF] = mature.route.biomes;
  const [freshF] = fresh.route.biomes;
  const matureStart: string = matureF.topology.startOccurrenceId;
  const occurrences = matureF.topology.occurrences.filter(
    (occurrence: { occurrenceId: string }) => occurrence.occurrenceId !== matureStart,
  );
  for (const occurrence of occurrences) delete occurrence.startingRewardAcquisition;
  const decisions = matureF.topology.decisions.map(
    (decision: { source: { kind: string; occurrenceId?: string } }) =>
      decision.source.occurrenceId === matureStart
        ? { ...decision, source: { kind: 'occurrence', occurrenceId: freshFileIntroId } }
        : decision,
  );
  const topology = {
    ...matureF.topology,
    startOccurrenceId: freshF.topology.startOccurrenceId,
    occurrences: [...freshF.topology.occurrences, ...occurrences],
    decisions: [...freshF.topology.decisions, ...decisions],
  };
  return authorLegalTraitOffers(
    decodeProjectDocument(
      { ...mature, route: { ...fresh.route, biomes: [{ ...matureF, topology }] } },
      catalog,
    ),
  );
}

/**
 * A save carrying a GeneratedF customization on Fresh F_Combat01, which the
 * route's FIntroFight rule has since replaced.
 */
export function withRetainedFreshFileIntroCustomization(project: ProjectDocument): ProjectDocument {
  const retained =
    loadUnderworldGeneratedCompositionCheckpoint().route.biomes[0]!.topology!.occurrences.find(
      (occurrence) => occurrence.encounters.customizationByPhase?.Encounter !== undefined,
    )!.encounters.customizationByPhase!;
  const raw = JSON.parse(encodeProjectDocument(project));
  raw.route.biomes[0].topology.occurrences.find(
    (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === freshFileIntroId,
  ).encounters.customizationByPhase = retained;
  return decodeProjectDocument(raw, catalog);
}

export const freshFileGBiome = createBiomeAddress('FreshFile', 'G');
export const freshFileHBiome = createBiomeAddress('FreshFile', 'H');
export const freshFileIBiome = createBiomeAddress('FreshFile', 'I');
/** The first G combat, which resolves FishmanIntro. */
export const freshFileGFirstCombatId = createOccurrenceId('golden-g-b1-e1');
/** The second G combat, entered after FishmanIntro at the same biome depth. */
export const freshFileGSecondCombatId = createOccurrenceId('golden-g-b2-e1');
export const freshFileBridgeId = createOccurrenceId('golden-h-bridge01');
export const freshFileIFirstCombatId = createOccurrenceId('golden-i-combat01');
export const freshFileIShopId = createOccurrenceId('golden-i-preboss');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- decoded JSON edited before strict decoding
type RawJson = any;

function replaceRaw(target: RawJson, value: RawJson): void {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, value);
}

const boonOffer = (source: string) => ({
  rewardType: 'Boon',
  payload: { kind: 'BoonSource', source },
});

/**
 * A complete valid Fresh File F→I: the command-built F, then the golden G/H/I
 * made fresh-legal. G's first combat resolves FishmanIntro and I's
 * ClockworkIntro; the entered H_Bridge01 is a WorldShop; the I Shop's fifth
 * slot is cleared through ClearShopOffer.
 */
export function createFreshFileRouteProject(): ProjectDocument {
  const fresh = JSON.parse(encodeProjectDocument(createFreshFileFProject()));
  const mature = JSON.parse(
    encodeProjectDocument(loadUnderworldFGHICheckpoint()).replaceAll('Underworld', 'FreshFile'),
  );
  const biomes: RawJson[] = mature.route.biomes.slice(1);
  const [g, h] = biomes;
  const occurrence = (id: string): RawJson =>
    biomes
      .flatMap((biome) => biome.topology.occurrences)
      .find((candidate) => candidate.occurrenceId === id);
  const decision = (biome: RawJson, sourceId: string): RawJson =>
    biome.topology.decisions.find(
      (candidate: RawJson) => candidate.source.occurrenceId === sourceId,
    );
  const recast = (id: string, gameName: string, fromId = id) =>
    replaceRaw(occurrence(id), {
      ...structuredClone(occurrence(fromId)),
      occurrenceId: id,
      gameName,
    });

  // G: no Narcissus story or MiniBoss02 on a fresh profile, and FishmanIntro
  // leaves the third batch at biome encounter depth 2.
  recast('golden-g-b3-e1', 'G_Combat04', 'golden-g-b3-e2');
  occurrence('golden-g-b3-e2').gameName = 'G_Combat05';
  occurrence('golden-g-b3-e3').gameName = 'G_Combat06';
  const fourth = decision(g, 'golden-g-b3-e1');
  fourth.normal.targets.push({ exitKey: 'exit2', occurrenceId: 'golden-g-b4-e2' });
  fourth.selection = { kind: 'normal', exitKey: 'exit1' };
  g.topology.occurrences.push({
    ...structuredClone(occurrence('golden-g-b4-e1')),
    occurrenceId: 'golden-g-b4-e2',
    gameName: 'G_Combat11',
  });
  occurrence('golden-g-b6-e2').gameName = 'G_MiniBoss03';
  // H: the bridge is entered as a Shop, forcing MiniBoss02 after it.
  recast('golden-h-bridge01', 'H_Bridge01', 'golden-g-b5-e1');
  recast('golden-h-combat05', 'H_MiniBoss02', 'golden-h-miniboss01');
  decision(h, 'golden-h-combat09').selection = { kind: 'normal', exitKey: 'exit2' };
  decision(h, 'golden-h-miniboss01').source.occurrenceId = 'golden-h-bridge01';
  // I: no Story and the fresh I_PreBoss01.
  recast('golden-i-story01', 'I_Combat04', 'golden-i-combat03');
  occurrence('golden-i-story01').state.reward = {};
  for (const id of ['golden-g-preboss-shop:postboss', 'golden-h-preboss-shop:postboss']) {
    delete occurrence(id).stygianWell;
    delete occurrence(id).purgingPool;
  }
  const incoming: Readonly<Record<string, RawJson>> = {
    'golden-g-b1-e1': { rewardType: 'MetaCardPointsCommonDrop' },
    'golden-g-b2-e1': { rewardType: 'MetaCardPointsCommonDrop' },
    'golden-g-b2-e2': { rewardType: 'MetaCurrencyDrop' },
    'golden-g-b3-e1': { rewardType: 'MetaCardPointsCommonDrop' },
    'golden-g-b3-e2': { rewardType: 'MetaCurrencyDrop' },
    'golden-g-b3-e3': { rewardType: 'RoomRewardHealDrop' },
    'golden-g-b4-e2': { rewardType: 'MaxHealthDrop' },
    'golden-g-b6-e2': boonOffer('ApolloUpgrade'),
    'golden-i-story01': { rewardType: 'RoomMoneyTripleDrop' },
    'golden-i-combat02': { rewardType: 'StackUpgradeTriple' },
  };
  const cages: Readonly<Record<string, Readonly<Record<string, RawJson>>>> = {
    'golden-h-combat09': {
      cage1: { rewardType: 'RoomMoneyDrop' },
      cage2: boonOffer('PoseidonUpgrade'),
      cage3: boonOffer('ApolloUpgrade'),
    },
    'golden-h-combat03': { cage2: { rewardType: 'MaxManaDrop' } },
  };
  const rewards = [
    ...Object.entries(incoming).map(([id, offer]) => [occurrence(id).state.reward, offer]),
    ...Object.entries(cages).flatMap(([id, slots]) =>
      Object.entries(slots).map(([slot, offer]) => [occurrence(id).state.cages[slot], offer]),
    ),
  ];
  for (const [reward, offer] of rewards) {
    const role = offer.rewardType === 'Boon' ? 'source' : 'self';
    reward.offer = offer;
    reward.traitOffersByAcquisitionRole = role === 'source' ? { source: null } : {};
    reward.dispositionByAcquisitionRole = { [role]: { kind: 'normal' } };
    if (offer.rewardType === 'StackUpgradeTriple')
      reward.levelResolutionsByAcquisitionRole = {
        self: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
      };
  }
  // Fresh gods and resource tiers; every trait offer is re-authored below.
  const legal = JSON.parse(
    JSON.stringify(biomes)
      .replaceAll('"HestiaUpgrade"', '"PoseidonUpgrade"')
      .replaceAll('"ZeusUpgrade"', '"PoseidonUpgrade"')
      .replaceAll('"I_PreBoss02"', '"I_PreBoss01"')
      .replaceAll('"MetaCurrencyBigDrop"', '"MetaCardPointsCommonDrop"')
      .replaceAll('"MetaCardPointsCommonBigDrop"', '"MetaCardPointsCommonDrop"'),
  );
  withUnresolvedTraitOffers(legal);
  let project = decodeProjectDocument(
    {
      ...fresh,
      projectId: 'fresh-route',
      route: {
        ...fresh.route,
        itineraryBiomeKeys: ['F', 'G', 'H', 'I'],
        biomes: [fresh.route.biomes[0], ...legal],
      },
    },
    catalog,
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ClearShopOffer',
    offer: createShopOfferAddress(freshFileIBiome, freshFileIShopId, 'MetaProgress'),
  });
  return authorLegalTraitOffers(project);
}

function withUnresolvedTraitOffers(value: RawJson): void {
  if (Array.isArray(value)) return value.forEach(withUnresolvedTraitOffers);
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, RawJson>)) {
    if (key === 'traitOffersByAcquisitionRole' && child !== null)
      for (const role of Object.keys(child)) child[role] = null;
    else withUnresolvedTraitOffers(child);
  }
}
