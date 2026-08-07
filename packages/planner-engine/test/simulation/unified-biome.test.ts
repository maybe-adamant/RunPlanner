import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  evaluateBiome,
  simulateProject,
} from '@run-planner/engine/simulation';

function traitContext(project: ReturnType<typeof createProjectDocument>, routeKey: string) {
  const route = project.routes.find((candidate) => candidate.routeKey === routeKey);
  if (route === undefined) throw new Error(`missing ${routeKey} route`);
  return route.loadout;
}

function selectedFTakeoverProject() {
  const biome = createBiomeAddress('Underworld', 'F');
  let project = createProjectDocument(catalog, {
    projectId: 'unified-f',
    name: 'Unified F',
    configuredBiomeCounts: { Underworld: 1 },
  });
  const startId = createOccurrenceId('f-start');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });
  const opening = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: startId });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: opening });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, opening.source),
    storeKey: 'RunProgress',
  });
  const combatId = createOccurrenceId('f-combat');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, opening.source, 'exit1'),
    occurrenceId: combatId,
    gameName: 'F_Combat02',
  });
  const combat = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: combatId,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: combat,
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('f-preboss-shop'),
      exit2: createOccurrenceId('f-preboss-free'),
    },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, combat.source),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
}

function incompleteFPrefixProject() {
  const biome = createBiomeAddress('Underworld', 'F');
  let project = createProjectDocument(catalog, {
    projectId: 'unified-f-prefix',
    name: 'Unified F prefix',
    configuredBiomeCounts: { Underworld: 1 },
  });
  const startId = createOccurrenceId('f-prefix-start');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });
  const opening = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: startId });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: opening });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, opening.source),
    storeKey: 'MetaProgress',
  });
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, opening.source, 'exit1'),
    occurrenceId: createOccurrenceId('f-prefix-combat'),
    gameName: 'F_Combat02',
  });
}

function createBatchTargets(
  project: ReturnType<typeof createProjectDocument>,
  biome: ReturnType<typeof createBiomeAddress>,
  sourceOccurrenceId: string,
  targets: readonly {
    readonly exitKey: string;
    readonly occurrenceId: string;
    readonly gameName: string;
  }[],
  fieldsCageOutcome?: 'min' | 'max',
  rewardStoreKey?: 'RunProgress' | 'MetaProgress',
  selectedExitKey?: string,
) {
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId(sourceOccurrenceId),
  });
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  if (rewardStoreKey !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, decision.source),
      storeKey: rewardStoreKey,
    });
  }
  if (fieldsCageOutcome !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: fieldsCageOutcome,
    });
  }
  for (const target of targets) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, target.exitKey),
      occurrenceId: createOccurrenceId(target.occurrenceId),
      gameName: target.gameName,
    });
  }
  if (targets.length > 1) {
    next = applyProjectCommand(next, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, decision.source),
      value: { kind: 'normal', exitKey: selectedExitKey ?? targets[0]!.exitKey },
    });
  }
  return next;
}

function withIEncounterSelection(
  project: ReturnType<typeof createProjectDocument>,
  occurrenceId: string,
  encounterKey: string,
) {
  const encoded = JSON.parse(encodeProjectDocument(project)) as {
    routes: Array<{
      routeKey: string;
      biomes: Array<{
        biomeKey: string;
        topology: {
          occurrences: Array<{
            occurrenceId: string;
            encounters: { encounterKeyByPhase: Record<string, string> };
          }>;
        } | null;
      }>;
    }>;
  };
  const occurrence = encoded.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'I')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error(`I fixture lost ${occurrenceId}`);
  occurrence.encounters.encounterKeyByPhase.Encounter = encounterKey;
  return decodeProjectDocument(encoded, catalog);
}

