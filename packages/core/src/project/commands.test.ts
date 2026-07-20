import { describe, expect, it } from 'vitest';

import type {
  Catalog,
  CatalogCollection,
  EncounterProfile,
  LinearBiomeLayout,
  RoomDeclaration,
  RouteDeclaration,
} from '../catalog';
import type { CountedRewardBinding } from '../rewards';
import type {
  PayloadDomainDeclaration,
  ProducerLifecycleProfileDeclaration,
  RewardKernelCatalog,
  RewardStoreDeclaration,
  RewardTypeDeclaration,
  ShopProfileDeclaration,
} from '../rewardKernel/model';
import {
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createRouteAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  SemanticAddressContractError,
  semanticAddressKey,
} from './addresses';
import { applyProjectCommand, ProjectCommandContractError } from './commands';
import { createEmptyProjectDocument, createProjectDocument } from './defaults';
import {
  applyProjectHistoryCommand,
  canRedoProjectHistory,
  canUndoProjectHistory,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
} from './history';
import { encodeProjectDocument, parseProjectDocument } from './codec';
import type { ProjectDocument } from './model';

function collection<T>(values: readonly T[], key: (value: T) => string): CatalogCollection<T> {
  return {
    values,
    byKey: Object.fromEntries(values.map((value) => [key(value), value])),
  };
}

function emptyCollection<T>(): CatalogCollection<T> {
  return { values: [], byKey: {} };
}

const underworld = {
  key: 'Underworld',
  label: 'Underworld',
  biomeKeys: ['F'],
} as const satisfies RouteDeclaration;

const alternate = {
  key: 'Alternate',
  label: 'Alternate',
  biomeKeys: ['F'],
} as const satisfies RouteDeclaration;

const boonSource = {
  key: 'BoonSource',
  kind: 'oneOf',
  values: ['ApolloUpgrade', 'ZeusUpgrade'],
} as const satisfies PayloadDomainDeclaration;

const boon = {
  gameName: 'Boon',
  label: 'Boon',
  payloadDomain: 'BoonSource',
  defaultPayload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
  sourceSupport: 'ordinaryBoonPeer',
  sourceResolution: { kind: 'offer' },
  offerProjection: 'none',
  acquisitionRoles: emptyCollection(),
} as const satisfies RewardTypeDeclaration;

const maxHealth = {
  gameName: 'MaxHealthDrop',
  label: 'Max Health',
  offerProjection: 'none',
  acquisitionRoles: emptyCollection(),
} as const satisfies RewardTypeDeclaration;

const shopReward = {
  gameName: 'Shop',
  label: 'Shop',
  offerProjection: 'none',
  acquisitionRoles: emptyCollection(),
} as const satisfies RewardTypeDeclaration;

const runProgress = {
  key: 'RunProgress',
  defaultOffer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  entries: [
    { index: 0, rewardType: 'Boon', allowDuplicates: true },
    { index: 1, rewardType: 'MaxHealthDrop', allowDuplicates: false },
  ],
} as const satisfies RewardStoreDeclaration;

const metaProgress = {
  key: 'MetaProgress',
  defaultOffer: { rewardType: 'MaxHealthDrop' },
  entries: [{ index: 0, rewardType: 'MaxHealthDrop', allowDuplicates: false }],
} as const satisfies RewardStoreDeclaration;

const countedReward = {
  kind: 'countedChoice',
  storeKeys: ['RunProgress', 'MetaProgress'],
  eligibleRewardTypes: [],
  ineligibleRewardTypes: [],
  allowedRewardTypes: ['Boon', 'MaxHealthDrop'],
  defaultOffersByStore: {
    RunProgress: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
    MetaProgress: { rewardType: 'MaxHealthDrop' },
  },
  producerLifecycleKey: 'RoomReward',
} as const satisfies CountedRewardBinding;

const shopProfile = {
  key: 'WorldShop',
  groups: collection(
    [
      {
        key: 'Boon',
        offerCount: 1,
        options: collection(
          [
            {
              key: 'Boon',
              defaultOffer: {
                rewardType: 'Boon',
                payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
              },
              acquisitionLifecycle: [],
            },
          ],
          (option) => option.key,
        ),
        rewardTypes: ['Boon'],
      },
    ],
    (group) => group.key,
  ),
  slots: collection(
    [
      {
        key: 'Offer1',
        label: 'Offer 1',
        groupKey: 'Boon',
        defaultOptionKey: 'Boon',
        defaultOffer: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      },
    ],
    (slot) => slot.key,
  ),
  slotCount: 1,
} as const satisfies ShopProfileDeclaration;

const roomRewardLifecycle = {
  key: 'RoomReward',
  rewardTypes: collection(
    [boon, maxHealth, shopReward].map((rewardType) => ({
      rewardType: rewardType.gameName,
      acquisitionLifecycle: [],
    })),
    (rewardType) => rewardType.rewardType,
  ),
} as const satisfies ProducerLifecycleProfileDeclaration;

