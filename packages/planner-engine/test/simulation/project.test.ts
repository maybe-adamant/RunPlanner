import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createHubSlotAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createRouteAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type LinearBiomePlan,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeLinearHistory,
  createPreparedProjectCandidateSession,
  evaluateLinearCompleteness,
  evaluateLinearRoomGeneration,
  evaluateLinearRewards,
  foldLinearHistoryEvents,
  evaluateProjectCandidate,
  evaluateProjectCandidates,
  simulateProject,
  supportedFieldsCageOutcomes,
  materializeLinearBiome,
  type CandidateEvaluationEvent,
} from '@run-planner/engine/simulation';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createRepresentativeNOProject,
  createRepresentativeNOPQProject,
  createRepresentativeNProject,
  nBiome,
  nOccurrenceId,
} from '../../../../apps/planner/test/fixtures/surfaceProject';

const biome = createBiomeAddress('Underworld', 'F');
const gBiome = createBiomeAddress('Underworld', 'G');
const hBiome = createBiomeAddress('Underworld', 'H');
const iBiome = createBiomeAddress('Underworld', 'I');
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
                Object.freeze({
                  kind: 'LinearBiome' as const,
                  biomeKey: 'G',
                  state: Object.freeze({}),
                  topology: null,
                }),
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
  readonly terminalParent?: 'G_Combat12' | 'G_Combat14';
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
  const pickedRooms = gPickedRooms.map((gameName, index) =>
    gameName === 'G_MiniBoss01'
      ? (options.pickedMiniboss ?? gameName)
      : index === gPickedRooms.length - 1
        ? (options.terminalParent ?? gameName)
        : gameName,
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

  const terminalParent = catalog.rooms.byKey[pickedRooms.at(-1)!];
  if (terminalParent === undefined) {
    throw new Error('missing G terminal predecessor');
  }
  const terminalOccurrenceIds = terminalParent.exits.map((exit) =>
    createOccurrenceId(
      exit.index === 1 ? 'golden-g-terminal-shop' : `golden-g-terminal-free-${exit.index}`,
    ),
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(gBiome, parentId),
    targetOccurrenceIds: terminalOccurrenceIds,
  });
  for (const [index, occurrenceId] of terminalOccurrenceIds.slice(1).entries()) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(gBiome, occurrenceId),
      value: { rewardType: index === 0 ? 'StackUpgrade' : 'HermesUpgrade' },
    });
  }
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

function hPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biomePlan) => biomePlan.biomeKey === 'H');
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('golden project has no H plan');
  }
  return plan;
}

function hFieldsPolicy() {
  const layout = catalog.biomeLayouts.byKey.H;
  if (layout?.kind !== 'LinearBiome' || layout.continuation.batchPolicy.kind !== 'fields') {
    throw new Error('catalog has no H Fields batch policy');
  }
  return layout.continuation.batchPolicy;
}

function appendGoldenH(project: ProjectDocument): ProjectDocument {
  const start = createOccurrenceId('golden-h-start');
  const combat02 = createOccurrenceId('golden-h-combat02');
  const combat09 = createOccurrenceId('golden-h-combat09');
  const combat03 = createOccurrenceId('golden-h-combat03');
  const bridge = createOccurrenceId('golden-h-bridge');
  const miniboss = createOccurrenceId('golden-h-miniboss');
  const combat05 = createOccurrenceId('golden-h-combat05');
  const combat04 = createOccurrenceId('golden-h-combat04');
  let next = applyProjectCommand(project, catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 3,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateStart',
    biome: hBiome,
    occurrenceId: start,
    gameName: 'H_Intro',
  });

  const batches = [
    {
      parent: start,
      targets: [{ occurrenceId: combat02, gameName: 'H_Combat02' }],
      outcome: 'min' as const,
    },
    {
      parent: combat02,
      targets: [
        { occurrenceId: combat09, gameName: 'H_Combat09' },
        { occurrenceId: combat03, gameName: 'H_Combat03' },
      ],
      outcome: 'max' as const,
    },
    {
      parent: combat09,
      targets: [
        { occurrenceId: bridge, gameName: 'H_Bridge01' },
        { occurrenceId: miniboss, gameName: 'H_MiniBoss01' },
      ],
      outcome: 'max' as const,
    },
    {
      parent: bridge,
      targets: [
        { occurrenceId: combat05, gameName: 'H_Combat05' },
        { occurrenceId: combat04, gameName: 'H_Combat04' },
      ],
      outcome: 'min' as const,
    },
  ];
  for (const batch of batches) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(hBiome, batch.parent),
    });
    if (batch.outcome === 'max') {
      next = applyProjectCommand(next, catalog, {
        kind: 'ReplaceFieldsCageOutcome',
        continuation: createContinuationAddress(hBiome, batch.parent),
        cageOutcome: batch.outcome,
      });
    }
    for (const [targetOffset, target] of batch.targets.entries()) {
      next = applyProjectCommand(next, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(hBiome, batch.parent, targetOffset + 1),
        occurrenceId: target.occurrenceId,
        gameName: target.gameName,
      });
    }
    next = applyProjectCommand(next, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(hBiome, batch.parent),
      exitIndex: 1,
    });
  }
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(hBiome, combat05),
    targetOccurrenceIds: [
      createOccurrenceId('golden-h-terminal-shop'),
      createOccurrenceId('golden-h-terminal-free'),
    ],
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(hBiome, combat05),
    exitIndex: 1,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(hBiome, createOccurrenceId('golden-h-terminal-free')),
    value: { rewardType: 'StackUpgrade' },
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(
      hBiome,
      createOccurrenceId('golden-h-terminal-shop'),
      'MajorNonBoon',
    ),
    value: { rewardType: 'RoomRewardHealDrop' },
  });

  const raw = JSON.parse(encodeProjectDocument(next)) as {
    routes: Array<{
      routeKey: string;
      biomes: Array<{
        biomeKey: string;
        topology: {
          occurrences: Array<{
            occurrenceId: string;
            state: {
              kind: string;
              cages?: Record<string, ResolvedRewardOffer>;
            };
          }>;
        } | null;
      }>;
    }>;
  };
  const h = raw.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biomePlan) => biomePlan.biomeKey === 'H');
  if (h?.topology === null || h === undefined) {
    throw new Error('encoded golden H topology is missing');
  }
  const offersByOccurrence: Readonly<Record<string, readonly ResolvedRewardOffer[]>> = {
    'golden-h-combat02': [
      { rewardType: 'RoomMoneyDrop' },
      { rewardType: 'WeaponUpgrade' },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
    ],
    'golden-h-combat09': [
      { rewardType: 'HermesUpgrade' },
      { rewardType: 'TalentDrop' },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
    ],
    'golden-h-combat03': [
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
    ],
    'golden-h-combat05': [
      { rewardType: 'MaxHealthDrop' },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
    ],
    'golden-h-combat04': [
      { rewardType: 'MaxManaDrop' },
      { rewardType: 'RoomMoneyDrop' },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
    ],
  };
  for (const occurrence of h.topology.occurrences) {
    if (occurrence.state.kind !== 'fieldsCombat' || occurrence.state.cages === undefined) {
      continue;
    }
    const offers = offersByOccurrence[occurrence.occurrenceId];
    if (offers === undefined) {
      throw new Error(`missing golden cage offers for ${occurrence.occurrenceId}`);
    }
    for (const [index, slotKey] of ['cage1', 'cage2', 'cage3'].entries()) {
      occurrence.state.cages[slotKey] = offers[index]!;
    }
  }
  return decodeProjectDocument(raw, catalog);
}

