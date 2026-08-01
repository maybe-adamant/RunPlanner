import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRewardWheelOfferAddress,
  createRewardWheelAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceIds,
} from '@run-planner/test-fixtures';
import { createCandidateSessionFactory } from '@planner/projections/candidateProjection';
import { createContextualOptionResolver } from '@planner/projections/contextualOptions';
import { createContextualPickerProjection } from '@planner/projections/contextualPicker';
import { createRewardPickerProjection } from '@planner/projections/rewardPicker';
import { assembleWorkspaceBiomeSemantics } from '../assembly/biome-semantic-assembly';
import { createWorkspaceProjectSourceIndex } from '../source-index';
import { bindWorkspaceInteractions } from './interaction-binding';
import type { WorkspaceTakeoverInteractionRequirement } from './interaction-requirements';

const contextualPicker = createContextualPickerProjection(createContextualOptionResolver(catalog));
const services = {
  candidateSessions: createCandidateSessionFactory(catalog),
  contextualPicker,
  rewardPicker: createRewardPickerProjection(catalog, contextualPicker),
};

function bind(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  allocateOccurrenceId = () => createOccurrenceId('interaction-binding-start'),
  transformTakeoverRequirements: (
    requirements: ReadonlyMap<string, WorkspaceTakeoverInteractionRequirement>,
  ) => ReadonlyMap<string, WorkspaceTakeoverInteractionRequirement> = (requirements) =>
    requirements,
) {
  const projectAssembly = simulateProjectAssembly(catalog, project);
  const evaluation = projectAssembly.evaluation;
  const source = createWorkspaceProjectSourceIndex(catalog, project, evaluation)
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  const assembly = assembleWorkspaceBiomeSemantics(catalog, source);
  return {
    assembly,
    interactions: bindWorkspaceInteractions({
      allocateOccurrenceId,
      assembly: projectAssembly,
      batchInteractionRequirements: assembly.batchInteractionRequirements,
      catalog,
      frontierInteractionRequirements: assembly.frontierInteractionRequirements,
      hubInteractionRequirements: assembly.hubInteractionRequirements,
      occurrenceInteractionRequirements: assembly.occurrenceInteractionRequirements,
      rewardControls: assembly.rewardControls,
      roomControls: assembly.roomControls,
      services,
      startInteractionRequirements: assembly.startInteractionRequirements,
      takeoverInteractionRequirements: transformTakeoverRequirements(
        assembly.takeoverInteractionRequirements,
      ),
      topologyRemovalInteractionRequirements: assembly.topologyRemovalInteractionRequirements,
    }),
  };
}

