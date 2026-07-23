import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createHubVisitAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createRepresentativeNOPQProject,
  createRepresentativeNOProject,
  createRepresentativeNProject,
  nBiome,
  oBiome,
  oOccurrenceIds,
} from '../../test/fixtures/surfaceProject';
import { createGoldenFGHIProject, targetOccurrenceId } from '../../test/fixtures/underworldProject';
import { createCandidateSessionFactory, type CandidateSessionFactory } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';
import { createRewardPickerProjection } from './rewardPicker';
import {
  createStructuredWorkspaceProjection,
  type WorkspaceBiome,
  type WorkspaceLinearBiome,
} from './structuredWorkspace';

const candidateSessions = createCandidateSessionFactory(catalog, {
  yieldToHost: () => Promise.resolve(),
});
const contextualPicker = createContextualPickerProjection(createContextualOptionResolver(catalog));
const rewardPicker = createRewardPickerProjection(catalog, contextualPicker);
const projection = createStructuredWorkspaceProjection(catalog, {
  candidateSessions,
  contextualPicker,
  rewardPicker,
});

function biome(workspace: ReturnType<typeof projectWorkspace>, biomeKey: string): WorkspaceBiome {
  const projected = workspace.routes
    .flatMap((route) => route.biomes)
    .find((candidate) => candidate.biomeKey === biomeKey);
  if (projected === undefined) {
    throw new Error(`workspace has no ${biomeKey} biome`);
  }
  return projected;
}

function projectWorkspace(project: ReturnType<typeof createProjectDocument>) {
  return projection.project(project, simulateProject(catalog, project));
}

function linear(projected: WorkspaceBiome): WorkspaceLinearBiome {
  if (projected.kind !== 'LinearBiome') {
    throw new Error(`${projected.biomeKey} is not Linear`);
  }
  return projected;
}