const rewards: RewardKernelCatalog = {
  payloadDomains: collection([boonSource], (domain) => domain.key),
  rewardTypes: collection([boon, maxHealth, shopReward], (rewardType) => rewardType.gameName),
  acquisitions: emptyCollection(),
  stores: collection([runProgress, metaProgress], (store) => store.key),
  shops: collection([shopProfile], (profile) => profile.key),
  producerLifecycles: collection([roomRewardLifecycle], (profile) => profile.key),
};

function exits(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    index: index + 1,
    type: 'Door',
    compatibilityPolicyKey: 'Unconstrained',
  }));
}

function countedRoom(
  gameName: string,
  kind: 'Combat' | 'Opening',
  templateKey: 'FixedOpening' | 'StandardCombat',
  exitCount: number,
): RoomDeclaration {
  return {
    gameName,
    label: gameName,
    biomeKey: 'F',
    kind,
    mode: { kind: 'authored', templateKey },
    structuralTags: [],
    exits: exits(exitCount),
    incomingReward: countedReward,
    enteredRewardStoreHistory: { kind: 'resolvedOffer' },
    encounterProfileKey: kind,
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: { maxAppearancesThisBiome: 1 },
    localChildren: [],
  };
}

const rooms: readonly RoomDeclaration[] = [
  countedRoom('F_Opening01', 'Opening', 'FixedOpening', 2),
  countedRoom('F_Opening02', 'Opening', 'FixedOpening', 2),
  countedRoom('F_OpeningThreeExit', 'Opening', 'FixedOpening', 3),
  countedRoom('F_OpeningHidden', 'Opening', 'FixedOpening', 2),
  countedRoom('F_CombatOneExit', 'Combat', 'StandardCombat', 1),
  countedRoom('F_CombatTwoExit', 'Combat', 'StandardCombat', 2),
  countedRoom('F_CombatThreeExit', 'Combat', 'StandardCombat', 3),
  {
    ...countedRoom('F_ForcedMeta', 'Combat', 'StandardCombat', 1),
    forcedRewardStoreKey: 'MetaProgress',
  },
  {
    ...countedRoom('F_ForcedRun', 'Combat', 'StandardCombat', 1),
    forcedRewardStoreKey: 'RunProgress',
  },
  {
    gameName: 'F_Shop01',
    label: 'Midshop',
    biomeKey: 'F',
    kind: 'Shop',
    mode: { kind: 'authored', templateKey: 'Shop' },
    structuralTags: [],
    exits: exits(1),
    incomingReward: {
      kind: 'shop',
      offer: { rewardType: 'Shop' },
      shopProfileKey: 'WorldShop',
      producerLifecycleKey: 'RoomReward',
    },
    enteredRewardStoreHistory: { kind: 'resolvedOffer' },
    encounterProfileKey: 'Shop',
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: { maxAppearancesThisBiome: 1 },
    localChildren: [],
  },
  {
    gameName: 'F_PreBoss01',
    label: 'Preboss',
    biomeKey: 'F',
    kind: 'Preboss',
    mode: { kind: 'authored', templateKey: 'ForkedPreboss' },
    structuralTags: [],
    exits: [{ index: 1, type: 'Boss', compatibilityPolicyKey: 'Unconstrained' }],
    incomingReward: {
      kind: 'shop',
      offer: { rewardType: 'Shop' },
      shopProfileKey: 'WorldShop',
      producerLifecycleKey: 'RoomReward',
    },
    entryOfferPolicy: {
      kind: 'shopThenFillRemainingExits',
      freeReward: countedReward,
      maxFreeRewards: 1,
    },
    forcedRewardStoreKey: 'RunProgress',
    enteredRewardStoreHistory: { kind: 'resolvedOffer' },
    encounterProfileKey: 'Preboss',
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: { maxAppearancesThisBiome: 1 },
    localChildren: [],
  },
  {
    gameName: 'F_Boss01',
    label: 'Boss',
    biomeKey: 'F',
    kind: 'Boss',
    mode: { kind: 'derived', classification: 'completion' },
    structuralTags: [],
    exits: exits(1),
    incomingReward: { kind: 'none' },
    enteredRewardStoreHistory: { kind: 'none' },
    encounterProfileKey: 'Boss',
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: { maxAppearancesThisBiome: 1 },
    localChildren: [],
  },
];

