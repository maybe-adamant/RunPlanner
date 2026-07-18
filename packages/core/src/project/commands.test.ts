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
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  SemanticAddressContractError,
  semanticAddressKey,
} from './addresses';
import { applyProjectCommand, ProjectCommandContractError } from './commands';
import { createProjectDocument } from './defaults';
import {
  applyProjectHistoryCommand,
  canRedoProjectHistory,
  canUndoProjectHistory,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
} from './history';
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

function selectedTwoExitParent(parentId: typeof startId): ProjectDocument {
  let project = createBatch(startedProject());
  project = createTarget(project, startId, 1, parentId, 'F_CombatTwoExit');
  return setPicked(project, startId, 1);
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
      kind: 'SetShopPurchase',
      purchase,
      purchased: true,
    });
    const offer = createShopOfferAddress(biome, shopId, 'Offer1');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      reward: { rewardType: 'Boon', payload: { source: 'ZeusUpgrade' } },
    });
    const shopState = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (room) => room.occurrenceId === shopId,
    )?.state;
    expect(shopState).toMatchObject({
      kind: 'shop',
      shop: {
        offers: {
          Offer1: {
            reward: { rewardType: 'Boon', payload: { source: 'ZeusUpgrade' } },
            purchased: true,
          },
        },
      },
    });
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopOffer',
        offer,
        reward: { rewardType: 'Boon', payload: { source: 'ZeusUpgrade' } },
      }),
    ).toBe(project);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopOffer',
        offer,
        reward: { rewardType: 'MaxHealthDrop' },
      }),
    ).toThrowError(ProjectCommandContractError);
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
    const unchanged = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, startId),
      choice: {
        storeKey: 'RunProgress',
        reward: { rewardType: 'Boon', payload: { source: 'ApolloUpgrade' } },
      },
    });
    expect(unchanged).toBe(history);

    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, startId),
      choice: { storeKey: 'RunProgress', reward: { rewardType: 'MaxHealthDrop' } },
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