function evaluateH(project: ProjectDocument) {
  const g = simulateProject(catalog, project).routes[0]?.biomes[1];
  if (g?.kind !== 'LinearBiome' || g.authoring !== 'complete' || g.validity !== 'valid') {
    throw new Error('golden G validation seed is unavailable');
  }
  const completeness = evaluateLinearCompleteness(catalog, hBiome, hPlan(project));
  if (completeness.completion !== 'complete') {
    throw new Error('golden H topology is incomplete');
  }
  const snapshot = materializeLinearBiome(catalog, hBiome, completeness);
  const history = composeLinearHistory(catalog, snapshot, g.history);
  return {
    g,
    snapshot,
    history,
    generation: evaluateLinearRoomGeneration(catalog, snapshot, history, 3),
    rewards: evaluateLinearRewards(catalog, snapshot, history, 3, g.rewards.branches),
  };
}

function selectedGoldenHProject(): ProjectDocument {
  let project = appendGoldenH(completeGoldenFGProject());
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(hBiome, createOccurrenceId('golden-h-bridge')),
    gameName: 'H_MiniBoss01',
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(hBiome, createOccurrenceId('golden-h-miniboss')),
    gameName: 'H_Bridge01',
  });
}

function selectedGoldenIProject(): ProjectDocument {
  let project = applyProjectCommand(selectedGoldenHProject(), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 4,
  });
  let parent: OccurrenceId | null = null;
  const batches = [
    { targets: ['I_Combat01'], pickedExitIndex: 1 },
    { targets: ['I_Combat02', 'I_Combat03'], pickedExitIndex: 1 },
    { targets: ['I_Combat05'], pickedExitIndex: 1 },
    { targets: ['I_Combat06'], pickedExitIndex: 1 },
    { targets: ['I_Combat09'], pickedExitIndex: 1 },
  ] as const;
  for (const [batchIndex, batch] of batches.entries()) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(iBiome, parent),
    });
    for (const [targetIndex, gameName] of batch.targets.entries()) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(iBiome, parent, targetIndex + 1),
        occurrenceId: createOccurrenceId(
          targetIndex === 0
            ? `golden-i-goal-${batchIndex + 1}`
            : `golden-i-peer-${batchIndex + 1}-${targetIndex + 1}`,
        ),
        gameName,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(iBiome, parent),
      exitIndex: batch.pickedExitIndex,
    });
    parent = createOccurrenceId(`golden-i-goal-${batchIndex + 1}`);
  }
  const preboss = createOccurrenceId('golden-i-preboss');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(iBiome, parent),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(iBiome, parent, 1),
    occurrenceId: preboss,
    gameName: 'I_PreBoss02',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(iBiome, parent, 2),
    occurrenceId: createOccurrenceId('golden-i-terminal-peer'),
    gameName: 'I_MiniBoss01',
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(iBiome, parent),
    exitIndex: 1,
  });
}