const layout = {
  biomeKey: 'F',
  kind: 'LinearBiome',
  initialCounters: { biomeDepthCache: 0, biomeEncounterDepth: 1 },
  start: {
    kind: 'authoredStart',
    mode: 'oneOf',
    roomGameNames: ['F_Opening01', 'F_Opening02', 'F_OpeningThreeExit'],
  },
  entries: [],
  continuation: {
    progressionPolicy: { kind: 'eligibilityDriven' },
    batchPolicy: { kind: 'standard', fields: [] },
    rewardStorePolicy: {
      kind: 'authoredBaseStore',
      storeKeys: ['RunProgress', 'MetaProgress'],
      defaultStoreKey: 'RunProgress',
      targetMetaRewardsRatio: 0.315,
      targetMetaRewardsAdjustSpeed: 10,
    },
    rewardStoreOverrides: [],
  },
  terminal: {
    kind: 'forkedTransition',
    roomGameName: 'F_PreBoss01',
    exitPolicy: { kind: 'allExitsTerminal' },
  },
  completion: {
    rooms: [{ role: 'boss', roomGameName: 'F_Boss01' }],
    transitionEffects: [
      { kind: 'resetCounter', axis: 'biomeDepthCache' },
      { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
    ],
  },
  fields: [],
  bounds: { maxBatches: 10, maxTargets: 20 },
} as const satisfies LinearBiomeLayout;

const catalog: Catalog = {
  version: 'command-fixture-1',
  biomes: collection([{ key: 'F', label: 'Erebus' }], (biome) => biome.key),
  routes: collection([underworld], (route) => route.key),
  rewards,
  encounterProfiles: collection<EncounterProfile>([], (profile) => profile.key),
  roomLifecycleProfiles: emptyCollection(),
  exitCompatibilityPolicies: collection(
    [{ key: 'Unconstrained', kind: 'unconstrained' }],
    (policy) => policy.key,
  ),
  exitTypes: collection(
    [{ key: 'Door', compatibilityPolicyKey: 'Unconstrained' }],
    (exitType) => exitType.key,
  ),
  rooms: collection(rooms, (room) => room.gameName),
  biomeLayouts: collection([layout], (biome) => biome.biomeKey),
};

const reusedBiomeCatalog: Catalog = {
  ...catalog,
  routes: collection([underworld, alternate], (route) => route.key),
};

const biome = createBiomeAddress('Underworld', 'F');
const startId = createOccurrenceId('start');

function emptyProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'command-project',
    name: 'Command Project',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function startedProject(): ProjectDocument {
  return applyProjectCommand(emptyProject(), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });
}

function createBatch(document: ProjectDocument, parentOccurrenceId = startId): ProjectDocument {
  return applyProjectCommand(document, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, parentOccurrenceId),
  });
}

function createTarget(
  document: ProjectDocument,
  parentOccurrenceId: typeof startId,
  exitIndex: number,
  occurrenceId: typeof startId,
  gameName: string,
): ProjectDocument {
  return applyProjectCommand(document, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, parentOccurrenceId, exitIndex),
    occurrenceId,
    gameName,
  });
}

function setPicked(
  document: ProjectDocument,
  parentOccurrenceId: typeof startId,
  exitIndex: number,
): ProjectDocument {
  return applyProjectCommand(document, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, parentOccurrenceId),
    exitIndex,
  });
}

function selectedTwoExitParent(parentId: typeof startId): ProjectDocument {
  let project = createBatch(startedProject());
  project = createTarget(project, startId, 1, parentId, 'F_CombatTwoExit');
  return setPicked(project, startId, 1);
}

describe('project semantic addresses', () => {
  it('creates stable domain keys without rendered positions', () => {
    const route = createRouteAddress('Underworld');
    const occurrence = createOccurrenceAddress(biome, startId);
    const firstTarget = createTargetAddress(biome, startId, 1);
    const secondTarget = createTargetAddress(biome, startId, 2);

    expect(semanticAddressKey(route)).toBe('["route","Underworld"]');
    expect(semanticAddressKey(occurrence)).toBe('["occurrence","Underworld","F","start"]');
    expect(semanticAddressKey(firstTarget)).not.toBe(semanticAddressKey(secondTarget));
    expect(Object.isFrozen(route)).toBe(true);
    expect(Object.isFrozen(occurrence)).toBe(true);
    expect(() => createOccurrenceId(' ')).toThrowError(
      new SemanticAddressContractError('occurrenceId', 'must not be blank'),
    );
  });

  it('isolates reused biome placements by route key', () => {
    const sharedOccurrenceId = createOccurrenceId('shared-start');
    const alternateBiome = createBiomeAddress('Alternate', 'F');
    let project = createProjectDocument(reusedBiomeCatalog, {
      projectId: 'reused-biome-project',
      name: 'Reused Biome Project',
      configuredBiomeCounts: { Underworld: 1, Alternate: 1 },
    });

    project = applyProjectCommand(project, reusedBiomeCatalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: sharedOccurrenceId,
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, reusedBiomeCatalog, {
      kind: 'CreateStart',
      biome: alternateBiome,
      occurrenceId: sharedOccurrenceId,
      gameName: 'F_Opening02',
    });
    project = applyProjectCommand(project, reusedBiomeCatalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(alternateBiome, sharedOccurrenceId),
      gameName: 'F_OpeningThreeExit',
    });

    expect(project.routes[0]?.biomes[0]?.topology?.occurrences[0]).toMatchObject({
      occurrenceId: sharedOccurrenceId,
      gameName: 'F_Opening01',
    });
    expect(project.routes[1]?.biomes[0]?.topology?.occurrences[0]).toMatchObject({
      occurrenceId: sharedOccurrenceId,
      gameName: 'F_OpeningThreeExit',
    });
  });
});