function createRetainedLinearProject() {
  const f = createBiomeAddress('Underworld', 'F');
  const start = createOccurrenceId('structured-retained-start');
  const first = createOccurrenceId('structured-retained-first');
  const second = createOccurrenceId('structured-retained-second');
  const third = createOccurrenceId('structured-retained-third');
  let project = createProjectDocument(catalog, {
    projectId: 'structured-retained',
    name: 'Structured Retained',
    configuredBiomeCounts: { Underworld: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: f,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  for (const [parent, occurrenceId, gameName] of [
    [start, first, 'F_Combat02'],
    [first, second, 'F_Combat03'],
    [second, third, 'F_Combat04'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(f, parent),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(f, parent, 1),
      occurrenceId,
      gameName,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(f, parent),
      exitIndex: 1,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(f, third),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(f, start),
    storeKey: 'MetaProgress',
  });
}

function createRepeatedIPrebossProject() {
  const i = createBiomeAddress('Underworld', 'I');
  const firstParent = createOccurrenceId('phase-6-i-goal-5');
  const laterParent = createOccurrenceId('phase-6-i-terminal-peer');
  const laterPreboss = createOccurrenceId('structured-i-later-preboss');
  let project = createGoldenFGHIProject(catalog);
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(i, firstParent),
    exitIndex: 2,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(i, laterParent),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(i, laterParent, 1),
    occurrenceId: laterPreboss,
    gameName: 'I_PreBoss02',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(i, laterParent, 2),
    occurrenceId: createOccurrenceId('structured-i-later-peer'),
    gameName: 'I_Combat10',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(i, laterParent),
    exitIndex: 1,
  });
  return { laterPreboss, project };
}

describe('structured workspace projection', () => {
  it('projects deterministic canonical Linear workspaces for all seven Linear biomes', () => {
    const underworldProject = createGoldenFGHIProject(catalog);
    const surfaceProject = createRepresentativeNOPQProject();
    const underworld = projectWorkspace(underworldProject);
    const surface = projectWorkspace(surfaceProject);

    expect(
      projection.project(underworldProject, simulateProject(catalog, underworldProject)),
    ).not.toBe(underworld);
    const underworldEvaluation = simulateProject(catalog, underworldProject);
    expect(projection.project(underworldProject, underworldEvaluation)).toBe(
      projection.project(underworldProject, underworldEvaluation),
    );

    for (const [workspace, biomeKeys] of [
      [underworld, ['F', 'G', 'H', 'I']],
      [surface, ['N', 'O', 'P', 'Q']],
    ] as const) {
      expect(workspace.routes.flatMap((route) => route.rail.map((item) => item.biomeKey))).toEqual(
        biomeKeys,
      );
      for (const biomeKey of biomeKeys) {
        const projected = biome(workspace, biomeKey);
        expect(workspace.focusByOwner.get(projected.marker.focusKey)).toMatchObject({
          biomeKey,
          focusAddress: projected.marker.address,
          region: 'structure',
        });
      }
    }

    for (const biomeKey of ['F', 'G', 'H', 'I', 'O', 'P', 'Q']) {
      const workspace = ['F', 'G', 'H', 'I'].includes(biomeKey) ? underworld : surface;
      const projected = linear(biome(workspace, biomeKey));
      expect(projected.source).toBe('canonical');
      expect(projected.decisions.length).toBeGreaterThan(0);
      expect(projected.completion.length).toBeGreaterThan(0);
      for (const decision of projected.decisions) {
        expect(workspace.focusByOwner.has(decision.marker.focusKey)).toBe(true);
        for (const target of decision.targets) {
          expect(workspace.focusByOwner.has(target.marker.focusKey)).toBe(true);
          expect(workspace.focusByOwner.has(target.room.marker.focusKey)).toBe(true);
        }
      }
    }

    expect(linear(biome(underworld, 'F')).terminal.realization).toBe('independent');
    expect(linear(biome(underworld, 'G')).terminal.realization).toBe('independent');
    expect(linear(biome(underworld, 'H')).decisions).toHaveLength(4);
    expect(linear(biome(underworld, 'H')).emptyOutline.progression).toEqual({
      kind: 'exact',
      decisionCount: 4,
    });
    expect(linear(biome(underworld, 'I')).terminal.realization).toBe('generatedPeer');
    expect(linear(biome(surface, 'O')).emptyOutline.progression).toEqual({
      kind: 'exact',
      decisionCount: 6,
    });
    expect(linear(biome(surface, 'O')).decisions).toHaveLength(6);
    expect(linear(biome(surface, 'P')).emptyOutline.progression).toEqual({ kind: 'variable' });
    expect(linear(biome(surface, 'Q')).emptyOutline.progression).toEqual({
      kind: 'staged',
      stageKeys: [
        'foyer',
        'firstFork',
        'firstMiniboss',
        'ordinary',
        'secondFork',
        'secondMiniboss',
      ],
    });
    expect(linear(biome(surface, 'Q')).decisions).toHaveLength(6);

    for (const [workspace, biomeKeys] of [
      [underworld, ['F', 'G', 'H']],
      [surface, ['O', 'P', 'Q']],
    ] as const) {
      for (const biomeKey of biomeKeys) {
        const terminal = linear(biome(workspace, biomeKey)).terminal;
        expect(terminal.realization).toBe('independent');
        expect(terminal.targets.length).toBeGreaterThan(0);
        for (const target of terminal.targets) {
          expect(target.contextualOwner).toMatchObject({
            kind: 'linearTarget',
            interaction: 'readOnly',
          });
        }
      }
    }
    for (const target of linear(biome(underworld, 'I')).terminal.targets) {
      expect(target.contextualOwner).toMatchObject({
        kind: 'linearTarget',
        interaction: 'replaceable',
      });
    }
  });

  it('projects N as one joint board plus an ordered visit timeline', () => {
    const workspace = projectWorkspace(createRepresentativeNOPQProject());
    const projected = biome(workspace, 'N');
    if (projected.kind !== 'HubBiome') {
      throw new Error('N did not project as HubBiome');
    }

    expect(projected.source).toBe('canonical');
    expect(projected.board.generationRegion).toBe('joint');
    expect(projected.board.slots).toHaveLength(26);
    expect(projected.board.slots.filter((slot) => slot.open)).toHaveLength(9);
    expect(projected.visits).toHaveLength(6);
    expect(projected.visits.every((visit) => visit.authored)).toBe(true);
    expect(projected.visits.map((visit) => visit.visitIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(projected.board.slots.find((slot) => slot.hubSlotKey === 'combat05')).toMatchObject({
      sideRooms: [
        { slotKey: 'sideDoor1', generation: 'generated', enteredOrdinal: 2 },
        { slotKey: 'sideDoor2', generation: 'generated', enteredOrdinal: 1 },
        { slotKey: 'sideDoor3', generation: 'generated', enteredOrdinal: null },
      ],
    });
    const sideRoom = projected.board.slots.find((slot) => slot.hubSlotKey === 'combat05')
      ?.sideRooms[0];
    expect(sideRoom).toBeDefined();
    expect(workspace.focusByOwner.get(sideRoom!.marker.focusKey)).toMatchObject({
      focusAddress: sideRoom!.marker.address,
      region: 'structure',
    });
    expect(projected.terminal.role).toBe('preboss');
    expect(projected.emptyOutline.progression).toEqual({ kind: 'hubVisits', visitCount: 6 });
    expect(workspace.focusByOwner.get(projected.board.marker.focusKey)).toMatchObject({
      focusAddress: projected.board.marker.address,
      region: 'structure',
    });
  });

  it('projects every partial N visit position and keeps its fixed preboss unentered', () => {
    let project = createRepresentativeNProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 3),
    });
    const workspace = projectWorkspace(project);
    const projected = biome(workspace, 'N');
    if (projected.kind !== 'HubBiome') {
      throw new Error('N did not project as HubBiome');
    }

    expect(projected.source).toBe('progressive');
    expect(projected.board.slots.filter((slot) => slot.open)).not.toHaveLength(0);
    expect(projected.board.slots.filter((slot) => !slot.open)).not.toHaveLength(0);
    expect(projected.board.slots.every((slot) => slot.marker.assessment === 'assessed')).toBe(true);
    expect(projected.visits).toHaveLength(6);
    expect(projected.visits.map((visit) => visit.authored)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(projected.visits[2]).toMatchObject({
      authored: false,
      contextualOwner: { kind: 'hubVisit', address: createHubVisitAddress(nBiome, 3) },
      visitIndex: 3,
    });
    expect(projected.terminal.room).toMatchObject({ entered: false });
  });

  it('keeps empty and blocked biomes authored rather than claiming canonical structure', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'structured-empty',
      name: 'Structured Empty',
      configuredBiomeCounts: { Surface: 4, Underworld: 4 },
    });
    const workspace = projectWorkspace(project);

    for (const projected of workspace.routes.flatMap((route) => route.biomes)) {
      expect(projected.source).toBe('authored');
      expect(projected.emptyOutline.completion.length).toBeGreaterThan(0);
    }
    expect(linear(biome(workspace, 'F')).emptyOutline.progression).toEqual({ kind: 'variable' });
    expect(linear(biome(workspace, 'H')).emptyOutline.progression).toEqual({
      kind: 'exact',
      decisionCount: 4,
    });
    expect(biome(workspace, 'G').marker.assessment).toBe('blocked');
    const n = biome(workspace, 'N');
    expect(n.kind).toBe('HubBiome');
    if (n.kind === 'HubBiome') {
      expect(n.board.generationRegion).toBe('joint');
      expect(n.board.slots.every((slot) => slot.marker.assessment === 'unassessed')).toBe(true);
    }
  });

  it('uses progressive coverage for an incomplete Linear prefix without publishing canonical state', () => {
    const f = createBiomeAddress('Underworld', 'F');
    const start = createOccurrenceId('structured-prefix-start');
    const target = createOccurrenceId('structured-prefix-target');
    let project = createProjectDocument(catalog, {
      projectId: 'structured-prefix',
      name: 'Structured Prefix',
      configuredBiomeCounts: { Underworld: 1 },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: f,
      occurrenceId: start,
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(f, start),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(f, start, 1),
      occurrenceId: target,
      gameName: 'F_Combat02',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(f, start),
      exitIndex: 1,
    });

    const workspace = projectWorkspace(project);
    const projected = linear(biome(workspace, 'F'));
    const decision = projected.decisions[0];
    const projectedTarget = decision?.targets[0];
    if (decision === undefined || projectedTarget === undefined) {
      throw new Error('progressive F decision was not projected');
    }

    expect(projected.source).toBe('progressive');
    expect(projected.decisions).toHaveLength(1);
    expect(decision.marker.assessment).toBe('assessed');
    expect(decision.pickedMarker.assessment).toBe('assessed');
    expect(workspace.focusByOwner.get(decision.pickedMarker.focusKey)?.nodeKey).toBe(
      decision.marker.focusKey,
    );
    expect(decision.contextualOwner).toMatchObject({
      kind: 'linearDecision',
      address: decision.marker.address,
    });
    expect(projectedTarget.contextualOwner).toMatchObject({
      kind: 'linearTarget',
      address: projectedTarget.marker.address,
    });
    expect(projected.frontier?.address.kind).toBe('continuation');
    expect(projected.terminal.realization).toBe('projected');
  });

  it('keeps retained picked descendants unassessed and unentered', () => {
    const projected = linear(biome(projectWorkspace(createRetainedLinearProject()), 'F'));
    const retained = projected.decisions.find((decision) => decision.retainedOverflow);
    const picked = retained?.targets.find((target) => target.picked);

    expect(projected.source).toBe('progressive');
    expect(retained).toBeDefined();
    expect(picked).toMatchObject({ retained: true, room: { entered: false } });
  });

  it('retains concrete reward payload labels in compact room summaries', () => {
    const projected = linear(biome(projectWorkspace(createGoldenFGHIProject(catalog)), 'F'));
    const boon = projected.decisions
      .flatMap((decision) => decision.targets)
      .find((target) => target.room.gameName === 'F_Combat03');

    expect(boon?.room.rewardSummary).toContain('Apollo');
  });

  it('binds lazy room and nested reward interactions to the projected project', async () => {
    const workspace = projectWorkspace(createGoldenFGHIProject(catalog));
    const projected = linear(biome(workspace, 'F'));
    const target = projected.decisions
      .flatMap((decision) => decision.targets)
      .find((candidate) => candidate.room.gameName === 'F_Combat03');
    if (
      target === undefined ||
      target.contextualOwner.kind !== 'linearTarget' ||
      target.contextualOwner.interaction !== 'replaceable'
    ) {
      throw new Error('F combat target has no contextual room owner');
    }
    const roomModel = workspace.contextual.resolveRoom(target.contextualOwner.address).load();
    expect(roomModel.selected?.value.gameName).toBe('F_Combat03');
    expect(roomModel.sections.length).toBeGreaterThan(0);

    const reward = target.room.rewardControls[0];
    if (reward === undefined) {
      throw new Error('F combat target has no incoming reward control');
    }
    const interaction = workspace.contextual.resolveReward(reward.owner.address);
    const domain = await interaction.load(interaction.selected);
    const rewardModel = interaction.model(domain, 'type', interaction.selected);

    expect(reward.owner.address.kind).toBe('incomingReward');
    expect(reward.marker.assessment).toBe('assessed');
    expect(workspace.focusByOwner.get(reward.marker.focusKey)?.nodeKey).toBe(
      target.room.marker.focusKey,
    );
    expect(interaction.summary(interaction.selected)).toContain('Apollo');
    expect(rewardModel.selected?.value).toEqual(interaction.selected);
    expect(workspace.contextual.resolveReward(reward.owner.address)).toBe(interaction);
  });

  it('defers target-room and counted-reward domains until their interactions load', async () => {
    let roomDomainScans = 0;
    let countedRewardTypeResolutions = 0;
    const trackedCatalog: Catalog = {
      ...catalog,
      rooms: {
        byKey: catalog.rooms.byKey,
        get values() {
          roomDomainScans += 1;
          return catalog.rooms.values;
        },
      },
    };
    const evaluateTrackedProject = (project: ReturnType<typeof createProjectDocument>) =>
      simulateProject(trackedCatalog, project);
    const baseCandidates = createCandidateSessionFactory(trackedCatalog);
    const trackedCandidates: CandidateSessionFactory = {
      ...baseCandidates,
      bind(project, evaluation) {
        const session = baseCandidates.bind(project, evaluation);
        return Object.freeze({
          ...session,
          countedRewardTypes: (
            ...args: Parameters<typeof session.countedRewardTypes>
          ): ReturnType<typeof session.countedRewardTypes> => {
            countedRewardTypeResolutions += 1;
            return session.countedRewardTypes(...args);
          },
        });
      },
    };
    const trackedContextualPicker = createContextualPickerProjection(
      createContextualOptionResolver(trackedCatalog),
    );
    const trackedProjection = createStructuredWorkspaceProjection(trackedCatalog, {
      candidateSessions: trackedCandidates,
      contextualPicker: trackedContextualPicker,
      rewardPicker: createRewardPickerProjection(trackedCatalog, trackedContextualPicker),
    });
    const project = createGoldenFGHIProject(trackedCatalog);
    const evaluation = evaluateTrackedProject(project);
    roomDomainScans = 0;
    const workspace = trackedProjection.project(project, evaluation);
    const projected = linear(biome(workspace, 'F'));
    const target = projected.decisions
      .flatMap((decision) => decision.targets)
      .find((candidate) => candidate.room.gameName === 'F_Combat03');
    if (
      target === undefined ||
      target.contextualOwner.kind !== 'linearTarget' ||
      target.contextualOwner.interaction !== 'replaceable'
    ) {
      throw new Error('F combat target has no contextual room owner');
    }
    const reward = target.room.rewardControls.find((control) => control.kind === 'countedReward');
    if (reward === undefined) {
      throw new Error('F combat target has no counted reward control');
    }

    const roomInteraction = workspace.contextual.resolveRoom(target.contextualOwner.address);
    const rewardInteraction = workspace.contextual.resolveReward(reward.owner.address);
    expect(roomDomainScans).toBe(0);
    expect(countedRewardTypeResolutions).toBe(0);

    roomInteraction.load();
    expect(roomDomainScans).toBeGreaterThan(0);
    expect(countedRewardTypeResolutions).toBe(0);

    await rewardInteraction.load(rewardInteraction.selected);
    expect(countedRewardTypeResolutions).toBe(1);
    await rewardInteraction.load(rewardInteraction.selected);
    expect(countedRewardTypeResolutions).toBe(1);
  });

  it('discovers exact shop offer and purchase owners in a progressive prefix', () => {
    const g = createBiomeAddress('Underworld', 'G');
    let project = createGoldenFGHIProject(catalog);
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveBatch',
      continuation: createContinuationAddress(g, targetOccurrenceId('G', 6, 1)),
    });
    const workspace = projectWorkspace(project);
    const projected = linear(biome(workspace, 'G'));
    const shop = projected.decisions
      .flatMap((decision) => decision.targets)
      .find((target) => target.room.gameName === 'G_Shop01');
    const offer = shop?.room.rewardControls[0];

    expect(projected.source).toBe('progressive');
    expect(offer?.owner.address.kind).toBe('shopOffer');
    expect(offer?.marker.assessment).toBe('assessed');
    expect(offer?.kind).toBe('explicitReward');
    expect(offer?.kind === 'explicitReward' ? offer.purchaseMarker : undefined).toMatchObject({
      address: { kind: 'shopPurchase' },
      assessment: 'assessed',
    });
    expect(workspace.focusByOwner.get(offer!.marker.focusKey)?.nodeKey).toBe(
      shop?.room.marker.focusKey,
    );
    const purchaseMarker = offer?.kind === 'explicitReward' ? offer.purchaseMarker : undefined;
    expect(workspace.focusByOwner.get(purchaseMarker!.focusKey)?.nodeKey).toBe(
      shop?.room.marker.focusKey,
    );
  });

  it('focuses I terminal structure on the picked closing occurrence', () => {
    const { laterPreboss, project } = createRepeatedIPrebossProject();
    const projected = linear(biome(projectWorkspace(project), 'I'));
    const i = createBiomeAddress('Underworld', 'I');

    expect(projected.terminal.targets).toHaveLength(2);
    expect(projected.terminal.targets.map((target) => target.room.gameName)).toEqual([
      'I_PreBoss02',
      'I_Combat10',
    ]);
    expect(projected.terminal.marker.address).toEqual(
      createTargetAddress(i, createOccurrenceId('phase-6-i-terminal-peer'), 1),
    );
    expect(projected.terminal.targets.find((target) => target.picked)?.room.occurrenceId).toBe(
      laterPreboss,
    );
  });

  it('keeps O Trial selectable after replacement and exposes its fixed payload interaction', async () => {
    const originalWorkspace = projectWorkspace(createRepresentativeNOProject());
    const originalTrial = linear(biome(originalWorkspace, 'O'))
      .decisions.flatMap((decision) => decision.targets)
      .find((target) => target.room.occurrenceId === oOccurrenceIds.devotion);
    const reward = originalTrial?.room.rewardControls[0];
    if (reward === undefined) {
      throw new Error('O Trial has no fixed payload reward control');
    }
    const interaction = originalWorkspace.contextual.resolveReward(reward.owner.address);

    expect(reward).toMatchObject({
      kind: 'explicitReward',
      owner: { kind: 'incomingReward' },
      rewardTypes: ['Devotion'],
    });
    expect(interaction.selected).toEqual({
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'AresUpgrade',
        spurnedSource: 'HephaestusUpgrade',
      },
    });
    const domain = await interaction.load(interaction.selected);
    const chosenModel = interaction.model(domain, 'chosen', interaction.selected);
    expect(chosenModel.selected?.value.payload).toMatchObject({
      kind: 'DevotionPair',
      chosenSource: 'AresUpgrade',
    });
    expect(originalWorkspace.focusByOwner.get(reward.marker.focusKey)?.nodeKey).toBe(
      originalTrial?.room.marker.focusKey,
    );

    const replacedProject = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.devotion),
      gameName: 'O_Combat03',
    });
    const replacedWorkspace = projectWorkspace(replacedProject);
    const replacedTrial = linear(biome(replacedWorkspace, 'O'))
      .decisions.flatMap((decision) => decision.targets)
      .find((target) => target.room.occurrenceId === oOccurrenceIds.devotion);
    if (
      replacedTrial?.contextualOwner.kind !== 'linearTarget' ||
      replacedTrial.contextualOwner.interaction !== 'replaceable'
    ) {
      throw new Error('replaced O Trial target has no room picker');
    }

    expect(replacedTrial.room.gameName).toBe('O_Combat03');
    const replacementModel = replacedWorkspace.contextual
      .resolveRoom(replacedTrial.contextualOwner.address)
      .load();
    expect(
      replacementModel.sections
        .flatMap((section) => section.items)
        .map((item) => item.value.gameName),
    ).toContain('O_Devotion01');
  });

  it('resolves finding owners and structural owners to stable inspector destinations', () => {
    const f = createBiomeAddress('Underworld', 'F');
    const start = createOccurrenceId('structured-focus-start');
    let project = createProjectDocument(catalog, {
      projectId: 'structured-focus',
      name: 'Structured Focus',
      configuredBiomeCounts: { Underworld: 1 },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: f,
      occurrenceId: start,
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(f, start),
    });
    const evaluation = simulateProject(catalog, project);
    const workspace = projection.project(project, evaluation);
    const finding = evaluation.findings.find((candidate) => candidate.code === 'targetMissing');
    if (finding === undefined) {
      throw new Error('incomplete F decision has no target finding');
    }
    const destination = workspace.focusByOwner.get(semanticAddressKey(finding.origin));

    expect(destination).toMatchObject({
      ownerAddress: finding.origin,
      focusAddress: finding.origin,
      region: 'structure',
    });
  });

  it('rejects an evaluation prepared from a different authored-project identity', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'structured-identity',
      name: 'Structured Identity',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const changed = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: createBiomeAddress('Underworld', 'F'),
      occurrenceId: createOccurrenceId('structured-identity-start'),
      gameName: 'F_Opening01',
    });

    expect(() => projection.project(project, simulateProject(catalog, changed))).toThrow(
      'prepared project evaluation does not belong to the authored project identity',
    );
  });
});