function completeHProject() {
  const biome = createBiomeAddress('Underworld', 'H');
  let project = createProjectDocument(catalog, {
    projectId: 'unified-h',
    name: 'Unified H',
    configuredBiomeCounts: { Underworld: 3 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: createOccurrenceId('h-start'),
  });
  for (const [sourceOccurrenceId, targets] of [
    ['h-start', [['exit1', 'h-02', 'H_Combat02']]],
    [
      'h-02',
      [
        ['exit1', 'h-03', 'H_Combat03'],
        ['exit2', 'h-04', 'H_Combat04'],
      ],
    ],
    [
      'h-03',
      [
        ['exit1', 'h-05', 'H_Combat05'],
        ['exit2', 'h-06', 'H_Combat06'],
      ],
    ],
    [
      'h-05',
      [
        ['exit1', 'h-07', 'H_Combat07'],
        ['exit2', 'h-08', 'H_Combat08'],
      ],
    ],
  ] as const) {
    project = createBatchTargets(
      project,
      biome,
      sourceOccurrenceId,
      targets.map(([exitKey, occurrenceId, gameName]) => ({ exitKey, occurrenceId, gameName })),
      'min',
    );
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('h-07'),
    }),
    gameName: 'H_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('h-preboss-shop'),
      exit2: createOccurrenceId('h-preboss-free'),
    },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('h-07'),
    }),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
}

function completeOProject() {
  const biome = createBiomeAddress('Surface', 'O');
  let project = createProjectDocument(catalog, {
    projectId: 'unified-o',
    name: 'Unified O',
    configuredBiomeCounts: { Surface: 2 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: createOccurrenceId('o-start'),
  });
  for (const [index, gameName] of [
    'O_Combat01',
    'O_Combat02',
    'O_Combat03',
    'O_Combat04',
    'O_Combat05',
    'O_Combat06',
  ].entries()) {
    project = createBatchTargets(
      project,
      biome,
      index === 0 ? 'o-start' : `o-${index}`,
      [{ exitKey: 'exit1', occurrenceId: `o-${index + 1}`, gameName }],
      undefined,
      index === 0 ? 'RunProgress' : undefined,
    );
  }
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('o-6'),
    }),
    gameName: 'O_PreBoss01',
    targetOccurrenceIds: { exit1: createOccurrenceId('o-preboss') },
  });
}

function completeQProject() {
  const biome = createBiomeAddress('Surface', 'Q');
  let project = createProjectDocument(catalog, {
    projectId: 'unified-q',
    name: 'Unified Q',
    configuredBiomeCounts: { Surface: 4 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: createOccurrenceId('q-start'),
  });
  for (const [sourceOccurrenceId, occurrenceId, gameName] of [
    ['q-start', 'q-foyer', 'Q_Combat10'],
    ['q-foyer', 'q-first-fork', 'Q_Combat03'],
  ] as const) {
    project = createBatchTargets(project, biome, sourceOccurrenceId, [
      { exitKey: 'exit1', occurrenceId, gameName },
    ]);
  }
  project = createBatchTargets(project, biome, 'q-first-fork', [
    { exitKey: 'exit1', occurrenceId: 'q-first-miniboss', gameName: 'Q_MiniBoss02' },
    { exitKey: 'exit2', occurrenceId: 'q-first-miniboss-peer', gameName: 'Q_MiniBoss05' },
  ]);
  project = createBatchTargets(project, biome, 'q-first-miniboss', [
    { exitKey: 'exit1', occurrenceId: 'q-ordinary', gameName: 'Q_Combat01' },
  ]);
  project = createBatchTargets(project, biome, 'q-ordinary', [
    { exitKey: 'exit1', occurrenceId: 'q-second-fork', gameName: 'Q_Combat12' },
  ]);
  project = createBatchTargets(project, biome, 'q-second-fork', [
    { exitKey: 'exit1', occurrenceId: 'q-second-miniboss', gameName: 'Q_MiniBoss03' },
    { exitKey: 'exit2', occurrenceId: 'q-second-miniboss-peer', gameName: 'Q_MiniBoss04' },
  ]);
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('q-second-miniboss'),
    }),
    gameName: 'Q_PreBoss01',
    targetOccurrenceIds: { exit1: createOccurrenceId('q-preboss') },
  });
}

