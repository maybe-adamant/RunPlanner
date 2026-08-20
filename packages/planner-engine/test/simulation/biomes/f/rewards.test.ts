import {
  applyProjectCommand,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionSiteAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createRouteAddress,
  createProjectDocument,
  createShopOfferAddress,
  createAcquisitionEntryAddress,
  createTargetAddress,
  createTraitOfferAddress,
  createAcquisitionRoleAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeBiomeHistory,
  evaluateBiomeCompleteness,
  evaluateBiomeRewards,
  materializeBiome,
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  simulateProject,
  type CompleteBiomeCompletenessResult,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  authorLegalTraitOffers,
  authorRequiredTestRoomActions,
  authorTestArtificerReplacement,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';

import {
  createFGenerationProject,
  fGenerationOccurrenceId,
} from '../../support/f-generation-project';
import { createCompleteFTakeoverProject } from '../../support/f-takeover-project';

const biome = createBiomeAddress('Underworld', 'F');

function replaceShopActions(
  project: ProjectDocument,
  site: ReturnType<typeof createAcquisitionSiteAddress>,
  offerKeys: readonly string[],
): ProjectDocument {
  if (site.owner.kind !== 'occurrence') throw new Error('F Shop site must be occurrence-owned');
  return replaceTestShopOfferActions(project, catalog, site.owner, offerKeys);
}

interface TargetSpec {
  readonly id: OccurrenceId;
  readonly gameName: string;
  readonly offer?: ResolvedRewardOffer;
}

function fPlan(project: ProjectDocument) {
  const plan = project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0];
  if (plan?.biomeKey !== 'F') {
    throw new Error('missing F reward fixture plan');
  }
  return plan;
}

function traitContext(project: ProjectDocument) {
  const route = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
  if (route === undefined) throw new Error('fixture has no Underworld route');
  return route.loadout;
}

function complete(project: ProjectDocument): CompleteBiomeCompletenessResult {
  const result = evaluateBiomeCompleteness(catalog, biome, fPlan(project));
  if (result.completion !== 'complete') {
    throw new Error(`reward fixture is incomplete: ${result.findings[0]?.code}`);
  }
  return result;
}

function emptyProject(projectId: string): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId,
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function replaceIncoming(
  project: ProjectDocument,
  occurrenceId: OccurrenceId,
  value: ResolvedRewardOffer,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, occurrenceId),
    value,
  });
}

function authorOpening(project: ProjectDocument, occurrenceId: OccurrenceId): ProjectDocument {
  const rewarded = replaceIncoming(project, occurrenceId, {
    rewardType: 'Boon',
    payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
  });
  return applyProjectCommand(rewarded, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, occurrenceId), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
}

function authorWorldShop(project: ProjectDocument, occurrenceId: OccurrenceId): ProjectDocument {
  let next = project;
  for (const [offerKey, value] of Object.entries({
    Boon: {
      rewardType: 'RandomLoot',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    MajorNonBoon: { rewardType: 'WeaponUpgradeDrop' },
    Minor: { rewardType: 'MaxManaDrop' },
  } satisfies Readonly<Record<string, ResolvedRewardOffer>>)) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(biome, occurrenceId, offerKey),
      value,
    });
  }
  return applyProjectCommand(next, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createShopOfferAddress(biome, occurrenceId, 'Boon'), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
        { traitKey: 'ApolloRetaliateBoon', rarity: 'Common' },
        { traitKey: 'PerfectDamageBonusBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
}

function addBatch(
  project: ProjectDocument,
  parentId: OccurrenceId,
  storeKey: 'MetaProgress' | 'RunProgress',
  targets: readonly TargetSpec[],
  pickedExitIndex = 1,
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: parentId,
  });
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, decision.source),
    storeKey,
  });
  for (const [offset, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, `exit${offset + 1}`),
      occurrenceId: target.id,
      gameName: target.gameName,
    });
    if (target.offer !== undefined) {
      next = replaceIncoming(next, target.id, target.offer);
    }
  }
  if (targets.length > 1) {
    next = applyProjectCommand(next, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, decision.source),
      value: { kind: 'normal', exitKey: `exit${pickedExitIndex}` },
    });
  }
  const selectedTarget = targets[pickedExitIndex - 1];
  if (selectedTarget?.gameName === 'F_Shop01') {
    next = authorWorldShop(next, selectedTarget.id);
  }
  return next;
}

function addTakeover(
  project: ProjectDocument,
  parentId: OccurrenceId,
  targetIds: readonly OccurrenceId[],
  pickedExitIndex = 1,
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: parentId,
  });
  const targetOccurrenceIds = Object.fromEntries(
    targetIds.map((occurrenceId, offset) => [`exit${offset + 1}`, occurrenceId]),
  );
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision,
    gameName: 'F_PreBoss01',
    targetOccurrenceIds,
  });
  if (targetIds.length > 1) {
    next = applyProjectCommand(next, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, decision.source),
      value: { kind: 'normal', exitKey: `exit${pickedExitIndex}` },
    });
  }
  if (pickedExitIndex === 1) {
    next = authorWorldShop(next, targetIds[0]!);
  }
  if (targetIds.length > 1) {
    next = replaceIncoming(next, targetIds[1]!, {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    });
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(createIncomingRewardAddress(biome, targetIds[1]!), 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloManaBoon', rarity: 'Common' },
          { traitKey: 'ApolloRetaliateBoon', rarity: 'Common' },
          { traitKey: 'PerfectDamageBonusBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
  }
  return next;
}

function evaluate(project: ProjectDocument, authorTraits = true) {
  if (authorTraits) project = authorLegalTraitOffers(project);
  const snapshot = materializeBiome(catalog, biome, complete(project), traitContext(project));
  const history = composeBiomeHistory(catalog, snapshot);
  return {
    snapshot,
    history,
    rewards: evaluateBiomeRewards(catalog, snapshot, history, 1, traitContext(project)),
  };
}

function withDenial(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceFearVowRank',
    route: createRouteAddress('Underworld'),
    vowKey: 'BanUnpickedBoonsShrineUpgrade',
    rank: 1,
  });
}

