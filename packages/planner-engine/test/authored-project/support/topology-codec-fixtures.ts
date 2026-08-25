import { expect } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createProjectHistory,
  createRewardWheelOfferAddress,
  createTargetAddress,
  semanticAddressKey,
  ordinaryTargetAuthoringEligibility,
  decodeProjectDocument,
  encodeProjectDocument,
  ProjectDocumentContractError,
  redoProjectHistory,
  type ProjectDocument,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import { composeBiomeHistoryPrefix, materializeBiomePrefix } from '@run-planner/engine/simulation';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';

import { createNormalDispositionByAcquisitionRole } from '../../../src/authored-project/reward-state';
import { createCompleteNProject } from '../support/complete-n-project';

export const fBiome = createBiomeAddress('Underworld', 'F');
export const hBiome = createBiomeAddress('Underworld', 'H');
export const iBiome = createBiomeAddress('Underworld', 'I');
export const oBiome = createBiomeAddress('Surface', 'O');
export const qBiome = createBiomeAddress('Surface', 'Q');

export interface EncodedTopology {
  startOccurrenceId: string;
  occurrences: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
}

export interface EncodedProject extends Record<string, unknown> {
  routes: Array<{
    routeKey: string;
    biomes: Array<{
      biomeKey: string;
      topology: EncodedTopology | null;
    }>;
  }>;
}

export function project(
  projectId: string,
  configuredBiomeCounts: Partial<Record<'Underworld' | 'Surface', number>>,
): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId,
    configuredBiomeCounts,
  });
}

export function encodedProject(document: ProjectDocument): EncodedProject {
  return JSON.parse(encodeProjectDocument(document)) as EncodedProject;
}

export function encodedTopology(
  document: ProjectDocument,
  routeKey: string,
  biomeKey: string,
): {
  readonly document: EncodedProject;
  readonly topology: EncodedTopology;
  readonly path: string;
} {
  const encoded = encodedProject(document);
  const routeIndex = encoded.routes.findIndex((route) => route.routeKey === routeKey);
  const route = encoded.routes[routeIndex];
  const biomeIndex = route?.biomes.findIndex((biome) => biome.biomeKey === biomeKey) ?? -1;
  const topology = route?.biomes[biomeIndex]?.topology;
  if (routeIndex < 0 || biomeIndex < 0 || topology === null || topology === undefined) {
    throw new Error(`missing encoded ${routeKey}/${biomeKey} topology`);
  }
  return {
    document: encoded,
    topology,
    path: `$.routes[${routeIndex}].biomes[${biomeIndex}].topology`,
  };
}

export function planFor(
  document: ProjectDocument,
  routeKey: 'Underworld' | 'Surface',
  biomeKey: string,
) {
  const plan = document.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey);
  if (plan === undefined) throw new Error(`missing ${routeKey}/${biomeKey} plan`);
  return plan;
}

export function terminalEnvelope(
  document: ProjectDocument,
  biome: ReturnType<typeof createBiomeAddress>,
  sourceOccurrenceId: string,
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId(sourceOccurrenceId),
  });
  const withoutTakeover = applyProjectCommand(document, catalog, {
    kind: 'RemoveExitDecision',
    decision,
  });
  return applyProjectCommand(withoutTakeover, catalog, { kind: 'CreateBatch', decision });
}

export function iAtOrdinaryBatchLimit(): {
  readonly document: ProjectDocument;
  readonly terminalSourceId: ReturnType<typeof createOccurrenceId>;
} {
  const startId = createOccurrenceId('codec-i-bound-start');
  let document = applyProjectCommand(project('codec-i-bound', { Underworld: 4 }), catalog, {
    kind: 'CreateStart',
    biome: iBiome,
    occurrenceId: startId,
  });
  let sourceId = startId;
  for (let index = 1; index <= 13; index += 1) {
    const decision = createExitDecisionAddress(iBiome, {
      kind: 'occurrence',
      occurrenceId: sourceId,
    });
    document = applyProjectCommand(document, catalog, { kind: 'CreateBatch', decision });
    const targetId = createOccurrenceId(`codec-i-bound-${index}`);
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, decision.source, 'exit1'),
      occurrenceId: targetId,
      gameName: 'I_Combat01',
    });
    sourceId = targetId;
  }
  return Object.freeze({ document, terminalSourceId: sourceId });
}

