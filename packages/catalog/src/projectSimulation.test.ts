import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
  simulateProject,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/core';
import type { ResolvedRewardOffer } from '@run-planner/core/reward-kernel';
import { describe, expect, it } from 'vitest';

import { createCatalog } from './catalog';
import { declarations } from './declarations';
import { catalog } from './index';

const biome = createBiomeAddress('Underworld', 'F');
const startId = createOccurrenceId('golden-start');

interface BatchSpec {
  readonly targets: readonly string[];
  readonly pickedExitIndex: number;
}

const goldenBatches: readonly BatchSpec[] = [
  { targets: ['F_Combat02'], pickedExitIndex: 1 },
  { targets: ['F_Combat03', 'F_Combat03'], pickedExitIndex: 1 },
  { targets: ['F_Combat04', 'F_Combat04'], pickedExitIndex: 1 },
  { targets: ['F_Combat05', 'F_Combat11'], pickedExitIndex: 1 },
  { targets: ['F_Combat06', 'F_Combat06'], pickedExitIndex: 1 },
  { targets: ['F_MiniBoss01', 'F_MiniBoss02'], pickedExitIndex: 1 },
  { targets: ['F_Combat11'], pickedExitIndex: 1 },
  { targets: ['F_Combat12', 'F_Combat12'], pickedExitIndex: 1 },
  { targets: ['F_Combat14', 'F_Combat14'], pickedExitIndex: 1 },
  { targets: ['F_Combat15', 'F_Combat15'], pickedExitIndex: 1 },
];

const goldenPeerOffers: Readonly<Record<number, ResolvedRewardOffer>> = {
  2: { rewardType: 'MaxHealthDrop' },
  3: { rewardType: 'MaxManaDrop' },
  4: { rewardType: 'RoomMoneyDrop' },
  5: { rewardType: 'MetaCurrencyDrop' },
  6: {
    rewardType: 'Boon',
    payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
  },
  8: { rewardType: 'HermesUpgrade' },
  9: { rewardType: 'MetaCurrencyDrop' },
  10: { rewardType: 'SpellDrop' },
};

const goldenPickedOffers: Readonly<Record<number, ResolvedRewardOffer>> = {
  3: { rewardType: 'MaxHealthDrop' },
  4: { rewardType: 'StackUpgrade' },
  7: { rewardType: 'MaxManaDrop' },
  8: { rewardType: 'WeaponUpgrade' },
  10: { rewardType: 'RoomMoneyDrop' },
};

function batchOccurrenceId(batchIndex: number, exitIndex: number): OccurrenceId {
  return createOccurrenceId(`golden-b${batchIndex}-e${exitIndex}`);
}

function emptyFProject(projectId: string): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId,
    name: projectId,
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function withDormantG(project: ProjectDocument): ProjectDocument {
  return Object.freeze({
    ...project,
    routes: Object.freeze(
      project.routes.map((route) =>
        route.routeKey === 'Underworld'
          ? Object.freeze({
              ...route,
              biomes: Object.freeze([
                ...route.biomes,
                Object.freeze({ kind: 'LinearBiome' as const, biomeKey: 'G', topology: null }),
              ]),
            })
          : route,
      ),
    ),
  });
}