describe('route prefix commands', () => {
  const route = createRouteAddress('Underworld');

  it('expands and shrinks the declared prefix without a duplicate count authority', () => {
    const empty = createEmptyProjectDocument(catalog, {
      projectId: 'route-prefix-project',
      name: 'Route Prefix Project',
    });
    const configured = applyProjectCommand(empty, catalog, {
      kind: 'ConfigureRoutePrefix',
      route,
      configuredBiomeCount: 1,
    });

    expect(configured.routes[0]?.biomes).toEqual([
      { kind: 'LinearBiome', biomeKey: 'F', topology: null },
    ]);
    expect(
      applyProjectCommand(configured, catalog, {
        kind: 'ConfigureRoutePrefix',
        route,
        configuredBiomeCount: 1,
      }),
    ).toBe(configured);
    expect(
      applyProjectCommand(configured, catalog, {
        kind: 'ConfigureRoutePrefix',
        route,
        configuredBiomeCount: 0,
      }).routes[0]?.biomes,
    ).toEqual([]);
  });

  it('restores an explicitly removed configured biome through semantic history', () => {
    const original = startedProject();
    let history = createProjectHistory(original);
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ConfigureRoutePrefix',
      route,
      configuredBiomeCount: 0,
    });

    expect(history.present.routes[0]?.biomes).toEqual([]);
    history = undoProjectHistory(history);
    expect(history.present).toBe(original);
    history = redoProjectHistory(history);
    expect(history.present.routes[0]?.biomes).toEqual([]);
  });

  it('rejects malformed counts and unknown routes at the route address', () => {
    const empty = createEmptyProjectDocument(catalog, {
      projectId: 'invalid-route-prefix-project',
      name: 'Invalid Route Prefix Project',
    });

    for (const configuredBiomeCount of [-1, 0.5, 2]) {
      expect(() =>
        applyProjectCommand(empty, catalog, {
          kind: 'ConfigureRoutePrefix',
          route,
          configuredBiomeCount,
        }),
      ).toThrowError(ProjectCommandContractError);
    }
    const unknownRoute = createRouteAddress('Unknown');
    expect(() =>
      applyProjectCommand(empty, catalog, {
        kind: 'ConfigureRoutePrefix',
        route: unknownRoute,
        configuredBiomeCount: 0,
      }),
    ).toThrowError(
      new ProjectCommandContractError(
        'ConfigureRoutePrefix',
        unknownRoute,
        'unknown route Unknown',
      ),
    );
  });
});

