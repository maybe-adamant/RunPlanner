import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createRouteAddress,
  createShopOfferAddress,
  createTargetAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

export interface OfferSpec {
  readonly rewardType: string;
  readonly source?: string;
}

interface TargetSpec {
  readonly gameName: string;
  readonly offer?: OfferSpec;
}

interface BatchSpec {
  readonly storeKey?: 'MetaProgress';
  readonly targets: readonly TargetSpec[];
}

export const goldenBatches: readonly BatchSpec[] = [
  { storeKey: 'MetaProgress', targets: [{ gameName: 'F_Combat02' }] },
  {
    targets: [
      { gameName: 'F_Combat03' },
      { gameName: 'F_Combat03', offer: { rewardType: 'MaxHealthDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'F_Combat04', offer: { rewardType: 'MaxHealthDrop' } },
      { gameName: 'F_Combat04', offer: { rewardType: 'MaxManaDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'F_Combat05', offer: { rewardType: 'StackUpgrade' } },
      { gameName: 'F_Combat11', offer: { rewardType: 'RoomMoneyDrop' } },
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      { gameName: 'F_Combat06', offer: { rewardType: 'MetaCardPointsCommonDrop' } },
      { gameName: 'F_Combat06', offer: { rewardType: 'MetaCurrencyDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'F_MiniBoss01' },
      {
        gameName: 'F_MiniBoss02',
        offer: { rewardType: 'Boon', source: 'PoseidonUpgrade' },
      },
    ],
  },
  {
    targets: [{ gameName: 'F_Combat11', offer: { rewardType: 'MaxManaDrop' } }],
  },
  {
    targets: [
      { gameName: 'F_Combat12', offer: { rewardType: 'WeaponUpgrade' } },
      { gameName: 'F_Combat12', offer: { rewardType: 'HermesUpgrade' } },
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      { gameName: 'F_Combat14', offer: { rewardType: 'MetaCardPointsCommonDrop' } },
      { gameName: 'F_Combat14', offer: { rewardType: 'MetaCurrencyDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'F_Combat15', offer: { rewardType: 'RoomMoneyDrop' } },
      { gameName: 'F_Combat15', offer: { rewardType: 'SpellDrop' } },
    ],
  },
];

const goldenGBatches: readonly BatchSpec[] = [
  {
    targets: [{ gameName: 'G_Combat01', offer: { rewardType: 'Boon', source: 'HestiaUpgrade' } }],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      { gameName: 'G_Combat02', offer: { rewardType: 'MetaCurrencyBigDrop' } },
      { gameName: 'G_Combat02', offer: { rewardType: 'MetaCardPointsCommonBigDrop' } },
    ],
  },
  {
    targets: [
      { gameName: 'G_Story01' },
      { gameName: 'G_Combat03', offer: { rewardType: 'MaxManaDrop' } },
      { gameName: 'G_Combat03', offer: { rewardType: 'RoomMoneyDrop' } },
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [{ gameName: 'G_Combat10', offer: { rewardType: 'MetaCardPointsCommonBigDrop' } }],
  },
  {
    targets: [
      { gameName: 'G_Shop01' },
      { gameName: 'G_Combat12', offer: { rewardType: 'StackUpgrade' } },
    ],
  },
  {
    targets: [
      { gameName: 'G_MiniBoss01', offer: { rewardType: 'Boon', source: 'HestiaUpgrade' } },
      { gameName: 'G_MiniBoss02', offer: { rewardType: 'Boon', source: 'ZeusUpgrade' } },
    ],
  },
  {
    targets: [
      { gameName: 'G_Combat12', offer: { rewardType: 'Boon', source: 'HestiaUpgrade' } },
      { gameName: 'G_Combat13', offer: { rewardType: 'RoomMoneyDrop' } },
    ],
  },
];

function resolvedOffer(offer: OfferSpec): ResolvedRewardOffer {
  return offer.source === undefined
    ? Object.freeze({ rewardType: offer.rewardType })
    : Object.freeze({
        rewardType: offer.rewardType,
        payload: Object.freeze({ kind: 'BoonSource' as const, source: offer.source }),
      });
}

export function targetOccurrenceId(biomeKey: 'F' | 'G', batchIndex: number, exitIndex: number) {
  return createOccurrenceId(`phase-5-${biomeKey.toLowerCase()}-b${batchIndex}-e${exitIndex}`);
}

function appendGoldenBatches(
  project: ProjectDocument,
  catalog: Catalog,
  biomeKey: 'F' | 'G',
  startId: OccurrenceId,
  batches: readonly BatchSpec[],
): {
  readonly parentGameName: string;
  readonly parentId: OccurrenceId;
  readonly project: ProjectDocument;
} {
  const biome = createBiomeAddress('Underworld', biomeKey);
  let nextProject = project;
  let parentId = startId;
  for (const [batchOffset, batch] of batches.entries()) {
    const batchIndex = batchOffset + 1;
    nextProject = applyProjectCommand(nextProject, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, parentId),
    });
    if (batch.storeKey !== undefined) {
      nextProject = applyProjectCommand(nextProject, catalog, {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: createBatchRewardStoreAddress(biome, parentId),
        storeKey: batch.storeKey,
      });
    }
    for (const [targetOffset, target] of batch.targets.entries()) {
      const exitIndex = targetOffset + 1;
      const occurrenceId = targetOccurrenceId(biomeKey, batchIndex, exitIndex);
      nextProject = applyProjectCommand(nextProject, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, parentId, exitIndex),
        occurrenceId,
        gameName: target.gameName,
      });
      if (target.offer !== undefined) {
        nextProject = applyProjectCommand(nextProject, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(biome, occurrenceId),
          value: resolvedOffer(target.offer),
        });
      }
    }
    nextProject = applyProjectCommand(nextProject, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, parentId),
      exitIndex: 1,
    });
    if (batch.targets[0]?.gameName === 'G_Shop01') {
      nextProject = applyProjectCommand(nextProject, catalog, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(
          biome,
          targetOccurrenceId('G', batchIndex, 1),
          'MajorNonBoon',
        ),
        value: { rewardType: 'RoomRewardHealDrop' },
      });
    }
    parentId = targetOccurrenceId(biomeKey, batchIndex, 1);
  }
  const parentGameName = batches.at(-1)?.targets[0]?.gameName;
  if (parentGameName === undefined) {
    throw new Error(`${biomeKey} golden batches have no terminal predecessor`);
  }
  return Object.freeze({ parentGameName, parentId, project: nextProject });
}