export function expectDocumentError(
  value: unknown,
  expected: { readonly path: string; readonly detail: string },
): void {
  try {
    decodeProjectDocument(value, catalog);
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectDocumentContractError);
    expect(error).toMatchObject(expected);
    return;
  }
  throw new Error(`expected ProjectDocumentContractError at ${expected.path}`);
}

export function createBatchTargets(
  document: ProjectDocument,
  input: {
    readonly biome: ReturnType<typeof createBiomeAddress>;
    readonly sourceOccurrenceId: string;
    readonly targets: readonly {
      readonly exitKey: string;
      readonly occurrenceId: string;
      readonly gameName: string;
    }[];
    readonly rewardStoreKey?: 'RunProgress' | 'MetaProgress';
    readonly fieldsCageOutcome?: 'min' | 'max';
  },
): ProjectDocument {
  const decision = createExitDecisionAddress(input.biome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId(input.sourceOccurrenceId),
  });
  let next = applyProjectCommand(document, catalog, { kind: 'CreateBatch', decision });
  if (input.rewardStoreKey !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(input.biome, decision.source),
      storeKey: input.rewardStoreKey,
    });
  }
  if (input.fieldsCageOutcome !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: input.fieldsCageOutcome,
    });
  }
  for (const target of input.targets) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(input.biome, decision.source, target.exitKey),
      occurrenceId: createOccurrenceId(target.occurrenceId),
      gameName: target.gameName,
    });
  }
  if (input.targets.length > 1) {
    next = applyProjectCommand(next, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(input.biome, decision.source),
      value: { kind: 'normal', exitKey: input.targets[0]!.exitKey },
    });
  }
  return next;
}

export function unresolvedFProject(): ProjectDocument {
  let document = applyProjectCommand(project('codec-unresolved-f', { Underworld: 1 }), catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: createOccurrenceId('round-trip-f-start'),
    gameName: 'F_Opening01',
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('round-trip-f-start'),
    }),
  });
  return document;
}

/**
 * Builds the persisted contract shape before the Midshop's ordinary branch
 * has been authored. The command to add the contract lands separately; this
 * fixture protects the schema boundary that must retain that incomplete
 * branch rather than repairing it during decode.
 */
export function incompleteZagreusEnvelopeProject(): ProjectDocument {
  let document = applyProjectCommand(
    project('codec-zagreus-envelope', { Underworld: 1 }),
    catalog,
    {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('zagreus-opening'),
      gameName: 'F_Opening01',
    },
  );
  document = createBatchTargets(document, {
    biome: fBiome,
    sourceOccurrenceId: 'zagreus-opening',
    rewardStoreKey: 'RunProgress',
    targets: [{ exitKey: 'exit1', occurrenceId: 'zagreus-shop', gameName: 'F_Shop01' }],
  });
  const shopSource = {
    kind: 'occurrence' as const,
    occurrenceId: createOccurrenceId('zagreus-shop'),
  };
  document = applyProjectCommand(document, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(fBiome, shopSource),
  });

  const encoded = encodedTopology(document, 'Underworld', 'F');
  const shopDecision = encoded.topology.decisions.find(
    (candidate) =>
      candidate.kind === 'exit' &&
      (candidate.source as { occurrenceId?: string }).occurrenceId === 'zagreus-shop',
  );
  if (shopDecision === undefined) throw new Error('missing Zagreus Midshop decision');
  const contractBinding = catalog.rooms.byKey.C_Boss01?.incomingReward;
  if (contractBinding?.kind !== 'fixed') throw new Error('C_Boss01 must have a fixed reward');
  const contractOffer = Object.freeze({
    rewardType: contractBinding.rewardType,
  }) as Parameters<typeof createNormalDispositionByAcquisitionRole>[1];
  encoded.topology.occurrences.push({
    occurrenceId: 'zagreus-contract',
    gameName: 'C_Boss01',
    state: {
      kind: 'fixed',
      reward: {
        offer: contractOffer,
        dispositionByAcquisitionRole: createNormalDispositionByAcquisitionRole(
          catalog,
          contractOffer,
        ),
        traitOffersByAcquisitionRole: {},
      },
    },
    encounters: {
      encounterKeyByPhase: {},
      figLeafSkipByPhase: { Encounter: false },
      gorgonResultByPhase: {},
    },
    roomActions: { order: [] },
    additionalExits: [],
  });
  const shopOccurrence = encoded.topology.occurrences.find(
    (candidate) => candidate.occurrenceId === 'zagreus-shop',
  );
  if (shopOccurrence === undefined) throw new Error('missing Zagreus Midshop occurrence');
  shopOccurrence.additionalExits = [
    {
      kind: 'zagreusContract',
      key: 'zagreusContract',
      occurrenceId: 'zagreus-contract',
    },
  ];
  return decodeProjectDocument(encoded.document, catalog);
}

