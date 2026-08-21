import { describe, expect, it } from 'vitest';

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

const fBiome = createBiomeAddress('Underworld', 'F');
const hBiome = createBiomeAddress('Underworld', 'H');
const iBiome = createBiomeAddress('Underworld', 'I');
const oBiome = createBiomeAddress('Surface', 'O');
const qBiome = createBiomeAddress('Surface', 'Q');

interface EncodedTopology {
  startOccurrenceId: string;
  occurrences: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
}

interface EncodedProject extends Record<string, unknown> {
  routes: Array<{
    routeKey: string;
    biomes: Array<{
      biomeKey: string;
      topology: EncodedTopology | null;
    }>;
  }>;
}

function project(
  projectId: string,
  configuredBiomeCounts: Partial<Record<'Underworld' | 'Surface', number>>,
): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId,
    configuredBiomeCounts,
  });
}

function encodedProject(document: ProjectDocument): EncodedProject {
  return JSON.parse(encodeProjectDocument(document)) as EncodedProject;
}

function encodedTopology(
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

function planFor(document: ProjectDocument, routeKey: 'Underworld' | 'Surface', biomeKey: string) {
  const plan = document.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey);
  if (plan === undefined) throw new Error(`missing ${routeKey}/${biomeKey} plan`);
  return plan;
}