function appendGoldenTerminal(
  project: ProjectDocument,
  catalog: Catalog,
  biomeKey: 'F' | 'G' | 'H',
  parentId: OccurrenceId,
  parentGameName: string,
): ProjectDocument {
  const biome = createBiomeAddress('Underworld', biomeKey);
  const parent = catalog.rooms.byKey[parentGameName];
  if (parent === undefined) {
    throw new Error(`${biomeKey} terminal predecessor ${parentGameName} is missing`);
  }
  const targetIds = parent.exits.map((exit) =>
    createOccurrenceId(`phase-5-${biomeKey.toLowerCase()}-terminal-e${exit.index}`),
  );
  let nextProject = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, parentId),
    targetOccurrenceIds: targetIds,
  });
  for (const [index, occurrenceId] of targetIds.slice(1).entries()) {
    nextProject = applyProjectCommand(nextProject, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, occurrenceId),
      value: { rewardType: index === 0 ? 'StackUpgrade' : 'HermesUpgrade' },
    });
  }
  nextProject = applyProjectCommand(nextProject, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, parentId),
    exitIndex: 1,
  });
  return applyProjectCommand(nextProject, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(biome, targetIds[0]!, 'MajorNonBoon'),
    value: { rewardType: 'RoomRewardHealDrop' },
  });
}

export function createGoldenFGProject(
  catalog: Catalog,
  options: { readonly gTerminalParent?: 'G_Combat12' | 'G_Combat14' } = {},
): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'phase-5-product-loop',
    name: 'Phase 5 Product Loop',
    configuredBiomeCounts: { Underworld: 2 },
  });
  const fStart = createOccurrenceId('phase-5-f-start');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: createBiomeAddress('Underworld', 'F'),
    occurrenceId: fStart,
    gameName: 'F_Opening01',
  });
  const f = appendGoldenBatches(project, catalog, 'F', fStart, goldenBatches);
  project = appendGoldenTerminal(f.project, catalog, 'F', f.parentId, f.parentGameName);

  const gStart = createOccurrenceId('phase-5-g-start');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: createBiomeAddress('Underworld', 'G'),
    occurrenceId: gStart,
    gameName: 'G_Intro',
  });
  const gBatches = goldenGBatches.map((batch, index) =>
    index === goldenGBatches.length - 1 && options.gTerminalParent !== undefined
      ? Object.freeze({
          ...batch,
          targets: Object.freeze(
            batch.targets.map((target, targetIndex) =>
              targetIndex === 0
                ? Object.freeze({ ...target, gameName: options.gTerminalParent! })
                : target,
            ),
          ),
        })
      : batch,
  );
  const g = appendGoldenBatches(project, catalog, 'G', gStart, gBatches);
  return appendGoldenTerminal(g.project, catalog, 'G', g.parentId, g.parentGameName);
}