function completeIProject() {
  const biome = createBiomeAddress('Underworld', 'I');
  let project = createProjectDocument(catalog, {
    projectId: 'unified-i',
    name: 'Unified I',
    configuredBiomeCounts: { Underworld: 4 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: createOccurrenceId('i-intro'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBiomeField',
    field: createBiomeFieldAddress(biome, 'maxNonGoalRewards'),
    value: 5,
  });
  for (const [source, targets, selectedExitKey] of [
    ['i-intro', [['exit1', 'i-combat01', 'I_Combat01']]],
    [
      'i-combat01',
      [
        ['exit1', 'i-combat03', 'I_Combat03'],
        ['exit2', 'i-story', 'I_Story01'],
      ],
    ],
    [
      'i-combat03',
      [
        ['exit1', 'i-combat04', 'I_Combat04'],
        ['exit2', 'i-combat05', 'I_Combat05'],
      ],
      'exit2',
    ],
    ['i-combat05', [['exit1', 'i-combat09', 'I_Combat09']]],
    [
      'i-combat09',
      [
        ['exit1', 'i-combat10', 'I_Combat10'],
        ['exit2', 'i-combat06', 'I_Combat06'],
      ],
      'exit2',
    ],
    ['i-combat06', [['exit1', 'i-combat11', 'I_Combat11']]],
    [
      'i-combat11',
      [
        ['exit1', 'i-combat12-offered', 'I_Combat12'],
        ['exit2', 'i-combat07', 'I_Combat07'],
      ],
      'exit2',
    ],
    ['i-combat07', [['exit1', 'i-combat12-entered', 'I_Combat12']]],
    [
      'i-combat12-entered',
      [
        ['exit1', 'i-preboss-declined', 'I_PreBoss02'],
        ['exit2', 'i-combat08', 'I_Combat08'],
      ],
      'exit2',
    ],
    ['i-combat08', [['exit1', 'i-preboss-entered', 'I_PreBoss02']]],
  ] as const) {
    project = createBatchTargets(
      project,
      biome,
      source,
      targets.map(([exitKey, occurrenceId, gameName]) => ({ exitKey, occurrenceId, gameName })),
      undefined,
      undefined,
      selectedExitKey,
    );
  }
  for (const [occurrenceId, encounterKey] of [
    ['i-combat01', 'GeneratedI_GoalReward'],
    ['i-combat03', 'GeneratedI_Small_GoalReward'],
    ['i-combat05', 'GeneratedI_Small_GoalReward'],
    ['i-combat09', 'GeneratedI_GoalReward'],
    ['i-combat06', 'GeneratedI_GoalReward'],
  ] as const) {
    project = withIEncounterSelection(project, occurrenceId, encounterKey);
  }
  return project;
}

function completeGProject() {
  const biome = createBiomeAddress('Underworld', 'G');
  let project = createProjectDocument(catalog, {
    projectId: 'unified-g',
    name: 'Unified G',
    configuredBiomeCounts: { Underworld: 2 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: createOccurrenceId('g-intro'),
  });
  project = createBatchTargets(
    project,
    biome,
    'g-intro',
    [{ exitKey: 'exit1', occurrenceId: 'g-combat', gameName: 'G_Combat01' }],
    undefined,
    'RunProgress',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('g-combat'),
    }),
    gameName: 'G_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('g-preboss-shop'),
      exit2: createOccurrenceId('g-preboss-free'),
    },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('g-combat'),
    }),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
}

function completePProject() {
  const biome = createBiomeAddress('Surface', 'P');
  let project = createProjectDocument(catalog, {
    projectId: 'unified-p',
    name: 'Unified P',
    configuredBiomeCounts: { Surface: 3 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: createOccurrenceId('p-intro'),
  });
  project = createBatchTargets(
    project,
    biome,
    'p-intro',
    [
      { exitKey: 'exit1', occurrenceId: 'p-combat', gameName: 'P_Combat01' },
      { exitKey: 'exit2', occurrenceId: 'p-combat-peer', gameName: 'P_Combat02' },
    ],
    undefined,
    'RunProgress',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('p-combat'),
    }),
    gameName: 'P_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('p-preboss-shop'),
      exit2: createOccurrenceId('p-preboss-free'),
    },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('p-combat'),
    }),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
}

