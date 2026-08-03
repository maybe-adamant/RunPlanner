import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
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
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
  createRepresentativeNOPQProject,
  appendCompleteN,
  appendNEntry,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceIds,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures';
import { createCandidateSessionFactory } from '@planner/projections/candidateProjection';
import { createContextualOptionResolver } from '@planner/projections/contextualOptions';
import { createContextualPickerProjection } from '@planner/projections/contextualPicker';
import { createRewardPickerProjection } from '@planner/projections/rewardPicker';
import { assembleWorkspaceBiomeSemantics } from '../assembly/biome-semantic-assembly';
import { createWorkspaceProjectSourceIndex } from '../source-index';
import { bindWorkspaceInteractions } from './interaction-binding';

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
      hubTakeoverInteractionRequirements: assembly.hubTakeoverInteractionRequirements,
      occurrenceInteractionRequirements: assembly.occurrenceInteractionRequirements,
      rewardControls: assembly.rewardControls,
      roomControls: assembly.roomControls,
      services,
      startInteractionRequirements: assembly.startInteractionRequirements,
      takeoverInteractionRequirements: assembly.takeoverInteractionRequirements,
      topologyRemovalInteractionRequirements: assembly.topologyRemovalInteractionRequirements,
    }),
  };
}

describe('structured workspace interaction binding', () => {
  it('binds one provisional Hub-slot identity per explicit opening attempt', () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 6),
    });
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const { interactions } = bind(project, 'Surface', 'N', () => {
      const occurrenceId = createOccurrenceId(`bound-hub-opening-${allocated.length + 1}`);
      allocated.push(occurrenceId);
      return occurrenceId;
    });
    const slot = [...interactions.hubSlots.values()].find((candidate) => !candidate.selected);
    if (slot === undefined) throw new Error('closed Hub-slot interaction is missing');

    expect(allocated).toEqual([]);
    const firstAttempt = slot.beginOpeningAttempt();
    expect(allocated).toEqual([createOccurrenceId('bound-hub-opening-1')]);
    const firstCandidates = firstAttempt.load();
    expect(firstAttempt.load()).toBe(firstCandidates);
    expect(firstAttempt.intentFor(true)).toEqual({
      command: {
        kind: 'OpenHubSlot',
        occurrenceId: createOccurrenceId('bound-hub-opening-1'),
        slot: slot.owner,
      },
    });
    expect(allocated).toHaveLength(1);

    const secondAttempt = slot.beginOpeningAttempt();
    expect(secondAttempt).not.toBe(firstAttempt);
    expect(allocated).toEqual([
      createOccurrenceId('bound-hub-opening-1'),
      createOccurrenceId('bound-hub-opening-2'),
    ]);
    expect(secondAttempt.key).toContain('bound-hub-opening-2');
  });

  it('binds Hub closure, visit edits, and visit removal to exact commands and focus policy', () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 6),
    });
    const { interactions } = bind(project, 'Surface', 'N');
    const opened = [...interactions.hubSlots.values()].find(
      (candidate) => candidate.selected && candidate.close !== undefined,
    );
    if (opened?.selected !== true || opened.close === undefined) {
      throw new Error('closable Hub-slot interaction is missing');
    }
    const closeCandidate = opened.close.load().find((candidate) => !candidate.value);
    if (closeCandidate === undefined) throw new Error('Hub closure candidate is missing');
    expect(opened.close.intentFor(false)).toEqual({
      command: { kind: 'CloseHubSlot', slot: opened.owner },
    });

    const replace = [...interactions.hubVisits.values()].find(
      (interaction) => interaction.removal !== undefined,
    );
    const append = [...interactions.hubVisits.values()].find(
      (interaction) => interaction.removal === undefined,
    );
    if (replace === undefined || append === undefined) {
      throw new Error('Hub append/replace interactions are missing');
    }
    const replacement = replace.load().find((candidate) => candidate.value !== replace.selected);
    const appended = append.load()[0];
    if (replacement === undefined || appended === undefined) {
      throw new Error('Hub visit candidates are missing');
    }
    expect(replace.intentFor(replacement.value)).toEqual({
      command: {
        hubSlotKey: replacement.value,
        kind: 'ReplaceHubVisit',
        visit: replace.owner,
      },
    });
    expect(replace.removal).toEqual({
      command: { kind: 'RemoveHubVisitsFrom', visit: replace.owner },
    });
    expect(append.intentFor(appended.value)).toEqual({
      command: { hubSlotKey: appended.value, kind: 'AppendHubVisit', visit: append.owner },
    });
    expect(append.removal).toBeUndefined();
  });

  it('binds topology removals to exact commands with before-focus policy', () => {
    const { interactions } = bind(createRepresentativeNOPQProject(), 'Surface', 'N');
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

  it('binds the terminal Hub takeover and completed handoff to exact commands', () => {
    const boardProject = appendNEntry(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Bound Hub board',
        projectId: 'bound-hub-board',
      }),
    );
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const terminalOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    });
    const takeover = bind(boardProject, 'Surface', 'N').interactions.hubTakeovers.get(
      semanticAddressKey(terminalOwner),
    );
    if (takeover === undefined) throw new Error('terminal Hub takeover interaction is missing');
    expect(takeover.owner).toEqual(terminalOwner);
    expect(takeover.hub).toEqual(hub);
    expect(takeover.load().evaluation).toMatchObject({ kind: 'hubTerminalTakeover' });
    expect(takeover.intent()).toEqual({
      command: { decision: terminalOwner, hub, kind: 'ReplaceWithHubDecision' },
      focus: { owner: hub, timing: 'after' },
    });

    const handoffProject = appendCompleteN(
      createProjectDocument(catalog, {
        configuredBiomeCounts: { Surface: 1 },
        name: 'Bound Hub handoff',
        projectId: 'bound-hub-handoff',
      }),
      { includePreboss: false },
    );
    const handoffOwner = createExitDecisionAddress(nBiome, {
      decisionKey: 'hub',
      kind: 'hubDecision',
    });
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const handoff = bind(handoffProject, 'Surface', 'N', () => {
      const occurrenceId = createOccurrenceId(`bound-hub-handoff-${allocated.length + 1}`);
      allocated.push(occurrenceId);
      return occurrenceId;
    }).interactions.takeoverBatches.get(semanticAddressKey(handoffOwner));
    if (handoff?.presentation !== 'completedHubHandoff') {
      throw new Error('completed Hub handoff interaction is missing');
    }
    expect(allocated).toEqual([]);
    expect(handoff.intent()).toEqual({
      command: {
        decision: handoffOwner,
        gameName: 'N_PreBoss01',
        kind: 'CreateTakeoverBatch',
        targetOccurrenceIds: { preboss: createOccurrenceId('bound-hub-handoff-1') },
      },
      focus: { owner: handoffOwner, timing: 'before' },
    });
    expect(allocated).toHaveLength(1);
  });

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

  it('binds the only terminal Door 1 takeover choice to its exact replacement command', () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const withoutDecision = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    const project = applyProjectCommand(withoutDecision, catalog, {
      decision: owner,
      kind: 'CreateBatch',
    });
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
    expect(items.map((item) => item.value.gameName)).toEqual(['F_PreBoss01']);
    expect(() => interaction.intentFor('F_Combat01')).toThrow(
      /outside the decision-entry room domain/,
    );
    expect(allocated).toEqual([]);

    const intent = interaction.intentFor('F_PreBoss01');
    expect(intent.focus).toEqual({ owner, timing: 'before' });
    const command = intent.command;
    if (command.kind !== 'ReplaceWithTakeoverBatch') {
      throw new Error('F terminal Preboss selection did not bind a takeover replacement');
    }
    expect(command).toMatchObject({
      decision: owner,
      gameName: 'F_PreBoss01',
      kind: 'ReplaceWithTakeoverBatch',
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
        name: 'Unresolved direct F entry',
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
    const withoutDecision = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
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
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
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
        name: 'Retained prefix direct entry',
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
