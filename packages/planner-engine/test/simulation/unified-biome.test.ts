import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  evaluateBiome,
  simulateProjectAssembly,
  simulateProject,
} from '@run-planner/engine/simulation';
import {
  authorLegalTraitOffers,
  authorSurfaceWorldShop,
  createCompleteFGProject,
  createGoldenFGHProject,
  createRepresentativeNProject,
  oOccurrenceIds,
  createRepresentativeNOProject,
  createRepresentativeNOPProject,
  createRepresentativeNOPQProject,
} from '@run-planner/test-fixtures';

function traitContext(project: ReturnType<typeof createProjectDocument>, routeKey: string) {
  const route = project.routes.find((candidate) => candidate.routeKey === routeKey);
  if (route === undefined) throw new Error(`missing ${routeKey} route`);
  return route.loadout;
}

function legalHFieldsProject() {
  const biome = createBiomeAddress('Underworld', 'H');
  let project = createGoldenFGHProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, createOccurrenceId('golden-h-miniboss01')),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
  });
  return authorLegalTraitOffers(project);
}

function legalOProject() {
  const biome = createBiomeAddress('Surface', 'O');
  let project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(biome, oOccurrenceIds.devotion),
    gameName: 'O_Shop01',
  });
  project = authorSurfaceWorldShop(project, biome, oOccurrenceIds.devotion);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createShopOfferAddress(biome, oOccurrenceIds.devotion, 'Boon'),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceRewardWheelOffer',
    offer: createRewardWheelOfferAddress(biome, oOccurrenceIds.combat02, 'wheel1', 'offer1'),
    value: { rewardType: 'HermesUpgrade' },
  });
  return authorLegalTraitOffers(project);
}

function legalIProject() {
  let project = completeIProject();
  project = withIEncounterSelection(project, 'i-combat06', 'GeneratedI');
  project = withIEncounterSelection(project, 'i-combat11', 'GeneratedI_GoalReward');
  project = withIEncounterSelection(project, 'i-combat12-entered', 'GeneratedI_GoalReward');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(
      createBiomeAddress('Underworld', 'I'),
      createOccurrenceId('i-miniboss'),
    ),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(
        createBiomeAddress('Underworld', 'I'),
        createOccurrenceId('i-miniboss'),
      ),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(
      createBiomeAddress('Underworld', 'I'),
      createOccurrenceId('i-combat13-offered'),
    ),
    value: { rewardType: 'RoomMoneyTripleDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(
      createBiomeAddress('Underworld', 'I'),
      createOccurrenceId('i-combat06'),
    ),
    value: { rewardType: 'WeaponUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(
        createBiomeAddress('Underworld', 'I'),
        createOccurrenceId('i-combat06'),
      ),
      'self',
    ),
    value: {
      kind: 'traits',
      giverKey: 'WeaponUpgrade',
      options: [
        { traitKey: 'StaffDoubleAttackTrait' },
        { traitKey: 'StaffLongAttackTrait' },
        { traitKey: 'StaffDashAttackTrait' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(
      createBiomeAddress('Underworld', 'I'),
      createOccurrenceId('i-combat07'),
    ),
    value: { rewardType: 'StackUpgradeTriple' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceLevelResolution',
    levelResolution: createLevelResolutionAddress(
      createIncomingRewardAddress(
        createBiomeAddress('Underworld', 'I'),
        createOccurrenceId('i-combat07'),
      ),
      'self',
    ),
    value: {
      kind: 'choice',
      offeredTraitKeys: ['ZeusWeaponBoon'],
      selectedTraitKey: 'ZeusWeaponBoon',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(
      createBiomeAddress('Underworld', 'I'),
      createOccurrenceId('i-combat08'),
    ),
    value: { rewardType: 'WeaponUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(
        createBiomeAddress('Underworld', 'I'),
        createOccurrenceId('i-combat08'),
      ),
      'self',
    ),
    value: {
      kind: 'traits',
      giverKey: 'WeaponUpgrade',
      options: [
        { traitKey: 'StaffTripleShotTrait' },
        { traitKey: 'StaffJumpSpecialTrait' },
        { traitKey: 'StaffAttackRecoveryTrait' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  return authorLegalTraitOffers(project);
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
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, startId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(biome, startId), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  const opening = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: startId });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: opening });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, opening.source),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, opening.source, 'exit1'),
    occurrenceId: createOccurrenceId('f-prefix-combat'),
    gameName: 'F_Combat02',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, createOccurrenceId('f-prefix-combat')),
    value: { rewardType: 'GiftDrop' },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceLevelResolution',
    levelResolution: createLevelResolutionAddress(
      createIncomingRewardAddress(biome, createOccurrenceId('f-prefix-combat')),
      'self',
    ),
    value: { kind: 'random', targetTraitKey: 'ApolloWeaponBoon' },
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
        ['exit2', 'i-miniboss', 'I_MiniBoss01'],
      ],
      'exit2',
    ],
    [
      'i-miniboss',
      [
        ['exit1', 'i-combat09', 'I_Combat09'],
        ['exit2', 'i-combat13-offered', 'I_Combat13'],
      ],
    ],
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
    ['i-combat09', 'GeneratedI_GoalReward'],
    ['i-combat06', 'GeneratedI_GoalReward'],
  ] as const) {
    project = withIEncounterSelection(project, occurrenceId, encounterKey);
  }
  return project;
}