function completeGoldenProject(batches: readonly BatchSpec[] = goldenBatches): ProjectDocument {
  let project = applyProjectCommand(emptyFProject('phase-3-golden'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });
  let parentId = startId;

  batches.forEach((batch, batchOffset) => {
    const batchIndex = batchOffset + 1;
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, parentId),
    });
    if (batchIndex === 1 || batchIndex === 5 || batchIndex === 9) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: createBatchRewardStoreAddress(biome, parentId),
        storeKey: 'MetaProgress',
      });
    }
    batch.targets.forEach((gameName, targetOffset) => {
      const exitIndex = targetOffset + 1;
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, parentId, exitIndex),
        occurrenceId: batchOccurrenceId(batchIndex, exitIndex),
        gameName,
      });
    });
    const peerOffer = goldenPeerOffers[batchIndex];
    if (peerOffer !== undefined) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(biome, batchOccurrenceId(batchIndex, 2)),
        value: peerOffer,
      });
    }
    if (batchIndex === 5 || batchIndex === 9) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(biome, batchOccurrenceId(batchIndex, 1)),
        value: { rewardType: 'MetaCardPointsCommonDrop' },
      });
    }
    const pickedOffer = goldenPickedOffers[batchIndex];
    if (pickedOffer !== undefined) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(biome, batchOccurrenceId(batchIndex, 1)),
        value: pickedOffer,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, parentId),
      exitIndex: batch.pickedExitIndex,
    });
    parentId = batchOccurrenceId(batchIndex, batch.pickedExitIndex);
  });

  const parentName = batches.at(-1)?.targets[batches.at(-1)!.pickedExitIndex - 1];
  const parent = parentName === undefined ? undefined : catalog.rooms.byKey[parentName];
  if (parent === undefined) {
    throw new Error('golden terminal parent is missing');
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, parentId),
    targetOccurrenceIds: parent.exits.map((exit) =>
      createOccurrenceId(`golden-terminal-e${exit.index}`),
    ),
  });
  if (parent.exits.length > 1) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, createOccurrenceId('golden-terminal-e2')),
      value: { rewardType: 'StackUpgrade' },
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, parentId),
    exitIndex: 1,
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(biome, createOccurrenceId('golden-terminal-e1'), 'MajorNonBoon'),
    value: { rewardType: 'RoomRewardHealDrop' },
  });
}

function earlyTerminalProject(): ProjectDocument {
  let project = applyProjectCommand(emptyFProject('phase-3-invalid'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: createOccurrenceId('invalid-start'),
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, createOccurrenceId('invalid-start')),
    targetOccurrenceIds: [createOccurrenceId('invalid-terminal-shop')],
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, createOccurrenceId('invalid-start')),
    exitIndex: 1,
  });
}

function shopTraceProject(): ProjectDocument {
  const start = createOccurrenceId('public-shop-start');
  const first = createOccurrenceId('public-shop-first');
  const third = createOccurrenceId('public-shop-third');
  const shop = createOccurrenceId('public-shop-room');
  const fifth = createOccurrenceId('public-shop-fifth');
  const peer = createOccurrenceId('public-shop-peer');
  let project = applyProjectCommand(emptyFProject('phase-3-shop-trace'), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  const batches = [
    { parent: start, child: first, gameName: 'F_Combat01' },
    { parent: first, child: third, gameName: 'F_MiniBoss01' },
    { parent: third, child: shop, gameName: 'F_Shop01' },
  ] as const;
  for (const batch of batches) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, batch.parent),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, batch.parent),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, batch.parent, 1),
      occurrenceId: batch.child,
      gameName: batch.gameName,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, batch.parent),
      exitIndex: 1,
    });
  }
  for (const [occurrenceId, source] of [
    [first, 'PoseidonUpgrade'],
    [third, 'HestiaUpgrade'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, occurrenceId),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source } },
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(biome, shop, 'Boon'),
    value: {
      rewardType: 'RandomLoot',
      payload: { kind: 'BoonSource', source: 'AresUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetShopPurchase',
    purchase: createShopPurchaseAddress(biome, shop, 'Boon'),
    purchased: true,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, shop),
  });
  for (const [exitOffset, target] of [
    { occurrenceId: fifth, gameName: 'F_Combat04' },
    { occurrenceId: peer, gameName: 'F_Story01' },
  ].entries()) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, shop, exitOffset + 1),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, shop),
    exitIndex: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, fifth),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, fifth),
    targetOccurrenceIds: [
      createOccurrenceId('public-shop-terminal-shop'),
      createOccurrenceId('public-shop-terminal-free'),
    ],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, fifth),
    exitIndex: 1,
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, createOccurrenceId('public-shop-terminal-free')),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