function selectedNProject() {
  const biome = createBiomeAddress('Surface', 'N');
  let project = createProjectDocument(catalog, {
    projectId: 'unified-n',
    name: 'Unified N',
    configuredBiomeCounts: { Surface: 1 },
  });
  const openingId = createOccurrenceId('n-opening');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: openingId,
  });
  const opening = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: openingId,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: opening,
  });
  const preHubId = createOccurrenceId('n-prehub');
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, opening.source, 'prehub'),
    occurrenceId: preHubId,
    gameName: 'N_PreHub01',
  });
  const preHub = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: preHubId,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: preHub,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceWithHubDecision',
    decision: preHub,
    hub: createHubDecisionAddress(biome, 'hub'),
  });
  for (let index = 1; index <= 9; index += 1) {
    const slotKey = `combat${String(index).padStart(2, '0')}`;
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(biome, 'hub', slotKey),
      occurrenceId: createOccurrenceId(`n-${slotKey}`),
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub: createHubDecisionAddress(biome, 'hub'),
    hubSlotKeys: ['combat01', 'combat02', 'combat03', 'combat04', 'combat05', 'combat06'],
  });
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(biome, { kind: 'hubDecision', decisionKey: 'hub' }),
    gameName: 'N_PreBoss01',
    targetOccurrenceIds: { preboss: createOccurrenceId('n-preboss') },
  });
}

