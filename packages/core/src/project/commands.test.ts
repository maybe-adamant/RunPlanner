import { describe, expect, it } from 'vitest';

import type {
  Catalog,
  CatalogCollection,
  EncounterProfile,
  LinearBiomeLayout,
  RoomDeclaration,
  RouteDeclaration,
} from '../catalog';
import type {
  CountedRewardBinding,
  RewardPayloadDomain,
  RewardPrimitive,
  RewardStore,
  ShopOptionSet,
  ShopProfile,
} from '../rewards';
import {
  createBiomeAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  SemanticAddressContractError,
  semanticAddressKey,
} from './addresses';
import { applyProjectCommand, ProjectCommandContractError } from './commands';
import { createProjectDocument } from './defaults';
import type { ProjectDocument } from './model';

function collection<T>(values: readonly T[], key: (value: T) => string): CatalogCollection<T> {
  return {
    values,
    byKey: Object.fromEntries(values.map((value) => [key(value), value])),
  };
}

const underworld = {
  key: 'Underworld',
  label: 'Underworld',
  biomeSteps: [{ key: 'Underworld_F', biome: 'F' }],
} as const satisfies RouteDeclaration;

const boonSource = {
  key: 'BoonSource',
  kind: 'oneOf',
  values: ['ApolloUpgrade', 'ZeusUpgrade'],
} as const satisfies RewardPayloadDomain;

const boon = {
  gameName: 'Boon',
  label: 'Boon',
  acquiredAs: 'Boon',
  payloadDomain: 'BoonSource',
  defaultPayload: { source: 'ApolloUpgrade' },
} as const satisfies RewardPrimitive;

const maxHealth = {
  gameName: 'MaxHealthDrop',
  label: 'Max Health',
  acquiredAs: 'MaxHealthDrop',
} as const satisfies RewardPrimitive;

const runProgress = {
  key: 'RunProgress',
  defaultRewardType: 'Boon',
  refill: 'appendWhenNoEligibleEntry',
  entries: [{ rewardType: 'Boon' }, { rewardType: 'MaxHealthDrop' }],
  rewardTypes: ['Boon', 'MaxHealthDrop'],
} as const satisfies RewardStore;

const countedReward = {
  kind: 'countedChoice',
  storeKeys: ['RunProgress'],
  defaultStoreKey: 'RunProgress',
  eligibleRewardTypes: [],
  ineligibleRewardTypes: [],
  allowedRewardTypes: ['Boon', 'MaxHealthDrop'],
  defaultReward: { rewardType: 'Boon', payload: { source: 'ApolloUpgrade' } },
} as const satisfies CountedRewardBinding;

const shopOptions = {
  key: 'ShopBoon',
  rewardTypes: ['Boon'],
} as const satisfies ShopOptionSet;

const shopProfile = {
  key: 'WorldShop',
  slots: collection(
    [
      {
        key: 'Offer1',
        label: 'Offer 1',
        optionSetKey: 'ShopBoon',
        defaultReward: { rewardType: 'Boon', payload: { source: 'ApolloUpgrade' } },
      },
    ],
    (slot) => slot.key,
  ),
} as const satisfies ShopProfile;

function exits(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    index: index + 1,
    targetMode: 'generated' as const,
    type: 'Door',
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
    biomeStepKey: 'Underworld_F',
    kind,
    templateKey,
    exits: exits(exitCount),
    incomingReward: countedReward,
    encounterProfileKey: kind,
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: { maxAppearancesThisBiome: 1 },
  };
}

const rooms: readonly RoomDeclaration[] = [
  countedRoom('F_Opening01', 'Opening', 'FixedOpening', 2),
  countedRoom('F_Opening02', 'Opening', 'FixedOpening', 2),
  countedRoom('F_OpeningHidden', 'Opening', 'FixedOpening', 2),
  countedRoom('F_CombatOneExit', 'Combat', 'StandardCombat', 1),
  countedRoom('F_CombatTwoExit', 'Combat', 'StandardCombat', 2),
  {
    gameName: 'F_Shop01',
    label: 'Midshop',
    biomeStepKey: 'Underworld_F',
    kind: 'Shop',
    templateKey: 'Shop',
    exits: exits(1),
    incomingReward: { kind: 'shop', shopProfileKey: 'WorldShop' },
    encounterProfileKey: 'Shop',
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: { maxAppearancesThisBiome: 1 },
  },
  {
    gameName: 'F_PreBoss01',
    label: 'Preboss',
    biomeStepKey: 'Underworld_F',
    kind: 'Preboss',
    templateKey: 'ForkedPreboss',
    exits: [{ index: 1, targetMode: 'fixedBoss', type: 'Boss' }],
    incomingReward: { kind: 'shop', shopProfileKey: 'WorldShop' },
    entryOfferPolicy: {
      kind: 'shopThenFillRemainingExits',
      freeReward: countedReward,
      maxFreeRewards: 1,
    },
    encounterProfileKey: 'Preboss',
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: { maxAppearancesThisBiome: 1 },
  },
];

