import { describe, expect, it } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';

const {
  bind,
  catalog,
  applyProjectCommand,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createTargetAddress,
  semanticAddressKey,
  createGoldenFGHIProject,
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  qBiome,
  qOccurrenceIds,
} = support;

describe('structured workspace interaction binding', () => {
  it('binds topology removals to exact commands with before-focus policy', () => {
    const { interactions } = bind(loadSurfaceNOPQProject(), 'Surface', 'N');
    const clear = interactions.topologyRemovals.get(semanticAddressKey(nBiome));
    const openingOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });
    const remove = interactions.topologyRemovals.get(semanticAddressKey(openingOwner));
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const removeHub = interactions.topologyRemovals.get(semanticAddressKey(hub));

    expect(clear).toEqual({
      intent: {
        command: { biome: nBiome, kind: 'ClearTopology' },
        focus: { owner: nBiome, timing: 'before' },
      },
      key: semanticAddressKey(nBiome),
      owner: nBiome,
    });
    expect(remove).toEqual({
      intent: {
        command: { decision: openingOwner, kind: 'RemoveExitDecision' },
        focus: { owner: openingOwner, timing: 'before' },
      },
      key: semanticAddressKey(openingOwner),
      owner: openingOwner,
    });
    expect(removeHub).toEqual({
      intent: {
        command: { hub, kind: 'RemoveHubDecision' },
        focus: { owner: hub, timing: 'before' },
      },
      key: semanticAddressKey(hub),
      owner: hub,
    });
  });

  it('binds a fixed start to one generic command and after-focus intent', () => {
    const project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Surface: 1 },
      projectId: 'fixed-start-binding',
    });
    const occurrenceId = createOccurrenceId('bound-fixed-start');
    let allocations = 0;
    const interaction = bind(project, 'Surface', 'N', () => {
      allocations += 1;
      return occurrenceId;
    }).interactions.starts.get(semanticAddressKey(nBiome));
    if (interaction === undefined) throw new Error('N start interaction is missing');

    expect(allocations).toBe(0);
    expect(interaction.intent()).toEqual({
      command: { biome: nBiome, kind: 'CreateStart', occurrenceId },
      focus: {
        owner: createOccurrenceAddress(nBiome, occurrenceId),
        timing: 'after',
      },
    });
    expect(allocations).toBe(1);
  });

  it('binds an authored-choice start to the same generic command', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      projectId: 'choice-start-binding',
    });
    const occurrenceId = createOccurrenceId('bound-choice-start');
    let allocations = 0;
    const interaction = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return occurrenceId;
    }).interactions.starts.get(semanticAddressKey(biome));
    if (interaction === undefined) throw new Error('F start interaction is missing');

    expect(allocations).toBe(0);
    expect(interaction.intent()).toEqual({
      command: {
        biome,
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
      focus: { owner: existingTarget, timing: 'after' },
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

  it('keeps ordinary room candidates visible while binding the forced terminal takeover', () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const withoutDecision = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    const project = withoutDecision;
    const target = createTargetAddress(goldenFBiome, owner.source, 'exit1');
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const interaction = bind(project, 'Underworld', 'F', () => {
      const occurrenceId = createOccurrenceId(`bound-takeover-${allocated.length + 1}`);
      allocated.push(occurrenceId);
      return occurrenceId;
    }).interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('F terminal Door 1 decision-entry interaction is missing');
    }
    expect(allocated).toEqual([]);
    expect(interaction.owner).toEqual(target);
    expect(interaction.decisionOwner).toEqual(owner);
    const model = interaction.load();
    expect(allocated).toEqual([]);
    const items = model.sections.flatMap((section) => section.items);
    const preboss = items.find((item) => item.value.gameName === 'F_PreBoss01');
    if (preboss === undefined) throw new Error('F terminal Preboss choice is missing');
    expect(preboss).toMatchObject({ disabled: false, state: 'forced' });
    const ordinary = items.find((item) => item.value.gameName === 'F_Combat01');
    if (ordinary === undefined) throw new Error('F terminal ordinary choice is missing');
    expect(ordinary).toMatchObject({ disabled: true, state: 'impossible' });
    expect(items.length).toBeGreaterThan(1);
    expect(allocated).toEqual([]);

    const intent = interaction.intentFor('F_PreBoss01');
    expect(intent.focus).toEqual({ owner, timing: 'before' });
    const command = intent.command;
    if (command.kind !== 'CreateTakeoverBatch') {
      throw new Error('F terminal Preboss selection did not bind an atomic takeover creation');
    }
    expect(command).toMatchObject({
      decision: owner,
      gameName: 'F_PreBoss01',
      kind: 'CreateTakeoverBatch',
    });
    expect(Object.values(command.targetOccurrenceIds)).toEqual(allocated);
    expect(allocated).not.toHaveLength(0);
    expect(Object.keys(command.targetOccurrenceIds)).toHaveLength(allocated.length);
  });

  it('keeps unresolved ordinary decision entry choices visible but non-executable', () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const started = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        projectId: 'unresolved-direct-f-entry',
      }),
      catalog,
      {
        biome: goldenFBiome,
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: goldenFStartId,
      },
    );
    const project = applyProjectCommand(started, catalog, { decision: owner, kind: 'CreateBatch' });
    const target = createTargetAddress(goldenFBiome, owner.source, 'exit1');
    let allocations = 0;
    const interaction = bind(project, 'Underworld', 'F', () => {
      allocations += 1;
      return createOccurrenceId('impossible-takeover-allocation');
    }).interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('F unresolved Door 1 decision-entry interaction is missing');
    }
    const ordinary = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName !== 'F_PreBoss01');
    if (ordinary === undefined) throw new Error('F unresolved ordinary choice is missing');
    expect(ordinary).toMatchObject({ disabled: true, state: 'unassessed' });
    expect(allocations).toBe(0);
    expect(() => interaction.intentFor(ordinary.value.gameName)).toThrow(
      /not currently authorable/,
    );
    expect(allocations).toBe(0);
  });

  it('blocks a locally unresolved Fields Door 1 even when its ordinary room stays eligible', () => {
    const occurrenceId = createOccurrenceId('binding-h-fields-start');
    const owner = createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId,
    });
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      configuredBiomeCount: 3,
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Underworld'),
    });
    project = applyProjectCommand(project, catalog, {
      biome: goldenHBiome,
      kind: 'CreateStart',
      occurrenceId,
    });
    project = applyProjectCommand(project, catalog, { decision: owner, kind: 'CreateBatch' });
    const target = createTargetAddress(goldenHBiome, owner.source, 'exit1');
    let allocations = 0;
    const interaction = bind(project, 'Underworld', 'H', () => {
      allocations += 1;
      return createOccurrenceId(`binding-h-fields-allocation-${allocations}`);
    }).interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('H Fields Door 1 decision-entry interaction is missing');
    }

    const ordinary = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'H_Combat02');
    if (ordinary === undefined) throw new Error('H eligible ordinary Door 1 choice is missing');
    expect(ordinary).toMatchObject({ disabled: true, state: 'possible' });
    expect(() => interaction.intentFor('H_Combat02')).toThrow(/not currently authorable/);
    expect(allocations).toBe(0);
  });

  it('binds I’s empty-decision Preboss through the ordinary target path', () => {
    let project = createGoldenFGHIProject();
    const iPlan = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'I');
    const prebossOccurrenceId = iPlan?.topology?.occurrences.find(
      (occurrence) => occurrence.gameName === 'I_PreBoss02',
    )?.occurrenceId;
    const prebossDecision = iPlan?.topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.normal.kind === 'batch' &&
        decision.normal.targets.some((target) => target.occurrenceId === prebossOccurrenceId),
    );
    if (prebossOccurrenceId === undefined || prebossDecision?.kind !== 'exit') {
      throw new Error('I mixed Preboss decision fixture is missing');
    }
    const owner = createExitDecisionAddress(goldenIBiome, prebossDecision.source);
    project = applyProjectCommand(project, catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    project = applyProjectCommand(project, catalog, { decision: owner, kind: 'CreateBatch' });
    const target = createTargetAddress(goldenIBiome, owner.source, 'exit1');
    const occurrenceId = createOccurrenceId('bound-i-ordinary-preboss');
    const interaction = bind(project, 'Underworld', 'I', () => occurrenceId).interactions.rooms.get(
      semanticAddressKey(target),
    );
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('I ordinary Preboss decision-entry interaction is missing');
    }

    const preboss = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'I_PreBoss02');
    if (preboss === undefined) throw new Error('I ordinary Preboss choice is missing');
    expect(preboss.disabled).toBe(false);
    expect(interaction.choices.some((choice) => choice.gameName !== 'I_PreBoss02')).toBe(true);
    expect(interaction.intentFor('I_PreBoss02')).toEqual({
      command: {
        gameName: 'I_PreBoss02',
        kind: 'CreateTarget',
        occurrenceId,
        target,
      },
      focus: { owner: target, timing: 'after' },
    });
  });

  it('binds O’s fixed terminal Preboss through Door 1 rather than a standalone action', () => {
    const owner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    const withoutDecision = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    const project = applyProjectCommand(withoutDecision, catalog, {
      decision: owner,
      kind: 'CreateBatch',
    });
    const target = createTargetAddress(oBiome, owner.source, 'exit1');
    const occurrenceId = createOccurrenceId('bound-fixed-takeover');
    let allocations = 0;
    const interaction = bind(project, 'Surface', 'O', () => {
      allocations += 1;
      return occurrenceId;
    }).interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('O terminal Door 1 decision-entry interaction is missing');
    }
    const preboss = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'O_PreBoss01');
    expect(preboss).toMatchObject({ disabled: false, state: 'forced' });
    expect(allocations).toBe(0);
    expect(interaction.intentFor('O_PreBoss01')).toEqual({
      command: {
        decision: owner,
        gameName: 'O_PreBoss01',
        kind: 'ReplaceWithTakeoverBatch',
        targetOccurrenceIds: { exit1: occurrenceId },
      },
      focus: { owner, timing: 'before' },
    });
    expect(allocations).toBe(1);
  });

  it('does not publish ordinary room candidates beyond Q’s terminal decision envelope', () => {
    const owner = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: qOccurrenceIds.secondMiniboss1,
    });
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      decision: createExitDecisionAddress(oBiome, {
        kind: 'occurrence',
        occurrenceId: oOccurrenceIds.combat02,
      }),
      kind: 'RemoveExitDecision',
    });
    project = applyProjectCommand(project, catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    project = applyProjectCommand(project, catalog, { decision: owner, kind: 'CreateBatch' });
    const target = createTargetAddress(qBiome, owner.source, 'exit1');
    let allocations = 0;
    const interaction = bind(project, 'Surface', 'Q', () => {
      allocations += 1;
      return createOccurrenceId(`q-terminal-ordinary-${allocations}`);
    }).interactions.rooms.get(semanticAddressKey(target));
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('Q terminal Door 1 decision-entry interaction is missing');
    }
    const items = interaction.load().sections.flatMap((section) => section.items);
    expect(items.map((item) => item.value.gameName)).toEqual(['Q_PreBoss01']);
    expect(() => interaction.intentFor('Q_Combat01')).toThrow(
      /outside the decision-entry room domain/,
    );
    expect(allocations).toBe(0);
  });

  it('keeps a structurally valid unassessed ordinary Door 1 authorable behind a retained prefix', () => {
    const start = createOccurrenceId('retained-prefix-direct-start');
    const firstTarget = createOccurrenceId('retained-prefix-direct-first-target');
    const startOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: start,
    });
    let project = applyProjectCommand(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        projectId: 'retained-prefix-direct-entry',
      }),
      catalog,
      {
        biome: goldenFBiome,
        gameName: 'F_Opening01',
        kind: 'CreateStart',
        occurrenceId: start,
      },
    );
    project = applyProjectCommand(project, catalog, { decision: startOwner, kind: 'CreateBatch' });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, startOwner.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      gameName: 'F_Combat03',
      kind: 'CreateTarget',
      occurrenceId: firstTarget,
      target: createTargetAddress(goldenFBiome, startOwner.source, 'exit1'),
    });
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: firstTarget,
    });
    project = applyProjectCommand(project, catalog, { decision: owner, kind: 'CreateBatch' });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, owner.source),
      storeKey: 'RunProgress',
    });
    const target = createTargetAddress(goldenFBiome, owner.source, 'exit1');
    const interaction = bind(project, 'Underworld', 'F').interactions.rooms.get(
      semanticAddressKey(target),
    );
    if (interaction?.kind !== 'decisionEntryRoom') {
      throw new Error('retained-prefix Door 1 decision-entry interaction is missing');
    }
    const ordinary = interaction
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'F_Combat02');
    if (ordinary === undefined) throw new Error('retained-prefix ordinary choice is missing');
    expect(ordinary).toMatchObject({ disabled: false, state: 'unassessed' });
    expect(interaction.intentFor('F_Combat02').command).toMatchObject({
      gameName: 'F_Combat02',
      kind: 'CreateTarget',
      target,
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