describe('ordinary project commands', () => {
  it('constructs a complete batch while preserving repeated game names', () => {
    const original = emptyProject();
    const first = createOccurrenceId('combat-first');
    const second = createOccurrenceId('combat-second');
    let project = applyProjectCommand(original, catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    project = createBatch(project);
    project = createTarget(project, startId, 1, first, 'F_CombatTwoExit');
    project = createTarget(project, startId, 2, second, 'F_CombatTwoExit');
    project = setPicked(project, startId, 1);

    const topology = project.routes[0]?.biomes[0]?.topology;
    expect(original.routes[0]?.biomes[0]?.topology).toBeNull();
    expect(topology?.occurrences.map((room) => room.gameName)).toEqual([
      'F_Opening01',
      'F_CombatTwoExit',
      'F_CombatTwoExit',
    ]);
    expect(topology?.occurrences[1]?.state).toEqual({
      kind: 'counted',
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    expect(topology?.continuations[0]?.pickedExitIndex).toBe(1);
    expect(Object.isFrozen(project)).toBe(true);
  });

  it('replaces the batch store without rewriting target offers or downstream topology', () => {
    const targetId = createOccurrenceId('retained-target');
    const downstreamId = createOccurrenceId('retained-downstream');
    let project = createBatch(startedProject());
    project = createTarget(project, startId, 1, targetId, 'F_CombatTwoExit');
    project = setPicked(project, startId, 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, targetId),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    project = createBatch(project, targetId);
    project = createTarget(project, targetId, 1, downstreamId, 'F_CombatOneExit');
    project = setPicked(project, targetId, 1);
    const before = project.routes[0]?.biomes[0]?.topology;
    if (before === null || before === undefined) {
      throw new Error('expected retained topology fixture');
    }

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, startId),
      storeKey: 'MetaProgress',
    });
    const after = project.routes[0]?.biomes[0]?.topology;
    if (after === null || after === undefined) {
      throw new Error('expected topology after store replacement');
    }

    expect(after.occurrences).toEqual(before.occurrences);
    expect(after.continuations).toEqual([
      {
        ...before.continuations[0],
        rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'MetaProgress' },
      },
      before.continuations[1],
    ]);
    expect(after.continuations[1]).toEqual({
      kind: 'batch',
      parentOccurrenceId: targetId,
      rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
      batchState: null,
      targets: [{ exitIndex: 1, occurrenceId: downstreamId }],
      pickedExitIndex: 1,
    });
  });

  it('resolves forced stores in physical exit order regardless of authoring order', () => {
    const metaId = createOccurrenceId('forced-meta');
    const runId = createOccurrenceId('forced-run');
    const ordinaryId = createOccurrenceId('after-forced');
    let project = applyProjectCommand(emptyProject(), catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: startId,
      gameName: 'F_OpeningThreeExit',
    });
    project = createBatch(project);
    project = createTarget(project, startId, 2, runId, 'F_ForcedRun');
    project = createTarget(project, startId, 1, metaId, 'F_ForcedMeta');
    project = createTarget(project, startId, 3, ordinaryId, 'F_CombatThreeExit');

    const occurrences = project.routes[0]?.biomes[0]?.topology?.occurrences;
    expect(occurrences?.find((room) => room.occurrenceId === metaId)?.state).toEqual({
      kind: 'counted',
      offer: { rewardType: 'MaxHealthDrop' },
    });
    expect(occurrences?.find((room) => room.occurrenceId === ordinaryId)?.state).toEqual({
      kind: 'counted',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
  });

  it('materializes shop inventory on entry and retains it dormantly after re-picking', () => {
    const shopId = createOccurrenceId('unpicked-shop');
    const siblingId = createOccurrenceId('shop-sibling');
    let project = createBatch(startedProject());
    project = createTarget(project, startId, 1, shopId, 'F_Shop01');
    project = createTarget(project, startId, 2, siblingId, 'F_CombatTwoExit');
    expect(
      project.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (room) => room.occurrenceId === shopId,
      )?.state,
    ).toEqual({ kind: 'shop' });

    project = setPicked(project, startId, 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(biome, shopId, 'Offer1'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetShopPurchase',
      purchase: createShopPurchaseAddress(biome, shopId, 'Offer1'),
      purchased: true,
    });
    project = setPicked(project, startId, 2);

    const roundTripped = parseProjectDocument(encodeProjectDocument(project), catalog);
    expect(
      roundTripped.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (room) => room.occurrenceId === shopId,
      )?.state,
    ).toEqual({
      kind: 'shop',
      shop: {
        profileKey: 'WorldShop',
        offers: {
          Offer1: {
            offer: {
              rewardType: 'Boon',
              payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
            },
            purchased: true,
          },
        },
      },
    });
    expect(roundTripped.routes[0]?.biomes[0]?.topology?.continuations[0]?.pickedExitIndex).toBe(2);
  });

  it('re-anchors downstream topology and retains overflow after room replacement', () => {
    const first = createOccurrenceId('first');
    const second = createOccurrenceId('second');
    const downstreamOne = createOccurrenceId('downstream-one');
    const downstreamTwo = createOccurrenceId('downstream-two');
    let project = createBatch(startedProject());
    project = createTarget(project, startId, 1, first, 'F_CombatOneExit');
    project = createTarget(project, startId, 2, second, 'F_CombatTwoExit');
    project = setPicked(project, startId, 1);
    project = createBatch(project, first);
    project = createTarget(project, first, 1, downstreamOne, 'F_CombatTwoExit');
    project = setPicked(project, first, 1);

    project = setPicked(project, startId, 2);
    project = createTarget(project, second, 2, downstreamTwo, 'F_CombatOneExit');
    project = setPicked(project, second, 2);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, second),
      value: { rewardType: 'MaxHealthDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, second),
      gameName: 'F_CombatOneExit',
    });

    const topology = project.routes[0]?.biomes[0]?.topology;
    const continuation = topology?.continuations.find(
      (candidate) => candidate.parentOccurrenceId === second,
    );
    expect(topology?.occurrences.find((room) => room.occurrenceId === second)).toEqual({
      occurrenceId: second,
      gameName: 'F_CombatOneExit',
      state: {
        kind: 'counted',
        offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      },
    });
    expect(
      topology?.continuations.some((candidate) => candidate.parentOccurrenceId === first),
    ).toBe(false);
    expect(continuation?.targets.map((target) => target.exitIndex)).toEqual([1, 2]);
    expect(continuation?.pickedExitIndex).toBe(2);

    expect(() => setPicked(project, second, 2)).toThrowError(
      new ProjectCommandContractError(
        'SetPicked',
        createPickedAddress(biome, second),
        'exit 2 is unavailable from F_CombatOneExit',
      ),
    );
    expect(setPicked(project, second, 1).routes[0]?.biomes[0]?.topology).not.toBeNull();
  });

  it('rejects duplicate IDs and direct creation on unavailable exits', () => {
    const first = createOccurrenceId('first');
    let project = createBatch(startedProject());
    project = createTarget(project, startId, 1, first, 'F_CombatOneExit');

    expect(() => createTarget(project, startId, 2, first, 'F_CombatTwoExit')).toThrowError(
      new ProjectCommandContractError(
        'CreateTarget',
        createTargetAddress(biome, startId, 2),
        'occurrence first already exists',
      ),
    );

    expect(() =>
      createTarget(project, startId, 2, createOccurrenceId('opening-target'), 'F_OpeningHidden'),
    ).toThrowError(
      new ProjectCommandContractError(
        'CreateTarget',
        createTargetAddress(biome, startId, 2),
        'F_OpeningHidden cannot be an ordinary generated target',
      ),
    );

    expect(() =>
      createTarget(project, startId, 2, createOccurrenceId('derived-target'), 'F_Boss01'),
    ).toThrowError(
      new ProjectCommandContractError(
        'CreateTarget',
        createTargetAddress(biome, startId, 2),
        'F_Boss01 is layout-derived and cannot be authored',
      ),
    );

    project = setPicked(project, startId, 1);
    project = createBatch(project, first);
    expect(() =>
      createTarget(project, first, 2, createOccurrenceId('unavailable'), 'F_CombatTwoExit'),
    ).toThrowError(
      new ProjectCommandContractError(
        'CreateTarget',
        createTargetAddress(biome, first, 2),
        'exit 2 is unavailable from F_CombatOneExit',
      ),
    );
  });

  it('replaces counted rewards and shop purchase state through leaf addresses', () => {
    let project = startedProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, startId),
      value: { rewardType: 'MaxHealthDrop' },
    });
    expect(project.routes[0]?.biomes[0]?.topology?.occurrences[0]?.state).toEqual({
      kind: 'counted',
      offer: { rewardType: 'MaxHealthDrop' },
    });

    const shopId = createOccurrenceId('shop');
    project = createBatch(project);
    project = createTarget(project, startId, 1, shopId, 'F_Shop01');
    project = setPicked(project, startId, 1);
    const purchase = createShopPurchaseAddress(biome, shopId, 'Offer1');
    const purchased = applyProjectCommand(project, catalog, {
      kind: 'SetShopPurchase',
      purchase,
      purchased: true,
    });
    expect(
      purchased.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (room) => room.occurrenceId === shopId,
      )?.state,
    ).toMatchObject({ kind: 'shop', shop: { offers: { Offer1: { purchased: true } } } });
    expect(
      applyProjectCommand(purchased, catalog, {
        kind: 'SetShopPurchase',
        purchase,
        purchased: true,
      }),
    ).toBe(purchased);
  });

  it('reports invalid leaf values against their semantic address', () => {
    const reward = createIncomingRewardAddress(biome, startId);
    expect(() =>
      applyProjectCommand(startedProject(), catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'MissingReward' },
      }),
    ).toThrowError(
      new ProjectCommandContractError(
        'ReplaceIncomingReward',
        reward,
        '$.routes[0].biomes[0].topology.occurrences[0].state.offer.rewardType: unknown reward type MissingReward',
      ),
    );
  });
});