function createGoldenFGHProject(catalog: Catalog): ProjectDocument {
  const biome = createBiomeAddress('Underworld', 'H');
  const start = createOccurrenceId('phase-6-h-start');
  const combat02 = createOccurrenceId('phase-6-h-combat02');
  const combat09 = createOccurrenceId('phase-6-h-combat09');
  const combat03 = createOccurrenceId('phase-6-h-combat03');
  const miniboss = createOccurrenceId('phase-6-h-miniboss');
  const bridge = createOccurrenceId('phase-6-h-bridge');
  const combat05 = createOccurrenceId('phase-6-h-combat05');
  const combat04 = createOccurrenceId('phase-6-h-combat04');
  let project = applyProjectCommand(createGoldenFGProject(catalog), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 3,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'H_Intro',
  });
  const batches = [
    {
      parent: start,
      targets: [{ occurrenceId: combat02, gameName: 'H_Combat02' }],
      cageOutcome: 'min' as const,
    },
    {
      parent: combat02,
      targets: [
        { occurrenceId: combat09, gameName: 'H_Combat09' },
        { occurrenceId: combat03, gameName: 'H_Combat03' },
      ],
      cageOutcome: 'min' as const,
    },
    {
      parent: combat09,
      targets: [
        { occurrenceId: miniboss, gameName: 'H_MiniBoss01' },
        { occurrenceId: bridge, gameName: 'H_Bridge01' },
      ],
      cageOutcome: 'max' as const,
    },
    {
      parent: miniboss,
      targets: [
        { occurrenceId: combat05, gameName: 'H_Combat05' },
        { occurrenceId: combat04, gameName: 'H_Combat04' },
      ],
      cageOutcome: 'max' as const,
    },
  ];
  for (const batch of batches) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, batch.parent),
    });
    if (batch.cageOutcome === 'max') {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFieldsCageOutcome',
        continuation: createContinuationAddress(biome, batch.parent),
        cageOutcome: batch.cageOutcome,
      });
    }
    for (const [targetOffset, target] of batch.targets.entries()) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, batch.parent, targetOffset + 1),
        occurrenceId: target.occurrenceId,
        gameName: target.gameName,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, batch.parent),
      exitIndex: 1,
    });
  }

  const cageOffers: Readonly<Record<string, readonly OfferSpec[]>> = {
    [combat02]: [
      { rewardType: 'MaxHealthDrop' },
      { rewardType: 'MaxManaDrop' },
      { rewardType: 'Boon', source: 'HestiaUpgrade' },
    ],
    [combat09]: [
      { rewardType: 'HermesUpgrade' },
      { rewardType: 'WeaponUpgrade' },
      { rewardType: 'Boon', source: 'HestiaUpgrade' },
    ],
    [combat03]: [
      { rewardType: 'MaxHealthDrop' },
      { rewardType: 'SpellDrop' },
      { rewardType: 'Boon', source: 'DemeterUpgrade' },
    ],
    [combat05]: [
      { rewardType: 'MaxHealthDrop' },
      { rewardType: 'Boon', source: 'ApolloUpgrade' },
      { rewardType: 'Boon', source: 'HestiaUpgrade' },
    ],
    [combat04]: [
      { rewardType: 'MaxManaDrop' },
      { rewardType: 'RoomMoneyDrop' },
      { rewardType: 'Boon', source: 'DemeterUpgrade' },
    ],
  };
  for (const [occurrenceId, offers] of Object.entries(cageOffers)) {
    for (const [slotOffset, offer] of offers.entries()) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(
          biome,
          createOccurrenceId(occurrenceId),
          'cages',
          `cage${slotOffset + 1}`,
        ),
        value: resolvedOffer(offer),
      });
    }
  }
  return appendGoldenTerminal(project, catalog, 'H', combat05, 'H_Combat05');
}

export function createGoldenFGHIProject(catalog: Catalog): ProjectDocument {
  const biome = createBiomeAddress('Underworld', 'I');
  let project = applyProjectCommand(createGoldenFGHProject(catalog), catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 4,
  });
  let parent: OccurrenceId | null = null;
  const batches = [
    { targets: ['I_Combat01'] },
    { targets: ['I_Combat03', 'I_Story01'] },
    { targets: ['I_Combat05', 'I_Combat02'] },
    { targets: ['I_Combat06'] },
    { targets: ['I_Combat09'] },
  ] as const;
  for (const [batchIndex, batch] of batches.entries()) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, parent),
    });
    for (const [targetIndex, gameName] of batch.targets.entries()) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, parent, targetIndex + 1),
        occurrenceId: createOccurrenceId(
          targetIndex === 0
            ? `phase-6-i-goal-${batchIndex + 1}`
            : `phase-6-i-peer-${batchIndex + 1}-${targetIndex + 1}`,
        ),
        gameName,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, parent),
      exitIndex: 1,
    });
    parent = createOccurrenceId(`phase-6-i-goal-${batchIndex + 1}`);
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, parent),
  });
  const preboss = createOccurrenceId('phase-6-i-preboss');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, parent, 1),
    occurrenceId: preboss,
    gameName: 'I_PreBoss02',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, parent, 2),
    occurrenceId: createOccurrenceId('phase-6-i-terminal-peer'),
    gameName: 'I_MiniBoss01',
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, parent),
    exitIndex: 1,
  });
}