function replaceGoldenHCage(
  project: ProjectDocument,
  occurrenceId: string,
  slotKey: string,
  offer: ResolvedRewardOffer,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceLocalReward',
    reward: createLocalRewardAddress(hBiome, createOccurrenceId(occurrenceId), 'cages', slotKey),
    value: offer,
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
    expect(underworld.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'incomplete', biomeKey: 'F' },
      blockedSuffix: [],
    });
    expect(evaluation).toEqual({
      kind: 'LinearBiome',
      biomeKey: 'F',
      origin: biome,
      authoring: 'incomplete',
      frontier: biome,
      coverage: { kind: 'none', reason: 'notEvaluated' },
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
      processing: {
        completeValidPrefix: ['F'],
        active: null,
        blockedSuffix: [],
      },
    });
    expect(evaluation.authoring).toBe('complete');
    expect(evaluation.coverage).toEqual({ kind: 'complete' });
    if (evaluation.kind !== 'LinearBiome' || evaluation.authoring !== 'complete') {
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
    expect(evaluation.rewards.branches).toHaveLength(1);
  });

  it('retains complete canonical products and addressed findings for invalid F', () => {
    const result = simulateProject(catalog, earlyTerminalProject());
    const underworld = result.routes[0]!;
    const evaluation = underworld.biomes[0]!;

    expect(result.status).toBe('invalid');
    expect(underworld.processing.completeValidPrefix).toEqual([]);
    expect(underworld.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'invalid', biomeKey: 'F' },
      blockedSuffix: [],
    });
    expect(evaluation.authoring).toBe('complete');
    if (evaluation.kind !== 'LinearBiome' || evaluation.authoring !== 'complete') {
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

  it('blocks configured downstream biomes after incomplete and invalid F regions', () => {
    const incomplete = simulateProject(
      catalog,
      createProjectDocument(catalog, {
        projectId: 'phase-3-incomplete-horizon',
        name: 'Phase 3 Incomplete Horizon',
        configuredBiomeCounts: { Underworld: 2 },
      }),
    );
    const invalid = simulateProject(catalog, withDormantG(earlyTerminalProject()));

    expect(incomplete.routes[0]!.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'incomplete', biomeKey: 'F' },
      blockedSuffix: ['G'],
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
    expect(invalid.routes[0]!.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'invalid', biomeKey: 'F' },
      blockedSuffix: ['G'],
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

  it('partitions incomplete, invalid, active, and valid Surface route regions', () => {
    const incomplete = simulateProject(
      catalog,
      createProjectDocument(catalog, {
        projectId: 'phase-7-surface-incomplete',
        name: 'Phase 7 Surface Incomplete',
        configuredBiomeCounts: { Surface: 4 },
      }),
    ).routes[1]!;
    expect(incomplete.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'incomplete', biomeKey: 'N' },
      blockedSuffix: ['O', 'P', 'Q'],
    });
    expect(incomplete.biomes[0]).toMatchObject({
      authoring: 'incomplete',
      frontier: nBiome,
      coverage: { kind: 'none', reason: 'notEvaluated' },
    });

    const activeOProject = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Surface'),
      configuredBiomeCount: 4,
    });
    const activeO = simulateProject(catalog, activeOProject).routes[1]!;
    expect(activeO.processing).toEqual({
      completeValidPrefix: ['N'],
      active: { kind: 'incomplete', biomeKey: 'O' },
      blockedSuffix: ['P', 'Q'],
    });
    expect(activeO.biomes).toMatchObject([
      { biomeKey: 'N', authoring: 'complete', coverage: { kind: 'complete' } },
      { biomeKey: 'O', authoring: 'incomplete', coverage: { kind: 'none' } },
    ]);

    const invalidNProject = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'miniBoss02'),
      occurrenceId: nOccurrenceId('miniBoss02'),
    });
    const invalidN = simulateProject(catalog, invalidNProject).routes[1]!;
    expect(invalidN.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'invalid', biomeKey: 'N' },
      blockedSuffix: ['O'],
    });

    const valid = simulateProject(catalog, createRepresentativeNOPQProject()).routes[1]!;
    expect(valid.processing).toEqual({
      completeValidPrefix: ['N', 'O', 'P', 'Q'],
      active: null,
      blockedSuffix: [],
    });
  });

  it('carries validated F route state through a complete G simulation', () => {
    const result = simulateProject(catalog, completeGoldenFGProject());
    const underworld = result.routes[0]!;
    const f = underworld.biomes[0]!;
    const g = underworld.biomes[1]!;

    expect(result.findings).toEqual([]);
    expect(result.status).toBe('valid');
    expect(underworld.processing.completeValidPrefix).toEqual(['F', 'G']);
    expect(g.authoring).toBe('complete');
    if (
      f.kind !== 'LinearBiome' ||
      f.authoring !== 'complete' ||
      g.kind !== 'LinearBiome' ||
      g.authoring !== 'complete'
    ) {
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

  it('composes H Fields history and rewards from carried G state', () => {
    const fgResult = simulateProject(catalog, completeGoldenFGProject());
    const g = fgResult.routes[0]!.biomes[1];
    if (g?.kind !== 'LinearBiome' || g.authoring !== 'complete') {
      throw new Error('golden G history seed is unavailable');
    }
    const project = appendGoldenH(completeGoldenFGProject());
    const completeness = evaluateLinearCompleteness(catalog, hBiome, hPlan(project));
    if (completeness.completion !== 'complete') {
      throw new Error('golden H topology is incomplete');
    }
    const snapshot = materializeLinearBiome(catalog, hBiome, completeness);
    expect(() => composeLinearHistory(catalog, snapshot)).toThrowError(
      'H requires validated G history',
    );
    const history = composeLinearHistory(catalog, snapshot, g.history);
    const rewards = evaluateLinearRewards(catalog, snapshot, history, 3, g.rewards.branches);

    expect(history.events[0]).toMatchObject({
      kind: 'biomeStarted',
      counters: {
        biomeDepthCache: 1,
        biomeEncounterDepth: 1,
        fieldsMaxDoorsRolled: 0,
        routeEncounterDepth: g.history.afterTransition.ledgers.counters.routeEncounterDepth,
        roomHistoryOrdinal: g.history.afterTransition.ledgers.counters.roomHistoryOrdinal,
      },
    });
    expect(
      history.events
        .filter((event) => event.kind === 'fieldsBatchOutcomeRecorded')
        .map((event) => ({
          cageOutcome: event.cageOutcome,
          batchCapacity: event.batchCapacity,
          cageTargetCount: event.cageTargetCount,
          doorCageRewardCount: event.doorCageRewardCount,
        })),
    ).toEqual([
      { cageOutcome: 'min', batchCapacity: 3, cageTargetCount: 1, doorCageRewardCount: 2 },
      { cageOutcome: 'max', batchCapacity: 2, cageTargetCount: 2, doorCageRewardCount: 2 },
      { cageOutcome: 'max', batchCapacity: 3, cageTargetCount: 0, doorCageRewardCount: 3 },
      { cageOutcome: 'min', batchCapacity: 3, cageTargetCount: 2, doorCageRewardCount: 2 },
    ]);
    expect(history.biomeCompletion.ledgers.counters.fieldsMaxDoorsRolled).toBe(2);
    expect(foldLinearHistoryEvents(history.events, g.history.afterTransition)).toEqual(history);
    expect(history.afterTransition.ledgers.counters.routeEncounterDepth).toBe(
      g.history.afterTransition.ledgers.counters.routeEncounterDepth + 6,
    );
    expect(
      history.ledgers.encounterStarts
        .filter((entry) => entry.origin.biomeKey === 'H' && entry.gameName === 'H_Combat02')
        .map((entry) => [entry.encounterProfileKey, entry.phaseKey]),
    ).toEqual([
      ['H_FieldsCombatCage2', 'Passive'],
      ['H_FieldsCombatCage2', 'Cage01'],
      ['H_FieldsCombatCage2', 'Cage02'],
    ]);
    expect(
      history.ledgers.enteredRewardStores
        .filter((entry) => entry.origin.biomeKey === 'H')
        .map((entry) => entry.gameName),
    ).toEqual(['H_Bridge01', 'H_PreBoss01', 'H_Boss01']);

    expect(rewards.findings).toEqual([]);
    expect(rewards.validity).toBe('valid');
    const branch = rewards.branches[0]!;
    const localOffers = branch.events.filter(
      (event) => event.kind === 'rewardOffered' && event.origin.kind === 'localReward',
    );
    const localAcquisitions = branch.events.filter(
      (event) => event.kind === 'concreteAcquisition' && event.origin.kind === 'localReward',
    );
    expect(localOffers.map((event) => semanticAddressKey(event.origin))).toEqual([
      '["localReward","Underworld","H","golden-h-combat02","cages","cage1"]',
      '["localReward","Underworld","H","golden-h-combat02","cages","cage2"]',
      '["localReward","Underworld","H","golden-h-combat09","cages","cage1"]',
      '["localReward","Underworld","H","golden-h-combat09","cages","cage2"]',
      '["localReward","Underworld","H","golden-h-combat03","cages","cage1"]',
      '["localReward","Underworld","H","golden-h-combat03","cages","cage2"]',
      '["localReward","Underworld","H","golden-h-combat05","cages","cage1"]',
      '["localReward","Underworld","H","golden-h-combat05","cages","cage2"]',
      '["localReward","Underworld","H","golden-h-combat04","cages","cage1"]',
      '["localReward","Underworld","H","golden-h-combat04","cages","cage2"]',
    ]);
    expect(localAcquisitions.map((event) => semanticAddressKey(event.origin))).toEqual([
      '["localReward","Underworld","H","golden-h-combat02","cages","cage1"]',
      '["localReward","Underworld","H","golden-h-combat02","cages","cage2"]',
      '["localReward","Underworld","H","golden-h-combat09","cages","cage1"]',
      '["localReward","Underworld","H","golden-h-combat09","cages","cage2"]',
      '["localReward","Underworld","H","golden-h-combat05","cages","cage1"]',
      '["localReward","Underworld","H","golden-h-combat05","cages","cage2"]',
    ]);
    for (const acquisition of localAcquisitions) {
      if (acquisition.origin.kind !== 'localReward') {
        throw new Error('filtered local acquisition lost its semantic owner');
      }
      const occurrenceId = acquisition.origin.occurrenceId;
      const offer = localOffers.find(
        (candidate) =>
          semanticAddressKey(candidate.origin) === semanticAddressKey(acquisition.origin),
      );
      expect(offer?.historySequence).toBeLessThan(acquisition.historySequence);
      const slotNumber = Number(acquisition.origin.slotKey.slice(-1));
      const completion = history.events.find(
        (event) =>
          event.kind === 'encounterCompleted' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === occurrenceId &&
          event.phaseKey === `Cage0${slotNumber}`,
      );
      expect(acquisition.historySequence).toBe(completion?.sequence);
    }
  });

  it('validates the selected H force pools, Fields outcomes, and terminal timing', () => {
    const result = evaluateH(selectedGoldenHProject());

    expect(result.generation.findings).toEqual([]);
    expect(result.generation.validity).toBe('valid');
    expect(
      result.generation.fieldsCageOutcomes.map((entry) => ({
        biomeDepthCache: entry.biomeDepthCache,
        fieldsMaxDoorsRolled: entry.fieldsMaxDoorsRolled,
        selectedOutcome: entry.selectedOutcome,
        supportOutcomes: entry.supportOutcomes,
      })),
    ).toEqual([
      {
        biomeDepthCache: 1,
        fieldsMaxDoorsRolled: 0,
        selectedOutcome: 'min',
        supportOutcomes: ['min', 'max'],
      },
      {
        biomeDepthCache: 1,
        fieldsMaxDoorsRolled: 0,
        selectedOutcome: 'max',
        supportOutcomes: ['min', 'max'],
      },
      {
        biomeDepthCache: 2,
        fieldsMaxDoorsRolled: 1,
        selectedOutcome: 'max',
        supportOutcomes: ['min', 'max'],
      },
      {
        biomeDepthCache: 3,
        fieldsMaxDoorsRolled: 2,
        selectedOutcome: 'min',
        supportOutcomes: ['min'],
      },
    ]);

    const bridge = result.generation.forcePressure.find(
      (entry) =>
        semanticAddressKey(entry.targetOrigin) ===
        semanticAddressKey(createTargetAddress(hBiome, createOccurrenceId('golden-h-combat09'), 1)),
    );
    expect(bridge).toMatchObject({
      selectedGameName: 'H_MiniBoss01',
      biomeDepthCache: 2,
      selectedPossible: true,
      optionalForcedRoomGameNames: ['H_MiniBoss01', 'H_MiniBoss02'],
      requiredForcedRoomGameNames: ['H_Bridge01'],
      supportRoomGameNames: ['H_MiniBoss01', 'H_MiniBoss02', 'H_Bridge01'],
    });
    expect(result.generation.forcePressure.slice(-2)).toEqual([
      expect.objectContaining({
        selectedGameName: 'H_PreBoss01',
        biomeDepthCache: 4,
        selectedPossible: true,
        requiredForcedRoomGameNames: ['H_PreBoss01'],
      }),
      expect.objectContaining({
        selectedGameName: 'H_PreBoss01',
        biomeDepthCache: 4,
        selectedPossible: true,
        requiredForcedRoomGameNames: ['H_PreBoss01'],
      }),
    ]);
    expect(result.rewards.validity).toBe('valid');
  });

  it('rejects unsupported authored Fields outcomes at the semantic continuation', () => {
    let ceilingProject = selectedGoldenHProject();
    ceilingProject = applyProjectCommand(ceilingProject, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      continuation: createContinuationAddress(hBiome, createOccurrenceId('golden-h-bridge')),
      cageOutcome: 'max',
    });
    const ceiling = evaluateH(ceilingProject).generation;
    expect(ceiling.fieldsCageOutcomes[3]).toMatchObject({
      biomeDepthCache: 3,
      fieldsMaxDoorsRolled: 2,
      selectedOutcome: 'max',
      supportOutcomes: ['min'],
      selectedPossible: false,
    });
    expect(ceiling.findings).toContainEqual(
      expect.objectContaining({
        code: 'fieldsCageOutcomeUnavailable',
        origin: createContinuationAddress(hBiome, createOccurrenceId('golden-h-bridge')),
      }),
    );

    expect(supportedFieldsCageOutcomes(hFieldsPolicy(), 4, 0)).toEqual(['max']);
    expect(supportedFieldsCageOutcomes(hFieldsPolicy(), 5, 1)).toEqual(['max']);
    expect(supportedFieldsCageOutcomes(hFieldsPolicy(), 6, 1)).toEqual(['min']);
    expect(supportedFieldsCageOutcomes(hFieldsPolicy(), 4, 2)).toEqual(['min']);
  });

  it('addresses H Bridge timing, creation caps, and entered-miniboss exclusions', () => {
    let timingProject = selectedGoldenHProject();
    timingProject = applyProjectCommand(timingProject, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(hBiome, createOccurrenceId('golden-h-combat03')),
      gameName: 'H_Bridge01',
    });
    const timing = evaluateH(timingProject).generation;
    const pressureByTarget = new Map(
      timing.forcePressure.map((entry) => [semanticAddressKey(entry.targetOrigin), entry]),
    );
    expect(
      pressureByTarget.get(
        semanticAddressKey(createTargetAddress(hBiome, createOccurrenceId('golden-h-combat02'), 2)),
      ),
    ).toMatchObject({
      selectedGameName: 'H_Bridge01',
      selectedPossible: false,
      selectedExclusionReasons: ['eligibilityRequirement'],
    });
    expect(
      pressureByTarget.get(
        semanticAddressKey(createTargetAddress(hBiome, createOccurrenceId('golden-h-combat09'), 1)),
      ),
    ).toMatchObject({
      selectedGameName: 'H_MiniBoss01',
      selectedPossible: true,
    });
    expect(
      pressureByTarget.get(
        semanticAddressKey(createTargetAddress(hBiome, createOccurrenceId('golden-h-combat09'), 2)),
      ),
    ).toMatchObject({
      selectedGameName: 'H_Bridge01',
      selectedPossible: false,
      selectedExclusionReasons: ['maxCreationsThisRun'],
    });

    let exclusionProject = selectedGoldenHProject();
    exclusionProject = applyProjectCommand(exclusionProject, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(hBiome, createOccurrenceId('golden-h-combat04')),
      gameName: 'H_MiniBoss02',
    });
    const exclusion = evaluateH(exclusionProject).generation.forcePressure.find(
      (entry) =>
        semanticAddressKey(entry.targetOrigin) ===
        semanticAddressKey(createTargetAddress(hBiome, createOccurrenceId('golden-h-bridge'), 2)),
    );
    expect(exclusion).toMatchObject({
      selectedGameName: 'H_MiniBoss02',
      biomeDepthCache: 3,
      selectedPossible: false,
      selectedExclusionReasons: ['eligibilityRequirement'],
    });
  });

  it('addresses an impossible H cage offer through its local reward owner', () => {
    const hestia: ResolvedRewardOffer = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
    };
    let project = selectedGoldenHProject();
    project = replaceGoldenHCage(project, 'golden-h-combat02', 'cage1', hestia);
    const result = evaluateH(project);

    expect(result.rewards.validity).toBe('invalid');
    expect(result.rewards.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: {
          kind: 'localReward',
          routeKey: 'Underworld',
          biomeKey: 'H',
          occurrenceId: 'golden-h-combat02',
          groupKey: 'cages',
          slotKey: 'cage1',
        },
      }),
    );
  });

  it('evaluates active H room, Fields, cage, and terminal candidates', () => {
    const project = selectedGoldenHProject();
    const before = encodeProjectDocument(project);
    const evaluations = evaluateProjectCandidates(catalog, project, [
      {
        kind: 'roomTarget',
        target: createTargetAddress(hBiome, createOccurrenceId('golden-h-start'), 1),
        gameName: 'H_Bridge01',
      },
      {
        kind: 'roomTarget',
        target: createTargetAddress(hBiome, createOccurrenceId('golden-h-combat09'), 1),
        gameName: 'H_MiniBoss01',
      },
      {
        kind: 'fieldsCageOutcome',
        continuation: createContinuationAddress(hBiome, createOccurrenceId('golden-h-start')),
        cageOutcome: 'max',
      },
      {
        kind: 'fieldsCageOutcome',
        continuation: createContinuationAddress(hBiome, createOccurrenceId('golden-h-bridge')),
        cageOutcome: 'min',
      },
      {
        kind: 'localReward',
        reward: createLocalRewardAddress(
          hBiome,
          createOccurrenceId('golden-h-combat02'),
          'cages',
          'cage1',
        ),
        value: { rewardType: 'RoomMoneyDrop' },
      },
      {
        kind: 'localReward',
        reward: createLocalRewardAddress(
          hBiome,
          createOccurrenceId('golden-h-combat02'),
          'cages',
          'cage1',
        ),
        value: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
        },
      },
      {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(hBiome, createOccurrenceId('golden-h-terminal-free')),
        value: { rewardType: 'StackUpgrade' },
      },
      {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(hBiome, createOccurrenceId('golden-h-terminal-free')),
        value: { rewardType: 'WeaponUpgrade' },
      },
      {
        kind: 'shopOffer',
        offer: createShopOfferAddress(
          hBiome,
          createOccurrenceId('golden-h-terminal-shop'),
          'MajorNonBoon',
        ),
        value: { rewardType: 'RoomRewardHealDrop' },
      },
      {
        kind: 'shopPurchase',
        purchase: createShopPurchaseAddress(
          hBiome,
          createOccurrenceId('golden-h-terminal-shop'),
          'MajorNonBoon',
        ),
        purchased: true,
      },
    ]);

    expect(evaluations.map((evaluation) => evaluation.context)).toEqual(
      Array.from({ length: evaluations.length }, () => 'evaluated'),
    );
    expect(
      evaluations.map((evaluation) =>
        evaluation.context === 'evaluated' ? evaluation.support : 'unavailable',
      ),
    ).toEqual([
      'impossible',
      'forced',
      'possible',
      'forced',
      'possible',
      'impossible',
      'possible',
      'impossible',
      'possible',
      'possible',
    ]);
    expect(evaluations[5]).toMatchObject({
      context: 'evaluated',
      findings: [{ code: 'rewardBagEntryUnavailable' }],
    });
    expect(evaluations[7]).toMatchObject({
      context: 'evaluated',
      findings: [{ code: 'rewardBagEntryUnavailable' }],
    });
    expect(encodeProjectDocument(project)).toBe(before);

    const simulation = simulateProject(catalog, project).routes[0];
    expect(simulation?.biomes.map((evaluation) => evaluation.biomeKey)).toEqual(['F', 'G', 'H']);
    expect(simulation?.processing.completeValidPrefix).toEqual(['F', 'G', 'H']);
    expect(simulation?.processing).toEqual({
      completeValidPrefix: ['F', 'G', 'H'],
      active: null,
      blockedSuffix: [],
    });
  }, 15_000);

  it('preserves an invalid Fields selection and evaluates covered incomplete H context', () => {
    let invalid = selectedGoldenHProject();
    invalid = applyProjectCommand(invalid, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      continuation: createContinuationAddress(hBiome, createOccurrenceId('golden-h-bridge')),
      cageOutcome: 'max',
    });
    const invalidBefore = encodeProjectDocument(invalid);
    expect(
      evaluateProjectCandidate(catalog, invalid, {
        kind: 'fieldsCageOutcome',
        continuation: createContinuationAddress(hBiome, createOccurrenceId('golden-h-bridge')),
        cageOutcome: 'max',
      }),
    ).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      findings: [{ code: 'fieldsCageOutcomeUnavailable' }],
      evidence: {
        candidateOutcome: 'max',
        fieldsMaxDoorsRolled: 2,
        supportOutcomes: ['min'],
      },
    });
    expect(encodeProjectDocument(invalid)).toBe(invalidBefore);

    const incomplete = applyProjectCommand(selectedGoldenHProject(), catalog, {
      kind: 'RemoveBatch',
      continuation: createContinuationAddress(hBiome, createOccurrenceId('golden-h-bridge')),
    });
    expect(
      evaluateProjectCandidate(catalog, incomplete, {
        kind: 'localReward',
        reward: createLocalRewardAddress(
          hBiome,
          createOccurrenceId('golden-h-combat02'),
          'cages',
          'cage1',
        ),
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toMatchObject({ context: 'evaluated', support: 'impossible' });
  });

  it('evaluates a covered shop purchase from its room-local lifecycle context', () => {
    const project = selectedGoldenHProject();
    const events: CandidateEvaluationEvent[] = [];
    const session = createPreparedProjectCandidateSession(
      catalog,
      project,
      simulateProject(catalog, project),
      { observe: (event) => events.push(event) },
    );

    expect(
      session.evaluate([
        {
          kind: 'shopPurchase',
          purchase: createShopPurchaseAddress(
            hBiome,
            createOccurrenceId('golden-h-terminal-shop'),
            'MajorNonBoon',
          ),
          purchased: true,
        },
      ])[0],
    ).toMatchObject({ context: 'evaluated', support: 'possible', findings: [] });
    expect(events).toEqual([{ kind: 'queryBatch', queryCount: 1 }]);
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

  it('validates a complete Clockwork spine and exposes I candidates without activating the app', () => {
    const project = selectedGoldenIProject();
    const route = simulateProject(catalog, project).routes[0]!;
    const evaluation = route.biomes[3];

    expect(evaluation?.findings).toEqual([]);
    expect(evaluation).toMatchObject({
      biomeKey: 'I',
      authoring: 'complete',
      coverage: { kind: 'complete' },
      validity: 'valid',
    });
    expect(route.processing.completeValidPrefix).toEqual(['F', 'G', 'H', 'I']);
    if (evaluation?.kind !== 'LinearBiome' || evaluation.authoring !== 'complete') {
      throw new Error('golden I evaluation is incomplete');
    }
    expect(evaluation.history.biomeCompletion.ledgers.counters).toMatchObject({
      clockworkGoalsRemaining: 0,
      clockworkNonGoalRewardsAcquired: 0,
      clockworkMaxNonGoalRewards: 3,
    });
    expect(
      evaluation.rewards.branches[0]?.events.some(
        (event) =>
          event.kind === 'rewardOffered' &&
          event.origin.kind === 'incomingReward' &&
          event.origin.occurrenceId === createOccurrenceId('golden-i-peer-2-2'),
      ),
    ).toBe(true);

    const terminalParent = createOccurrenceId('golden-i-goal-5');
    const [
      field,
      earlyPreboss,
      terminalPeer,
      repeatedPreboss,
      dormantGoalReward,
      activeNonGoalReward,
      shopOffer,
      purchase,
    ] = evaluateProjectCandidates(catalog, project, [
      {
        kind: 'biomeField',
        field: createBiomeFieldAddress(iBiome, 'maxNonGoalRewards'),
        value: 6,
      },
      {
        kind: 'roomTarget',
        target: createTargetAddress(iBiome, null, 1),
        gameName: 'I_PreBoss02',
      },
      {
        kind: 'roomTarget',
        target: createTargetAddress(iBiome, terminalParent, 1),
        gameName: 'I_Combat07',
      },
      {
        kind: 'roomTarget',
        target: createTargetAddress(iBiome, terminalParent, 2),
        gameName: 'I_PreBoss02',
      },
      {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(iBiome, createOccurrenceId('golden-i-goal-1')),
        value: { rewardType: 'StackUpgradeTriple' },
      },
      {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(iBiome, createOccurrenceId('golden-i-peer-2-2')),
        value: { rewardType: 'StackUpgradeTriple' },
      },
      {
        kind: 'shopOffer',
        offer: createShopOfferAddress(iBiome, createOccurrenceId('golden-i-preboss'), 'Survival'),
        value: { rewardType: 'ArmorBigBoost' },
      },
      {
        kind: 'shopPurchase',
        purchase: createShopPurchaseAddress(
          iBiome,
          createOccurrenceId('golden-i-preboss'),
          'Survival',
        ),
        purchased: true,
      },
    ]);

    expect(field).toMatchObject({ context: 'evaluated', support: 'possible', findings: [] });
    expect(earlyPreboss).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      evidence: {
        exclusionReasons: ['eligibilityRequirement'],
        exclusions: [{ kind: 'eligibilityRequirement', evaluation: { satisfied: false } }],
      },
    });
    expect(terminalPeer).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      evidence: { exclusionReasons: ['forcedPool'] },
    });
    expect(repeatedPreboss).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      evidence: {
        exclusionReasons: ['maxCreationsPerRoom'],
        exclusions: [{ kind: 'maxCreationsPerRoom', actual: 1, maximum: 1 }],
      },
    });
    expect(dormantGoalReward).toMatchObject({
      context: 'unavailable',
      reason: 'producerFrontierUnavailable',
    });
    expect(activeNonGoalReward).toMatchObject({
      context: 'evaluated',
      support: 'possible',
      findings: [],
    });
    expect(shopOffer).toMatchObject({ context: 'evaluated', support: 'possible', findings: [] });
    expect(purchase).toMatchObject({ context: 'evaluated', support: 'possible', findings: [] });
  });

  it('keeps I candidates behind the validated prefix', () => {
    const project = selectedGoldenIProject();
    const field = createBiomeFieldAddress(iBiome, 'maxNonGoalRewards');
    const incomplete = applyProjectCommand(project, catalog, {
      kind: 'RemoveBatch',
      continuation: createContinuationAddress(hBiome, createOccurrenceId('golden-h-bridge')),
    });
    expect(
      evaluateProjectCandidate(catalog, incomplete, {
        kind: 'biomeField',
        field,
        value: 4,
      }),
    ).toMatchObject({ context: 'unavailable', reason: 'upstreamIncomplete' });

    const invalid = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      continuation: createContinuationAddress(hBiome, createOccurrenceId('golden-h-bridge')),
      cageOutcome: 'max',
    });
    expect(
      evaluateProjectCandidate(catalog, invalid, {
        kind: 'biomeField',
        field,
        value: 4,
      }),
    ).toMatchObject({ context: 'unavailable', reason: 'upstreamInvalid' });
    expect(() =>
      evaluateProjectCandidate(catalog, project, {
        kind: 'biomeField',
        field,
        value: 2,
      }),
    ).toThrow(/candidate proposal is malformed.*must be between 3 and 6/);
  });

  it('preserves biome encounter depth when the picked G miniboss is Crawler', () => {
    const project = completeGoldenFGProject({ pickedMiniboss: 'G_MiniBoss02' });
    const result = simulateProject(catalog, project);
    const g = result.routes[0]!.biomes[1]!;

    expect(g.authoring).toBe('complete');
    if (g.kind !== 'LinearBiome' || g.authoring !== 'complete') {
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

    for (const gameName of ['G_MiniBoss01', 'G_MiniBoss03']) {
      const candidate = evaluateProjectCandidate(catalog, project, {
        kind: 'roomTarget',
        target: createTargetAddress(gBiome, gOccurrenceId(7, 1), 1),
        gameName,
      });
      expect(candidate).toMatchObject({ context: 'evaluated', support: 'impossible' });
      if (candidate.context !== 'evaluated' || !('exclusionReasons' in candidate.evidence)) {
        throw new Error(`${gameName} candidate context is unavailable`);
      }
      expect(candidate.evidence.exclusionReasons).toContain('eligibilityRequirement');
      if (gameName === 'G_MiniBoss01') {
        expect(candidate.evidence.exclusionReasons).toContain('maxCreationsThisRun');
      }
    }
  });

  it('materializes the maximum G preboss fork from a three-exit predecessor', () => {
    const project = completeGoldenFGProject({ terminalParent: 'G_Combat14' });
    const result = simulateProject(catalog, project);
    const g = result.routes[0]!.biomes[1]!;

    expect(result.status).toBe('valid');
    expect(g.authoring).toBe('complete');
    if (g.kind !== 'LinearBiome' || g.authoring !== 'complete') {
      throw new Error('three-exit G terminal unexpectedly incomplete');
    }
    expect(
      g.snapshot.terminalEntry.targets.map((target) => ({
        exitIndex: target.exit.index,
        gameName: target.room.gameName,
        producerKind: target.room.incomingReward?.producerKind,
        hasShop: target.room.entryState?.kind === 'shop',
      })),
    ).toEqual([
      { exitIndex: 1, gameName: 'G_PreBoss01', producerKind: 'shop', hasShop: true },
      { exitIndex: 2, gameName: 'G_PreBoss01', producerKind: 'freeReward', hasShop: false },
      { exitIndex: 3, gameName: 'G_PreBoss01', producerKind: 'freeReward', hasShop: false },
    ]);
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
    expect(result.routes[0]!.processing).toEqual({
      completeValidPrefix: ['F'],
      active: { kind: 'invalid', biomeKey: 'G' },
      blockedSuffix: [],
    });
    expect(g.authoring).toBe('complete');
    if (g.kind !== 'LinearBiome' || g.authoring !== 'complete') {
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

    expect(g.authoring).toBe('complete');
    if (g.kind !== 'LinearBiome' || g.authoring !== 'complete') {
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

    expect(evaluation.authoring).toBe('complete');
    if (evaluation.kind !== 'LinearBiome' || evaluation.authoring !== 'complete') {
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
    expect(dormant.routes[0]!.processing).toEqual({
      completeValidPrefix: ['F'],
      active: { kind: 'incomplete', biomeKey: 'G' },
      blockedSuffix: [],
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