describe('terminal and destructive project commands', () => {
  it('creates derived terminal roles and preserves purchase state across offer replacement', () => {
    const parentId = createOccurrenceId('terminal-parent');
    const shopId = createOccurrenceId('terminal-shop');
    const freeId = createOccurrenceId('terminal-free');
    const continuation = createContinuationAddress(biome, parentId);
    let project = selectedTwoExitParent(parentId);

    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTerminalTransition',
      continuation,
      targetOccurrenceIds: [shopId, freeId],
    });
    const topology = project.routes[0]?.biomes[0]?.topology;
    expect(topology?.continuations.at(-1)).toMatchObject({
      kind: 'terminal',
      parentOccurrenceId: parentId,
      targets: [
        { exitIndex: 1, occurrenceId: shopId },
        { exitIndex: 2, occurrenceId: freeId },
      ],
      pickedExitIndex: null,
    });
    expect(topology?.occurrences.find((room) => room.occurrenceId === shopId)?.state.kind).toBe(
      'shop',
    );
    expect(topology?.occurrences.find((room) => room.occurrenceId === freeId)?.state.kind).toBe(
      'freeReward',
    );

    const removed = applyProjectCommand(project, catalog, {
      kind: 'RemoveTerminalTransition',
      continuation,
    });
    expect(
      removed.routes[0]?.biomes[0]?.topology?.occurrences.map((room) => room.occurrenceId),
    ).toEqual([startId, parentId]);

    const purchase = createShopPurchaseAddress(biome, shopId, 'Offer1');
    project = applyProjectCommand(project, catalog, {
      kind: 'SetTerminalPicked',
      picked: createPickedAddress(biome, parentId),
      exitIndex: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetShopPurchase',
      purchase,
      purchased: true,
    });
    const offer = createShopOfferAddress(biome, shopId, 'Offer1');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    const shopState = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (room) => room.occurrenceId === shopId,
    )?.state;
    expect(shopState).toMatchObject({
      kind: 'shop',
      shop: {
        offers: {
          Offer1: {
            offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
            purchased: true,
          },
        },
      },
    });
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopOffer',
        offer,
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      }),
    ).toBe(project);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopOffer',
        offer,
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toThrowError(ProjectCommandContractError);
  });

  it('applies maxTargets only to ordinary generated targets', () => {
    const parentId = createOccurrenceId('bounded-parent');
    const shopId = createOccurrenceId('bounded-shop');
    const freeId = createOccurrenceId('bounded-free');
    let project = selectedTwoExitParent(parentId);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTerminalTransition',
      continuation: createContinuationAddress(biome, parentId),
      targetOccurrenceIds: [shopId, freeId],
    });
    const boundedLayout = { ...layout, bounds: { maxBatches: 1, maxTargets: 1 } };
    const boundedCatalog = {
      ...catalog,
      biomeLayouts: collection([boundedLayout], (candidate) => candidate.biomeKey),
    };

    expect(parseProjectDocument(encodeProjectDocument(project), boundedCatalog)).toEqual(project);
  });

  it('retains, restores, and explicitly reconciles terminal overflow', () => {
    const parentId = createOccurrenceId('terminal-parent');
    const shopId = createOccurrenceId('terminal-shop');
    const freeId = createOccurrenceId('terminal-free');
    const continuation = createContinuationAddress(biome, parentId);
    let project = selectedTwoExitParent(parentId);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTerminalTransition',
      continuation,
      targetOccurrenceIds: [shopId, freeId],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetTerminalPicked',
      picked: createPickedAddress(biome, parentId),
      exitIndex: 2,
    });
    const shrunk = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, parentId),
      gameName: 'F_CombatOneExit',
    });

    expect(() =>
      applyProjectCommand(shrunk, catalog, {
        kind: 'ReconcileTerminalExitCapacity',
        continuation,
      }),
    ).toThrowError(
      new ProjectCommandContractError(
        'ReconcileTerminalExitCapacity',
        continuation,
        'picked exit 2 remains unavailable',
      ),
    );

    const restored = applyProjectCommand(shrunk, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, parentId),
      gameName: 'F_CombatTwoExit',
    });
    expect(
      applyProjectCommand(restored, catalog, {
        kind: 'ReconcileTerminalExitCapacity',
        continuation,
      }),
    ).toBe(restored);

    project = applyProjectCommand(shrunk, catalog, {
      kind: 'SetTerminalPicked',
      picked: createPickedAddress(biome, parentId),
      exitIndex: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReconcileTerminalExitCapacity',
      continuation,
    });
    const reconciled = project.routes[0]?.biomes[0]?.topology;
    expect(reconciled?.continuations.at(-1)?.targets).toEqual([
      { exitIndex: 1, occurrenceId: shopId },
    ]);
    expect(reconciled?.occurrences.some((room) => room.occurrenceId === freeId)).toBe(false);
  });

  it('reconciles ordinary overflow only after an available exit is picked', () => {
    const parentId = createOccurrenceId('ordinary-parent');
    const firstId = createOccurrenceId('ordinary-first');
    const overflowId = createOccurrenceId('ordinary-overflow');
    const continuation = createContinuationAddress(biome, parentId);
    let project = createBatch(selectedTwoExitParent(parentId), parentId);
    project = createTarget(project, parentId, 1, firstId, 'F_CombatOneExit');
    project = createTarget(project, parentId, 2, overflowId, 'F_CombatOneExit');
    project = setPicked(project, parentId, 2);
    const shrunk = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, parentId),
      gameName: 'F_CombatOneExit',
    });

    expect(() =>
      applyProjectCommand(shrunk, catalog, { kind: 'ReconcileExitCapacity', continuation }),
    ).toThrowError(
      new ProjectCommandContractError(
        'ReconcileExitCapacity',
        continuation,
        'picked exit 2 remains unavailable',
      ),
    );

    project = setPicked(shrunk, parentId, 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReconcileExitCapacity',
      continuation,
    });
    const topology = project.routes[0]?.biomes[0]?.topology;
    expect(topology?.continuations.at(-1)?.targets).toEqual([
      { exitIndex: 1, occurrenceId: firstId },
    ]);
    expect(topology?.occurrences.some((room) => room.occurrenceId === overflowId)).toBe(false);
  });

  it('replaces continuation forms and deletes only their owned subtrees', () => {
    const parentId = createOccurrenceId('replace-parent');
    const childId = createOccurrenceId('replace-child');
    const grandchildId = createOccurrenceId('replace-grandchild');
    const shopId = createOccurrenceId('replace-shop');
    const freeId = createOccurrenceId('replace-free');
    const continuation = createContinuationAddress(biome, parentId);
    let project = createBatch(selectedTwoExitParent(parentId), parentId);
    project = createTarget(project, parentId, 1, childId, 'F_CombatOneExit');
    project = setPicked(project, parentId, 1);
    project = createBatch(project, childId);
    project = createTarget(project, childId, 1, grandchildId, 'F_CombatOneExit');

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceWithTerminalTransition',
      continuation,
      targetOccurrenceIds: [shopId, freeId],
    });
    let topology = project.routes[0]?.biomes[0]?.topology;
    expect(topology?.occurrences.map((room) => room.occurrenceId)).toEqual([
      startId,
      parentId,
      shopId,
      freeId,
    ]);
    expect(topology?.continuations.at(-1)?.kind).toBe('terminal');

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceWithBatch',
      continuation,
    });
    topology = project.routes[0]?.biomes[0]?.topology;
    expect(topology?.occurrences.map((room) => room.occurrenceId)).toEqual([startId, parentId]);
    expect(topology?.continuations.at(-1)).toEqual({
      kind: 'batch',
      parentOccurrenceId: parentId,
      rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
      batchState: null,
      targets: [],
      pickedExitIndex: null,
    });

    project = applyProjectCommand(project, catalog, { kind: 'RemoveBatch', continuation });
    expect(project.routes[0]?.biomes[0]?.topology?.occurrences).toHaveLength(2);
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveBatch',
      continuation: createContinuationAddress(biome, startId),
    });
    expect(
      project.routes[0]?.biomes[0]?.topology?.occurrences.map((room) => room.occurrenceId),
    ).toEqual([startId]);

    project = applyProjectCommand(project, catalog, { kind: 'ClearTopology', biome });
    expect(project.routes[0]?.biomes[0]?.topology).toBeNull();
    expect(applyProjectCommand(project, catalog, { kind: 'ClearTopology', biome })).toBe(project);
  });

  it('rejects incomplete terminal occurrence allocation', () => {
    const parentId = createOccurrenceId('terminal-parent');
    const continuation = createContinuationAddress(biome, parentId);
    expect(() =>
      applyProjectCommand(selectedTwoExitParent(parentId), catalog, {
        kind: 'CreateTerminalTransition',
        continuation,
        targetOccurrenceIds: [createOccurrenceId('only-shop')],
      }),
    ).toThrowError(
      new ProjectCommandContractError(
        'CreateTerminalTransition',
        continuation,
        'requires 2 terminal occurrence IDs',
      ),
    );
  });
});