function firstBranch(result: ReturnType<typeof evaluate>['rewards']) {
  const branch = result.branches[0];
  if (branch === undefined) {
    throw new Error(`reward fixture has no branch: ${JSON.stringify(result.findings)}`);
  }
  return branch;
}

function ratioBoundaryProject(): ProjectDocument {
  const start = createOccurrenceId('ratio-start');
  const meta = createOccurrenceId('ratio-meta');
  const run = createOccurrenceId('ratio-run');
  const runPeer = createOccurrenceId('ratio-run-peer');
  const mixed = createOccurrenceId('ratio-mixed');
  const mixedPeer = createOccurrenceId('ratio-mixed-peer');
  let project = applyProjectCommand(emptyProject('ratio-boundaries'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = authorOpening(project, start);
  project = addBatch(project, start, 'MetaProgress', [
    { id: meta, gameName: 'F_Combat02', offer: { rewardType: 'GiftDrop' } },
  ]);
  project = addBatch(project, meta, 'RunProgress', [
    {
      id: run,
      gameName: 'F_Combat03',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    },
    { id: runPeer, gameName: 'F_Combat07', offer: { rewardType: 'MaxHealthDrop' } },
  ]);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, run), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Poseidon',
      options: [
        { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' },
        { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
        { traitKey: 'PoseidonCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = addBatch(project, run, 'MetaProgress', [
    { id: mixed, gameName: 'F_Combat04', offer: { rewardType: 'MetaCurrencyDrop' } },
    {
      id: mixedPeer,
      gameName: 'F_Combat06',
      offer: { rewardType: 'MetaCardPointsCommonDrop' },
    },
  ]);
  return addTakeover(project, mixed, [
    createOccurrenceId('ratio-preboss-shop'),
    createOccurrenceId('ratio-preboss-free'),
  ]);
}

function refillProject(): ProjectDocument {
  const start = createOccurrenceId('refill-start');
  const rooms = [
    createOccurrenceId('refill-combat'),
    createOccurrenceId('refill-miniboss-1'),
    createOccurrenceId('refill-miniboss-2'),
    createOccurrenceId('refill-miniboss-3'),
  ];
  const gameNames = ['F_Combat01', 'F_MiniBoss01', 'F_MiniBoss02', 'F_MiniBoss03'];
  const sources = ['PoseidonUpgrade', 'HestiaUpgrade', 'ZeusUpgrade', 'ApolloUpgrade'];
  let project = applyProjectCommand(emptyProject('one-refill'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = authorOpening(project, start);
  let parent = start;
  rooms.forEach((id, index) => {
    project = addBatch(project, parent, 'MetaProgress', [
      {
        id,
        gameName: gameNames[index]!,
        offer: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: sources[index]! },
        },
      },
    ]);
    parent = id;
  });
  project = addTakeover(project, parent, [createOccurrenceId('refill-preboss-shop')]);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(biome, createOccurrenceId('refill-miniboss-1')),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Hestia',
      options: [
        { traitKey: 'HestiaCastBoon', rarity: 'Common' },
        { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        { traitKey: 'HestiaManaBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(biome, createOccurrenceId('refill-miniboss-2')),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Zeus',
      options: [
        { traitKey: 'ZeusSprintBoon', rarity: 'Common' },
        { traitKey: 'ZeusManaBoon', rarity: 'Common' },
        { traitKey: 'ZeusManaBoltBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(biome, createOccurrenceId('refill-miniboss-3')),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
        { traitKey: 'ApolloRetaliateBoon', rarity: 'Common' },
        { traitKey: 'PerfectDamageBonusBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  return project;
}

function sameRoomAcquisitionProject(): ProjectDocument {
  const start = createOccurrenceId('same-room-start');
  const meta = createOccurrenceId('same-room-meta');
  const boon = createOccurrenceId('same-room-boon');
  const stack = createOccurrenceId('same-room-stack');
  let project = applyProjectCommand(emptyProject('same-room-acquisition'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = replaceIncoming(project, start, { rewardType: 'WeaponUpgrade' });
  project = addBatch(project, start, 'MetaProgress', [
    { id: meta, gameName: 'F_Combat02', offer: { rewardType: 'MetaCurrencyDrop' } },
  ]);
  project = addBatch(project, meta, 'RunProgress', [
    { id: boon, gameName: 'F_Combat03' },
    { id: createOccurrenceId('same-room-peer-1'), gameName: 'F_Story01' },
  ]);
  project = replaceIncoming(project, boon, {
    rewardType: 'Boon',
    payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, boon), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Hestia',
      options: [
        { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
        { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        { traitKey: 'HestiaManaBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = addBatch(project, boon, 'RunProgress', [
    { id: stack, gameName: 'F_Combat04', offer: { rewardType: 'StackUpgrade' } },
    { id: createOccurrenceId('same-room-peer-2'), gameName: 'F_Story01' },
  ]);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceLevelResolution',
    levelResolution: createLevelResolutionAddress(
      createIncomingRewardAddress(biome, stack),
      'self',
    ),
    value: {
      kind: 'choice',
      offeredTraitKeys: ['HestiaWeaponBoon'],
      selectedTraitKey: 'HestiaWeaponBoon',
    },
  });
  project = addTakeover(
    project,
    stack,
    [createOccurrenceId('same-room-preboss-shop'), createOccurrenceId('same-room-preboss-free')],
    2,
  );
  return replaceIncoming(project, createOccurrenceId('same-room-preboss-free'), {
    rewardType: 'MaxManaDrop',
  });
}

function shopTimingProject(): ProjectDocument {
  const start = createOccurrenceId('shop-trace-start');
  const first = createOccurrenceId('shop-trace-first');
  const third = createOccurrenceId('shop-trace-third');
  const shop = createOccurrenceId('shop-trace-shop');
  const fifth = createOccurrenceId('shop-trace-fifth');
  const peer = createOccurrenceId('shop-trace-peer');
  let project = applyProjectCommand(emptyProject('shop-trace'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = authorOpening(project, start);
  project = addBatch(project, start, 'MetaProgress', [
    {
      id: first,
      gameName: 'F_Combat01',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    },
  ]);
  project = addBatch(project, first, 'MetaProgress', [
    {
      id: third,
      gameName: 'F_MiniBoss01',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    },
  ]);
  project = addBatch(project, third, 'MetaProgress', [{ id: shop, gameName: 'F_Shop01' }]);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(biome, shop, 'Boon'),
    value: {
      rewardType: 'RandomLoot',
      payload: { kind: 'BoonSource', source: 'AresUpgrade' },
    },
  });
  project = replaceShopActions(
    project,
    createAcquisitionSiteAddress(createOccurrenceAddress(biome, shop), 'roomExit'),
    ['Boon'],
  );
  project = addBatch(project, shop, 'RunProgress', [
    {
      id: fifth,
      gameName: 'F_Combat04',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
    },
    { id: peer, gameName: 'F_Story01' },
  ]);
  project = addTakeover(project, fifth, [
    createOccurrenceId('shop-trace-preboss-shop'),
    createOccurrenceId('shop-trace-preboss-free'),
  ]);
  project = replaceIncoming(project, createOccurrenceId('shop-trace-preboss-free'), {
    rewardType: 'MaxHealthDrop',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, third), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Hestia',
      options: [
        { traitKey: 'HestiaCastBoon', rarity: 'Common' },
        { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        { traitKey: 'HestiaManaBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createShopOfferAddress(biome, shop, 'Boon'), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Ares',
      options: [
        { traitKey: 'AresSprintBoon', rarity: 'Common' },
        { traitKey: 'AresManaBoon', rarity: 'Common' },
        { traitKey: 'AresExCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, fifth), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Zeus',
      options: [
        { traitKey: 'ZeusManaBoon', rarity: 'Common' },
        { traitKey: 'ZeusManaBoltBoon', rarity: 'Common' },
        { traitKey: 'BoltRetaliateBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  return project;
}

function invalidShopOfferProject(): ProjectDocument {
  const start = createOccurrenceId('invalid-shop-start');
  const first = createOccurrenceId('invalid-shop-first');
  const source = createOccurrenceId('invalid-shop-source');
  const peer = createOccurrenceId('invalid-shop-peer');
  let project = applyProjectCommand(emptyProject('invalid-shop-offer'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = replaceIncoming(project, start, { rewardType: 'WeaponUpgrade' });
  project = addBatch(project, start, 'MetaProgress', [
    { id: first, gameName: 'F_Combat02', offer: { rewardType: 'MetaCurrencyDrop' } },
  ]);
  project = addBatch(project, first, 'RunProgress', [
    { id: source, gameName: 'F_Combat03', offer: { rewardType: 'MaxManaDrop' } },
    { id: peer, gameName: 'F_Story01' },
  ]);
  return addTakeover(project, source, [
    createOccurrenceId('invalid-shop-preboss'),
    createOccurrenceId('invalid-shop-free'),
  ]);
}

function invalidBlindBoxPurchaseProject(): ProjectDocument {
  const start = createOccurrenceId('blind-start');
  const combat = createOccurrenceId('blind-combat');
  const miniboss1 = createOccurrenceId('blind-miniboss-1');
  const miniboss2 = createOccurrenceId('blind-miniboss-2');
  const shop = createOccurrenceId('blind-shop');
  let project = applyProjectCommand(emptyProject('invalid-blind-box'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = authorOpening(project, start);
  project = addBatch(project, start, 'MetaProgress', [
    {
      id: combat,
      gameName: 'F_Combat01',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    },
  ]);
  project = addBatch(project, combat, 'MetaProgress', [
    {
      id: miniboss1,
      gameName: 'F_MiniBoss01',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    },
  ]);
  project = addBatch(project, miniboss1, 'MetaProgress', [
    {
      id: miniboss2,
      gameName: 'F_MiniBoss02',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
    },
  ]);
  for (const [occurrenceId, giverKey, options] of [
    [combat, 'Poseidon', ['PoseidonWeaponBoon', 'PoseidonSpecialBoon', 'PoseidonCastBoon']],
    [miniboss1, 'Hestia', ['HestiaWeaponBoon', 'HestiaSprintBoon', 'HestiaManaBoon']],
    [miniboss2, 'Zeus', ['ZeusWeaponBoon', 'ZeusSprintBoon', 'ZeusManaBoon']],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(createIncomingRewardAddress(biome, occurrenceId), 'source'),
      value: {
        kind: 'traits',
        giverKey,
        options: options.map((traitKey) => ({ traitKey, rarity: 'Common' })) as [
          { traitKey: string; rarity: 'Common' },
          { traitKey: string; rarity: 'Common' },
          { traitKey: string; rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
  }
  project = addBatch(project, miniboss2, 'MetaProgress', [{ id: shop, gameName: 'F_Shop01' }]);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(biome, shop, 'Boon'),
    value: {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createShopOfferAddress(biome, shop, 'Boon'), 'hiddenSource'),
    value: {
      kind: 'traits',
      giverKey: 'Demeter',
      options: [
        { traitKey: 'DemeterWeaponBoon', rarity: 'Common' },
        { traitKey: 'DemeterSprintBoon', rarity: 'Common' },
        { traitKey: 'CastNovaBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = replaceShopActions(
    project,
    createAcquisitionSiteAddress(createOccurrenceAddress(biome, shop), 'roomExit'),
    ['Boon'],
  );
  project = addTakeover(project, shop, [
    createOccurrenceId('blind-preboss-shop'),
    createOccurrenceId('blind-preboss-free'),
  ]);
  return replaceIncoming(project, createOccurrenceId('blind-preboss-free'), {
    rewardType: 'MaxHealthDrop',
  });
}

function devotionProject(): ProjectDocument {
  const start = createOccurrenceId('devotion-start');
  const meta1 = createOccurrenceId('devotion-meta-1');
  const run1 = createOccurrenceId('devotion-run-1');
  const meta2 = createOccurrenceId('devotion-meta-2');
  const run2 = createOccurrenceId('devotion-run-2');
  const run3 = createOccurrenceId('devotion-run-3');
  const devotion = createOccurrenceId('devotion-room');
  let project = applyProjectCommand(emptyProject('devotion-order'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = authorOpening(project, start);
  project = addBatch(project, start, 'MetaProgress', [
    { id: meta1, gameName: 'F_Combat02', offer: { rewardType: 'MetaCurrencyDrop' } },
  ]);
  project = addBatch(project, meta1, 'RunProgress', [
    {
      id: run1,
      gameName: 'F_Combat03',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    },
    { id: createOccurrenceId('devotion-peer-1'), gameName: 'F_Story01' },
  ]);
  project = addBatch(project, run1, 'MetaProgress', [
    { id: meta2, gameName: 'F_Combat04', offer: { rewardType: 'MetaCurrencyDrop' } },
    { id: createOccurrenceId('devotion-peer-2'), gameName: 'F_Story01' },
  ]);
  project = addBatch(project, meta2, 'RunProgress', [
    {
      id: run2,
      gameName: 'F_Combat05',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    },
    { id: createOccurrenceId('devotion-peer-3'), gameName: 'F_Story01' },
  ]);
  project = addBatch(project, run2, 'RunProgress', [
    { id: run3, gameName: 'F_Combat06', offer: { rewardType: 'MaxHealthDrop' } },
    { id: createOccurrenceId('devotion-peer-4'), gameName: 'F_Story01' },
  ]);
  project = addBatch(project, run3, 'RunProgress', [
    {
      id: devotion,
      gameName: 'F_Combat07',
      offer: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'PoseidonUpgrade',
        },
      },
    },
    { id: createOccurrenceId('devotion-peer-5'), gameName: 'F_Story01' },
  ]);
  project = addTakeover(project, devotion, [
    createOccurrenceId('devotion-preboss-shop'),
    createOccurrenceId('devotion-preboss-free'),
  ]);
  project = replaceIncoming(project, createOccurrenceId('devotion-preboss-free'), {
    rewardType: 'MaxManaDrop',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, run1), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Poseidon',
      options: [
        { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
        { traitKey: 'PoseidonCastBoon', rarity: 'Common' },
        { traitKey: 'PoseidonSprintBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, run2), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, devotion), 'chosenSource'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
        { traitKey: 'ApolloRetaliateBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, devotion), 'spurnedSource'),
    value: {
      kind: 'traits',
      giverKey: 'Poseidon',
      options: [
        { traitKey: 'PoseidonManaBoon', rarity: 'Common' },
        { traitKey: 'EncounterStartOffenseBuffBoon', rarity: 'Common' },
        { traitKey: 'RoomRewardBonusBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  return project;
}

describe('F reward-history simulation', () => {
  it('carries effective Denial through room, purchased Shop, and Devotion settlement', () => {
    const room = firstBranch(evaluate(withDenial(sameRoomAcquisitionProject())).rewards);
    const shop = firstBranch(evaluate(withDenial(shopTimingProject())).rewards);
    const devotion = firstBranch(evaluate(withDenial(devotionProject())).rewards);

    const bansFor = (branch: typeof room, giverKey: string, offeredKey?: string) => {
      const event = branch.traitHistory?.events.find(
        (candidate): candidate is TraitOfferEvent =>
          candidate.kind === 'traitOffer' &&
          candidate.giverKey === giverKey &&
          (offeredKey === undefined ||
            candidate.options.some((option) => option.traitKey === offeredKey)),
      );
      return event?.bannedTraitKeys;
    };

    expect(bansFor(room, 'Hestia')).toEqual(['HestiaSprintBoon', 'HestiaManaBoon']);
    expect(bansFor(shop, 'Ares')).toEqual(['AresManaBoon', 'AresExCastBoon']);
    expect(bansFor(devotion, 'Apollo', 'ApolloRetaliateBoon')).toEqual([
      'ApolloManaBoon',
      'ApolloRetaliateBoon',
    ]);
  });

  it('treats the opening reward as a biome entry without a current-room predecessor', () => {
    const start = createOccurrenceId('ratio-start');
    const project = replaceIncoming(ratioBoundaryProject(), start, { rewardType: 'SpellDrop' });
    const result = evaluate(project).rewards;

    expect(result.validity).toBe('valid');
    expect(firstBranch(result).events).toContainEqual(
      expect.objectContaining({
        kind: 'rewardOffered',
        origin: createIncomingRewardAddress(biome, start),
        offer: { rewardType: 'SpellDrop' },
      }),
    );
  });

  it('validates forced and possible authored base stores from current-room store history', () => {
    const result = evaluate(ratioBoundaryProject()).rewards;

    expect(result.validity).toBe('valid');
    expect(result.findings).toEqual([]);
    expect(result.storeSupport).toEqual([
      expect.objectContaining({
        authoredStoreKey: 'MetaProgress',
        enteredStoreCount: 1,
        enteredMetaStoreCount: 0,
        supportStoreKeys: ['MetaProgress'],
      }),
      expect.objectContaining({
        authoredStoreKey: 'RunProgress',
        enteredStoreCount: 2,
        enteredMetaStoreCount: 1,
        supportStoreKeys: ['RunProgress'],
      }),
      expect.objectContaining({
        authoredStoreKey: 'MetaProgress',
        enteredStoreCount: 3,
        enteredMetaStoreCount: 1,
        supportStoreKeys: ['RunProgress', 'MetaProgress'],
      }),
    ]);
  });

  it('replays a later forced target store across earlier ordinary peers', () => {
    let project = authorLegalTraitOffers(ratioBoundaryProject());
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, createOccurrenceId('ratio-mixed-peer')),
      gameName: 'F_Combat01',
    });
    const forcedBinding = catalog.rooms.byKey.F_Combat01?.incomingReward;
    if (forcedBinding?.kind !== 'countedChoice') {
      throw new Error('F_Combat01 must retain its counted reward binding');
    }
    project = replaceIncoming(project, createOccurrenceId('ratio-mixed-peer'), {
      rewardType: 'MaxHealthDrop',
    });
    project = replaceIncoming(project, createOccurrenceId('ratio-mixed'), {
      rewardType: 'MaxManaDrop',
    });

    const result = evaluate(project, false);
    const batch = result.snapshot.decisions[2];
    if (batch?.kind !== 'batch') throw new Error('ratio fixture lost its third batch');

    expect(result.rewards.validity).toBe('valid');
    expect(batch.rewardStore).toMatchObject({
      baseRewardStoreKey: 'MetaProgress',
      kind: 'authoredBaseStore',
    });
    expect(batch.resolvedSharedRewardStoreKey).toBe('RunProgress');
    expect(batch.targets.map((target) => target.room.incomingReward?.resolvedStoreKey)).toEqual([
      'RunProgress',
      'RunProgress',
    ]);
  });

  it('addresses an impossible authored base store without replacing the authored outcome', () => {
    let project = ratioBoundaryProject();
    const firstStore = createBatchRewardStoreAddress(biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('ratio-start'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: firstStore,
      storeKey: 'RunProgress',
    });
    const result = evaluate(project).rewards;

    expect(result.validity).toBe('invalid');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'baseRewardStoreUnavailable',
        origin: firstStore,
        evidence: expect.objectContaining({
          authoredStoreKey: 'RunProgress',
          supportStoreKeys: ['MetaProgress'],
        }),
      }),
    );
  });

  it('consumes unpicked offers but acquires only entered producers', () => {
    const result = evaluate(ratioBoundaryProject()).rewards;
    const branch = firstBranch(result);
    const unpickedOrigin = createIncomingRewardAddress(biome, createOccurrenceId('ratio-run-peer'));

    expect(branch.events).toContainEqual(
      expect.objectContaining({
        kind: 'rewardOffered',
        origin: unpickedOrigin,
        offer: { rewardType: 'MaxHealthDrop' },
      }),
    );
    expect(branch.events).not.toContainEqual(
      expect.objectContaining({ kind: 'concreteAcquisition', origin: unpickedOrigin }),
    );
    expect(branch.history.consumableRecord.MaxHealthDrop).toBeUndefined();
  });

  it('reaches the declared one-refill transition through F counted offers', () => {
    const result = evaluate(refillProject()).rewards;
    const runBag = firstBranch(result).bags.RunProgress!;
    const boonIndexes = catalog.rewards.stores.byKey.RunProgress!.entries.flatMap((entry, index) =>
      entry.rewardType === 'Boon' ? [index] : [],
    );

    expect(result.validity).toBe('valid');
    expect(boonIndexes.map((index) => runBag.remainingEntryCounts[index])).toEqual(
      expect.arrayContaining([0, 1]),
    );
    expect(
      runBag.remainingEntryCounts.some(
        (remaining, index) =>
          catalog.rewards.stores.byKey.RunProgress!.entries[index]?.rewardType ===
            'MaxHealthDrop' && remaining === 2,
      ),
    ).toBe(true);
  });

  it('applies an entered standard-room acquisition before its outgoing rewards', () => {
    const result = evaluate(sameRoomAcquisitionProject()).rewards;
    const branch = firstBranch(result);
    const boonOrigin = createIncomingRewardAddress(biome, createOccurrenceId('same-room-boon'));
    const stackOrigin = createIncomingRewardAddress(biome, createOccurrenceId('same-room-stack'));
    const boonAcquisition = branch.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(boonOrigin),
    );
    const stackOffer = branch.events.find(
      (event) =>
        event.kind === 'rewardOffered' &&
        semanticAddressKey(event.origin) === semanticAddressKey(stackOrigin),
    );

    expect(result.validity).toBe('valid');
    expect(boonAcquisition).toMatchObject({
      settlement: {
        site: { kind: 'acquisitionSite', pointKey: 'roomRewardPickup' },
        entry: { kind: 'acquisitionEntry', entryKey: 'source' },
      },
    });
    expect(boonAcquisition?.historySequence).toBeLessThan(stackOffer!.historySequence);
    expect(branch.history.lootTypeHistory.StackUpgrade).toBe(1);
    expect(branch.history.currentRoomUseRecord).toEqual({});
    expect(branch.history.useRecord.StackUpgrade).toBe(1);
  });

  it('keeps outgoing door sources pre-purchase in the fourth-shop/fifth-door trace', () => {
    const result = evaluate(shopTimingProject()).rewards;
    const branch = firstBranch(result);
    const shopPurchase = createShopOfferAddress(
      biome,
      createOccurrenceId('shop-trace-shop'),
      'Boon',
    );
    const fifthOffer = createIncomingRewardAddress(biome, createOccurrenceId('shop-trace-fifth'));
    const purchaseEvent = branch.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(shopPurchase),
    );
    const fifthOfferEvent = branch.events.find(
      (event) =>
        event.kind === 'rewardOffered' &&
        semanticAddressKey(event.origin) === semanticAddressKey(fifthOffer),
    );

    expect(result.validity).toBe('valid');
    expect(fifthOfferEvent?.historySequence).toBeLessThan(purchaseEvent!.historySequence);
    expect(branch.history.lootTypeHistory).toMatchObject({
      ApolloUpgrade: 1,
      PoseidonUpgrade: 1,
      HestiaUpgrade: 1,
      AresUpgrade: 1,
      ZeusUpgrade: 1,
    });
    expect(purchaseEvent?.origin).toEqual(shopPurchase);
  });

  it('keeps the World Shop outgoing batch byte-identical across acquisition edits while later history includes the purchase', () => {
    const shop = createOccurrenceId('shop-trace-shop');
    const site = createAcquisitionSiteAddress(createOccurrenceAddress(biome, shop), 'roomExit');
    const outgoingBytes = (project: ProjectDocument) => {
      const batch = evaluate(project).snapshot.decisions.find(
        (decision) =>
          decision.kind === 'batch' &&
          semanticAddressKey(decision.parent.origin) ===
            semanticAddressKey(createOccurrenceAddress(biome, shop)),
      );
      if (batch === undefined) throw new Error('Shop outgoing batch is missing');
      return JSON.stringify(batch);
    };
    const base = shopTimingProject();
    const empty = replaceShopActions(base, site, []);
    const reordered = replaceShopActions(base, site, ['MajorNonBoon', 'Boon']);
    const traitEdited = applyProjectCommand(base, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(createShopOfferAddress(biome, shop, 'Boon'), 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Ares',
        options: [
          { traitKey: 'AresSprintBoon', rarity: 'Common' },
          { traitKey: 'AresManaBoon', rarity: 'Common' },
          { traitKey: 'AresExCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
      },
    });
    let pomEdited = applyProjectCommand(base, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(biome, shop, 'Minor'),
      value: { rewardType: 'StoreRewardRandomStack' },
    });
    pomEdited = replaceShopActions(pomEdited, site, ['Minor']);
    pomEdited = applyProjectCommand(pomEdited, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: createLevelResolutionAddress(
        createShopOfferAddress(biome, shop, 'Minor'),
        'self',
      ),
      value: { kind: 'random', targetTraitKey: 'PoseidonWeaponBoon' },
    });

    const baseline = outgoingBytes(empty);
    expect(outgoingBytes(base)).toBe(baseline);
    expect(outgoingBytes(reordered)).toBe(baseline);
    expect(outgoingBytes(traitEdited)).toBe(baseline);
    expect(outgoingBytes(pomEdited)).toBe(baseline);

    const purchased = firstBranch(evaluate(base).rewards);
    const fifthOffer = createIncomingRewardAddress(biome, createOccurrenceId('shop-trace-fifth'));
    const purchase = purchased.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) ===
          semanticAddressKey(createShopOfferAddress(biome, shop, 'Boon')),
    );
    const laterRoom = purchased.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(fifthOffer),
    );
    expect(purchase).toBeDefined();
    expect(laterRoom?.historySequence).toBeGreaterThan(purchase!.historySequence);
    expect(purchased.history.lootTypeHistory.AresUpgrade).toBe(1);
  });

  it('classifies counted-bag and source-support failures at their incoming reward owners', () => {
    let bagProject = ratioBoundaryProject();
    bagProject = replaceIncoming(bagProject, createOccurrenceId('ratio-mixed'), {
      rewardType: 'GiftDrop',
    });
    const bagResult = evaluate(bagProject).rewards;

    let sourceProject = shopTimingProject();
    sourceProject = replaceIncoming(sourceProject, createOccurrenceId('shop-trace-preboss-free'), {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
    });
    const sourceResult = evaluate(sourceProject).rewards;

    expect(bagResult.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createIncomingRewardAddress(biome, createOccurrenceId('ratio-mixed')),
      }),
    );
    expect(sourceResult.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardSourceUnavailable',
        origin: createIncomingRewardAddress(biome, createOccurrenceId('shop-trace-preboss-free')),
      }),
    );
  });

  it('addresses unsupported shop inventory and purchased options separately', () => {
    const offerResult = evaluate(invalidShopOfferProject()).rewards;
    let purchaseProject = invalidBlindBoxPurchaseProject();
    purchaseProject = replaceShopActions(
      purchaseProject,
      createAcquisitionSiteAddress(
        createOccurrenceAddress(biome, createOccurrenceId('blind-shop')),
        'roomExit',
      ),
      ['Boon', 'MajorNonBoon'],
    );
    const purchaseResult = evaluate(purchaseProject).rewards;
    const offerFindings = offerResult.findings.filter(
      (finding) => finding.code === 'shopOfferUnavailable',
    );
    const purchaseFindings = purchaseResult.findings.filter(
      (finding) => finding.code === 'shopPurchaseUnavailable',
    );

    expect(offerFindings).toEqual([
      expect.objectContaining({
        origin: createShopOfferAddress(
          biome,
          createOccurrenceId('invalid-shop-preboss'),
          'MajorNonBoon',
        ),
      }),
    ]);
    expect(purchaseFindings).toEqual([
      expect.objectContaining({
        origin: createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(
            createOccurrenceAddress(biome, createOccurrenceId('blind-shop')),
            'roomExit',
          ),
          'Boon',
        ),
      }),
    ]);
  });

  it('retains the blocked Shop acquisition-order repair while withholding its suffix', () => {
    const batches = [
      {
        targets: ['F_Combat02'],
        pickedExitIndex: 1,
        offers: [{ rewardType: 'GiftDrop' }],
      },
      {
        targets: ['F_Combat03', 'F_Combat03'],
        pickedExitIndex: 1,
        offers: [
          { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
          { rewardType: 'MaxHealthDrop' },
        ],
      },
      {
        targets: ['F_Combat04', 'F_Combat04'],
        pickedExitIndex: 1,
        offers: [
          { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
          { rewardType: 'MaxManaDrop' },
        ],
      },
      {
        targets: ['F_Combat05', 'F_Combat11'],
        pickedExitIndex: 1,
        offers: [
          { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
          { rewardType: 'SpellDrop' },
        ],
      },
      {
        targets: ['F_Shop01', 'F_Combat11'],
        pickedExitIndex: 1,
        storeKey: 'MetaProgress',
        offers: [undefined, { rewardType: 'MetaCurrencyDrop' }],
      },
      {
        targets: ['F_MiniBoss01', 'F_MiniBoss02'],
        // Keep the Shop's outgoing decision partially authored: generated
        // targets exist, but no target is selected.
        offers: [
          { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
          { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
        ],
      },
    ] as const;
    const shopId = fGenerationOccurrenceId(5, 1);
    const shop = createOccurrenceAddress(biome, shopId);
    let project = createFGenerationProject(batches, { includeTakeover: false });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(biome, shopId, 'Boon'),
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
      },
    });
    project = replaceShopActions(project, createAcquisitionSiteAddress(shop, 'roomExit'), [
      'Boon',
      'MajorNonBoon',
    ]);
    const preShopOffers = [
      {
        owner: createIncomingRewardAddress(biome, fGenerationOccurrenceId(2, 1)),
        kind: 'traits',
        giverKey: 'Poseidon',
        options: [
          { traitKey: 'PoseidonWeaponBoon', rarity: 'Rare' },
          { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
          { traitKey: 'PoseidonCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
      },
      {
        owner: createIncomingRewardAddress(biome, fGenerationOccurrenceId(3, 1)),
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaWeaponBoon', rarity: 'Rare' },
          { traitKey: 'HestiaCastBoon', rarity: 'Common' },
          { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
      },
      {
        owner: createIncomingRewardAddress(biome, fGenerationOccurrenceId(4, 1)),
        kind: 'traits',
        giverKey: 'Zeus',
        options: [
          { traitKey: 'ZeusWeaponBoon', rarity: 'Rare' },
          { traitKey: 'ZeusSprintBoon', rarity: 'Common' },
          { traitKey: 'ZeusManaBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option3',
      },
    ] as const;
    for (const authored of preShopOffers) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(authored.owner, 'source'),
        value: {
          kind: 'traits',
          giverKey: authored.giverKey,
          options: authored.options,
          selectedOptionKey: authored.selectedOptionKey,
        },
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(createShopOfferAddress(biome, shopId, 'Boon'), 'hiddenSource'),
      value: {
        kind: 'traits',
        giverKey: 'Demeter',
        options: [
          { traitKey: 'DemeterWeaponBoon', rarity: 'Rare' },
          { traitKey: 'DemeterSprintBoon', rarity: 'Common' },
          { traitKey: 'CastNovaBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
      },
    });
    project = authorLegalTraitOffers(project);
    const assembly = simulateProjectAssembly(catalog, project);
    const evaluated = assembly.evaluation.routes[0]?.biomes[0];
    if (evaluated?.authoring !== 'incomplete' || evaluated.validity !== 'invalid') {
      throw new Error('invalid Shop purchase fixture did not produce a blocked evaluation');
    }
    const blockedPurchase = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(shop, 'roomExit'),
      'Boon',
    );
    expect(evaluated.coverage).toMatchObject({ kind: 'prefix', blockedAt: blockedPurchase });
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    expect(
      session.evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(biome, fGenerationOccurrenceId(6, 1)),
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('emits Devotion chosen and spurned acquisitions at their declared ordered points', () => {
    const result = evaluate(devotionProject()).rewards;
    const branch = firstBranch(result);
    const origin = createIncomingRewardAddress(biome, createOccurrenceId('devotion-room'));
    const acquisitions = branch.events.filter(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(origin),
    );

    expect(result.validity).toBe('valid');
    expect(acquisitions).toEqual([
      expect.objectContaining({
        acquisition: expect.objectContaining({
          role: 'chosenSource',
          lifecyclePoint: 'beforeCombat',
          acquisition: { kind: 'loot', gameName: 'ApolloUpgrade' },
        }),
        settlement: expect.objectContaining({
          site: expect.objectContaining({ pointKey: 'beforeCombat' }),
          entry: expect.objectContaining({ entryKey: 'chosenSource' }),
        }),
      }),
      expect.objectContaining({
        acquisition: expect.objectContaining({
          role: 'spurnedSource',
          lifecyclePoint: 'afterCombat',
          acquisition: { kind: 'loot', gameName: 'PoseidonUpgrade' },
        }),
        settlement: expect.objectContaining({
          site: expect.objectContaining({ pointKey: 'afterCombat' }),
          entry: expect.objectContaining({ entryKey: 'spurnedSource' }),
        }),
      }),
    ]);
    expect(acquisitions[0]!.historySequence).toBeLessThan(acquisitions[1]!.historySequence);
    const traitTraces = result.selectedTraitOffers.filter(
      (trace) => semanticAddressKey(trace.address.owner) === semanticAddressKey(origin),
    );
    const chosen = traitTraces.find((trace) => trace.acquisitionRole === 'chosenSource');
    const spurned = traitTraces.find((trace) => trace.acquisitionRole === 'spurnedSource');
    if (chosen === undefined || spurned === undefined) {
      throw new Error('Devotion fixture lost its trait-role traces');
    }
    expect(chosen.chronologicalIndex).toBeLessThan(spurned.chronologicalIndex);
  });

  it('converts both Devotion roles sequentially through the real lifecycle fold', () => {
    const origin = createIncomingRewardAddress(biome, createOccurrenceId('devotion-room'));
    let project = applyProjectCommand(devotionProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(origin, 'chosenSource'),
      value: { kind: 'timePiece' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(origin, 'spurnedSource'),
      value: { kind: 'timePiece' },
    });
    const result = evaluate(project).rewards;
    const branch = firstBranch(result);
    expect(branch.keepsakes.timePiece?.remainingCharges).toBe(2);
    expect(branch.events.filter((event) => event.kind === 'conversionToGold')).toHaveLength(2);
    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(origin),
      ),
    ).toHaveLength(0);
  });

  it('settles an ordinary Artificer replacement at the next mandatory checkpoint', () => {
    const occurrenceId = createOccurrenceId('ratio-meta');
    const source = createIncomingRewardAddress(biome, occurrenceId);
    let project = applyProjectCommand(ratioBoundaryProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Underworld'),
      arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
    });
    project = authorTestArtificerReplacement(
      project,
      catalog,
      createAcquisitionRoleAddress(source, 'self'),
      Object.freeze({
        offer: Object.freeze({ rewardType: 'MaxHealthDrop' }),
        traitOffersByAcquisitionRole: Object.freeze({}),
        dispositionByAcquisitionRole: Object.freeze({
          self: Object.freeze({ kind: 'normal' as const }),
        }),
      }),
    );
    project = authorRequiredTestRoomActions(project, catalog);
    const result = evaluate(project).rewards;
    const branch = firstBranch(result);
    const expected = createAcquisitionEntryAddress(
      artificerAcquisitionSite(createOccurrenceAddress(biome, occurrenceId), source),
      artificerReplacementEntryKey(source, 'self'),
    );
    const conversion = branch.events.find(
      (event) =>
        event.kind === 'artificerConversion' &&
        semanticAddressKey(event.origin) === semanticAddressKey(source),
    );
    const acquired = branch.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(expected),
    );
    expect(result.validity).toBe('valid');
    expect(conversion).toBeDefined();
    expect(acquired).toBeDefined();
    expect(branch.events.indexOf(conversion!)).toBeLessThan(branch.events.indexOf(acquired!));
  });

  it('settles the selected fixed/free Preboss reward through its declared singleton site', () => {
    const result = evaluate(createCompleteFTakeoverProject('exit2')).rewards;
    const origin = createIncomingRewardAddress(
      biome,
      createOccurrenceId('f-takeover-preboss-free'),
    );
    const acquisitions = firstBranch(result).events.filter(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(origin),
    );
    expect(acquisitions).toEqual([
      expect.objectContaining({
        settlement: {
          site: expect.objectContaining({ pointKey: 'roomRewardPickup' }),
          entry: expect.objectContaining({ entryKey: 'source' }),
        },
      }),
    ]);
  });

  it('rejects a canonical snapshot whose room identity is newer than its history', () => {
    const baseline = evaluate(ratioBoundaryProject());
    const project = applyProjectCommand(ratioBoundaryProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, createOccurrenceId('ratio-run-peer')),
      gameName: 'F_Combat06',
    });
    const snapshot = materializeBiome(catalog, biome, complete(project), traitContext(project));

    expect(() =>
      evaluateBiomeRewards(catalog, snapshot, baseline.history, 1, traitContext(project)),
    ).toThrowError(/in the snapshot but .* in history/);
  });

  it('keeps an already context-invalid downstream offer authored after room replacement', () => {
    const start = createOccurrenceId('retained-invalid-start');
    const replacedCombat = createOccurrenceId('retained-invalid-replaced-combat');
    const retainedCombat = createOccurrenceId('retained-invalid-retained-combat');
    const reward = createIncomingRewardAddress(biome, retainedCombat);
    let project = applyProjectCommand(emptyProject('retained-invalid-replacement'), catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: start,
      gameName: 'F_Opening01',
    });
    project = authorOpening(project, start);
    project = addBatch(project, start, 'MetaProgress', [
      { id: replacedCombat, gameName: 'F_Combat02', offer: { rewardType: 'MetaCurrencyDrop' } },
    ]);
    project = addBatch(project, replacedCombat, 'RunProgress', [
      { id: retainedCombat, gameName: 'F_Combat03', offer: { rewardType: 'GiftDrop' } },
      { id: createOccurrenceId('retained-invalid-peer'), gameName: 'F_Story01' },
    ]);
    project = addTakeover(project, retainedCombat, [
      createOccurrenceId('retained-invalid-preboss-shop'),
      createOccurrenceId('retained-invalid-preboss-free'),
    ]);
    project = authorRequiredTestRoomActions(project, catalog);

    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: reward }),
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, retainedCombat),
      gameName: 'F_Combat06',
    });
    project = authorRequiredTestRoomActions(project, catalog);

    expect(
      fPlan(project).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === retainedCombat,
      ),
    ).toMatchObject({
      gameName: 'F_Combat06',
      state: { kind: 'counted', reward: { offer: { rewardType: 'GiftDrop' } } },
    });
    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: reward,
        evidence: expect.objectContaining({ rewardType: 'GiftDrop', storeKey: 'RunProgress' }),
      }),
    );
  });
});