describe('project simulation composition', () => {
  it('reports an unconfigured project as empty rather than valid', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'phase-3-empty',
      name: 'Phase 3 Empty',
    });
    const result = simulateProject(catalog, project);

    expect(result.status).toBe('empty');
    expect(result.routes.map((route) => route.status)).toEqual(['empty', 'empty']);
    expect(result.findings).toEqual([]);
    expect(result.summary).toEqual({
      configuredBiomeCount: 0,
      evaluatedBiomeCount: 0,
      validatedBiomeCount: 0,
      incompleteBiomeCount: 0,
      invalidBiomeCount: 0,
      blockedBiomeCount: 0,
      eligibleForExecutionPlan: false,
    });
  });

  it('returns an addressed incomplete F result without a canonical snapshot', () => {
    const result = simulateProject(catalog, emptyFProject('phase-3-incomplete'));
    const underworld = result.routes[0]!;
    const evaluation = underworld.biomes[0]!;

    expect(result.status).toBe('incomplete');
    expect(underworld.horizon).toEqual({
      kind: 'incomplete',
      biomeKey: 'F',
      blockedBiomeKeys: [],
    });
    expect(evaluation).toEqual({
      biomeKey: 'F',
      origin: biome,
      completion: 'incomplete',
      findings: [expect.objectContaining({ code: 'biomeTopologyMissing', origin: biome })],
    });
    expect('snapshot' in evaluation).toBe(false);
    expect(result.summary).toMatchObject({
      evaluatedBiomeCount: 1,
      validatedBiomeCount: 0,
      incompleteBiomeCount: 1,
      eligibleForExecutionPlan: false,
    });
  });

  it('closes the representative valid F project through the public result', () => {
    const project = completeGoldenProject();
    const result = simulateProject(catalog, project);
    const repeated = [batchOccurrenceId(2, 1), batchOccurrenceId(2, 2)];
    const underworld = result.routes[0]!;
    const evaluation = underworld.biomes[0]!;

    expect(result.findings).toEqual([]);
    expect(result.status).toBe('valid');
    expect(result.summary).toEqual({
      configuredBiomeCount: 1,
      evaluatedBiomeCount: 1,
      validatedBiomeCount: 1,
      incompleteBiomeCount: 0,
      invalidBiomeCount: 0,
      blockedBiomeCount: 0,
      eligibleForExecutionPlan: true,
    });
    expect(underworld).toMatchObject({
      status: 'valid',
      configuredBiomeKeys: ['F'],
      validatedPrefix: ['F'],
      horizon: { kind: 'routeEnd' },
    });
    expect(evaluation.completion).toBe('complete');
    if (evaluation.completion !== 'complete') {
      throw new Error('golden F unexpectedly incomplete');
    }
    expect(evaluation.validity).toBe('valid');
    expect(evaluation.snapshot.batches).toHaveLength(10);
    expect(evaluation.snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'F_Boss01',
      'F_PostBoss01',
    ]);
    expect(evaluation.history.ledgers.roomCreations).toHaveLength(23);
    expect(evaluation.history.ledgers.roomAppearances).toHaveLength(14);
    expect(evaluation.history.afterTransition.ledgers.counters).toEqual({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
      routeEncounterDepth: 12,
      roomHistoryOrdinal: 14,
    });
    expect(
      evaluation.snapshot.batches[1]!.targets.map((target) => ({
        gameName: target.room.gameName,
        origin: target.room.origin.occurrenceId,
      })),
    ).toEqual([
      { gameName: 'F_Combat03', origin: repeated[0] },
      { gameName: 'F_Combat03', origin: repeated[1] },
    ]);
    expect(evaluation.roomGeneration.forcePressure.at(-1)).toMatchObject({
      selectedGameName: 'F_PreBoss01',
      selectedPossible: true,
      biomeDepthCache: 10,
    });
    expect(evaluation.rewards.branches.length).toBeGreaterThan(0);
  });

  it('retains complete canonical products and addressed findings for invalid F', () => {
    const result = simulateProject(catalog, earlyTerminalProject());
    const underworld = result.routes[0]!;
    const evaluation = underworld.biomes[0]!;

    expect(result.status).toBe('invalid');
    expect(underworld.validatedPrefix).toEqual([]);
    expect(underworld.horizon).toEqual({
      kind: 'invalid',
      biomeKey: 'F',
      blockedBiomeKeys: [],
    });
    expect(evaluation.completion).toBe('complete');
    if (evaluation.completion !== 'complete') {
      throw new Error('invalid F unexpectedly incomplete');
    }
    expect(evaluation.validity).toBe('invalid');
    expect(evaluation.snapshot.terminalEntry.targets).toHaveLength(1);
    expect(evaluation.history.events.length).toBeGreaterThan(0);
    expect(evaluation.roomGeneration.findings).toContainEqual(
      expect.objectContaining({ code: 'targetRoomUnavailable' }),
    );
    expect(result.findings.every((finding) => finding.origin.routeKey === 'Underworld')).toBe(true);
  });

  it('blocks configured downstream biomes after incomplete and invalid F horizons', () => {
    const incomplete = simulateProject(
      catalog,
      createProjectDocument(catalog, {
        projectId: 'phase-3-incomplete-horizon',
        name: 'Phase 3 Incomplete Horizon',
        configuredBiomeCounts: { Underworld: 2 },
      }),
    );
    const invalid = simulateProject(catalog, withDormantG(earlyTerminalProject()));

    expect(incomplete.routes[0]!.horizon).toEqual({
      kind: 'incomplete',
      biomeKey: 'F',
      blockedBiomeKeys: ['G'],
    });
    expect(incomplete.routes[0]!.biomes).toHaveLength(1);
    expect(incomplete.routes[0]!.summary).toMatchObject({
      evaluatedBiomeCount: 1,
      incompleteBiomeCount: 1,
      blockedBiomeCount: 1,
      eligibleForExecutionPlan: false,
    });
    expect(invalid.routes[0]!.horizon).toEqual({
      kind: 'invalid',
      biomeKey: 'F',
      blockedBiomeKeys: ['G'],
    });
    expect(invalid.routes[0]!.biomes).toHaveLength(1);
    expect(invalid.routes[0]!.summary).toMatchObject({
      evaluatedBiomeCount: 1,
      invalidBiomeCount: 1,
      blockedBiomeCount: 1,
      eligibleForExecutionPlan: false,
    });
  });

  it('publishes reward/shop witnesses through the same complete invalid evaluation', () => {
    const result = simulateProject(catalog, shopTraceProject());
    const evaluation = result.routes[0]!.biomes[0]!;

    expect(evaluation.completion).toBe('complete');
    if (evaluation.completion !== 'complete') {
      throw new Error('shop trace unexpectedly incomplete');
    }
    const branch = evaluation.rewards.branches[0]!;
    const purchaseOrigin = createShopPurchaseAddress(
      biome,
      createOccurrenceId('public-shop-room'),
      'Boon',
    );
    const fifthOrigin = createOccurrenceId('public-shop-fifth');
    const purchase = branch.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(purchaseOrigin),
    );
    const fifthOffer = branch.events.find(
      (event) =>
        event.kind === 'rewardOffered' &&
        event.origin.kind === 'incomingReward' &&
        event.origin.occurrenceId === fifthOrigin,
    );

    expect(evaluation.rewards.validity).toBe('valid');
    expect(fifthOffer!.historySequence).toBeLessThan(purchase!.historySequence);
    expect(branch.history.lootTypeHistory).toMatchObject({
      AresUpgrade: 1,
    });
  });

  it('is deeply deterministic and stops before dormant biome dispatch', () => {
    const project = completeGoldenProject();
    const first = simulateProject(catalog, project);
    const second = simulateProject(catalog, project);
    const rebuilt = simulateProject(createCatalog(declarations), project);
    const dormant = simulateProject(catalog, withDormantG(project));

    expect(second).toEqual(first);
    expect(rebuilt).toEqual(first);
    expect(dormant.routes[0]!.biomes).toHaveLength(1);
    expect(dormant.status).toBe('blocked');
    expect(dormant.routes[0]!.horizon).toEqual({
      kind: 'simulatorBoundary',
      biomeKey: 'G',
      blockedBiomeKeys: ['G'],
    });
    expect(dormant.routes[0]!.summary).toMatchObject({
      configuredBiomeCount: 2,
      evaluatedBiomeCount: 1,
      validatedBiomeCount: 1,
      blockedBiomeCount: 1,
      eligibleForExecutionPlan: false,
    });
  });
});
