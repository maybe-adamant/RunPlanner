import {
  applyProjectCommand,
  composeLinearHistory,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createRouteAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  evaluateProjectCandidate,
  evaluateProjectCandidates,
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
const gBiome = createBiomeAddress('Underworld', 'G');
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

const gPickedRooms = [
  'G_Combat01',
  'G_Combat02',
  'G_Combat03',
  'G_Combat10',
  'G_Combat11',
  'G_Shop01',
  'G_MiniBoss01',
  'G_Combat12',
] as const;

interface GFixtureOptions {
  readonly pickedMiniboss?: 'G_MiniBoss01' | 'G_MiniBoss02';
}

const gPeerRooms: Readonly<Record<number, readonly string[]>> = {
  2: ['G_Combat02'],
  3: ['G_Combat03', 'G_Combat03'],
  4: ['G_Combat11', 'G_Combat12'],
  5: ['G_Combat12'],
  6: ['G_Combat12'],
  7: ['G_MiniBoss02'],
  8: ['G_Combat13'],
};

const gMetaOffers: Readonly<Record<number, readonly (ResolvedRewardOffer | undefined)[]>> = {
  2: [{ rewardType: 'MetaCurrencyBigDrop' }, { rewardType: 'MetaCardPointsCommonBigDrop' }],
  5: [{ rewardType: 'MetaCurrencyBigDrop' }, { rewardType: 'MetaCardPointsCommonBigDrop' }],
};

const gRunOffers: Readonly<Record<number, readonly (ResolvedRewardOffer | undefined)[]>> = {
  1: [{ rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } }],
  3: [
    { rewardType: 'MaxHealthDrop' },
    { rewardType: 'MaxManaDrop' },
    { rewardType: 'RoomMoneyDrop' },
  ],
  4: [{ rewardType: 'SpellDrop' }, { rewardType: 'MaxHealthDrop' }, { rewardType: 'MaxManaDrop' }],
  6: [undefined, { rewardType: 'StackUpgrade' }],
  7: [
    { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
    { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
  ],
  8: [
    { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
    { rewardType: 'TalentDrop' },
  ],
};

function gOccurrenceId(batchIndex: number, exitIndex: number): OccurrenceId {
  return createOccurrenceId(`golden-g-b${batchIndex}-e${exitIndex}`);
}

function completeGoldenFGProject(options: GFixtureOptions = {}): ProjectDocument {
  const pickedRooms = gPickedRooms.map((gameName) =>
    gameName === 'G_MiniBoss01' ? (options.pickedMiniboss ?? gameName) : gameName,
  );
  let project = applyProjectCommand(completeGoldenProject(), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 2,
  });
  const introId = createOccurrenceId('golden-g-intro');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: gBiome,
    occurrenceId: introId,
    gameName: 'G_Intro',
  });
  let parentId = introId;

  pickedRooms.forEach((pickedGameName, offset) => {
    const batchIndex = offset + 1;
    const parent = catalog.rooms.byKey[batchIndex === 1 ? 'G_Intro' : pickedRooms[batchIndex - 2]!];
    if (parent === undefined) {
      throw new Error(`missing G parent for batch ${batchIndex}`);
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(gBiome, parentId),
    });
    if (batchIndex === 2 || batchIndex === 5) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: createBatchRewardStoreAddress(gBiome, parentId),
        storeKey: 'MetaProgress',
      });
    }
    const peerRooms =
      batchIndex === 7 && options.pickedMiniboss === 'G_MiniBoss02'
        ? ['G_MiniBoss01']
        : batchIndex === 8 && options.pickedMiniboss === 'G_MiniBoss02'
          ? []
          : (gPeerRooms[batchIndex] ?? []);
    const targetNames = [pickedGameName, ...peerRooms];
    if (targetNames.length !== parent.exits.length) {
      throw new Error(`G batch ${batchIndex} fixture does not fill its physical exits`);
    }
    targetNames.forEach((gameName, targetOffset) => {
      const exitIndex = targetOffset + 1;
      const occurrenceId = gOccurrenceId(batchIndex, exitIndex);
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(gBiome, parentId, exitIndex),
        occurrenceId,
        gameName,
      });
      const offer =
        gMetaOffers[batchIndex]?.[targetOffset] ?? gRunOffers[batchIndex]?.[targetOffset];
      if (offer !== undefined) {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(gBiome, occurrenceId),
          value: offer,
        });
      }
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(gBiome, parentId),
      exitIndex: 1,
    });
    if (pickedGameName === 'G_Shop01') {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(gBiome, gOccurrenceId(batchIndex, 1), 'MajorNonBoon'),
        value: { rewardType: 'RoomRewardHealDrop' },
      });
    }
    parentId = gOccurrenceId(batchIndex, 1);
  });

  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(gBiome, parentId),
    targetOccurrenceIds: [
      createOccurrenceId('golden-g-terminal-shop'),
      createOccurrenceId('golden-g-terminal-free'),
    ],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(gBiome, createOccurrenceId('golden-g-terminal-free')),
    value: { rewardType: 'StackUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(gBiome, parentId),
    exitIndex: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(
      gBiome,
      createOccurrenceId('golden-g-terminal-shop'),
      'MajorNonBoon',
    ),
    value: { rewardType: 'RoomRewardHealDrop' },
  });
  return project;
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
    expect(
      result.findings.every(
        (finding) => finding.origin.kind !== 'project' && finding.origin.routeKey === 'Underworld',
      ),
    ).toBe(true);
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
    expect(
      incomplete.findings.every(
        (finding) =>
          finding.origin.kind !== 'project' &&
          (finding.origin.kind === 'route' || finding.origin.biomeKey === 'F'),
      ),
    ).toBe(true);
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
    expect(
      invalid.findings.every(
        (finding) =>
          finding.origin.kind !== 'project' &&
          (finding.origin.kind === 'route' || finding.origin.biomeKey === 'F'),
      ),
    ).toBe(true);
    expect(invalid.routes[0]!.summary).toMatchObject({
      evaluatedBiomeCount: 1,
      invalidBiomeCount: 1,
      blockedBiomeCount: 1,
      eligibleForExecutionPlan: false,
    });
  });

  it('carries validated F route state through a complete G simulation', () => {
    const result = simulateProject(catalog, completeGoldenFGProject());
    const underworld = result.routes[0]!;
    const f = underworld.biomes[0]!;
    const g = underworld.biomes[1]!;

    expect(result.findings).toEqual([]);
    expect(result.status).toBe('valid');
    expect(underworld.validatedPrefix).toEqual(['F', 'G']);
    expect(g.completion).toBe('complete');
    if (f.completion !== 'complete' || g.completion !== 'complete') {
      throw new Error('golden F/G route unexpectedly incomplete');
    }
    expect(g.validity).toBe('valid');
    expect(() => composeLinearHistory(catalog, g.snapshot)).toThrowError(
      'G requires validated F history',
    );
    expect(g.snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'G_Boss01',
      'G_PostBoss01',
    ]);
    expect(g.snapshot.entryRooms[0]).toMatchObject({
      gameName: 'G_Intro',
      lifecycleProfileKey: 'RewardlessRoom',
    });
    expect(g.history.events[0]).toMatchObject({
      kind: 'biomeStarted',
      counters: {
        biomeDepthCache: 1,
        biomeEncounterDepth: 1,
        routeEncounterDepth: f.history.afterTransition.ledgers.counters.routeEncounterDepth,
        roomHistoryOrdinal: f.history.afterTransition.ledgers.counters.roomHistoryOrdinal,
      },
    });
    expect(g.history.events[0]!.sequence).toBe(f.history.afterTransition.sequence + 1);
    expect(g.history.afterTransition.sequence).toBeGreaterThan(f.history.afterTransition.sequence);
    expect(g.history.ledgers.roomAppearances.length).toBeGreaterThan(
      f.history.ledgers.roomAppearances.length,
    );
    expect(
      g.history.ledgers.encounterStarts.some(
        (entry) => entry.baselineEncounterKey === 'GeneratedG_ExtraDoor',
      ),
    ).toBe(false);
    expect(g.history.ledgers.enteredRewardStores.at(-1)).toMatchObject({
      gameName: 'G_Boss01',
      storeKey: 'RunProgress',
    });
    expect(g.history.afterTransition.ledgers.counters).toMatchObject({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
    });
    expect(g.rewards.branches[0]!.events.length).toBeGreaterThan(0);
    expect(g.rewards.branches[0]!.events[0]!.historySequence).toBeGreaterThan(
      f.history.afterTransition.sequence,
    );
    expect(
      g.rewards.branches[0]!.events.every(
        (event) =>
          event.origin.kind !== 'project' &&
          (event.origin.kind === 'route' || event.origin.biomeKey === 'G'),
      ),
    ).toBe(true);
    expect(g.rewards.storeSupport.slice(0, 3)).toMatchObject([
      { enteredStoreCount: 0, enteredMetaStoreCount: 0 },
      { enteredStoreCount: 1, enteredMetaStoreCount: 0 },
      { enteredStoreCount: 2, enteredMetaStoreCount: 1 },
    ]);
    expect(
      g.roomGeneration.forcePressure.find((entry) => entry.selectedGameName === 'G_Shop01'),
    ).toMatchObject({
      biomeDepthCache: 5,
      selectedPossible: true,
      requiredForcedRoomGameNames: ['G_Shop01'],
    });
    expect(
      g.roomGeneration.forcePressure.find((entry) => entry.selectedGameName === 'G_MiniBoss01'),
    ).toMatchObject({
      biomeDepthCache: 6,
      selectedPossible: true,
      requiredForcedRoomGameNames: ['G_MiniBoss01', 'G_MiniBoss02', 'G_MiniBoss03'],
    });
    expect(g.roomGeneration.forcePressure.at(-1)).toMatchObject({
      selectedGameName: 'G_PreBoss01',
      selectedPossible: true,
      biomeDepthCache: 8,
    });
  });

  it('keeps the registered G simulator outside an F-only simulation scope', () => {
    const result = simulateProject(catalog, completeGoldenFGProject(), {
      simulatableBiomeKeys: ['F'],
    });
    const underworld = result.routes[0]!;

    expect(result.status).toBe('blocked');
    expect(underworld.biomes.map((evaluation) => evaluation.biomeKey)).toEqual(['F']);
    expect(underworld.validatedPrefix).toEqual(['F']);
    expect(underworld.horizon).toEqual({
      kind: 'simulatorBoundary',
      biomeKey: 'G',
      blockedBiomeKeys: ['G'],
    });
  });

  it('keeps baseline and proposal candidate simulation inside the application scope', () => {
    const project = completeGoldenFGProject();
    const scope = { simulatableBiomeKeys: ['F'] } as const;

    expect(
      evaluateProjectCandidate(
        catalog,
        project,
        {
          kind: 'roomTarget',
          target: createTargetAddress(gBiome, createOccurrenceId('golden-g-intro'), 1),
          gameName: 'G_Combat02',
        },
        scope,
      ),
    ).toMatchObject({ context: 'unavailable', reason: 'simulatorUnavailable' });
    expect(
      evaluateProjectCandidate(
        catalog,
        project,
        {
          kind: 'incomingReward',
          reward: createIncomingRewardAddress(gBiome, gOccurrenceId(1, 1)),
          value: { rewardType: 'MaxHealthDrop' },
        },
        scope,
      ),
    ).toMatchObject({ context: 'unavailable', reason: 'simulatorUnavailable' });
  });

  it('evaluates G room, store, and reward candidates through the shared linear authorities', () => {
    const project = completeGoldenFGProject();
    const target = createTargetAddress(gBiome, createOccurrenceId('golden-g-intro'), 1);
    const rewardStore = createBatchRewardStoreAddress(gBiome, createOccurrenceId('golden-g-intro'));
    const reward = createIncomingRewardAddress(gBiome, gOccurrenceId(1, 1));
    const [roomCandidate, storeCandidate, rewardCandidate] = evaluateProjectCandidates(
      catalog,
      project,
      [
        { kind: 'roomTarget', target, gameName: 'G_Combat02' },
        { kind: 'batchRewardStore', rewardStore, storeKey: 'RunProgress' },
        {
          kind: 'incomingReward',
          reward,
          value: { rewardType: 'MaxHealthDrop' },
        },
      ],
    );

    expect(roomCandidate).toMatchObject({ context: 'evaluated', support: 'possible' });
    expect(storeCandidate).toMatchObject({ context: 'evaluated', support: 'possible' });
    expect(rewardCandidate).toMatchObject({ context: 'evaluated', support: 'possible' });
  });

  it('preserves biome encounter depth when the picked G miniboss is Crawler', () => {
    const result = simulateProject(
      catalog,
      completeGoldenFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
    );
    const g = result.routes[0]!.biomes[1]!;

    expect(g.completion).toBe('complete');
    if (g.completion !== 'complete') {
      throw new Error('Crawler G route unexpectedly incomplete');
    }
    expect(g.validity).toBe('valid');
    const crawlerOrigin = createOccurrenceAddress(gBiome, gOccurrenceId(7, 1));
    const crawler = g.history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(crawlerOrigin),
    );
    expect(crawler).toBeDefined();
    expect(
      g.history.ledgers.encounterStarts.find(
        (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(crawlerOrigin),
      ),
    ).toMatchObject({
      gameName: 'G_MiniBoss02',
      baselineEncounterKey: 'MiniBossCrawler',
    });
    expect(crawler!.preOutgoing!.ledgers.counters.biomeEncounterDepth).toBe(
      crawler!.entry.ledgers.counters.biomeEncounterDepth,
    );
  });

  it('retains a complete invalid G product after a G-local generation mismatch', () => {
    const project = applyProjectCommand(completeGoldenFGProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(gBiome, gOccurrenceId(1, 1)),
      gameName: 'G_Combat10',
    });
    const result = simulateProject(catalog, project);
    const g = result.routes[0]!.biomes[1]!;

    expect(result.status).toBe('invalid');
    expect(result.routes[0]!.horizon).toEqual({
      kind: 'invalid',
      biomeKey: 'G',
      blockedBiomeKeys: [],
    });
    expect(g.completion).toBe('complete');
    if (g.completion !== 'complete') {
      throw new Error('invalid G unexpectedly incomplete');
    }
    expect(g.validity).toBe('invalid');
    expect(g.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: createTargetAddress(gBiome, createOccurrenceId('golden-g-intro'), 1),
      }),
    );
    expect(
      g.findings.every(
        (finding) =>
          finding.origin.kind !== 'project' &&
          finding.origin.kind !== 'route' &&
          finding.origin.biomeKey === 'G',
      ),
    ).toBe(true);
  });

  it('evaluates G reward legality from carried route state', () => {
    const rewardOrigin = createIncomingRewardAddress(gBiome, gOccurrenceId(1, 1));
    const project = applyProjectCommand(completeGoldenFGProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: rewardOrigin,
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    const result = simulateProject(catalog, project);
    const g = result.routes[0]!.biomes[1]!;

    expect(g.completion).toBe('complete');
    if (g.completion !== 'complete') {
      throw new Error('reward-invalid G unexpectedly incomplete');
    }
    expect(g.rewards.validity).toBe('invalid');
    expect(g.rewards.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: rewardOrigin,
      }),
    );
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

  it('is deeply deterministic and evaluates configured G as incomplete', () => {
    const project = completeGoldenProject();
    const first = simulateProject(catalog, project);
    const second = simulateProject(catalog, project);
    const rebuilt = simulateProject(createCatalog(declarations), project);
    const dormant = simulateProject(catalog, withDormantG(project));

    expect(second).toEqual(first);
    expect(rebuilt).toEqual(first);
    expect(dormant.routes[0]!.biomes).toHaveLength(2);
    expect(dormant.status).toBe('incomplete');
    expect(dormant.routes[0]!.horizon).toEqual({
      kind: 'incomplete',
      biomeKey: 'G',
      blockedBiomeKeys: [],
    });
    expect(dormant.routes[0]!.summary).toMatchObject({
      configuredBiomeCount: 2,
      evaluatedBiomeCount: 2,
      validatedBiomeCount: 1,
      incompleteBiomeCount: 1,
      blockedBiomeCount: 0,
      eligibleForExecutionPlan: false,
    });
  });
});
