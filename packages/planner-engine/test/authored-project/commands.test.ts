import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createProjectHistory,
  createRewardWheelOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  declaredPhysicalExits,
  decodeProjectDocument,
  directShopOnlyPrebossForSource,
  encodeProjectDocument,
  fixedPrebossTransitionForSource,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  redoProjectHistory,
  semanticAddressKey,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';

const fBiome = createBiomeAddress('Underworld', 'F');
const gBiome = createBiomeAddress('Underworld', 'G');
const hBiome = createBiomeAddress('Underworld', 'H');
const iBiome = createBiomeAddress('Underworld', 'I');
const nBiome = createBiomeAddress('Surface', 'N');
const oBiome = createBiomeAddress('Surface', 'O');
const qBiome = createBiomeAddress('Surface', 'Q');

function fProject() {
  return createProjectDocument(catalog, {
    projectId: 'commands-f',
    name: 'Commands F',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function nProject() {
  return createProjectDocument(catalog, {
    projectId: 'commands-n',
    name: 'Commands N',
    configuredBiomeCounts: { Surface: 1 },
  });
}

function hProject() {
  return createProjectDocument(catalog, {
    projectId: 'commands-h',
    name: 'Commands H',
    configuredBiomeCounts: { Underworld: 3 },
  });
}

function gProject() {
  return createProjectDocument(catalog, {
    projectId: 'commands-g',
    name: 'Commands G',
    configuredBiomeCounts: { Underworld: 2 },
  });
}

function iProject() {
  return createProjectDocument(catalog, {
    projectId: 'commands-i',
    name: 'Commands I',
    configuredBiomeCounts: { Underworld: 4 },
  });
}

function surfaceProject(configuredBiomeCount: number) {
  return createProjectDocument(catalog, {
    projectId: `commands-surface-${configuredBiomeCount}`,
    name: 'Commands Surface',
    configuredBiomeCounts: { Surface: configuredBiomeCount },
  });
}

function fTopology(project: ReturnType<typeof fProject>) {
  const topology = project.routes[0]?.biomes[0]?.topology;
  if (topology === null || topology === undefined) throw new Error('missing F topology');
  return topology;
}

interface EncodedTopology {
  startOccurrenceId: string;
  occurrences: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
}

interface EncodedProject {
  routes: Array<{
    routeKey: string;
    biomes: Array<{ biomeKey: string; topology: EncodedTopology | null }>;
  }>;
}

function encodedTopology(
  project: ReturnType<typeof createProjectDocument>,
  routeKey: string,
  biomeKey: string,
): { readonly document: EncodedProject; readonly topology: EncodedTopology } {
  const document = JSON.parse(encodeProjectDocument(project)) as EncodedProject;
  const topology = document.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey)?.topology;
  if (topology === null || topology === undefined) throw new Error(`missing ${biomeKey} topology`);
  return { document, topology };
}

function selectedFTakeoverProject() {
  let project = applyProjectCommand(fProject(), catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: createOccurrenceId('f-start'),
    gameName: 'F_Opening01',
  });
  const openingDecision = createExitDecisionAddress(fBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('f-start'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: openingDecision,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
    occurrenceId: createOccurrenceId('f-combat'),
    gameName: 'F_Combat02',
  });
  const combatDecision = createExitDecisionAddress(fBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('f-combat'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: combatDecision,
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('f-preboss-shop'),
      exit2: createOccurrenceId('f-preboss-free'),
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(fBiome, combatDecision.source),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  return { project, combatDecision };
}

function projectWithForcedPrebossFreeOffer(input: {
  readonly project: ReturnType<typeof createProjectDocument>;
  readonly biome: ReturnType<typeof createBiomeAddress>;
  readonly startOccurrenceId: string;
  readonly startGameName?: string;
  readonly combatGameName: string;
  readonly prebossGameName: string;
  readonly normalExitKeys: readonly string[];
}) {
  let project = applyProjectCommand(input.project, catalog, {
    kind: 'CreateStart',
    biome: input.biome,
    occurrenceId: createOccurrenceId(input.startOccurrenceId),
    ...(input.startGameName === undefined ? {} : { gameName: input.startGameName }),
  });
  const startDecision = createExitDecisionAddress(input.biome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId(input.startOccurrenceId),
  });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: startDecision });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(input.biome, startDecision.source),
    storeKey: 'MetaProgress',
  });
  const combatId = createOccurrenceId(`${input.startOccurrenceId}-combat`);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(input.biome, startDecision.source, 'exit1'),
    occurrenceId: combatId,
    gameName: input.combatGameName,
  });
  const decision = createExitDecisionAddress(input.biome, {
    kind: 'occurrence',
    occurrenceId: combatId,
  });
  const targetOccurrenceIds = Object.fromEntries(
    input.normalExitKeys.map((exitKey, index) => [
      exitKey,
      createOccurrenceId(`${input.startOccurrenceId}-preboss-${index + 1}`),
    ]),
  ) as Readonly<Record<string, ReturnType<typeof createOccurrenceId>>>;
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision,
    gameName: input.prebossGameName,
    targetOccurrenceIds,
  });
  return { project, freeOccurrenceId: targetOccurrenceIds.exit2 };
}

function createBatchTargets(
  project: ReturnType<typeof createProjectDocument>,
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
) {
  const decision = createExitDecisionAddress(input.biome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId(input.sourceOccurrenceId),
  });
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
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