function terminalEnvelope(
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

function iAtOrdinaryBatchLimit(): {
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

function expectDocumentError(
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

function createBatchTargets(
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

function unresolvedFProject(): ProjectDocument {
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
function incompleteZagreusEnvelopeProject(): ProjectDocument {
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

function selectedFTakeoverProject(): ProjectDocument {
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

function completeHProject(): ProjectDocument {
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

function completeOProject(): ProjectDocument {
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

function completeQProject(): ProjectDocument {
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

function rewardWheelProject(): ProjectDocument {
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

function contextInvalidOverflowProject(): ProjectDocument {
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

describe('persisted authored topology codec', () => {
  it.each([
    ['an unresolved authored-store batch', unresolvedFProject],
    ['derived and selected multi-door takeover batches', selectedFTakeoverProject],
    ['Fields batch state at its ordinary bounds', completeHProject],
    ['source-offer-point Ship batches at their ordinary bounds', completeOProject],
    ['staged no-store batches at their ordinary bounds', completeQProject],
    [
      'normal PreHub, source-bearing Hub, and completed-Hub handoff decisions',
      createCompleteNProject,
    ],
    ['a command-produced Ship wheel leaf', rewardWheelProject],
    [
      'a structurally representable overflow after source replacement',
      contextInvalidOverflowProject,
    ],
  ] as const)(
    'round trips %s without changing occurrence identity or authored state',
    (_name, build) => {
      const document = build();
      expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);
    },
  );

  it('round-trips strict local-visit topology and rejects retired or malformed local ownership', () => {
    const complete = createCompleteNProject();
    const encoded = encodedTopology(complete, 'Surface', 'N');
    const localIndex = encoded.topology.decisions.findIndex(
      (decision) => decision.kind === 'localVisit',
    );
    const local = encoded.topology.decisions[localIndex];
    if (localIndex < 0 || local === undefined) throw new Error('complete N local visit is missing');
    expect(decodeProjectDocument(encoded.document, catalog)).toEqual(complete);

    const missing = encodedTopology(complete, 'Surface', 'N');
    missing.topology.decisions.splice(localIndex, 1);
    expect(() => decodeProjectDocument(missing.document, catalog)).toThrow(
      /requires exactly one local visit decision/,
    );

    const extra = encodedTopology(complete, 'Surface', 'N');
    const extraLocal = extra.topology.decisions[localIndex];
    if (extraLocal === undefined) throw new Error('complete N local visit is missing');
    extraLocal.sideRooms = {};
    expect(() => decodeProjectDocument(extra.document, catalog)).toThrow(
      /sideRooms: is not a project document field/,
    );

    const invalidOrder = encodedTopology(complete, 'Surface', 'N');
    const invalidLocal = invalidOrder.topology.decisions[localIndex];
    const targets = invalidLocal?.targetsBySlot as Record<
      string,
      { occurrenceId: string; generation: string }
    >;
    const firstTarget = Object.values(targets)[0];
    if (invalidLocal === undefined || firstTarget === undefined) {
      throw new Error('complete N local visit target is missing');
    }
    firstTarget.generation = 'notGenerated';
    invalidLocal.visitOrder = [firstTarget.occurrenceId];
    expect(() => decodeProjectDocument(invalidOrder.document, catalog)).toThrow(
      /must be generated before entry/,
    );
  });

  it('retains an incomplete Zagreus normal branch and admits its closed automatic host return', () => {
    let document = incompleteZagreusEnvelopeProject();
    const shopSource = {
      kind: 'occurrence' as const,
      occurrenceId: createOccurrenceId('zagreus-shop'),
    };
    const envelope = planFor(document, 'Underworld', 'F').topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === shopSource.occurrenceId,
    );
    expect(envelope).toMatchObject({
      normal: { targets: [] },
      selection: { kind: 'unresolved' },
    });
    expect(
      planFor(document, 'Underworld', 'F').topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === shopSource.occurrenceId,
      )?.additionalExits,
    ).toEqual([
      { kind: 'zagreusContract', key: 'zagreusContract', occurrenceId: 'zagreus-contract' },
    ]);
    expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);

    document = applyProjectCommand(document, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, shopSource),
      value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
    });
    const contractSource = {
      kind: 'occurrence' as const,
      occurrenceId: createOccurrenceId('zagreus-contract'),
    };
    const contractDecision = createExitDecisionAddress(fBiome, contractSource);
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateBatch',
      decision: contractDecision,
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, contractSource),
      storeKey: 'RunProgress',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, contractSource, 'exit1'),
      occurrenceId: createOccurrenceId('zagreus-host-return'),
      gameName: 'F_Combat02',
    });

    expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);
    const returnDecision = planFor(document, 'Underworld', 'F').topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === contractSource.occurrenceId,
    );
    expect(returnDecision).toMatchObject({
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: 'zagreus-host-return' }] },
      selection: { kind: 'derived' },
    });
  });

  it('rejects the retired decision-owned additional-exit field', () => {
    const encoded = encodedTopology(incompleteZagreusEnvelopeProject(), 'Underworld', 'F');
    const shopDecisionIndex = encoded.topology.decisions.findIndex(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'zagreus-shop',
    );
    const shopDecision = encoded.topology.decisions[shopDecisionIndex];
    if (shopDecision === undefined) throw new Error('missing Zagreus Midshop decision');
    shopDecision.additional = [];

    expectDocumentError(encoded.document, {
      path: `${encoded.path}.decisions[${shopDecisionIndex}].additional`,
      detail: 'is not a project document field',
    });
  });

  it.each([
    ['H', completeHProject, 9],
    ['O', completeOProject, 7],
    ['Q', completeQProject, 7],
  ] as const)(
    'does not count the complete %s takeover against generated progression bounds',
    (biomeKey, build, expectedTargetCount) => {
      const document = build();
      const plan = document.routes
        .flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === biomeKey);
      const layout = catalog.biomeLayouts.byKey[biomeKey];
      if (
        plan?.topology === null ||
        plan?.topology === undefined ||
        layout?.progression.kind !== 'generated'
      ) {
        throw new Error(`missing generated ${biomeKey} topology`);
      }
      const batches = plan.topology.decisions.filter(
        (decision) => decision.kind === 'exit' && decision.normal.kind === 'batch',
      );
      const targets = batches.flatMap((decision) =>
        decision.kind === 'exit' && decision.normal.kind === 'batch' ? decision.normal.targets : [],
      );
      expect(batches).toHaveLength(layout.progression.bounds.maxBatches + 1);
      expect(targets).toHaveLength(expectedTargetCount);
      expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);
    },
  );

  it('canonicalizes target references in declaration-owned exit order', () => {
    const encoded = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    const takeoverIndex = encoded.topology.decisions.findIndex(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'f-combat',
    );
    const takeover = encoded.topology.decisions[takeoverIndex];
    if (takeover === undefined) throw new Error('missing F takeover decision');
    (takeover.normal as { targets: unknown[] }).targets.reverse();

    const decoded = decodeProjectDocument(encoded.document, catalog);
    const decodedTakeover = decoded.routes[0]?.biomes[0]?.topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === 'f-combat',
    );
    expect(decodedTakeover).toMatchObject({
      normal: {
        targets: [
          { exitKey: 'exit1', occurrenceId: 'f-preboss-shop' },
          { exitKey: 'exit2', occurrenceId: 'f-preboss-free' },
        ],
      },
    });
  });

  it.each([
    ['H', 'Underworld', hBiome, completeHProject, 'complete-h-07', 'H_Combat02'],
    ['O', 'Surface', oBiome, completeOProject, 'complete-o-6', 'O_Combat01'],
    ['Q', 'Surface', qBiome, loadSurfaceNOPQProject, 'surface-q-second-miniboss-1', 'Q_Combat10'],
  ] as const)(
    'retains the declaration-admitted terminal %s envelope outside realized ordinary progression',
    (biomeKey, routeKey, biome, build, sourceOccurrenceId, ordinaryGameName) => {
      const document = terminalEnvelope(build(), biome, sourceOccurrenceId);
      const plan = planFor(document, routeKey, biomeKey);
      const layout = catalog.biomeLayouts.byKey[biomeKey];
      if (plan.topology === null || layout?.progression.kind !== 'generated') {
        throw new Error(`missing generated ${biomeKey} terminal envelope`);
      }
      const decision = createExitDecisionAddress(biome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId(sourceOccurrenceId),
      });
      const envelope = plan.topology.decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          semanticAddressKey(createExitDecisionAddress(biome, candidate.source)) ===
            semanticAddressKey(decision),
      );
      const route = document.routes.find((candidate) => candidate.routeKey === routeKey);
      if (route === undefined) throw new Error(`missing ${routeKey} route`);
      const prefix = materializeBiomePrefix(catalog, biome, plan, route.loadout);
      if (prefix === null) throw new Error(`missing ${biomeKey} terminal prefix`);
      const history = composeBiomeHistoryPrefix(catalog, prefix);

      expect(envelope).toMatchObject({
        normal: { kind: 'batch', targets: [] },
        selection: { kind: 'unresolved' },
      });
      expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);
      expect(prefix.decisions.filter((candidate) => candidate.kind === 'batch')).toHaveLength(
        layout.progression.bounds.maxBatches,
      );
      expect(prefix.frontier).toMatchObject({
        kind: 'exitDecision',
        origin: decision,
        targets: [],
      });
      expect(prefix.frontier).not.toHaveProperty('partialBatch');
      expect(
        history?.events.some(
          (event) => semanticAddressKey(event.origin) === semanticAddressKey(decision),
        ),
      ).toBe(false);
      expect(
        ordinaryTargetAuthoringEligibility(
          catalog,
          layout,
          plan.topology,
          createTargetAddress(biome, decision.source, 'exit1'),
          ordinaryGameName,
        ),
      ).toMatchObject({ kind: 'unavailable', reason: 'batchBound' });
      expect(() =>
        applyProjectCommand(document, catalog, {
          kind: 'CreateTarget',
          target: createTargetAddress(biome, decision.source, 'exit1'),
          occurrenceId: createOccurrenceId(`over-bound-${biomeKey.toLowerCase()}-ordinary`),
          gameName: ordinaryGameName,
        }),
      ).toThrowError(
        expect.objectContaining({
          detail: 'normal progression has reached its declaration-owned batch bound',
        }),
      );
    },
  );

  it('rejects a raw over-bound I envelope although it has no realized target', () => {
    const { document, terminalSourceId } = iAtOrdinaryBatchLimit();
    const terminalDecision = createExitDecisionAddress(iBiome, {
      kind: 'occurrence',
      occurrenceId: terminalSourceId,
    });
    expect(() =>
      applyProjectCommand(document, catalog, {
        kind: 'CreateBatch',
        decision: terminalDecision,
      }),
    ).toThrowError(
      expect.objectContaining({
        detail: 'normal progression has reached its declaration-owned batch bound',
      }),
    );

    const encoded = encodedTopology(document, 'Underworld', 'I');
    const template = encoded.topology.decisions.at(-1);
    if (template === undefined) throw new Error('missing final I batch');
    const normal = template.normal as Record<string, unknown>;
    encoded.topology.decisions.push({
      kind: 'exit',
      source: { kind: 'occurrence', occurrenceId: terminalSourceId },
      normal: {
        kind: 'batch',
        rewardStore: normal.rewardStore,
        batchState: normal.batchState,
        targets: [],
      },
      selection: { kind: 'unresolved' },
    });

    expectDocumentError(encoded.document, {
      path: `${encoded.path}.decisions`,
      detail: 'exceeds 13 normal batches',
    });
  });

  it('records and removes an H terminal envelope as one ordinary semantic edit', () => {
    const decision = createExitDecisionAddress(hBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('complete-h-07'),
    });
    const withoutTakeover = applyProjectCommand(completeHProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision,
    });
    const initial = createProjectHistory(withoutTakeover);
    const created = applyProjectHistoryCommand(initial, catalog, {
      kind: 'CreateBatch',
      decision,
    });
    const undone = undoProjectHistory(created);
    const redone = redoProjectHistory(undone);

    expect(created.present).toEqual(terminalEnvelope(completeHProject(), hBiome, 'complete-h-07'));
    expect(undone.present).toEqual(withoutTakeover);
    expect(redone.present).toEqual(created.present);
    const removed = applyProjectCommand(redone.present, catalog, {
      kind: 'RemoveExitDecision',
      decision,
    });
    expect(
      planFor(removed, 'Underworld', 'H').topology?.decisions.some(
        (candidate) =>
          candidate.kind === 'exit' &&
          semanticAddressKey(createExitDecisionAddress(hBiome, candidate.source)) ===
            semanticAddressKey(decision),
      ),
    ).toBe(false);
  });

  it('derives staged selection from the selected spine rather than decision storage order', () => {
    let document = applyProjectCommand(project('codec-staged-q', { Surface: 4 }), catalog, {
      kind: 'CreateStart',
      biome: qBiome,
      occurrenceId: createOccurrenceId('q-intro'),
    });
    document = createBatchTargets(document, {
      biome: qBiome,
      sourceOccurrenceId: 'q-intro',
      targets: [{ exitKey: 'exit1', occurrenceId: 'q-foyer', gameName: 'Q_Combat10' }],
    });
    document = createBatchTargets(document, {
      biome: qBiome,
      sourceOccurrenceId: 'q-foyer',
      targets: [{ exitKey: 'exit1', occurrenceId: 'q-first-fork', gameName: 'Q_Combat03' }],
    });
    const reordered = encodedTopology(document, 'Surface', 'Q');
    reordered.topology.decisions.reverse();
    expect(() => decodeProjectDocument(reordered.document, catalog)).not.toThrow();

    const firstFork = reordered.topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'q-first-fork',
    );
    if (firstFork === undefined) throw new Error('missing first-fork occurrence');
    firstFork.gameName = 'Q_Combat02';
    expectDocumentError(reordered.document, {
      path: reordered.path,
      detail: 'Q_Combat02 is not available in staged pool firstFork',
    });
  });

  it('uses selected topology ownership to require active Shop entry state', () => {
    let document = applyProjectCommand(project('codec-dormant-shop', { Underworld: 1 }), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('shop-opening'),
      gameName: 'F_Opening01',
    });
    document = createBatchTargets(document, {
      biome: fBiome,
      sourceOccurrenceId: 'shop-opening',
      rewardStoreKey: 'RunProgress',
      targets: [{ exitKey: 'exit1', occurrenceId: 'shop-source', gameName: 'F_Combat02' }],
    });
    const sourceDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('shop-source'),
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateBatch',
      decision: sourceDecision,
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, sourceDecision.source),
      storeKey: 'RunProgress',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('shop-peer'),
      gameName: 'F_Combat01',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit2'),
      occurrenceId: createOccurrenceId('ordinary-shop'),
      gameName: 'F_Shop01',
    });
    expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);

    const selectedWithoutEntryState = encodedTopology(document, 'Underworld', 'F');
    const decision = selectedWithoutEntryState.topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        (candidate.source as { occurrenceId?: string }).occurrenceId === 'shop-source',
    );
    const shopIndex = selectedWithoutEntryState.topology.occurrences.findIndex(
      (occurrence) => occurrence.occurrenceId === 'ordinary-shop',
    );
    if (decision === undefined || shopIndex < 0) throw new Error('missing dormant Shop topology');
    decision.selection = { kind: 'normal', exitKey: 'exit2' };
    expectDocumentError(selectedWithoutEntryState.document, {
      path: `${selectedWithoutEntryState.path}.occurrences[${shopIndex}].state.shop`,
      detail: 'is required for an entered shop occurrence',
    });

    const selected = applyProjectCommand(document, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, sourceDecision.source),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(decodeProjectDocument(encodedProject(selected), catalog)).toEqual(selected);
  });

  it('accepts Hub decision storage order but rejects malformed Hub source and linked normal ownership', () => {
    const reordered = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    reordered.topology.decisions.reverse();
    expect(() => decodeProjectDocument(reordered.document, catalog)).not.toThrow();

    const unsupportedLinkedNormal = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const opening = unsupportedLinkedNormal.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'round-trip-n-opening',
    );
    if (opening === undefined) throw new Error('missing normal PreHub entry');
    opening.normal = {
      kind: 'linked',
      exitKey: 'prehub',
      occurrenceId: 'round-trip-n-prehub',
    };
    expectDocumentError(unsupportedLinkedNormal.document, {
      path: `${unsupportedLinkedNormal.path}.decisions[0].normal.kind`,
      detail: 'unknown normal exit form linked',
    });

    const unsupportedHubSource = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const hubIndex = unsupportedHubSource.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    const hub = unsupportedHubSource.topology.decisions[hubIndex];
    if (hub === undefined) throw new Error('missing Hub decision');
    hub.source = { kind: 'hubDecision', decisionKey: 'hub' };
    expectDocumentError(unsupportedHubSource.document, {
      path: `${unsupportedHubSource.path}.decisions[${hubIndex}].source`,
      detail: 'Hub decision source must be an occurrence',
    });

    const unknownHubSource = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const unknownHubIndex = unknownHubSource.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    const unknownHub = unknownHubSource.topology.decisions[unknownHubIndex];
    if (unknownHub === undefined) throw new Error('missing Hub decision');
    unknownHub.source = { kind: 'occurrence', occurrenceId: 'missing-prehub' };
    expectDocumentError(unknownHubSource.document, {
      path: `${unknownHubSource.path}.decisions[${unknownHubIndex}].source.occurrenceId`,
      detail: 'unknown occurrence missing-prehub',
    });

    const competingHubOwner = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const competingHubIndex = competingHubOwner.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    if (competingHubIndex < 0) throw new Error('missing Hub decision');
    competingHubOwner.topology.decisions.push({
      kind: 'exit',
      source: { kind: 'occurrence', occurrenceId: 'round-trip-n-prehub' },
      normal: {
        kind: 'batch',
        rewardStore: { kind: 'none' },
        batchState: null,
        targets: [],
      },
      selection: { kind: 'unresolved' },
    });
    expectDocumentError(competingHubOwner.document, {
      path: `${competingHubOwner.path}.decisions[${competingHubIndex}].source`,
      detail: 'Hub decision cannot coexist with an exit decision at its source',
    });

    const nonTerminalHubSource = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const nonTerminalHubIndex = nonTerminalHubSource.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    const nonTerminalHub = nonTerminalHubSource.topology.decisions[nonTerminalHubIndex];
    if (nonTerminalHub === undefined) throw new Error('missing Hub decision');
    nonTerminalHub.source = { kind: 'occurrence', occurrenceId: 'round-trip-n-opening' };
    nonTerminalHubSource.topology.decisions = nonTerminalHubSource.topology.decisions.filter(
      (decision) =>
        !(
          decision.kind === 'exit' &&
          (decision.source as { occurrenceId?: string }).occurrenceId === 'round-trip-n-opening'
        ),
    );
    const nonTerminalHubAfterRemovalIndex = nonTerminalHubSource.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    expectDocumentError(nonTerminalHubSource.document, {
      path: `${nonTerminalHubSource.path}.decisions[${nonTerminalHubAfterRemovalIndex}].source`,
      detail: 'Hub source does not resolve the declared terminal Hub takeover',
    });
  });

  it('rejects invalid selection, decision-source, exit-key, reachability, owner, and cycle shapes', () => {
    const widthOne = encodedTopology(
      applyProjectCommand(project('codec-width-one', { Underworld: 1 }), catalog, {
        kind: 'CreateStart',
        biome: fBiome,
        occurrenceId: createOccurrenceId('f-width-one'),
        gameName: 'F_Opening01',
      }),
      'Underworld',
      'F',
    );
    widthOne.topology.occurrences.push({
      occurrenceId: 'f-width-one-target',
      gameName: 'F_Combat02',
      state: { kind: 'counted', offer: { rewardType: 'Boon' } },
      encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {}, gorgonResultByPhase: {} },
      roomActions: { order: [] },
      additionalExits: [],
    });
    widthOne.topology.decisions.push({
      kind: 'exit',
      source: { kind: 'occurrence', occurrenceId: 'f-width-one' },
      normal: {
        kind: 'batch',
        rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
        batchState: null,
        targets: [{ exitKey: 'exit1', occurrenceId: 'f-width-one-target' }],
      },
      selection: { kind: 'normal', exitKey: 'exit1' },
    });
    expectDocumentError(widthOne.document, {
      path: `${widthOne.path}.decisions[0].selection`,
      detail: 'a width-one normal exit must use derived selection',
    });

    const duplicateSource = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    duplicateSource.topology.decisions.push({ ...duplicateSource.topology.decisions[0]! });
    expectDocumentError(duplicateSource.document, {
      path: `${duplicateSource.path}.decisions[2]`,
      detail: 'duplicates decision source exit:occurrence:f-start',
    });

    const inventedExitKey = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    const takeover = inventedExitKey.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'f-combat',
    );
    if (takeover === undefined) throw new Error('missing F takeover decision');
    const targets = (takeover.normal as { targets: Array<{ exitKey: string }> }).targets;
    targets[1]!.exitKey = 'banana';
    expectDocumentError(inventedExitKey.document, {
      path: `${inventedExitKey.path}.decisions[1].normal.targets[1].exitKey`,
      detail: 'banana is not a declaration-owned normal exit key',
    });

    const deadLeaf = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    deadLeaf.topology.decisions.push({
      kind: 'exit',
      source: { kind: 'occurrence', occurrenceId: 'f-preboss-free' },
      normal: {
        kind: 'batch',
        rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
        batchState: null,
        targets: [],
      },
      selection: { kind: 'unresolved' },
    });
    expectDocumentError(deadLeaf.document, {
      path: `${deadLeaf.path}.decisions[2].source.occurrenceId`,
      detail: 'source is not on the selected topology spine',
    });

    const orphan = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    orphan.topology.occurrences.push({
      occurrenceId: 'orphan',
      gameName: 'F_Combat02',
      state: { kind: 'counted', offer: { rewardType: 'Boon' } },
      encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {}, gorgonResultByPhase: {} },
      roomActions: { order: [] },
      additionalExits: [],
    });
    expectDocumentError(orphan.document, {
      path: `${orphan.path}.occurrences[4]`,
      detail: 'occurrence orphan has no structural owner',
    });

    const cycle = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    const opening = cycle.topology.decisions[0];
    if (opening === undefined) throw new Error('missing F opening decision');
    const openingTargets = (opening.normal as { targets: Array<{ occurrenceId: string }> }).targets;
    openingTargets[0]!.occurrenceId = 'f-start';
    expectDocumentError(cycle.document, {
      path: cycle.path,
      detail: 'selected topology spine contains a decision cycle',
    });

    const multiplyOwned = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    const multiplyOwnedTakeover = multiplyOwned.topology.decisions[1];
    if (multiplyOwnedTakeover === undefined) throw new Error('missing F takeover decision');
    const takeoverTargets = (
      multiplyOwnedTakeover.normal as { targets: Array<{ occurrenceId: string }> }
    ).targets;
    takeoverTargets[1]!.occurrenceId = 'f-preboss-shop';
    expectDocumentError(multiplyOwned.document, {
      path: `${multiplyOwned.path}.decisions[1].normal.targets[1].occurrenceId`,
      detail: 'occurrence f-preboss-shop has multiple structural owners',
    });
  });

  it('rejects a Hub target without an occurrence at its exact owner path', () => {
    const malformedHub = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const hubIndex = malformedHub.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    const hub = malformedHub.topology.decisions[hubIndex];
    if (hub === undefined) throw new Error('missing Hub decision');
    hub.openTargets = [{ hubSlotKey: 'combat01', occurrenceId: 'missing-hub-target' }];
    expectDocumentError(malformedHub.document, {
      path: `${malformedHub.path}.decisions[${hubIndex}].openTargets[0].occurrenceId`,
      detail: 'unknown occurrence missing-hub-target',
    });
  });
});