describe('unified biome simulation', () => {
  it('materializes a selected takeover Preboss as an ordered normal-door batch', () => {
    const project = createCompleteFGProject();
    const evaluation = simulateProject(catalog, project);
    const biome = evaluation.routes[0]?.biomes[0];
    expect(biome?.authoring).toBe('complete');
    if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new Error('F should be complete-valid');
    }
    const takeover = biome.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.targets.every((target) => target.room.gameName === 'F_PreBoss01'),
    );
    expect(takeover).toMatchObject({ kind: 'batch', selectedExitKey: 'exit1' });
    if (takeover?.kind !== 'batch') throw new Error('missing F takeover batch');
    if (takeover.source.kind !== 'occurrence') throw new Error('missing F takeover source');
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
          takeover.source,
          'exit1',
        ),
        gameName: 'F_PreBoss01',
      }),
    ).toThrow(/source-owned takeover Preboss batch/);
    expect(
      candidates.evaluate({
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), takeover.source),
        gameName: 'F_PreBoss01',
      }),
    ).toMatchObject({ kind: 'takeoverPrebossBatch' });
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
      JSON.stringify(biome.findings),
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
    expect(result.findings.map((finding) => finding.code)).not.toContain('continuationMissing');
    expect(result.findings.map((finding) => finding.code)).toContain('baseRewardStoreUnavailable');
    expect(
      project.routes[0]?.biomes[0]?.topology?.occurrences.map(
        (occurrence) => occurrence.occurrenceId,
      ),
    ).toContain('f-prefix-combat');
  });

  it('runs the Fields chain and no-store takeover through the same evaluator', () => {
    const project = legalHFieldsProject();
    const biome = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (biome === undefined) throw new Error('missing H evaluation');
    expect(biome.authoring).toBe('complete');
    if (biome.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new Error('H should be complete-valid');
    }
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
    const oProject = legalOProject();
    const oPlan = oProject.routes[1]?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (oPlan === undefined) throw new Error('missing O plan');
    const o = evaluateBiome(catalog, 'Surface', oPlan, {
      enteredBiomeCount: 2,
      loadout: traitContext(oProject, 'Surface'),
    });
    expect(o.authoring).toBe('complete');
    if (o.authoring !== 'complete' || o.validity !== 'valid') {
      throw new Error('O should be complete-valid');
    }
    expect(o.snapshot.decisions.at(-1)).toMatchObject({
      kind: 'batch',
      rewardStore: { kind: 'sourceOfferPoint' },
      targets: [{ continuation: 'startsCompletion' }],
    });

    const qProject = createRepresentativeNOPQProject();
    const qPlan = qProject.routes[1]?.biomes.find((candidate) => candidate.biomeKey === 'Q');
    if (qPlan === undefined) throw new Error('missing Q plan');
    const q = simulateProject(catalog, qProject).routes[1]?.biomes.find(
      (candidate) => candidate.biomeKey === 'Q',
    );
    if (q === undefined) throw new Error('missing Q evaluation');
    expect(q.authoring).toBe('complete');
    if (q.authoring !== 'complete' || q.validity !== 'valid') {
      throw new Error(`Q should be complete-valid: ${JSON.stringify(q.findings)}`);
    }
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
      evaluateBiome(catalog, 'Surface', reversed, {
        enteredBiomeCount: 4,
        loadout: traitContext(qProject, 'Surface'),
      }).authoring,
    ).toBe('complete');
  });

  it('derives Clockwork batch state and reward timing from the selected I spine', () => {
    const project = legalIProject();
    const plan = project.routes[0]?.biomes.find((candidate) => candidate.biomeKey === 'I');
    if (plan === undefined) throw new Error('missing I plan');
    const biome = evaluateBiome(catalog, 'Underworld', plan, {
      enteredBiomeCount: 4,
      loadout: traitContext(project, 'Underworld'),
    });
    if (biome.authoring !== 'complete') throw new Error('I should remain structurally complete');
    expect(biome.validity).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({ code: 'pomTargetUnavailable' }),
    );
    if (!('materializedPrefix' in biome)) {
      throw new Error('I should retain a blocked materialized prefix');
    }
    const prefix = biome.materializedPrefix;
    expect(
      prefix.decisions
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
    ['G', createCompleteFGProject(), 'Underworld'],
    ['P', createRepresentativeNOPProject(), 'Surface'],
  ] as const)(
    'gives %s takeover batches their declaration-owned shop and free-reward roles',
    (biomeKey, project, routeKey) => {
      const legalProject = authorLegalTraitOffers(project);
      const biome = simulateProject(catalog, legalProject)
        .routes.find((route) => route.routeKey === routeKey)
        ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
      if (biome === undefined) throw new Error(`missing ${biomeKey} evaluation`);
      expect(biome.authoring).toBe('complete');
      if (biome.authoring !== 'complete' || biome.validity !== 'valid') {
        throw new Error(`${biomeKey} should be complete-valid: ${JSON.stringify(biome.findings)}`);
      }
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

  it('retains a Hub decision and its source-owned Preboss handoff in complete authorship', () => {
    const evaluation = simulateProject(catalog, createRepresentativeNProject());
    const biome = evaluation.routes[1]?.biomes[0];
    expect(biome?.authoring).toBe('complete');
    if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new Error('N should be complete-valid');
    }
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