export function selectedFTakeoverProject(): ProjectDocument {
  let document = applyProjectCommand(project('codec-selected-f', { Underworld: 1 }), catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: createOccurrenceId('f-start'),
    gameName: 'F_Opening01',
  });
  document = createBatchTargets(document, {
    biome: fBiome,
    sourceOccurrenceId: 'f-start',
    rewardStoreKey: 'RunProgress',
    targets: [{ exitKey: 'exit1', occurrenceId: 'f-combat', gameName: 'F_Combat02' }],
  });
  const combatDecision = createExitDecisionAddress(fBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('f-combat'),
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: combatDecision,
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('f-preboss-shop'),
      exit2: createOccurrenceId('f-preboss-free'),
    },
  });
  return applyProjectCommand(document, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(fBiome, combatDecision.source),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
}

export function completeHProject(): ProjectDocument {
  let document = applyProjectCommand(project('codec-complete-h', { Underworld: 3 }), catalog, {
    kind: 'CreateStart',
    biome: hBiome,
    occurrenceId: createOccurrenceId('complete-h-start'),
  });
  for (const [sourceOccurrenceId, targets] of [
    ['complete-h-start', [['exit1', 'complete-h-02', 'H_Combat02']]],
    [
      'complete-h-02',
      [
        ['exit1', 'complete-h-03', 'H_Combat03'],
        ['exit2', 'complete-h-04', 'H_Combat04'],
      ],
    ],
    [
      'complete-h-03',
      [
        ['exit1', 'complete-h-05', 'H_Combat05'],
        ['exit2', 'complete-h-06', 'H_Combat06'],
      ],
    ],
    [
      'complete-h-05',
      [
        ['exit1', 'complete-h-07', 'H_Combat07'],
        ['exit2', 'complete-h-08', 'H_Combat08'],
      ],
    ],
  ] as const) {
    document = createBatchTargets(document, {
      biome: hBiome,
      sourceOccurrenceId,
      fieldsCageOutcome: 'min',
      targets: targets.map(([exitKey, occurrenceId, gameName]) => ({
        exitKey,
        occurrenceId,
        gameName,
      })),
    });
  }
  return applyProjectCommand(document, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(hBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('complete-h-07'),
    }),
    gameName: 'H_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('complete-h-preboss-shop'),
      exit2: createOccurrenceId('complete-h-preboss-free'),
    },
  });
}

export function completeOProject(): ProjectDocument {
  let document = applyProjectCommand(project('codec-complete-o', { Surface: 2 }), catalog, {
    kind: 'CreateStart',
    biome: oBiome,
    occurrenceId: createOccurrenceId('complete-o-start'),
  });
  for (const [index, gameName] of [
    'O_Combat01',
    'O_Combat02',
    'O_Combat03',
    'O_Combat04',
    'O_Combat05',
    'O_Combat06',
  ].entries()) {
    document = createBatchTargets(document, {
      biome: oBiome,
      sourceOccurrenceId: index === 0 ? 'complete-o-start' : `complete-o-${index}`,
      ...(index === 0 ? { rewardStoreKey: 'RunProgress' as const } : {}),
      targets: [
        {
          exitKey: 'exit1',
          occurrenceId: `complete-o-${index + 1}`,
          gameName,
        },
      ],
    });
  }
  return applyProjectCommand(document, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('complete-o-6'),
    }),
    gameName: 'O_PreBoss01',
    targetOccurrenceIds: { exit1: createOccurrenceId('complete-o-preboss') },
  });
}