describe('authored project history', () => {
  it('restores destructive edits exactly and clears redo after a new command', () => {
    const parentId = createOccurrenceId('history-parent');
    const original = selectedTwoExitParent(parentId);
    const rootContinuation = createContinuationAddress(biome, startId);
    let history = createProjectHistory(original);
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'RemoveBatch',
      continuation: rootContinuation,
    });
    expect(canUndoProjectHistory(history)).toBe(true);
    expect(history.present.routes[0]?.biomes[0]?.topology?.occurrences).toHaveLength(1);

    history = undoProjectHistory(history);
    expect(history.present).toBe(original);
    expect(canRedoProjectHistory(history)).toBe(true);
    const withRedo = history;

    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, startId),
      exitIndex: 1,
    });
    expect(history).toBe(withRedo);
    expect(canRedoProjectHistory(history)).toBe(true);

    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, parentId),
      gameName: 'F_CombatOneExit',
    });
    expect(canRedoProjectHistory(history)).toBe(false);
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history.past)).toBe(true);
  });

  it('undoes and redoes exact authored snapshots without recording leaf no-ops', () => {
    const original = startedProject();
    let history = createProjectHistory(original);
    const reorderedUnchanged = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, startId),
      value: {
        payload: { source: 'ApolloUpgrade', kind: 'BoonSource' },
        rewardType: 'Boon',
      },
    });
    expect(reorderedUnchanged).toBe(history);

    const unchanged = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, startId),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    expect(unchanged).toBe(history);

    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, startId),
      value: { rewardType: 'MaxHealthDrop' },
    });
    const edited = history.present;
    expect(history.past).toEqual([original]);
    history = undoProjectHistory(history);
    expect(history.present).toBe(original);
    history = redoProjectHistory(history);
    expect(history.present).toBe(edited);
    expect(redoProjectHistory(history)).toBe(history);
  });
});
