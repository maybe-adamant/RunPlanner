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
import { loadUnderworldGeneratedCompositionCheckpoint } from '../checkpoints/underworld';
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