export function completeQProject(): ProjectDocument {
  let document = applyProjectCommand(project('codec-complete-q', { Surface: 4 }), catalog, {
    kind: 'CreateStart',
    biome: qBiome,
    occurrenceId: createOccurrenceId('complete-q-start'),
  });
  for (const [sourceOccurrenceId, occurrenceId, gameName] of [
    ['complete-q-start', 'complete-q-foyer', 'Q_Combat10'],
    ['complete-q-foyer', 'complete-q-first-fork', 'Q_Combat03'],
    ['complete-q-first-fork', 'complete-q-first-miniboss', 'Q_MiniBoss02'],
    ['complete-q-first-miniboss', 'complete-q-ordinary', 'Q_Combat01'],
    ['complete-q-ordinary', 'complete-q-second-fork', 'Q_Combat12'],
    ['complete-q-second-fork', 'complete-q-second-miniboss', 'Q_MiniBoss03'],
  ] as const) {
    document = createBatchTargets(document, {
      biome: qBiome,
      sourceOccurrenceId,
      targets: [{ exitKey: 'exit1', occurrenceId, gameName }],
    });
  }
  return applyProjectCommand(document, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('complete-q-second-miniboss'),
    }),
    gameName: 'Q_PreBoss01',
    targetOccurrenceIds: { exit1: createOccurrenceId('complete-q-preboss') },
  });
}

export function rewardWheelProject(): ProjectDocument {
  let document = applyProjectCommand(project('codec-wheel-o', { Surface: 2 }), catalog, {
    kind: 'CreateStart',
    biome: oBiome,
    occurrenceId: createOccurrenceId('o-wheel-intro'),
  });
  document = createBatchTargets(document, {
    biome: oBiome,
    sourceOccurrenceId: 'o-wheel-intro',
    rewardStoreKey: 'RunProgress',
    targets: [{ exitKey: 'exit1', occurrenceId: 'o-wheel-combat', gameName: 'O_Combat01' }],
  });
  return applyProjectCommand(document, catalog, {
    kind: 'ReplaceRewardWheelOffer',
    offer: createRewardWheelOfferAddress(
      oBiome,
      createOccurrenceId('o-wheel-combat'),
      'wheel1',
      'offer1',
    ),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

export function contextInvalidOverflowProject(): ProjectDocument {
  let document = applyProjectCommand(project('codec-overflow-f', { Underworld: 1 }), catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: createOccurrenceId('overflow-opening'),
    gameName: 'F_Opening01',
  });
  document = createBatchTargets(document, {
    biome: fBiome,
    sourceOccurrenceId: 'overflow-opening',
    rewardStoreKey: 'RunProgress',
    targets: [{ exitKey: 'exit1', occurrenceId: 'overflow-source', gameName: 'F_Combat02' }],
  });
  document = createBatchTargets(document, {
    biome: fBiome,
    sourceOccurrenceId: 'overflow-source',
    rewardStoreKey: 'RunProgress',
    targets: [
      { exitKey: 'exit1', occurrenceId: 'overflow-exit1', gameName: 'F_Combat01' },
      { exitKey: 'exit2', occurrenceId: 'overflow-exit2', gameName: 'F_Combat01' },
    ],
  });
  return applyProjectCommand(document, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(fBiome, createOccurrenceId('overflow-source')),
    gameName: 'F_Combat01',
  });
}

export {
  catalog,
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createProjectHistory,
  createRewardWheelOfferAddress,
  createTargetAddress,
  semanticAddressKey,
  ordinaryTargetAuthoringEligibility,
  decodeProjectDocument,
  encodeProjectDocument,
  ProjectDocumentContractError,
  redoProjectHistory,
  undoProjectHistory,
  composeBiomeHistoryPrefix,
  materializeBiomePrefix,
  loadSurfaceNOPQProject,
  createNormalDispositionByAcquisitionRole,
  createCompleteNProject,
};
export type { ProjectDocument };