describe('unified biome simulation', () => {
  it('materializes a selected takeover Preboss as an ordered normal-door batch', () => {
    const project = selectedFTakeoverProject();
    const evaluation = simulateProject(catalog, project);
    const biome = evaluation.routes[0]?.biomes[0];
    expect(biome?.authoring).toBe('complete');
    if (biome?.authoring !== 'complete') throw new Error('F should be complete');
    const takeover = biome.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.targets.every((target) => target.room.gameName === 'F_PreBoss01'),
    );
    expect(takeover).toMatchObject({ kind: 'batch', selectedExitKey: 'exit1' });
    if (takeover?.kind !== 'batch') throw new Error('missing F takeover batch');
    expect(
      takeover.targets.map((target) => [target.exit.exitKey, target.room.entryState?.kind]),
    ).toEqual([
      ['exit1', 'shop'],
      ['exit2', undefined],
    ]);
    expect(takeover.targets.map((target) => target.continuation)).toEqual([
      'startsCompletion',
      'deadLeaf',
    ]);
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    expect(() =>
      candidates.evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(
          createBiomeAddress('Underworld', 'F'),
          { kind: 'occurrence', occurrenceId: createOccurrenceId('f-combat') },
          'exit1',
        ),
        gameName: 'F_PreBoss01',
      }),
    ).toThrow(/source-owned takeover Preboss batch/);
    expect(
      candidates.evaluate({
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
          kind: 'occurrence',
          occurrenceId: createOccurrenceId('f-combat'),
        }),
        gameName: 'F_PreBoss01',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('keeps a structurally complete F prefix evaluated through its next decision frontier', () => {
    const project = incompleteFPrefixProject();
    const evaluation = simulateProject(catalog, project);
    const biome = evaluation.routes[0]?.biomes[0];
    expect(biome?.authoring).toBe('incomplete');
    if (biome?.authoring !== 'incomplete') throw new Error('F prefix should be incomplete');
    expect(biome.coverage.kind).toBe('prefix');
    if (biome.coverage.kind !== 'prefix') throw new Error('F prefix should have coverage');
    if (!('materializedPrefix' in biome)) throw new Error('F prefix should retain its products');
    expect(biome.materializedPrefix.decisions).toHaveLength(1);
    expect(
      biome.history.rooms.flatMap((room) =>
        room.origin.kind === 'occurrence' ? [room.origin.occurrenceId] : [],
      ),
    ).toContain('f-prefix-combat');
    expect(biome.roomGeneration.ordinary.forcePressure).toHaveLength(1);
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const result = candidates.evaluate({
      kind: 'roomTarget',
      target: createTargetAddress(
        createBiomeAddress('Underworld', 'F'),
        { kind: 'occurrence', occurrenceId: createOccurrenceId('f-prefix-combat') },
        'exit1',
      ),
      gameName: 'F_Combat03',
    });
    expect(result.kind).toBe('roomTarget');
    const takeover = candidates.evaluate({
      kind: 'roomTarget',
      target: createTargetAddress(
        createBiomeAddress('Underworld', 'F'),
        { kind: 'occurrence', occurrenceId: createOccurrenceId('f-prefix-combat') },
        'exit1',
      ),
      gameName: 'F_PreBoss01',
    });
    expect(takeover.kind).toBe('roomTarget');
    if (takeover.kind !== 'roomTarget') throw new Error('missing F target candidate result');
    expect(takeover.result.pressure.selectedPossible).toBe(false);
    const takeoverBatch = candidates.evaluate({
      kind: 'takeoverPrebossBatch',
      source: createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('f-prefix-combat'),
      }),
      gameName: 'F_PreBoss01',
    });
    expect(takeoverBatch).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: { requiredExitKeys: ['exit1', 'exit2'] },
    });
  });

  it('clamps an invalid incomplete prefix at its batch owner without discarding authored state', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const project = applyProjectCommand(incompleteFPrefixProject(), catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('f-prefix-start'),
      }),
      storeKey: 'RunProgress',
    });
    const evaluation = simulateProject(catalog, project);
    const result = evaluation.routes[0]?.biomes[0];
    expect(result?.authoring).toBe('incomplete');
    if (result?.authoring !== 'incomplete' || !('materializedPrefix' in result)) {
      throw new Error('invalid F prefix should retain a materialized prefix');
    }
    expect(result.assessmentPrefix?.decisions).toEqual([]);
    expect(result.materializedPrefix.decisions).toHaveLength(1);
    expect(result.coverage).toMatchObject({
      kind: 'prefix',
      blockedAt: createBatchRewardStoreAddress(biome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('f-prefix-start'),
      }),
    });
    expect(result.findings.map((finding) => finding.code)).toContain('continuationMissing');
    expect(result.findings.map((finding) => finding.code)).toContain('baseRewardStoreUnavailable');
    expect(
      project.routes[0]?.biomes[0]?.topology?.occurrences.map(
        (occurrence) => occurrence.occurrenceId,
      ),
    ).toContain('f-prefix-combat');
  });

  it('runs the Fields chain and no-store takeover through the same evaluator', () => {
    const project = completeHProject();
    const plan = project.routes[0]?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (plan === undefined) throw new Error('missing H plan');
    const biome = evaluateBiome(
      catalog,
      'Underworld',
      plan,
      3,
      traitContext(project, 'Underworld'),
    );
    expect(biome.authoring).toBe('complete');
    if (biome.authoring !== 'complete') throw new Error('H should be complete');
    expect(biome.snapshot.decisions.filter((decision) => decision.kind === 'batch')).toHaveLength(
      5,
    );
    const takeover = biome.snapshot.decisions.at(-1);
    expect(takeover).toMatchObject({
      kind: 'batch',
      rewardStore: { kind: 'none' },
      batchState: { kind: 'standard' },
      selectedExitKey: 'exit1',
    });
    expect(biome.history.events.some((event) => event.kind === 'fieldsBatchOutcomeRecorded')).toBe(
      true,
    );
  });

  it('keeps width-one and staged progression in the common batch evaluator', () => {
    const oProject = completeOProject();
    const oPlan = oProject.routes[1]?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (oPlan === undefined) throw new Error('missing O plan');
    const o = evaluateBiome(catalog, 'Surface', oPlan, 2, traitContext(oProject, 'Surface'));
    expect(o.authoring).toBe('complete');
    if (o.authoring !== 'complete') throw new Error('O should be complete');
    expect(o.snapshot.decisions.at(-1)).toMatchObject({
      kind: 'batch',
      rewardStore: { kind: 'sourceOfferPoint' },
      targets: [{ continuation: 'startsCompletion' }],
    });

    const qProject = completeQProject();
    const qPlan = qProject.routes[1]?.biomes.find((candidate) => candidate.biomeKey === 'Q');
    if (qPlan === undefined) throw new Error('missing Q plan');
    const q = evaluateBiome(catalog, 'Surface', qPlan, 4, traitContext(qProject, 'Surface'));
    expect(q.authoring).toBe('complete');
    if (q.authoring !== 'complete') throw new Error('Q should be complete');
    expect(q.snapshot.decisions.filter((decision) => decision.kind === 'batch')).toHaveLength(7);
    expect(
      q.snapshot.decisions
        .filter((decision) => decision.kind === 'batch')
        .map((decision) => decision.rewardStore.kind),
    ).toEqual(['none', 'none', 'none', 'none', 'none', 'none', 'none']);
    if (qPlan.topology === null) throw new Error('Q should have topology');
    const reversed = Object.freeze({
      ...qPlan,
      topology: Object.freeze({
        ...qPlan.topology,
        decisions: Object.freeze([...qPlan.topology.decisions].reverse()),
      }),
    });
    expect(
      evaluateBiome(catalog, 'Surface', reversed, 4, traitContext(qProject, 'Surface')).authoring,
    ).toBe('complete');
  });

  it('derives Clockwork batch state and reward timing from the selected I spine', () => {
    const project = completeIProject();
    const plan = project.routes[0]?.biomes.find((candidate) => candidate.biomeKey === 'I');
    if (plan === undefined) throw new Error('missing I plan');
    const biome = evaluateBiome(
      catalog,
      'Underworld',
      plan,
      4,
      traitContext(project, 'Underworld'),
    );
    expect(biome.authoring).toBe('complete');
    if (biome.authoring !== 'complete') throw new Error('I should be complete');
    expect(
      biome.snapshot.decisions
        .filter((decision) => decision.kind === 'batch')
        .map((decision) => decision.batchState.kind),
    ).toEqual([
      'clockwork',
      'clockwork',
      'clockwork',
      'clockwork',
      'clockwork',
      'clockwork',
      'clockwork',
      'clockwork',
      'clockwork',
      'clockwork',
    ]);
    expect(biome.history.events.some((event) => event.kind === 'clockworkGoalAcquired')).toBe(true);
  });

  it.each([
    ['G', completeGProject(), 'Underworld', 2],
    ['P', completePProject(), 'Surface', 3],
  ] as const)(
    'gives %s takeover batches their declaration-owned shop and free-reward roles',
    (biomeKey, project, routeKey, enteredBiomeCount) => {
      const route = project.routes.find((candidate) => candidate.routeKey === routeKey);
      const plan = route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
      if (plan === undefined) throw new Error(`missing ${biomeKey} plan`);
      const biome = evaluateBiome(
        catalog,
        routeKey,
        plan,
        enteredBiomeCount,
        traitContext(project, routeKey),
      );
      expect(biome.authoring).toBe('complete');
      if (biome.authoring !== 'complete') throw new Error(`${biomeKey} should be complete`);
      const takeover = biome.snapshot.decisions.find(
        (decision) =>
          decision.kind === 'batch' &&
          decision.targets.every((target) => target.room.gameName === `${biomeKey}_PreBoss01`),
      );
      if (takeover?.kind !== 'batch') throw new Error(`missing ${biomeKey} takeover`);
      expect(takeover.targets.map((target) => target.room.entryState?.kind)).toEqual([
        'shop',
        undefined,
      ]);
    },
  );

  it('composes a Hub decision and its source-owned Preboss handoff through completion', () => {
    const evaluation = simulateProject(catalog, selectedNProject());
    const biome = evaluation.routes[1]?.biomes[0];
    expect(biome?.authoring).toBe('complete');
    if (biome?.authoring !== 'complete') throw new Error('N should be complete');
    expect(biome.validity).toBe('invalid');
    expect(biome.snapshot.decisions.map((decision) => decision.kind)).toEqual([
      'batch',
      'hub',
      'batch',
    ]);
    const handoff = biome.snapshot.decisions.at(-1);
    expect(handoff).toMatchObject({
      kind: 'batch',
      source: { kind: 'hubDecision', decisionKey: 'hub' },
      selectedExitKey: 'preboss',
    });
    const hubCreation = biome.history.events.filter(
      (event) => event.kind === 'roomCreated' && event.source === 'hubTarget',
    );
    const handoffCreation = biome.history.events.find(
      (event) =>
        event.kind === 'roomCreated' &&
        event.source === 'generatedTarget' &&
        event.parentOrigin.kind === 'hubRoom',
    );
    expect(hubCreation).toHaveLength(9);
    expect(handoffCreation).toMatchObject({ generationIndex: 10, generationCount: 10 });
    expect(biome.history.events.some((event) => event.kind === 'biomeCompleted')).toBe(true);
  });
});