describe('structured workspace interaction binding', () => {
  it('lazily binds the fixed start to one complete command and after-focus intent', () => {
    const project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Surface: 1 },
      name: 'Fixed start binding',
      projectId: 'fixed-start-binding',
    });
    const occurrenceId = createOccurrenceId('bound-fixed-start');
    let allocations = 0;
    const interaction = bind(project, 'Surface', 'N', () => {
      allocations += 1;
      return occurrenceId;
    }).interactions.starts.get(semanticAddressKey(nBiome));
    if (interaction?.kind !== 'fixed') throw new Error('N fixed start interaction is missing');

    expect(allocations).toBe(0);
    interaction.load();
    expect(allocations).toBe(0);
    expect(interaction).not.toHaveProperty('fixedGameName');
    expect(interaction.intent()).toEqual({
      command: { biome: nBiome, kind: 'CreateStart', occurrenceId },
      focus: {
        owner: createOccurrenceAddress(nBiome, occurrenceId),
        timing: 'after',
      },
    });
    expect(allocations).toBe(1);
  });

  it('lazily binds an authored start choice to one complete command and after-focus intent', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      name: 'Choice start binding',
      projectId: 'choice-start-binding',
    });
    const occurrenceId = createOccurrenceId('bound-choice-start');
    let allocations = 0;
    const interaction = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return occurrenceId;
    }).interactions.starts.get(semanticAddressKey(biome));
    if (interaction?.kind !== 'choice') throw new Error('F choice start interaction is missing');

    expect(allocations).toBe(0);
    const room = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'F_Opening02')?.value;
    if (room === undefined) throw new Error('F Opening 02 start choice is missing');
    expect(allocations).toBe(0);
    expect(interaction.intentFor(room)).toEqual({
      command: {
        biome,
        gameName: 'F_Opening02',
        kind: 'CreateStart',
        occurrenceId,
      },
      focus: {
        owner: createOccurrenceAddress(biome, occurrenceId),
        timing: 'after',
      },
    });
    expect(allocations).toBe(1);
  });

  it('rejects an out-of-domain start choice before allocating an occurrence', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      name: 'Invalid start binding',
      projectId: 'invalid-start-binding',
    });
    let allocations = 0;
    const interaction = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return createOccurrenceId('invalid-start-binding');
    }).interactions.starts.get(semanticAddressKey(biome));
    if (interaction?.kind !== 'choice') throw new Error('F choice start interaction is missing');
    const combat = catalog.rooms.byKey.F_Combat01;
    if (combat === undefined) throw new Error('F Combat 01 is missing');

    expect(() => interaction.intentFor(combat)).toThrow(
      `F_Combat01 is outside the declared start domain for ${semanticAddressKey(biome)}`,
    );
    expect(allocations).toBe(0);
  });

  it('binds normal-batch creation to an exact before-focus intent', () => {
    const startId = createOccurrenceId('structural-batch-start');
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    const project = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        name: 'Structural batch binding',
        projectId: 'structural-batch-binding',
      }),
      catalog,
      {
        biome: goldenFBiome,
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: startId,
      },
    );
    let allocations = 0;
    const structural = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return createOccurrenceId('unused-structural-batch-id');
    }).interactions.structural.get(semanticAddressKey(owner));
    if (structural?.action !== 'createBatch') {
      throw new Error('F normal-batch structural interaction is missing');
    }

    expect(allocations).toBe(0);
    expect(structural.intent).toEqual({
      command: { decision: owner, kind: 'CreateBatch' },
      focus: { owner, timing: 'before' },
    });
    expect(allocations).toBe(0);
  });

  it('binds linked-exit creation to a lazy identity and exact after-focus intent', () => {
    const startId = createOccurrenceId('structural-linked-start');
    const linkedId = createOccurrenceId('structural-linked-created');
    const owner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    const project = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Structural linked binding',
        projectId: 'structural-linked-binding',
      }),
      catalog,
      { biome: nBiome, kind: 'CreateStart', occurrenceId: startId },
    );
    let allocations = 0;
    const structural = bind(project, 'Surface', 'N', () => {
      allocations += 1;
      return linkedId;
    }).interactions.structural.get(semanticAddressKey(owner));
    if (structural?.action !== 'createLinkedExit') {
      throw new Error('N linked-exit structural interaction is missing');
    }

    expect(allocations).toBe(0);
    expect(structural).not.toHaveProperty('targetGameName');
    expect(structural.intent()).toEqual({
      command: { decision: owner, kind: 'CreateLinkedExit', occurrenceId: linkedId },
      focus: { owner: createOccurrenceAddress(nBiome, linkedId), timing: 'after' },
    });
    expect(allocations).toBe(1);
  });

  it('binds existing and missing targets to exact replacement and lazy creation intents', () => {
    const startId = createOccurrenceId('target-binding-start');
    const firstCombatId = createOccurrenceId('target-binding-first-combat');
    const existingId = createOccurrenceId('target-binding-existing');
    const createdId = createOccurrenceId('target-binding-created');
    const firstSource = { kind: 'occurrence' as const, occurrenceId: startId };
    const source = { kind: 'occurrence' as const, occurrenceId: firstCombatId };
    const decision = createExitDecisionAddress(goldenFBiome, source);
    const existingTarget = createTargetAddress(goldenFBiome, source, 'exit1');
    const missingTarget = createTargetAddress(goldenFBiome, source, 'exit2');
    let project = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        name: 'Target interaction binding',
        projectId: 'target-interaction-binding',
      }),
      catalog,
      {
        biome: goldenFBiome,
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: startId,
      },
    );
    project = applyProjectCommand(project, catalog, {
      decision: createExitDecisionAddress(goldenFBiome, firstSource),
      kind: 'CreateBatch',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, firstSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      gameName: 'F_Combat03',
      kind: 'CreateTarget',
      occurrenceId: firstCombatId,
      target: createTargetAddress(goldenFBiome, firstSource, 'exit1'),
    });
    project = applyProjectCommand(project, catalog, { decision, kind: 'CreateBatch' });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      gameName: 'F_Combat04',
      kind: 'CreateTarget',
      occurrenceId: existingId,
      target: existingTarget,
    });
    let allocations = 0;
    const interactions = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return createdId;
    }).interactions.rooms;
    const existing = interactions.get(semanticAddressKey(existingTarget));
    const missing = interactions.get(semanticAddressKey(missingTarget));
    if (existing?.kind !== 'targetRoom' || missing?.kind !== 'targetRoom') {
      throw new Error('existing and missing target-room interactions are required');
    }

    expect(allocations).toBe(0);
    expect(existing.owner).toEqual(existingTarget);
    expect(missing.owner).toEqual(missingTarget);
    existing.load();
    missing.load();
    expect(allocations).toBe(0);
    expect(existing.intentFor('F_Combat05')).toEqual({
      command: {
        gameName: 'F_Combat05',
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(goldenFBiome, existingId),
      },
    });
    expect(allocations).toBe(0);
    expect(() => missing.intentFor('F_Opening01')).toThrow(
      `F_Opening01 is outside the target-room domain for ${semanticAddressKey(missingTarget)}`,
    );
    expect(allocations).toBe(0);
    expect(missing.intentFor('F_Combat05')).toEqual({
      command: {
        gameName: 'F_Combat05',
        kind: 'CreateTarget',
        occurrenceId: createdId,
        target: missingTarget,
      },
      focus: { owner: missingTarget, timing: 'after' },
    });
    expect(allocations).toBe(1);
  });

  it('binds all four reward owners to their exact no-focus replacement intents', () => {
    const project = createRepresentativeNOPQProject();
    const surfaceInteractions = {
      N: bind(project, 'Surface', 'N').interactions,
      O: bind(project, 'Surface', 'O').interactions,
      P: bind(project, 'Surface', 'P').interactions,
    };
    const replacement = { rewardType: 'MaxHealthDrop' } as const;
    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat05'));
    const local = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor1',
    );
    const wheel = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const shop = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');

    expect(
      surfaceInteractions.N.rewards.get(semanticAddressKey(incoming))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceIncomingReward', reward: incoming, value: replacement },
    });
    expect(
      surfaceInteractions.N.rewards.get(semanticAddressKey(local))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceLocalReward', reward: local, value: replacement },
    });
    expect(
      surfaceInteractions.O.rewards.get(semanticAddressKey(wheel))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceRewardWheelOffer', offer: wheel, value: replacement },
    });
    expect(
      surfaceInteractions.P.rewards.get(semanticAddressKey(shop))?.intentFor(replacement),
    ).toEqual({
      command: { kind: 'ReplaceShopOffer', offer: shop, value: replacement },
    });
  });

  it('binds candidate takeovers to declaration labels and their exact create command', () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const interaction = bind(project, 'Underworld', 'F', () => {
      const occurrenceId = createOccurrenceId(`bound-takeover-${allocated.length + 1}`);
      allocated.push(occurrenceId);
      return occurrenceId;
    }).interactions.takeoverBatches.get(semanticAddressKey(owner));
    if (interaction?.presentation !== 'candidate') {
      throw new Error('F candidate takeover interaction is missing');
    }
    expect(allocated).toEqual([]);
    const candidates = interaction.load();
    expect(allocated).toEqual([]);
    const selected = candidates.find(
      (candidate) =>
        candidate.evaluation.kind === 'takeoverPrebossBatch' &&
        candidate.evaluation.result.selectedPossible,
    );
    if (selected === undefined || selected.evaluation.kind !== 'takeoverPrebossBatch') {
      throw new Error('F candidate takeover has no currently applicable declaration');
    }

    expect(candidates).not.toHaveLength(0);
    expect(candidates.every((candidate) => candidate.value.gameName.startsWith('F_'))).toBe(true);
    expect(selected.value).toEqual({
      gameName: selected.value.gameName,
      label: catalog.rooms.byKey[selected.value.gameName]?.label,
    });
    const intent = interaction.intentFor(selected.value);
    expect(intent.focus).toEqual({ owner, timing: 'before' });
    const command = intent.command;
    expect(command).toMatchObject({
      decision: owner,
      gameName: selected.value.gameName,
      kind: 'CreateTakeoverBatch',
    });
    expect(Object.keys(command.targetOccurrenceIds)).toEqual(
      selected.evaluation.result.requiredExitKeys,
    );
    expect(Object.values(command.targetOccurrenceIds)).toEqual(allocated);
    expect(allocated).toHaveLength(selected.evaluation.result.requiredExitKeys.length);
  });

  it('binds takeover replacement while preserving existing targets and injecting missing IDs', () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    const existingOccurrenceId = createOccurrenceId('bound-replacement-existing');
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const { interactions } = bind(
      project,
      'Underworld',
      'F',
      () => {
        const occurrenceId = createOccurrenceId(`bound-replacement-${allocated.length + 1}`);
        allocated.push(occurrenceId);
        return occurrenceId;
      },
      (requirements) =>
        new Map(
          [...requirements].map(([key, requirement]) =>
            semanticAddressKey(requirement.owner) !== semanticAddressKey(owner) ||
            requirement.presentation !== 'candidate'
              ? [key, requirement]
              : [
                  key,
                  Object.freeze({
                    ...requirement,
                    action: 'replace' as const,
                    existingTargets: Object.freeze([
                      Object.freeze({ exitKey: 'exit1', occurrenceId: existingOccurrenceId }),
                    ]),
                  }),
                ],
          ),
        ),
    );
    const interaction = interactions.takeoverBatches.get(semanticAddressKey(owner));
    if (interaction?.presentation !== 'candidate') {
      throw new Error('F takeover replacement interaction is missing');
    }
    expect(interaction.action).toBe('replace');

    expect(allocated).toEqual([]);
    const selected = interaction
      .load()
      .find(
        (candidate) =>
          candidate.evaluation.kind === 'takeoverPrebossBatch' &&
          candidate.evaluation.result.selectedPossible,
      );
    if (selected === undefined || selected.evaluation.kind !== 'takeoverPrebossBatch') {
      throw new Error('F takeover replacement has no applicable candidate');
    }
    expect(allocated).toEqual([]);
    const intent = interaction.intentFor(selected.value);
    expect(intent.command).toMatchObject({
      decision: interaction.owner,
      gameName: selected.value.gameName,
      kind: 'ReplaceWithTakeoverBatch',
    });
    expect(intent.focus).toEqual({ owner: interaction.owner, timing: 'before' });
    const existingByExit = new Map([['exit1', existingOccurrenceId]]);
    const requiredExitKeys = selected.evaluation.result.requiredExitKeys;
    let allocatedIndex = 0;
    for (const exitKey of requiredExitKeys) {
      const occurrenceId = intent.command.targetOccurrenceIds[exitKey];
      const existing = existingByExit.get(exitKey);
      expect(occurrenceId).toBe(existing ?? allocated[allocatedIndex++]);
    }
    expect(allocated).toHaveLength(
      requiredExitKeys.filter((exitKey) => !existingByExit.has(exitKey)).length,
    );
  });

  it('rejects an impossible takeover candidate before allocating an occurrence', () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    let allocations = 0;
    const interaction = bind(createGoldenFGHIProject(), 'Underworld', 'F', () => {
      allocations += 1;
      return createOccurrenceId('impossible-takeover-allocation');
    }).interactions.takeoverBatches.get(semanticAddressKey(owner));
    if (interaction?.presentation !== 'candidate') {
      throw new Error('F opening takeover candidate interaction is missing');
    }
    const impossible = interaction
      .load()
      .find(
        (candidate) =>
          candidate.evaluation.kind === 'takeoverPrebossBatch' &&
          !candidate.evaluation.result.selectedPossible,
      );
    if (impossible === undefined) throw new Error('F opening has no impossible takeover candidate');

    expect(allocations).toBe(0);
    expect(() => interaction.intentFor(impossible.value)).toThrow(/not currently applicable/);
    expect(allocations).toBe(0);
  });

  it('binds fixed width-one takeover creation to a lazy injected identity and before focus', () => {
    const owner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    const occurrenceId = createOccurrenceId('bound-fixed-takeover');
    let allocations = 0;
    const interaction = bind(project, 'Surface', 'O', () => {
      allocations += 1;
      return occurrenceId;
    }).interactions.takeoverBatches.get(semanticAddressKey(owner));
    if (interaction?.presentation !== 'fixedWidthOneTakeover') {
      throw new Error('O fixed width-one takeover interaction is missing');
    }

    expect(allocations).toBe(0);
    const result = interaction.execute();
    if (result.kind !== 'intent') {
      throw new Error(`O fixed width-one takeover is unavailable: ${result.message}`);
    }
    expect(result.intent).toEqual({
      command: {
        decision: owner,
        gameName: 'O_PreBoss01',
        kind: 'CreateTakeoverBatch',
        targetOccurrenceIds: { exit1: occurrenceId },
      },
      focus: { owner, timing: 'before' },
    });
    expect(allocations).toBe(1);
  });

  it('binds selected exit choices in canonical physical order after authored serialization reorders', () => {
    const base = createGoldenFGHIProject();
    const forkSource = goldenFOccurrenceId(1, 1);
    const selectedChildSource = goldenFOccurrenceId(2, 2);
    const movedDecisionSource = goldenFOccurrenceId(3, 1);
    const withSelectedSpine = (reverse: boolean): ProjectDocument => ({
      ...base,
      routes: base.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((plan) =>
                plan.biomeKey !== 'F' || plan.topology === null
                  ? plan
                  : {
                      ...plan,
                      topology: {
                        ...plan.topology,
                        decisions: (reverse
                          ? [...plan.topology.decisions].reverse()
                          : plan.topology.decisions
                        ).map((decision) => {
                          if (decision.kind !== 'exit') return decision;
                          const normal =
                            decision.normal.kind !== 'batch' || !reverse
                              ? decision.normal
                              : {
                                  ...decision.normal,
                                  targets: [...decision.normal.targets].reverse(),
                                };
                          if (
                            decision.source.kind === 'occurrence' &&
                            decision.source.occurrenceId === forkSource
                          ) {
                            return {
                              ...decision,
                              normal,
                              selection: { kind: 'normal' as const, exitKey: 'exit2' },
                            };
                          }
                          if (
                            decision.source.kind === 'occurrence' &&
                            decision.source.occurrenceId === movedDecisionSource
                          ) {
                            return {
                              ...decision,
                              normal,
                              source: {
                                kind: 'occurrence' as const,
                                occurrenceId: selectedChildSource,
                              },
                            };
                          }
                          return normal === decision.normal ? decision : { ...decision, normal };
                        }),
                      },
                    },
              ),
            },
      ),
    });
    const interactionFor = (
      project: ProjectDocument,
      owner: ReturnType<typeof createExitDecisionAddress>,
    ) => {
      const interaction = [
        ...bind(project, 'Underworld', 'F').interactions.exitSelections.values(),
      ].find((candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(owner));
      if (interaction === undefined) {
        throw new Error(`exit-selection interaction for ${semanticAddressKey(owner)} is missing`);
      }
      return interaction;
    };
    const forkOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: forkSource,
    });
    const selectedChildOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: selectedChildSource,
    });
    const normalFork = interactionFor(withSelectedSpine(false), forkOwner);
    const reversedFork = interactionFor(withSelectedSpine(true), forkOwner);
    const normalSelectedChild = interactionFor(withSelectedSpine(false), selectedChildOwner);
    const reversedSelectedChild = interactionFor(withSelectedSpine(true), selectedChildOwner);

    expect(normalFork).toEqual({
      key: semanticAddressKey(createExitSelectionAddress(goldenFBiome, forkOwner.source)),
      owner: forkOwner,
      selectedExitKey: 'exit2',
      targets: [
        { label: 'exit1', value: 'exit1' },
        { label: 'exit2', value: 'exit2' },
      ],
    });
    expect(reversedFork).toEqual(normalFork);
    expect(reversedSelectedChild.targets).toEqual(normalSelectedChild.targets);
    expect(reversedSelectedChild.targets.map((target) => target.value)).toEqual(['exit1', 'exit2']);
  });

  it('binds Ephyra side-room proposals by exact local-child and group ownership', () => {
    const { assembly, interactions } = bind(createRepresentativeNOPQProject(), 'Surface', 'N');
    const combat = assembly.nodes.find(
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceId('combat05'),
    );
    if (
      combat?.kind !== 'occurrenceWorkbench' ||
      combat.room.roomLocal.kind !== 'ephyra' ||
      combat.room.roomLocal.sideRooms.kind !== 'published'
    ) {
      throw new Error('active Ephyra binding fixture is missing');
    }
    const group = combat.room.roomLocal.sideRooms.group;
    const sideDoor3 = group.slots.find((slot) => slot.key === 'sideDoor3');
    if (sideDoor3 === undefined) throw new Error('Ephyra sideDoor3 is missing');

    expect(
      interactions.sideRoomGenerations.get(semanticAddressKey(sideDoor3.address)),
    ).toMatchObject({ owner: sideDoor3.address, selected: sideDoor3.generation });
    expect(interactions.sideRoomEntryOrders.get(sideDoor3.entryOrder.interactionKey)).toMatchObject(
      {
        choices: sideDoor3.entryOrder.options.map((option) => ({
          label: option.label,
          value: option.proposedEnteredSlotKeys,
        })),
        owner: group.address,
        selected: sideDoor3.entryOrder.options.find(
          (option) => option.key === sideDoor3.entryOrder.selectedKey,
        )?.proposedEnteredSlotKeys,
      },
    );
  });

  it('binds Ship-wheel and Shop-purchase authored values from occurrence requirements', () => {
    const surface = createRepresentativeNOPQProject();
    const ship = bind(surface, 'Surface', 'O').interactions;
    const shop = bind(surface, 'Surface', 'N').interactions;
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const purchase = createShopPurchaseAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon');

    expect(
      ship.shipEncounterCounts.get(
        semanticAddressKey(createOccurrenceAddress(oBiome, oOccurrenceIds.combat04)),
      ),
    ).toMatchObject({ selected: 2 });
    expect(ship.rewardWheelOfferCounts.get(semanticAddressKey(wheel))).toMatchObject({
      owner: wheel,
      selected: 1,
    });
    expect(ship.rewardWheelStores.get(semanticAddressKey(wheel))).toMatchObject({
      owner: wheel,
      selected: 'RunProgress',
    });
    expect(ship.rewardWheelPicks.get(semanticAddressKey(wheel))).toMatchObject({
      owner: wheel,
      selected: 1,
    });
    expect(shop.shopPurchases.get(semanticAddressKey(purchase))).toMatchObject({
      owner: purchase,
      selected: false,
    });
  });

  it('constructs takeover repair commands from bound existing target identities', () => {
    const { assembly, interactions } = bind(createGoldenFGHIProject(), 'Underworld', 'F');
    const repair = [...interactions.takeoverBatches.values()].find(
      (interaction) => interaction.presentation === 'repair',
    );
    if (repair?.presentation !== 'repair') throw new Error('F takeover repair binding is missing');
    const requirement = [...assembly.takeoverInteractionRequirements.values()].find(
      (candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(repair.owner),
    );
    if (requirement?.presentation !== 'repair') {
      throw new Error('F takeover repair requirement is missing');
    }

    expect(repair.intent()).toEqual({
      command: {
        decision: repair.owner,
        gameName: requirement.gameName,
        kind: 'ReconcileTakeoverBatch',
        targetOccurrenceIds: Object.fromEntries(
          requirement.existingTargets.map((target) => [target.exitKey, target.occurrenceId]),
        ),
      },
      focus: { owner: repair.owner, timing: 'before' },
    });
  });

  it('retains a blocked takeover repair binding at its exact decision owner', () => {
    const base = createGoldenFGHIProject();
    const gPlan = base.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'G');
    const gTakeover = gPlan?.topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.normal.kind === 'batch' &&
        decision.normal.targets.every(
          (target) =>
            gPlan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'G_PreBoss01',
        ),
    );
    if (gTakeover?.kind !== 'exit' || gTakeover.source.kind !== 'occurrence') {
      throw new Error('G takeover source is missing');
    }
    const owner = createExitDecisionAddress(goldenGBiome, gTakeover.source);
    let project = applyProjectCommand(base, catalog, {
      gameName: 'G_MiniBoss02',
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, gTakeover.source.occurrenceId),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const { assembly, interactions } = bind(project, 'Underworld', 'G');
    const requirement = [...assembly.takeoverInteractionRequirements.values()].find(
      (candidate) => semanticAddressKey(candidate.owner) === semanticAddressKey(owner),
    );
    const interaction = interactions.takeoverBatches.get(semanticAddressKey(owner));
    if (requirement?.presentation !== 'repair' || interaction?.presentation !== 'repair') {
      throw new Error('blocked G takeover repair binding is missing');
    }

    expect(interaction).toMatchObject({ action: 'reconcile', owner, presentation: 'repair' });
    expect(interaction.intent()).toEqual({
      command: {
        decision: owner,
        gameName: requirement.gameName,
        kind: 'ReconcileTakeoverBatch',
        targetOccurrenceIds: Object.fromEntries(
          requirement.existingTargets
            .filter((target) => requirement.requiredExitKeys.includes(target.exitKey))
            .map((target) => [target.exitKey, target.occurrenceId]),
        ),
      },
      focus: { owner, timing: 'before' },
    });
  });
});