function completeHProject() {
  let project = applyProjectCommand(hProject(), catalog, {
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
    project = createBatchTargets(project, {
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
  const prebossDecision = createExitDecisionAddress(hBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('complete-h-07'),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: prebossDecision,
    gameName: 'H_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('complete-h-preboss-shop'),
      exit2: createOccurrenceId('complete-h-preboss-free'),
    },
  });
}

function completeOProject() {
  let project = applyProjectCommand(surfaceProject(2), catalog, {
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
    project = createBatchTargets(project, {
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
  const prebossDecision = createExitDecisionAddress(oBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('complete-o-6'),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: prebossDecision,
    gameName: 'O_PreBoss01',
    targetOccurrenceIds: { exit1: createOccurrenceId('complete-o-preboss') },
  });
}

function completeQProject() {
  let project = applyProjectCommand(surfaceProject(4), catalog, {
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
    project = createBatchTargets(project, {
      biome: qBiome,
      sourceOccurrenceId,
      targets: [{ exitKey: 'exit1', occurrenceId, gameName }],
    });
  }
  const prebossDecision = createExitDecisionAddress(qBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('complete-q-second-miniboss'),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: prebossDecision,
    gameName: 'Q_PreBoss01',
    targetOccurrenceIds: { exit1: createOccurrenceId('complete-q-preboss') },
  });
}

function unresolvedFProject() {
  let project = applyProjectCommand(fProject(), catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: createOccurrenceId('round-trip-f-start'),
    gameName: 'F_Opening01',
  });
  const decision = createExitDecisionAddress(fBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('round-trip-f-start'),
  });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  return project;
}

function completeNProject() {
  let project = applyProjectCommand(nProject(), catalog, {
    kind: 'CreateStart',
    biome: nBiome,
    occurrenceId: createOccurrenceId('round-trip-n-opening'),
  });
  const openingDecision = createExitDecisionAddress(nBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('round-trip-n-opening'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateLinkedExit',
    decision: openingDecision,
    occurrenceId: createOccurrenceId('round-trip-n-prehub'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateHubDecision',
    hub: createHubDecisionAddress(nBiome, 'hub'),
  });
  for (let index = 1; index <= 9; index += 1) {
    const slotKey = `combat${String(index).padStart(2, '0')}`;
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', slotKey),
      occurrenceId: createOccurrenceId(`round-trip-n-${slotKey}`),
    });
  }
  for (let index = 1; index <= 6; index += 1) {
    project = applyProjectCommand(project, catalog, {
      kind: 'AppendHubVisit',
      visit: createHubVisitAddress(nBiome, 'hub', index),
      hubSlotKey: `combat${String(index).padStart(2, '0')}`,
    });
  }
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    }),
    gameName: 'N_PreBoss01',
    targetOccurrenceIds: { preboss: createOccurrenceId('round-trip-n-preboss') },
  });
}