const layout = {
  biomeStepKey: 'Underworld_F',
  kind: 'LinearBiome',
  start: { mode: 'oneOf', roomGameNames: ['F_Opening01', 'F_Opening02'] },
  continuation: { defaultBatchRuleKey: 'Standard' },
  terminal: {
    roomGameName: 'F_PreBoss01',
    transitionRuleKey: 'PrebossEntry',
    exitPolicy: { kind: 'allExitsTerminal' },
  },
  bounds: { maxBatches: 10, maxTargets: 20 },
} as const satisfies LinearBiomeLayout;

const catalog: Catalog = {
  version: 'command-fixture-1',
  routes: collection([underworld], (route) => route.key),
  rewardPayloadDomains: collection([boonSource], (domain) => domain.key),
  rewardPrimitives: collection([boon, maxHealth], (primitive) => primitive.gameName),
  rewardStores: collection([runProgress], (store) => store.key),
  shopOptionSets: collection([shopOptions], (options) => options.key),
  shopProfiles: collection([shopProfile], (profile) => profile.key),
  encounterProfiles: collection<EncounterProfile>([], (profile) => profile.key),
  rooms: collection(rooms, (room) => room.gameName),
  biomeLayouts: collection([layout], (biome) => biome.biomeStepKey),
};

const biome = createBiomeAddress('Underworld', 'Underworld_F');
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

describe('project semantic addresses', () => {
  it('creates stable domain keys without rendered positions', () => {
    const occurrence = createOccurrenceAddress(biome, startId);
    const firstTarget = createTargetAddress(biome, startId, 1);
    const secondTarget = createTargetAddress(biome, startId, 2);

    expect(semanticAddressKey(occurrence)).toBe(
      '["occurrence","Underworld","Underworld_F","start"]',
    );
    expect(semanticAddressKey(firstTarget)).not.toBe(semanticAddressKey(secondTarget));
    expect(Object.isFrozen(occurrence)).toBe(true);
    expect(() => createOccurrenceId(' ')).toThrowError(
      new SemanticAddressContractError('occurrenceId', 'must not be blank'),
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
      choice: {
        storeKey: 'RunProgress',
        reward: { rewardType: 'Boon', payload: { source: 'ApolloUpgrade' } },
      },
    });
    expect(topology?.continuations[0]?.pickedExitIndex).toBe(1);
    expect(Object.isFrozen(project)).toBe(true);
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
      choice: { storeKey: 'RunProgress', reward: { rewardType: 'MaxHealthDrop' } },
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
        choice: {
          storeKey: 'RunProgress',
          reward: { rewardType: 'Boon', payload: { source: 'ApolloUpgrade' } },
        },
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
      choice: { storeKey: 'RunProgress', reward: { rewardType: 'MaxHealthDrop' } },
    });
    expect(project.routes[0]?.biomes[0]?.topology?.occurrences[0]?.state).toEqual({
      kind: 'counted',
      choice: { storeKey: 'RunProgress', reward: { rewardType: 'MaxHealthDrop' } },
    });

    const shopId = createOccurrenceId('shop');
    project = createBatch(project);
    project = createTarget(project, startId, 1, shopId, 'F_Shop01');
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
        choice: { storeKey: 'RunProgress', reward: { rewardType: 'MissingReward' } },
      }),
    ).toThrowError(
      new ProjectCommandContractError(
        'ReplaceIncomingReward',
        reward,
        '$.routes[0].biomes[0].topology.occurrences[0].state.choice.reward.rewardType: unknown reward primitive MissingReward',
      ),
    );
  });
});