describe('authored-project commands and topology', () => {
  it('resolves linked and completed-Hub physical exits from core declaration authority', () => {
    const project = completeNProject();
    const topology = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    const layout = catalog.biomeLayouts.byKey.N;
    if (topology === null || topology === undefined || layout === undefined) {
      throw new Error('N topology and layout are required for physical-exit coverage');
    }
    expect(
      declaredPhysicalExits(catalog, layout, topology, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('round-trip-n-opening'),
      }),
    ).toEqual([
      {
        kind: 'linked',
        exitKey: 'prehub',
        index: 1,
        type: 'N_OpeningDoor',
        compatibilityPolicyKey: 'Unconstrained',
      },
    ]);
    expect(
      declaredPhysicalExits(catalog, layout, topology, {
        kind: 'hubDecision',
        decisionKey: 'hub',
      }),
    ).toEqual([
      {
        kind: 'completedHub',
        exitKey: 'preboss',
        index: 1,
        type: 'EphyraExitBossDoor',
        compatibilityPolicyKey: 'Unconstrained',
      },
    ]);
    expect(
      fixedPrebossTransitionForSource(catalog, layout, topology, {
        kind: 'hubDecision',
        decisionKey: 'hub',
      }),
    ).toMatchObject({ kind: 'completedHubHandoff', room: { gameName: 'N_PreBoss01' } });
  });

  it('removes the completed-Hub Preboss handoff when a visit truncates the Hub', () => {
    const project = applyProjectCommand(completeNProject(), catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 6),
    });
    const topology = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    if (topology === null || topology === undefined) throw new Error('N topology is required');

    expect(
      topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
    expect(topology.occurrences.some((occurrence) => occurrence.gameName === 'N_PreBoss01')).toBe(
      false,
    );
    expect(topology.decisions.find((decision) => decision.kind === 'hub')).toMatchObject({
      visitOrder: ['combat01', 'combat02', 'combat03', 'combat04', 'combat05'],
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('recognizes O and Q direct Shop-only Prebosses from their selected bounded spine', () => {
    const oOwner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('complete-o-6'),
    });
    const oProject = applyProjectCommand(completeOProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: oOwner,
    });
    const oTopology = oProject.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O')?.topology;
    const oLayout = catalog.biomeLayouts.byKey.O;
    if (oTopology === null || oTopology === undefined || oLayout === undefined) {
      throw new Error('O topology and layout are required for direct Preboss coverage');
    }
    expect(
      directShopOnlyPrebossForSource(catalog, oLayout, oTopology, oOwner.source),
    ).toMatchObject({
      gameName: 'O_PreBoss01',
    });
    expect(
      fixedPrebossTransitionForSource(catalog, oLayout, oTopology, oOwner.source),
    ).toMatchObject({ kind: 'shopOnlyDirectPreboss', room: { gameName: 'O_PreBoss01' } });
    expect(
      directShopOnlyPrebossForSource(catalog, oLayout, oTopology, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('complete-o-5'),
      }),
    ).toBeUndefined();

    const qOwner = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('complete-q-second-miniboss'),
    });
    const qWithoutPreboss = applyProjectCommand(completeQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: qOwner,
    });
    const encoded = JSON.parse(encodeProjectDocument(qWithoutPreboss)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{ biomeKey: string; topology: { decisions: unknown[] } | null }>;
      }>;
    };
    const encodedTopology = encoded.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'Q')?.topology;
    if (encodedTopology === null || encodedTopology === undefined) {
      throw new Error('Q topology is required for selected-spine coverage');
    }
    encodedTopology.decisions.reverse();
    const qProject = decodeProjectDocument(encoded, catalog);
    const qTopology = qProject.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'Q')?.topology;
    const qLayout = catalog.biomeLayouts.byKey.Q;
    if (qTopology === null || qTopology === undefined || qLayout === undefined) {
      throw new Error('Q reordered topology and layout are required for direct Preboss coverage');
    }
    expect(
      directShopOnlyPrebossForSource(catalog, qLayout, qTopology, qOwner.source),
    ).toMatchObject({
      gameName: 'Q_PreBoss01',
    });
    expect(
      fixedPrebossTransitionForSource(catalog, qLayout, qTopology, qOwner.source),
    ).toMatchObject({ kind: 'shopOnlyDirectPreboss', room: { gameName: 'Q_PreBoss01' } });
    expect(
      directShopOnlyPrebossForSource(catalog, qLayout, qTopology, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('complete-q-second-fork'),
      }),
    ).toBeUndefined();
  });

  it('keeps command-produced decision variants stable through codec round trips', () => {
    const variants = [
      ['unresolved authored-store normal batch', unresolvedFProject()],
      [
        'derived and selected multi-door authored-store batches',
        selectedFTakeoverProject().project,
      ],
      ['Fields no-store batch state', completeHProject()],
      ['source-offer-point batch state', completeOProject()],
      ['staged no-store normal batch', completeQProject()],
      ['linked PreHub, Hub decision, and Hub-source takeover', completeNProject()],
    ] as const;
    for (const [name, project] of variants) {
      expect(
        decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog),
        `codec round trip failed for ${name}`,
      ).toEqual(project);
    }
  });

  it('requires topology null until an authored start exists and preserves selected starts', () => {
    let project = fProject();
    expect(project.routes[0]?.biomes[0]).toMatchObject({ biomeKey: 'F', topology: null });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('f-opening'),
      gameName: 'F_Opening02',
    });
    expect(fTopology(project)).toMatchObject({
      startOccurrenceId: 'f-opening',
      occurrences: [{ occurrenceId: 'f-opening', gameName: 'F_Opening02' }],
      decisions: [],
    });
    const malformed = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{ topology: { startOccurrenceId: string } | null }>;
      }>;
    };
    const fPlan = malformed.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.topology !== null);
    if (fPlan?.topology === null || fPlan?.topology === undefined) {
      throw new Error('missing encoded F topology');
    }
    fPlan.topology.startOccurrenceId = 'missing-start';
    expect(() => decodeProjectDocument(malformed, catalog)).toThrow(ProjectDocumentContractError);
  });

  it('keeps ordinary batches progressive and selection declaration-derived at width one', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('f-start'),
      gameName: 'F_Opening01',
    });
    const decision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('f-start'),
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    expect(fTopology(project).decisions[0]).toMatchObject({
      normal: { kind: 'batch', targets: [] },
      selection: { kind: 'unresolved' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, decision.source, 'exit1'),
      occurrenceId: createOccurrenceId('f-combat'),
      gameName: 'F_Combat02',
    });
    expect(fTopology(project).decisions[0]).toMatchObject({
      selection: { kind: 'derived' },
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: 'f-combat' }] },
    });
  });

  it('canonicalizes normal targets in declaration-owned physical exit order', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('ordered-opening'),
      gameName: 'F_Opening01',
    });
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('ordered-opening'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('ordered-source'),
      gameName: 'F_Combat02',
    });
    const sourceDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('ordered-source'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: sourceDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, sourceDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit2'),
      occurrenceId: createOccurrenceId('ordered-exit2'),
      gameName: 'F_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('ordered-exit1'),
      gameName: 'F_Combat03',
    });
    const source = fTopology(project).decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === 'ordered-source',
    );
    if (source?.kind !== 'exit' || source.normal.kind !== 'batch') {
      throw new Error('missing ordered source batch');
    }
    expect(source.normal.targets.map((target) => target.exitKey)).toEqual(['exit1', 'exit2']);

    const reordered = encodedTopology(project, 'Underworld', 'F');
    const encodedSource = reordered.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'ordered-source',
    );
    if (encodedSource === undefined) throw new Error('missing encoded ordered source batch');
    (encodedSource.normal as { targets: unknown[] }).targets.reverse();
    const decoded = decodeProjectDocument(reordered.document, catalog);
    const decodedSource = fTopology(decoded).decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === 'ordered-source',
    );
    if (decodedSource?.kind !== 'exit' || decodedSource.normal.kind !== 'batch') {
      throw new Error('missing decoded ordered batch');
    }
    expect(decodedSource.normal.targets.map((target) => target.exitKey)).toEqual([
      'exit1',
      'exit2',
    ]);
  });

  it('creates an atomic declaration-ordered takeover batch with Shop then free offers', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('f-start'),
      gameName: 'F_Opening01',
    });
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('f-start'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('f-combat'),
      gameName: 'F_Combat02',
    });
    const combatDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('f-combat'),
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTakeoverBatch',
        decision: combatDecision,
        gameName: 'F_PreBoss01',
        targetOccurrenceIds: { exit1: createOccurrenceId('partial-preboss') },
      }),
    ).toThrow(ProjectCommandContractError);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: combatDecision,
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('f-preboss-shop'),
        exit2: createOccurrenceId('f-preboss-free'),
      },
    });
    const topology = fTopology(project);
    const takeover = topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === 'f-combat',
    );
    expect(takeover).toMatchObject({
      selection: { kind: 'unresolved' },
      normal: {
        targets: [
          { exitKey: 'exit1', occurrenceId: 'f-preboss-shop' },
          { exitKey: 'exit2', occurrenceId: 'f-preboss-free' },
        ],
      },
    });
    expect(
      topology.occurrences.find((occurrence) => occurrence.occurrenceId === 'f-preboss-shop')?.state
        .kind,
    ).toBe('shop');
    expect(
      topology.occurrences.find((occurrence) => occurrence.occurrenceId === 'f-preboss-free')?.state
        .kind,
    ).toBe('freeReward');
    expect(
      topology.occurrences.find((occurrence) => occurrence.occurrenceId === 'f-preboss-shop')
        ?.state,
    ).toEqual({ kind: 'shop' });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, combatDecision.source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
      )?.state,
    ).toMatchObject({ kind: 'shop', shop: expect.any(Object) });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetShopPurchase',
      purchase: createShopPurchaseAddress(fBiome, createOccurrenceId('f-preboss-shop'), 'Boon'),
      purchased: true,
    });
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
      )?.state,
    ).toMatchObject({ kind: 'shop', shop: { offers: { Boon: { purchased: true } } } });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, combatDecision.source),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
      )?.state,
    ).toEqual({ kind: 'shop' });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(fBiome, combatDecision.source, 'exit1'),
        occurrenceId: createOccurrenceId('bad'),
        gameName: 'F_Combat01',
      }),
    ).toThrow(ProjectCommandContractError);
  });

  it('derives N fixed start identity and progressively creates linked PreHub, Hub, and its width-one exit', () => {
    expect(() =>
      applyProjectCommand(nProject(), catalog, {
        kind: 'CreateStart',
        biome: nBiome,
        occurrenceId: createOccurrenceId('n-opening'),
        gameName: 'N_Combat01',
      }),
    ).toThrow(ProjectCommandContractError);
    let project = applyProjectCommand(nProject(), catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: createOccurrenceId('n-opening'),
    });
    const openingDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('n-opening'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateLinkedExit',
      decision: openingDecision,
      occurrenceId: createOccurrenceId('n-prehub'),
    });
    const hub = createHubDecisionAddress(nBiome, 'hub');
    project = applyProjectCommand(project, catalog, { kind: 'CreateHubDecision', hub });
    for (let index = 1; index <= 9; index += 1) {
      const slotKey = `combat${String(index).padStart(2, '0')}`;
      project = applyProjectCommand(project, catalog, {
        kind: 'OpenHubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', slotKey),
        occurrenceId: createOccurrenceId(`n-${slotKey}`),
      });
    }
    for (let index = 1; index <= 6; index += 1) {
      const slotKey = `combat${String(index).padStart(2, '0')}`;
      project = applyProjectCommand(project, catalog, {
        kind: 'AppendHubVisit',
        visit: createHubVisitAddress(nBiome, 'hub', index),
        hubSlotKey: slotKey,
      });
    }
    const handoff = createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: handoff,
      gameName: 'N_PreBoss01',
      targetOccurrenceIds: { preboss: createOccurrenceId('n-preboss') },
    });
    const plan = project.routes.find((route) => route.routeKey === 'Surface')?.biomes[0];
    expect(plan?.topology).toMatchObject({
      startOccurrenceId: 'n-opening',
      occurrences: expect.arrayContaining([
        expect.objectContaining({ occurrenceId: 'n-opening', gameName: 'N_Opening01' }),
        expect.objectContaining({ occurrenceId: 'n-prehub', gameName: 'N_PreHub01' }),
        expect.objectContaining({
          occurrenceId: 'n-preboss',
          gameName: 'N_PreBoss01',
          state: expect.objectContaining({ kind: 'shop' }),
        }),
      ]),
    });
    const reordered = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{ topology: { decisions: unknown[] } | null }>;
      }>;
    };
    const nPlan = reordered.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.topology !== null);
    if (nPlan?.topology === null || nPlan?.topology === undefined) {
      throw new Error('missing encoded N topology');
    }
    nPlan.topology.decisions.reverse();
    expect(decodeProjectDocument(reordered, catalog).routes).toHaveLength(2);

    const additionalLinkedExit = encodedTopology(project, 'Surface', 'N');
    const linkedExit = additionalLinkedExit.topology.decisions.find(
      (decision) => (decision.normal as { kind?: string }).kind === 'linked',
    );
    const preHub = additionalLinkedExit.topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'n-prehub',
    );
    if (linkedExit === undefined || preHub === undefined) throw new Error('missing linked PreHub');
    additionalLinkedExit.topology.occurrences.push({
      ...preHub,
      occurrenceId: 'n-extra-prehub',
    });
    additionalLinkedExit.topology.decisions.push({
      ...linkedExit,
      source: { kind: 'occurrence', occurrenceId: 'n-prehub' },
      normal: {
        ...(linkedExit.normal as Record<string, unknown>),
        occurrenceId: 'n-extra-prehub',
      },
    });
    expect(() => decodeProjectDocument(additionalLinkedExit.document, catalog)).toThrow(
      /exactly one linked PreHub exit/,
    );

    const staleHubSource = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{ topology: { decisions: Array<Record<string, unknown>> } | null }>;
      }>;
    };
    const staleNTopology = staleHubSource.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.topology !== null)?.topology;
    const staleHandoff = staleNTopology?.decisions.find((decision) => decision.kind === 'exit');
    if (staleHandoff === undefined) throw new Error('missing completed-Hub handoff');
    staleHandoff.source = { kind: 'hub', hubKey: 'hub' };
    expect(() => decodeProjectDocument(staleHubSource, catalog)).toThrow(
      ProjectDocumentContractError,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveExitDecision',
      decision: openingDecision,
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Surface')?.biomes[0]?.topology,
    ).toMatchObject({
      occurrences: [{ occurrenceId: 'n-opening' }],
      decisions: [],
    });
  });

  it('clears every persisted N topology member through the shared clear impact', () => {
    const project = applyProjectCommand(completeNProject(), catalog, {
      kind: 'ClearTopology',
      biome: nBiome,
    });

    expect(
      project.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology,
    ).toBeNull();
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('addresses selection by semantic decision source and rejects absent target choices', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('f-start'),
      gameName: 'F_Opening01',
    });
    const decision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('f-start'),
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(fBiome, decision.source),
        value: { kind: 'normal', exitKey: 'exit1' },
      }),
    ).toThrow(ProjectCommandContractError);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, decision.source, 'exit1'),
      occurrenceId: createOccurrenceId('f-only-target'),
      gameName: 'F_Combat02',
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(fBiome, decision.source),
        value: { kind: 'normal', exitKey: 'exit1' },
      }),
    ).toThrow(ProjectCommandContractError);
  });

  it('uses the H Preboss declaration store when its normal batch has no store', () => {
    let project = applyProjectCommand(hProject(), catalog, {
      kind: 'CreateStart',
      biome: hBiome,
      occurrenceId: createOccurrenceId('h-intro'),
    });
    const introDecision = createExitDecisionAddress(hBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('h-intro'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision: introDecision,
      cageOutcome: 'min',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(hBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('h-combat'),
      gameName: 'H_Combat02',
    });
    const combatDecision = createExitDecisionAddress(hBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('h-combat'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: combatDecision,
      gameName: 'H_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('h-preboss-shop'),
        exit2: createOccurrenceId('h-preboss-free'),
      },
    });
    expect(
      project.routes[0]?.biomes[2]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'h-preboss-free',
      )?.state,
    ).toMatchObject({ kind: 'freeReward', offer: { rewardType: expect.any(String) } });
  });

  it('lets declaration-owned stores override an ordinary batch store on creation and replacement', () => {
    const createMetaBatch = () => {
      let project = applyProjectCommand(fProject(), catalog, {
        kind: 'CreateStart',
        biome: fBiome,
        occurrenceId: createOccurrenceId('forced-store-opening'),
        gameName: 'F_Opening01',
      });
      const decision = createExitDecisionAddress(fBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('forced-store-opening'),
      });
      project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
        storeKey: 'MetaProgress',
      });
      return { project, decision };
    };
    const forcedRoom = catalog.rooms.byKey.F_Combat01;
    if (forcedRoom?.incomingReward.kind !== 'countedChoice') {
      throw new Error('F_Combat01 must declare its counted reward binding');
    }
    const expectedState = {
      kind: 'counted' as const,
      offer: forcedRoom.incomingReward.defaultOffersByStore.RunProgress,
    };

    let direct = createMetaBatch();
    direct = {
      ...direct,
      project: applyProjectCommand(direct.project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(fBiome, direct.decision.source, 'exit1'),
        occurrenceId: createOccurrenceId('forced-store-direct'),
        gameName: 'F_Combat01',
      }),
    };
    expect(
      fTopology(direct.project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'forced-store-direct',
      )?.state,
    ).toEqual(expectedState);

    let replacement = createMetaBatch();
    replacement = {
      ...replacement,
      project: applyProjectCommand(replacement.project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(fBiome, replacement.decision.source, 'exit1'),
        occurrenceId: createOccurrenceId('forced-store-replacement'),
        gameName: 'F_Combat02',
      }),
    };
    replacement = {
      ...replacement,
      project: applyProjectCommand(replacement.project, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(fBiome, createOccurrenceId('forced-store-replacement')),
        gameName: 'F_Combat01',
      }),
    };
    expect(
      fTopology(replacement.project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'forced-store-replacement',
      )?.state,
    ).toEqual(expectedState);
  });

  it.each([
    ['H', completeHProject, 4, 7],
    ['O', completeOProject, 6, 6],
    ['Q', completeQProject, 6, 6],
  ] as const)(
    'does not count the complete %s takeover batch against ordinary progression bounds',
    (_biomeKey, createCompleteProject, ordinaryBatchCount, ordinaryTargetCount) => {
      const project = createCompleteProject();
      const document = JSON.parse(encodeProjectDocument(project));
      expect(() => decodeProjectDocument(document, catalog)).not.toThrow();
      const topology = project.routes
        .flatMap((route) => route.biomes)
        .find((biome) => biome.biomeKey === _biomeKey)?.topology;
      const ordinary = topology?.decisions.flatMap((decision) => {
        if (decision.kind !== 'exit' || decision.normal.kind !== 'batch') return [];
        const isTakeover = decision.normal.targets.some((target) =>
          topology.occurrences
            .find((occurrence) => occurrence.occurrenceId === target.occurrenceId)
            ?.gameName.endsWith('PreBoss01'),
        );
        return isTakeover ? [] : [decision.normal];
      });
      expect(ordinary).toHaveLength(ordinaryBatchCount);
      expect(ordinary?.flatMap((batch) => batch.targets)).toHaveLength(ordinaryTargetCount);
    },
  );

  it.each([
    {
      name: 'F',
      project: fProject(),
      biome: fBiome,
      startOccurrenceId: 'forced-f-start',
      startGameName: 'F_Opening01',
      combatGameName: 'F_Combat02',
      prebossGameName: 'F_PreBoss01',
      normalExitKeys: ['exit1', 'exit2'],
    },
    {
      name: 'G',
      project: gProject(),
      biome: gBiome,
      startOccurrenceId: 'forced-g-start',
      combatGameName: 'G_Combat02',
      prebossGameName: 'G_PreBoss01',
      normalExitKeys: ['exit1', 'exit2', 'exit3'],
    },
    {
      name: 'P',
      project: surfaceProject(3),
      biome: createBiomeAddress('Surface', 'P'),
      startOccurrenceId: 'forced-p-start',
      combatGameName: 'P_Combat01',
      prebossGameName: 'P_PreBoss01',
      normalExitKeys: ['exit1', 'exit2'],
    },
  ])('%s Preboss free offers use the declaration-forced RunProgress store', (fixture) => {
    const { project, freeOccurrenceId } = projectWithForcedPrebossFreeOffer(fixture);
    const preboss = catalog.rooms.byKey[fixture.prebossGameName];
    if (
      preboss?.prebossBatchPolicy?.kind !== 'takeOverNormalDoors' ||
      preboss.prebossBatchPolicy.remainingOffers.kind !== 'counted'
    ) {
      throw new Error(`missing counted takeover policy for ${fixture.prebossGameName}`);
    }
    const topology = project.routes
      .find((route) => route.routeKey === fixture.biome.routeKey)
      ?.biomes.find((biome) => biome.biomeKey === fixture.biome.biomeKey)?.topology;
    const free = topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === freeOccurrenceId,
    );
    expect(free?.state).toEqual({
      kind: 'freeReward',
      offer: preboss.prebossBatchPolicy.remainingOffers.reward.defaultOffersByStore.RunProgress,
    });
  });

  it('materializes an ordinary Shop inventory only when the selected exit enters it', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('shop-opening'),
      gameName: 'F_Opening01',
    });
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('shop-opening'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('shop-source'),
      gameName: 'F_Combat02',
    });
    const sourceDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('shop-source'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: sourceDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, sourceDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('shop-peer'),
      gameName: 'F_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit2'),
      occurrenceId: createOccurrenceId('ordinary-shop'),
      gameName: 'F_Shop01',
    });
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'ordinary-shop',
      )?.state,
    ).toEqual({ kind: 'shop' });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, sourceDecision.source),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'ordinary-shop',
      )?.state,
    ).toMatchObject({ kind: 'shop', shop: expect.any(Object) });
  });

  it('replaces a resolved reward-wheel offer without adding a wrapper field', () => {
    let project = applyProjectCommand(surfaceProject(2), catalog, {
      kind: 'CreateStart',
      biome: oBiome,
      occurrenceId: createOccurrenceId('o-wheel-intro'),
    });
    const introDecision = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('o-wheel-intro'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(oBiome, introDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(oBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('o-wheel-combat'),
      gameName: 'O_Combat01',
    });
    const ship = project.routes[1]?.biomes[1]?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'o-wheel-combat',
    );
    if (ship?.state.kind !== 'shipCombat') throw new Error('missing ShipCombat wheel state');
    const wheel1 = ship.state.wheels.wheel1;
    if (wheel1 === undefined) throw new Error('missing first reward wheel');
    const [offerKey, offer] = Object.entries(wheel1.offers)[0] ?? [];
    if (offerKey === undefined || offer === undefined) throw new Error('missing wheel offer');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(
        oBiome,
        createOccurrenceId('o-wheel-combat'),
        'wheel1',
        offerKey,
      ),
      value: offer,
    });
    expect(() =>
      decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog),
    ).not.toThrow();
  });

  it('retains overflow targets until explicit ordinary exit-capacity repair', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('capacity-opening'),
      gameName: 'F_Opening01',
    });
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('capacity-opening'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('capacity-source'),
      gameName: 'F_Combat02',
    });
    const sourceDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('capacity-source'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: sourceDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, sourceDecision.source),
      storeKey: 'RunProgress',
    });
    for (const exitKey of ['exit1', 'exit2']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(fBiome, sourceDecision.source, exitKey),
        occurrenceId: createOccurrenceId(`capacity-${exitKey}`),
        gameName: 'F_Combat01',
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, createOccurrenceId('capacity-source')),
      gameName: 'F_Combat01',
    });
    expect(
      fTopology(project).decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === 'capacity-source',
      ),
    ).toMatchObject({ normal: { targets: [{ exitKey: 'exit1' }, { exitKey: 'exit2' }] } });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReconcileBatchExitCapacity',
      decision: sourceDecision,
    });
    expect(
      fTopology(project).decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === 'capacity-source',
      ),
    ).toMatchObject({ normal: { targets: [{ exitKey: 'exit1' }] } });
  });

  it('retains takeover targets by declaration exit key rather than caller-supplied ID order', () => {
    let project = applyProjectCommand(gProject(), catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: createOccurrenceId('g-intro'),
    });
    const introDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('g-intro'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, introDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('g-combat'),
      gameName: 'G_Combat02',
    });
    const combatDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('g-combat'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: combatDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('g-shop'),
        exit2: createOccurrenceId('g-free-left'),
        exit3: createOccurrenceId('g-free-right'),
      },
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReconcileTakeoverBatch',
        decision: combatDecision,
        gameName: 'G_PreBoss01',
        targetOccurrenceIds: {
          exit1: createOccurrenceId('g-shop'),
          exit2: createOccurrenceId('g-free-right'),
          exit3: createOccurrenceId('g-free-left'),
        },
      }),
    ).toThrow(ProjectCommandContractError);

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(gBiome, createOccurrenceId('g-combat')),
      gameName: 'G_MiniBoss02',
    });
    expect(() =>
      decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog),
    ).not.toThrow();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReconcileTakeoverBatch',
      decision: combatDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: { exit1: createOccurrenceId('g-shop') },
    });
    const repaired = project.routes[0]?.biomes[1]?.topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === 'g-combat',
    );
    expect(repaired).toMatchObject({
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: 'g-shop' }] },
      selection: { kind: 'derived' },
    });
  });

  it('retains compatible ordinary leaves and defaults takeover leaves whose selection contract changes', () => {
    let ordinary = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('retained-opening'),
      gameName: 'F_Opening01',
    });
    const ordinaryDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('retained-opening'),
    });
    ordinary = applyProjectCommand(ordinary, catalog, {
      kind: 'CreateBatch',
      decision: ordinaryDecision,
    });
    ordinary = applyProjectCommand(ordinary, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, ordinaryDecision.source),
      storeKey: 'RunProgress',
    });
    ordinary = applyProjectCommand(ordinary, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, ordinaryDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('retained-combat'),
      gameName: 'F_Combat02',
    });
    const retainedBefore = fTopology(ordinary).occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'retained-combat',
    )?.state;
    ordinary = applyProjectCommand(ordinary, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, createOccurrenceId('retained-combat')),
      gameName: 'F_Combat03',
    });
    expect(
      fTopology(ordinary).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'retained-combat',
      )?.state,
    ).toEqual(retainedBefore);
    expect(
      semanticAddressKey(
        createIncomingRewardAddress(fBiome, createOccurrenceId('retained-combat')),
      ),
    ).toBe('["incomingReward","Underworld","F","retained-combat"]');

    let takeover = applyProjectCommand(gProject(), catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: createOccurrenceId('widening-intro'),
    });
    const introDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('widening-intro'),
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, introDecision.source),
      storeKey: 'RunProgress',
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('widening-source'),
      gameName: 'G_MiniBoss02',
    });
    const takeoverDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('widening-source'),
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: takeoverDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: { exit1: createOccurrenceId('widening-shop') },
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'SetShopPurchase',
      purchase: createShopPurchaseAddress(gBiome, createOccurrenceId('widening-shop'), 'Boon'),
      purchased: true,
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(gBiome, createOccurrenceId('widening-source')),
      gameName: 'G_Combat02',
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'ReconcileTakeoverBatch',
      decision: takeoverDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('widening-shop'),
        exit2: createOccurrenceId('widening-free-2'),
        exit3: createOccurrenceId('widening-free-3'),
      },
    });
    const widenedTopology = takeover.routes[0]?.biomes[1]?.topology;
    expect(widenedTopology?.occurrences).toContainEqual(
      expect.objectContaining({
        occurrenceId: 'widening-shop',
        state: { kind: 'shop' },
      }),
    );
    expect(widenedTopology?.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          occurrenceId: 'widening-free-2',
          state: expect.objectContaining({ kind: 'freeReward' }),
        }),
        expect.objectContaining({
          occurrenceId: 'widening-free-3',
          state: expect.objectContaining({ kind: 'freeReward' }),
        }),
      ]),
    );
  });

  it('rejects malformed structural states without repairing them', () => {
    const { project } = selectedFTakeoverProject();

    const widthOne = encodedTopology(
      applyProjectCommand(fProject(), catalog, {
        kind: 'CreateStart',
        biome: fBiome,
        occurrenceId: createOccurrenceId('f-width-one'),
        gameName: 'F_Opening01',
      }),
      'Underworld',
      'F',
    );
    const widthOneExit = {
      kind: 'exit',
      source: { kind: 'occurrence', occurrenceId: 'f-width-one' },
      normal: {
        kind: 'batch',
        rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
        batchState: null,
        targets: [{ exitKey: 'exit1', occurrenceId: 'f-width-one-target' }],
      },
      selection: { kind: 'normal', exitKey: 'exit1' },
    };
    widthOne.topology.occurrences.push({
      occurrenceId: 'f-width-one-target',
      gameName: 'F_Combat02',
      state: { kind: 'counted', offer: { rewardType: 'Boon' } },
    });
    widthOne.topology.decisions.push(widthOneExit);
    expect(() => decodeProjectDocument(widthOne.document, catalog)).toThrow(
      ProjectDocumentContractError,
    );

    const duplicateSource = encodedTopology(project, 'Underworld', 'F');
    duplicateSource.topology.decisions.push({ ...duplicateSource.topology.decisions[0] });
    expect(() => decodeProjectDocument(duplicateSource.document, catalog)).toThrow(
      ProjectDocumentContractError,
    );

    const inventedExitKey = encodedTopology(project, 'Underworld', 'F');
    const takeover = inventedExitKey.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'f-combat',
    );
    if (takeover === undefined) throw new Error('missing F takeover decision');
    const targets = (takeover.normal as { targets: Array<{ exitKey: string }> }).targets;
    targets[1]!.exitKey = 'banana';
    expect(() => decodeProjectDocument(inventedExitKey.document, catalog)).toThrow(
      ProjectDocumentContractError,
    );

    const deadLeaf = encodedTopology(project, 'Underworld', 'F');
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
    expect(() => decodeProjectDocument(deadLeaf.document, catalog)).toThrow(
      ProjectDocumentContractError,
    );

    const orphan = encodedTopology(project, 'Underworld', 'F');
    orphan.topology.occurrences.push({
      occurrenceId: 'orphan',
      gameName: 'F_Combat02',
      state: { kind: 'counted', offer: { rewardType: 'Boon' } },
    });
    expect(() => decodeProjectDocument(orphan.document, catalog)).toThrow(
      ProjectDocumentContractError,
    );

    const cycle = encodedTopology(project, 'Underworld', 'F');
    const opening = cycle.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'f-start',
    );
    if (opening === undefined) throw new Error('missing F opening decision');
    const openingTargets = (opening.normal as { targets: Array<{ occurrenceId: string }> }).targets;
    openingTargets[0]!.occurrenceId = 'f-start';
    expect(() => decodeProjectDocument(cycle.document, catalog)).toThrow(/decision cycle/);

    const multiplyOwned = encodedTopology(project, 'Underworld', 'F');
    const multiplyOwnedTakeover = multiplyOwned.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'f-combat',
    );
    if (multiplyOwnedTakeover === undefined) throw new Error('missing F takeover decision');
    const takeoverTargets = (
      multiplyOwnedTakeover.normal as { targets: Array<{ occurrenceId: string }> }
    ).targets;
    takeoverTargets[1]!.occurrenceId = 'f-preboss-shop';
    expect(() => decodeProjectDocument(multiplyOwned.document, catalog)).toThrow(
      /multiple structural owners/,
    );

    const obsoleteRole = encodedTopology(project, 'Underworld', 'F');
    const shop = obsoleteRole.topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
    );
    if (shop === undefined) throw new Error('missing takeover Shop occurrence');
    shop.state = { kind: 'terminalShop' };
    expect(() => decodeProjectDocument(obsoleteRole.document, catalog)).toThrow(
      ProjectDocumentContractError,
    );

    let nProjectWithHub = applyProjectCommand(nProject(), catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: createOccurrenceId('malformed-n-opening'),
    });
    const nOpeningDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('malformed-n-opening'),
    });
    nProjectWithHub = applyProjectCommand(nProjectWithHub, catalog, {
      kind: 'CreateLinkedExit',
      decision: nOpeningDecision,
      occurrenceId: createOccurrenceId('malformed-n-prehub'),
    });
    expect(() =>
      applyProjectCommand(nProjectWithHub, catalog, {
        kind: 'CreateBatch',
        decision: createExitDecisionAddress(nBiome, {
          kind: 'occurrence',
          occurrenceId: createOccurrenceId('malformed-n-prehub'),
        }),
      }),
    ).toThrow(ProjectCommandContractError);
    nProjectWithHub = applyProjectCommand(nProjectWithHub, catalog, {
      kind: 'CreateHubDecision',
      hub: createHubDecisionAddress(nBiome, 'hub'),
    });
    const malformedHub = encodedTopology(nProjectWithHub, 'Surface', 'N');
    const hub = malformedHub.topology.decisions.find((decision) => decision.kind === 'hub');
    if (hub === undefined) throw new Error('missing Hub decision');
    hub.openTargets = [{ hubSlotKey: 'combat01', occurrenceId: 'missing-hub-target' }];
    expect(() => decodeProjectDocument(malformedHub.document, catalog)).toThrow(
      ProjectDocumentContractError,
    );
  });

  it('records common structural commands as semantic history and preserves compatible takeover state', () => {
    let fHistory = createProjectHistory(fProject());
    const start = {
      kind: 'CreateStart' as const,
      biome: fBiome,
      occurrenceId: createOccurrenceId('history-start'),
      gameName: 'F_Opening01',
    };
    fHistory = applyProjectHistoryCommand(fHistory, catalog, start);
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('history-start'),
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
      storeKey: 'RunProgress',
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('history-combat'),
      gameName: 'F_Combat02',
    });
    const combatDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('history-combat'),
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: combatDecision,
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('history-shop'),
        exit2: createOccurrenceId('history-free'),
      },
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, combatDecision.source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'SetShopPurchase',
      purchase: createShopPurchaseAddress(fBiome, createOccurrenceId('history-shop'), 'Boon'),
      purchased: true,
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'ReconcileTakeoverBatch',
      decision: combatDecision,
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('history-shop'),
        exit2: createOccurrenceId('history-free'),
      },
    });
    expect(
      fHistory.present.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'history-shop',
      )?.state,
    ).toMatchObject({ kind: 'shop', shop: { offers: { Boon: { purchased: true } } } });
    const beforeUndo = fHistory.present;
    fHistory = undoProjectHistory(fHistory);
    expect(fHistory.present).not.toEqual(beforeUndo);
    fHistory = redoProjectHistory(fHistory);
    expect(fHistory.present).toEqual(beforeUndo);

    let nHistory = createProjectHistory(nProject());
    nHistory = applyProjectHistoryCommand(nHistory, catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: createOccurrenceId('history-opening'),
    });
    const nOpeningDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('history-opening'),
    });
    nHistory = applyProjectHistoryCommand(nHistory, catalog, {
      kind: 'CreateLinkedExit',
      decision: nOpeningDecision,
      occurrenceId: createOccurrenceId('history-prehub'),
    });
    nHistory = applyProjectHistoryCommand(nHistory, catalog, {
      kind: 'CreateHubDecision',
      hub: createHubDecisionAddress(nBiome, 'hub'),
    });
    const hubbed = nHistory.present;
    nHistory = undoProjectHistory(nHistory);
    nHistory = undoProjectHistory(nHistory);
    nHistory = undoProjectHistory(nHistory);
    expect(
      nHistory.present.routes.find((route) => route.routeKey === 'Surface')?.biomes[0],
    ).toMatchObject({
      topology: null,
    });
    nHistory = redoProjectHistory(redoProjectHistory(redoProjectHistory(nHistory)));
    expect(nHistory.present).toEqual(hubbed);
  });

  it('keeps I Preboss in the ordinary batch but respects its one-creation-per-source policy', () => {
    let project = applyProjectCommand(iProject(), catalog, {
      kind: 'CreateStart',
      biome: iBiome,
      occurrenceId: createOccurrenceId('i-intro'),
    });
    const decision = createExitDecisionAddress(iBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('i-intro'),
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, decision.source, 'exit1'),
      occurrenceId: createOccurrenceId('i-two-exit-combat'),
      gameName: 'I_Combat01',
    });
    const twoExitDecision = createExitDecisionAddress(iBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('i-two-exit-combat'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: twoExitDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, twoExitDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('i-preboss'),
      gameName: 'I_PreBoss02',
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[3]?.topology
        ?.occurrences,
    ).toContainEqual(
      expect.objectContaining({
        occurrenceId: 'i-preboss',
        state: expect.objectContaining({ kind: 'shop', shop: expect.any(Object) }),
      }),
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(iBiome, twoExitDecision.source, 'exit2'),
        occurrenceId: createOccurrenceId('i-second-preboss'),
        gameName: 'I_PreBoss02',
      }),
    ).toThrow(ProjectCommandContractError);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, twoExitDecision.source, 'exit2'),
      occurrenceId: createOccurrenceId('i-peer'),
      gameName: 'I_Combat02',
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[3]?.topology
        ?.occurrences,
    ).toContainEqual(
      expect.objectContaining({ occurrenceId: 'i-preboss', state: { kind: 'shop' } }),
    );
  });

  it('derives Q stages from the selected batch spine after decisions are reordered', () => {
    let project = applyProjectCommand(surfaceProject(4), catalog, {
      kind: 'CreateStart',
      biome: qBiome,
      occurrenceId: createOccurrenceId('q-reordered-intro'),
    });
    const introDecision = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('q-reordered-intro'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(qBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('q-reordered-foyer'),
      gameName: 'Q_Combat10',
    });
    const foyerDecision = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('q-reordered-foyer'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: foyerDecision,
    });

    const reordered = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{ biomeKey: string; topology: { decisions: unknown[] } | null }>;
      }>;
    };
    const qTopology = reordered.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'Q')?.topology;
    if (qTopology === null || qTopology === undefined)
      throw new Error('missing encoded Q topology');
    qTopology.decisions.reverse();
    project = decodeProjectDocument(reordered, catalog);

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(qBiome, createOccurrenceId('q-reordered-foyer')),
      gameName: 'Q_Combat11',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(qBiome, foyerDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('q-reordered-first-fork'),
      gameName: 'Q_Combat03',
    });
    const topology = project.routes[1]?.biomes[3]?.topology;
    expect(topology?.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          occurrenceId: 'q-reordered-foyer',
          gameName: 'Q_Combat11',
        }),
        expect.objectContaining({
          occurrenceId: 'q-reordered-first-fork',
          gameName: 'Q_Combat03',
        }),
      ]),
    );
  });

  it('keeps staged candidate pools and Ship encounter counts valid after occurrence replacement', () => {
    let qProject = applyProjectCommand(surfaceProject(4), catalog, {
      kind: 'CreateStart',
      biome: qBiome,
      occurrenceId: createOccurrenceId('q-intro'),
    });
    const qIntroDecision = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('q-intro'),
    });
    qProject = applyProjectCommand(qProject, catalog, {
      kind: 'CreateBatch',
      decision: qIntroDecision,
    });
    qProject = applyProjectCommand(qProject, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(qBiome, qIntroDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('q-foyer'),
      gameName: 'Q_Combat10',
    });
    const qFoyerDecision = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('q-foyer'),
    });
    qProject = applyProjectCommand(qProject, catalog, {
      kind: 'CreateBatch',
      decision: qFoyerDecision,
    });
    qProject = applyProjectCommand(qProject, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(qBiome, qFoyerDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('q-first-fork'),
      gameName: 'Q_Combat03',
    });
    expect(() =>
      applyProjectCommand(qProject, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(qBiome, createOccurrenceId('q-first-fork')),
        gameName: 'Q_Combat02',
      }),
    ).toThrow(ProjectCommandContractError);
    qProject = applyProjectCommand(qProject, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(qBiome, createOccurrenceId('q-first-fork')),
      gameName: 'Q_Combat05',
    });
    expect(
      qProject.routes.find((route) => route.routeKey === 'Surface')?.biomes[3]?.topology
        ?.occurrences,
    ).toContainEqual(expect.objectContaining({ gameName: 'Q_Combat05' }));

    let oProject = applyProjectCommand(surfaceProject(2), catalog, {
      kind: 'CreateStart',
      biome: oBiome,
      occurrenceId: createOccurrenceId('o-intro'),
    });
    const oIntroDecision = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('o-intro'),
    });
    oProject = applyProjectCommand(oProject, catalog, {
      kind: 'CreateBatch',
      decision: oIntroDecision,
    });
    oProject = applyProjectCommand(oProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(oBiome, oIntroDecision.source),
      storeKey: 'RunProgress',
    });
    oProject = applyProjectCommand(oProject, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(oBiome, oIntroDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('o-ship'),
      gameName: 'O_Combat01',
    });
    oProject = applyProjectCommand(oProject, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, createOccurrenceId('o-ship')),
      encounterCount: 3,
    });
    expect(
      oProject.routes.find((route) => route.routeKey === 'Surface')?.biomes[1]?.topology
        ?.occurrences,
    ).toContainEqual(
      expect.objectContaining({
        occurrenceId: 'o-ship',
        state: expect.objectContaining({ kind: 'shipCombat', encounterCount: 3 }),
      }),
    );
  });
});
