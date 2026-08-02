import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
} from '@run-planner/test-fixtures';
import { createRepresentativeNOPQProject } from '@run-planner/test-fixtures';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  assembleWorkspaceDecision,
  type WorkspaceAuthoredBatchDecision,
  type WorkspaceAuthoredLinkedExitDecision,
} from './decision-assembly';
import {
  assembleWorkspaceOccurrence,
  type WorkspaceOccurrenceAssemblyRequest,
} from './occurrence-assembly';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from './occurrence-facts';
import { createWorkspaceBiomeMarkerDestinationBuilder } from '../navigation/marker-builder';
import {
  createWorkspaceProjectSourceIndex,
  type WorkspaceBiomeSource,
  type WorkspaceEvaluatedBatchOverlay,
} from '../source-index';

function biomeSource(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
): WorkspaceBiomeSource {
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    simulateProject(catalog, project),
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function decisionKit(source: WorkspaceBiomeSource) {
  const facts = createWorkspaceBiomeOccurrenceAssemblyFacts(source);
  const markers = createWorkspaceBiomeMarkerDestinationBuilder({
    assessmentFor: (address) =>
      source.evaluation === undefined
        ? 'blocked'
        : source.isAssessed(address) || source.findingsFor(address).length > 0
          ? 'assessed'
          : 'unassessed',
    biome: source.biome,
    findingCountFor: (address) => source.findingsFor(address).length,
    routeKey: source.biome.routeKey,
  });
  const assembleOccurrence = (input: WorkspaceOccurrenceAssemblyRequest) => {
    const occurrenceFacts = facts.occurrence(input.occurrence.occurrenceId);
    if (occurrenceFacts === undefined) {
      throw new Error(`${input.occurrence.occurrenceId} occurrence facts are missing`);
    }
    return assembleWorkspaceOccurrence({
      biome: source.biome,
      catalog,
      ...(input.evaluatedRoom === undefined ? {} : { evaluatedRoom: input.evaluatedRoom }),
      ...(input.fieldsBatchFacts === undefined ? {} : { fieldsBatchFacts: input.fieldsBatchFacts }),
      facts: occurrenceFacts,
      markerDestinations: markers.emitter,
      occurrence: input.occurrence,
    });
  };
  return { assembleOccurrence, markers };
}

function batchDecision(source: WorkspaceBiomeSource): WorkspaceAuthoredBatchDecision {
  const decision = source.exitDecisions.find(
    (candidate) => candidate.normal.kind === 'batch' && candidate.normal.targets.length > 1,
  );
  if (decision?.normal.kind !== 'batch') throw new Error('multi-target authored batch is missing');
  return decision as WorkspaceAuthoredBatchDecision;
}

function batchDecisionAt(
  source: WorkspaceBiomeSource,
  occurrenceId: string,
): WorkspaceAuthoredBatchDecision {
  const decision = source.exitDecisions.find(
    (candidate) =>
      candidate.normal.kind === 'batch' &&
      candidate.source.kind === 'occurrence' &&
      candidate.source.occurrenceId === occurrenceId,
  );
  if (decision?.normal.kind !== 'batch') throw new Error('authored batch is missing');
  return decision as WorkspaceAuthoredBatchDecision;
}

function linkedDecision(source: WorkspaceBiomeSource): WorkspaceAuthoredLinkedExitDecision {
  const decision = source.exitDecisions.find((candidate) => candidate.normal.kind === 'linked');
  if (decision?.normal.kind !== 'linked') throw new Error('authored linked exit is missing');
  return decision as WorkspaceAuthoredLinkedExitDecision;
}

function catalogWithNonFieldsBoundedRoom(gameName: string): Catalog {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) throw new Error(`catalog has no ${gameName}`);
  const replacement: RoomDeclaration = {
    ...room,
    mode: { kind: 'authored', templateKey: 'StandardCombat' },
  };
  return {
    ...catalog,
    rooms: {
      ...catalog.rooms,
      byKey: { ...catalog.rooms.byKey, [gameName]: replacement },
      values: catalog.rooms.values.map((candidate) =>
        candidate.gameName === gameName ? replacement : candidate,
      ),
    },
  };
}

function withUnresolvedFOpening(project: ProjectDocument): ProjectDocument {
  return {
    ...project,
    routes: project.routes.map((route) =>
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
                      decisions: plan.topology.decisions.map((decision) =>
                        decision.kind === 'exit' &&
                        decision.source.kind === 'occurrence' &&
                        decision.source.occurrenceId === goldenFStartId
                          ? { ...decision, selection: { kind: 'unresolved' as const } }
                          : decision,
                      ),
                    },
                  },
            ),
          },
    ),
  };
}

describe('structured workspace decision assembly', () => {
  it('returns authored physical targets, workbenches, controls, and decision focus redirects', () => {
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'F');
    const decision = batchDecision(source);
    const owner = createExitDecisionAddress(source.biome, decision.source);
    const evaluated = source.evaluatedBatch(owner);
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision,
      ...(evaluated === undefined ? {} : { evaluated }),
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });

    if (assembly.kind !== 'batch') throw new Error('batch produced a linked-exit assembly');
    expect(assembly.batch.targets.map((target) => target.index)).toEqual(
      [...assembly.batch.targets].map((target) => target.index).sort((left, right) => left - right),
    );
    expect(assembly.batch.targets.filter((target) => target.selected)).toHaveLength(1);
    expect(assembly.workbenches).toHaveLength(assembly.batch.targets.length);
    expect(assembly.roomControls.some((control) => control.kind === 'targetRoomPicker')).toBe(true);
    const selected = assembly.batch.targets.find((target) => target.selected);
    if (selected === undefined) throw new Error('selected target is missing');
    expect(
      assembly.roomControls.find(
        (control) =>
          control.kind === 'targetRoomPicker' &&
          semanticAddressKey(control.address) === selected.marker.focusKey,
      ),
    ).toEqual({
      address: selected.marker.address,
      kind: 'targetRoomPicker',
      target: {
        kind: 'existing',
        occurrence: selected.room.address,
        selectedGameName: selected.room.gameName,
      },
    });
    expect(kit.markers.destinations().get(selected.marker.focusKey)?.nodeKey).toBe(
      assembly.batch.key,
    );
    expect(kit.markers.destinations().get(selected.room.marker.focusKey)?.nodeKey).toBe(
      assembly.batch.key,
    );
  });

  it('retains authored batch membership when no evaluated overlay is supplied', () => {
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'F');
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision: batchDecision(source),
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });

    if (assembly.kind !== 'batch') throw new Error('batch produced a linked-exit assembly');
    expect(assembly.batch.targets.every((target) => target.retained)).toBe(true);
    expect(assembly.workbenches.map((workbench) => workbench.room.occurrenceId)).toEqual(
      assembly.batch.targets.map((target) => target.room.occurrenceId),
    );
  });

  it('keeps an unavailable canonical target continuation ahead of the fallback', () => {
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'F');
    const decision = batchDecision(source);
    const owner = createExitDecisionAddress(source.biome, decision.source);
    const evaluated = source.evaluatedBatch(owner);
    if (evaluated === undefined) throw new Error('F evaluated batch is missing');
    const selected = evaluated.batch.targets.find((target) => target.picked);
    if (selected === undefined) throw new Error('F selected target is missing');
    const unavailable: WorkspaceEvaluatedBatchOverlay = {
      ...evaluated,
      batch: {
        ...evaluated.batch,
        targets: evaluated.batch.targets.map((target) =>
          target.exit.exitKey === selected.exit.exitKey
            ? {
                ...target,
                continuation: 'startsCompletion',
                exit: {
                  kind: 'unavailable',
                  exitKey: target.exit.exitKey,
                  index: target.exit.index,
                },
              }
            : target,
        ),
      },
    };
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision,
      evaluated: unavailable,
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch') throw new Error('F unavailable target is not a batch');
    const target = assembly.batch.targets.find((candidate) => candidate.selected);

    expect(target).toMatchObject({
      physicalState: 'unavailable',
      nextPath: 'startsCompletion',
    });
  });

  it('maps retained Fields facts into the decision summary and cage surface', () => {
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'H');
    const decision = source.exitDecisions.find(
      (candidate) =>
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.some(
          (target) => source.occurrence(target.occurrenceId)?.state.kind === 'fieldsCombat',
        ),
    );
    if (decision?.normal.kind !== 'batch') throw new Error('H Fields decision is missing');
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision: decision as WorkspaceAuthoredBatchDecision,
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch') throw new Error('H Fields decision is not a batch');
    const fieldsWorkbench = assembly.workbenches.find(
      (workbench) => workbench.room.roomLocal.kind === 'fields',
    );
    if (fieldsWorkbench?.room.roomLocal.kind !== 'fields') {
      throw new Error('H Fields workbench is missing');
    }

    expect(assembly.batch.fieldsCageOutcome).toBeDefined();
    expect(assembly.batch.effectiveRewardStore).toBeUndefined();
    expect(assembly.batch.fields).toMatchObject({
      cageOutcome: 'min',
      cageTargetCount: 1,
      doorCageRewardCount: 2,
    });
    expect(fieldsWorkbench.room.roomLocal.cages.map((cage) => cage.active)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('projects a forced final shared store separately from the authored base store', () => {
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'F');
    const decision = batchDecisionAt(source, goldenFOccurrenceId(4, 1));
    if (
      decision.normal.rewardStore.kind !== 'authoredBaseStore' ||
      decision.normal.rewardStore.baseRewardStoreKey !== 'MetaProgress'
    ) {
      throw new Error('F reward-store fixture lost its authored Minor Reward batch');
    }
    const owner = createExitDecisionAddress(goldenFBiome, decision.source);
    const evaluated = source.evaluatedBatch(owner);
    if (evaluated === undefined) throw new Error('F reward-store fixture is not evaluated');
    const overridden: WorkspaceEvaluatedBatchOverlay = Object.freeze({
      ...evaluated,
      batch: Object.freeze({
        ...evaluated.batch,
        resolvedSharedRewardStoreKey: 'RunProgress',
      }),
    });
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision,
      evaluated: overridden,
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch') throw new Error('F reward-store decision is not a batch');

    expect(assembly.batch.effectiveRewardStore).toEqual({
      label: 'Major Reward',
      storeKey: 'RunProgress',
    });
  });

  it('keeps authored-active Fields cages reachable beyond a clamped target overlay', () => {
    const sourceOccurrenceId = createOccurrenceId('golden-h-combat02');
    const retainedOccurrenceId = createOccurrenceId('golden-h-combat03');
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'H');
    const decision = batchDecisionAt(source, sourceOccurrenceId);
    const owner = createExitDecisionAddress(goldenHBiome, decision.source);
    const evaluated = source.evaluatedBatch(owner);
    if (evaluated === undefined || evaluated.batch.targets.length !== 2) {
      throw new Error('H two-door evaluated Fields batch is missing');
    }
    const clamped: WorkspaceEvaluatedBatchOverlay = Object.freeze({
      batch: Object.freeze({
        ...evaluated.batch,
        targets: Object.freeze(evaluated.batch.targets.slice(0, 1)),
      }),
      partial: true,
    });
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision,
      evaluated: clamped,
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch') throw new Error('H clamped Fields decision is not a batch');
    const retainedWorkbench = assembly.workbenches.find(
      (workbench) => workbench.room.occurrenceId === retainedOccurrenceId,
    );
    if (retainedWorkbench?.room.roomLocal.kind !== 'fields') {
      throw new Error('H retained Fields workbench is missing');
    }

    expect(retainedWorkbench.room.entered).toBe(false);
    expect(retainedWorkbench.room.roomLocal.cages.map((cage) => cage.active)).toEqual([
      true,
      true,
      false,
    ]);
    const repairOwner = createLocalRewardAddress(
      goldenHBiome,
      retainedOccurrenceId,
      'cages',
      'cage2',
    );
    expect(retainedWorkbench.room.roomLocal.cages[1]).toMatchObject({
      active: true,
      control: {
        marker: { address: repairOwner },
        owner: { address: repairOwner },
      },
    });
  });

  it('keeps the Fields outcome control available while a retained batch awaits its outcome', () => {
    const start = createOccurrenceId('retained-fields-awaiting-start');
    let project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 3 },
      name: 'Retained Fields awaiting outcome',
      projectId: 'retained-fields-awaiting-outcome',
    });
    project = applyProjectCommand(project, catalog, {
      biome: goldenHBiome,
      kind: 'CreateStart',
      occurrenceId: start,
    });
    const owner = createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: start,
    });
    project = applyProjectCommand(project, catalog, { decision: owner, kind: 'CreateBatch' });
    const source = biomeSource(project, 'Underworld', 'H');
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision: batchDecisionAt(source, start),
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch') throw new Error('awaiting H decision is not a batch');

    expect(assembly.batch.fieldsCageOutcome).toBeDefined();
    expect(assembly.batch.fields).toBeUndefined();
    expect(assembly.batch.missingTargets.map((target) => target.authoring)).toEqual([
      {
        kind: 'awaitingFieldsCageOutcome',
        message: 'Choose the Fields door roll first.',
      },
    ]);
    expect(assembly.roomControls).toMatchObject([
      {
        address: assembly.batch.missingTargets[0]?.marker.address,
        decisionOwner: owner,
        kind: 'decisionEntryRoomPicker',
        ordinaryTargetAuthoring: {
          kind: 'awaitingFieldsCageOutcome',
          message: 'Choose the Fields door roll first.',
        },
        ordinaryTargetGameNames: expect.arrayContaining(['H_Combat02']),
        takeoverGameNames: ['H_PreBoss01'],
      },
    ]);
  });

  it('keeps Fields policy facts while excluding a non-Fields bounded target from capacity', () => {
    const initialProject = createGoldenFGHIProject();
    const initialSource = biomeSource(initialProject, 'Underworld', 'H');
    const initialDecision = initialSource.exitDecisions.find(
      (candidate) =>
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.some(
          (target) => initialSource.occurrence(target.occurrenceId)?.gameName === 'H_Combat09',
        ),
    );
    if (initialDecision?.normal.kind !== 'batch') {
      throw new Error('H bounded-target batch is missing');
    }
    const project = applyProjectCommand(initialProject, catalog, {
      cageOutcome: 'max',
      decision: createExitDecisionAddress(initialSource.biome, initialDecision.source),
      kind: 'ReplaceFieldsCageOutcome',
    });
    const source = biomeSource(project, 'Underworld', 'H');
    const decision = source.exitDecisions.find(
      (candidate) =>
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.some(
          (target) => source.occurrence(target.occurrenceId)?.gameName === 'H_Combat09',
        ),
    );
    if (decision?.normal.kind !== 'batch')
      throw new Error('configured H bounded-target batch is missing');
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog: catalogWithNonFieldsBoundedRoom('H_Combat09'),
      decision: decision as WorkspaceAuthoredBatchDecision,
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch') throw new Error('H bounded-target decision is not a batch');

    expect(assembly.batch.fieldsCageOutcome).toBeDefined();
    expect(assembly.batch.fields).toMatchObject({
      cageOutcome: 'max',
      cageTargetCount: 1,
      doorCageRewardCount: 3,
    });
  });

  it('withholds Fields controls and facts from a retained mixed takeover batch', () => {
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'H');
    const decision = source.exitDecisions.find(
      (candidate) => candidate.normal.kind === 'batch' && candidate.normal.targets.length > 1,
    );
    if (decision?.normal.kind !== 'batch') throw new Error('multi-target H batch is missing');
    const fieldsTarget = decision.normal.targets.find(
      (target) => source.occurrence(target.occurrenceId)?.state.kind === 'fieldsCombat',
    );
    const takeoverTarget = decision.normal.targets.find(
      (target) => target.occurrenceId !== fieldsTarget?.occurrenceId,
    );
    const preboss = source.plan.topology?.occurrences.find(
      (occurrence) => occurrence.gameName === 'H_PreBoss01',
    );
    if (fieldsTarget === undefined || takeoverTarget === undefined || preboss === undefined) {
      throw new Error('H mixed takeover fixture is missing');
    }
    const mixedSource: WorkspaceBiomeSource = {
      ...source,
      occurrence: (occurrenceId) =>
        occurrenceId === takeoverTarget.occurrenceId
          ? { ...preboss, occurrenceId }
          : source.occurrence(occurrenceId),
    };
    const kit = decisionKit(mixedSource);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision: decision as WorkspaceAuthoredBatchDecision,
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source: mixedSource,
    });
    if (assembly.kind !== 'batch') throw new Error('mixed H decision is not a batch');
    const fieldsWorkbench = assembly.workbenches.find(
      (workbench) => workbench.room.occurrenceId === fieldsTarget.occurrenceId,
    );
    if (fieldsWorkbench?.room.roomLocal.kind !== 'fields') {
      throw new Error('mixed H batch lost its Fields workbench');
    }

    expect(assembly.batch.fieldsCageOutcome).toBeUndefined();
    expect(assembly.batch.fields).toBeUndefined();
    expect(fieldsWorkbench.room.roomLocal.cages.every((cage) => !cage.active)).toBe(true);
  });

  it('keeps a retained authored suffix and its focus destinations after an unresolved prefix', () => {
    const source = biomeSource(
      withUnresolvedFOpening(createGoldenFGHIProject()),
      'Underworld',
      'F',
    );
    const decision = batchDecisionAt(source, goldenFOccurrenceId(1, 1));
    const owner = createExitDecisionAddress(goldenFBiome, decision.source);
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision,
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch') throw new Error('retained F suffix is not a batch');
    const retainedTarget = assembly.batch.targets.find(
      (target) => target.room.rewardControls.length > 0,
    );
    if (retainedTarget === undefined) throw new Error('retained F reward target is missing');

    expect(source.evaluatedBatch(owner)).toBeUndefined();
    expect(assembly.batch.topologyState).toBe('retained');
    expect(assembly.batch.marker.assessment).toBe('unassessed');
    expect(assembly.batch.targets.every((target) => target.retained)).toBe(true);
    expect(
      assembly.batch.targets.every((target) => target.marker.assessment === 'unassessed'),
    ).toBe(true);
    expect(kit.markers.destinations().get(retainedTarget.room.marker.focusKey)?.nodeKey).toBe(
      assembly.batch.key,
    );
    expect(
      kit.markers.destinations().get(retainedTarget.room.rewardControls[0]!.marker.focusKey)
        ?.nodeKey,
    ).toBe(assembly.batch.key);
  });

  it('keeps takeover targets read-only at the decision-owned batch boundary', () => {
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'F');
    const decision = source.exitDecisions.find(
      (candidate) =>
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.some(
          (target) => source.occurrence(target.occurrenceId)?.gameName === 'F_PreBoss01',
        ),
    );
    if (decision?.normal.kind !== 'batch') throw new Error('F takeover batch is missing');
    const owner = createExitDecisionAddress(goldenFBiome, decision.source);
    const kit = decisionKit(source);
    const evaluated = source.evaluatedBatch(owner);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision: decision as WorkspaceAuthoredBatchDecision,
      ...(evaluated === undefined ? {} : { evaluated }),
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch' || assembly.batch.kind !== 'takeoverBatch') {
      throw new Error('F takeover decision was not classified as a takeover batch');
    }

    expect(assembly.batch.targetInteraction).toBe('readOnly');
    expect(assembly.roomControls).toEqual([]);
  });

  it('keeps I’s mixed Preboss target replaceable with its decision-owned room picker', () => {
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'I');
    const decision = source.exitDecisions.find(
      (candidate) =>
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.some(
          (target) => source.occurrence(target.occurrenceId)?.gameName === 'I_PreBoss02',
        ),
    );
    if (decision?.normal.kind !== 'batch') throw new Error('I mixed Preboss batch is missing');
    const owner = createExitDecisionAddress(goldenIBiome, decision.source);
    const kit = decisionKit(source);
    const evaluated = source.evaluatedBatch(owner);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision: decision as WorkspaceAuthoredBatchDecision,
      ...(evaluated === undefined ? {} : { evaluated }),
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch' || assembly.batch.kind !== 'mixedBatch') {
      throw new Error('I Preboss decision was not classified as a mixed batch');
    }

    expect(assembly.batch.targetInteraction).toBe('replaceable');
    expect(
      assembly.roomControls.find(
        (control) =>
          control.kind === 'targetRoomPicker' &&
          control.target.kind === 'existing' &&
          control.target.selectedGameName === 'I_PreBoss02',
      ),
    ).toMatchObject({ kind: 'targetRoomPicker' });
  });

  it.each([
    ['F', 'Underworld', createGoldenFGHIProject, 'F_PreBoss01'],
    ['G', 'Underworld', createGoldenFGHIProject, 'G_PreBoss01'],
    ['H', 'Underworld', createGoldenFGHIProject, 'H_PreBoss01'],
    ['N', 'Surface', createRepresentativeNOPQProject, 'N_PreBoss01'],
    ['O', 'Surface', createRepresentativeNOPQProject, 'O_PreBoss01'],
    ['P', 'Surface', createRepresentativeNOPQProject, 'P_PreBoss01'],
    ['Q', 'Surface', createRepresentativeNOPQProject, 'Q_PreBoss01'],
  ] as const)(
    'keeps %s Preboss takeover targets read-only at their decision boundary',
    (biomeKey, routeKey, project, prebossGameName) => {
      const source = biomeSource(project(), routeKey, biomeKey);
      const decision = source.exitDecisions.find(
        (candidate) =>
          candidate.normal.kind === 'batch' &&
          candidate.normal.targets.some(
            (target) => source.occurrence(target.occurrenceId)?.gameName === prebossGameName,
          ),
      );
      if (decision?.normal.kind !== 'batch') {
        throw new Error(`${biomeKey} Preboss takeover batch is missing`);
      }
      const owner = createExitDecisionAddress(source.biome, decision.source);
      const kit = decisionKit(source);
      const evaluated = source.evaluatedBatch(owner);
      const assembly = assembleWorkspaceDecision({
        assembleOccurrence: kit.assembleOccurrence,
        catalog,
        decision: decision as WorkspaceAuthoredBatchDecision,
        ...(evaluated === undefined ? {} : { evaluated }),
        kind: 'batch',
        markerDestinations: kit.markers.emitter,
        source,
      });
      if (assembly.kind !== 'batch' || assembly.batch.kind !== 'takeoverBatch') {
        throw new Error(`${biomeKey} Preboss decision is not a takeover batch`);
      }

      expect(assembly.batch.targetInteraction).toBe('readOnly');
      expect(assembly.roomControls).toEqual([]);
    },
  );

  it('keeps the linked PreHub workbench as the exact staged-removal focus destination', () => {
    const source = biomeSource(createRepresentativeNOPQProject(), 'Surface', 'N');
    const decision = linkedDecision(source);
    const owner = createExitDecisionAddress(source.biome, decision.source);
    const evaluated = source.evaluatedLinkedExit(owner);
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision,
      ...(evaluated === undefined ? {} : { evaluated }),
      kind: 'linkedExit',
      markerDestinations: kit.markers.emitter,
      source,
    });

    if (assembly.kind !== 'linkedExit') throw new Error('linked exit produced a batch assembly');
    expect(assembly.workbench.sourceDecisionRemoval?.label).toBe('Remove PreHub');
    expect(assembly.node.target.selected).toBe(true);
    expect(assembly.node.target.retained).toBe(false);
    expect(kit.markers.destinations().get(assembly.node.target.marker.focusKey)?.nodeKey).toBe(
      assembly.workbench.key,
    );
    expect(semanticAddressKey(assembly.node.owner)).toBe(semanticAddressKey(owner));
  });

  it('uses the engine continuation fallback for unpicked and linked Preboss targets', () => {
    const fSource = biomeSource(createGoldenFGHIProject(), 'Underworld', 'F');
    const fDecision = fSource.exitDecisions.find(
      (candidate) =>
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.some(
          (target) => fSource.occurrence(target.occurrenceId)?.gameName === 'F_PreBoss01',
        ),
    );
    if (fDecision?.normal.kind !== 'batch') throw new Error('F Preboss batch is missing');
    const fKit = decisionKit(fSource);
    const fAssembly = assembleWorkspaceDecision({
      assembleOccurrence: fKit.assembleOccurrence,
      catalog,
      decision: fDecision as WorkspaceAuthoredBatchDecision,
      kind: 'batch',
      markerDestinations: fKit.markers.emitter,
      source: fSource,
    });
    if (fAssembly.kind !== 'batch') throw new Error('F Preboss decision is not a batch');
    expect(
      fAssembly.batch.targets.find(
        (target) => !target.selected && target.room.gameName === 'F_PreBoss01',
      )?.nextPath,
    ).toBe('deadLeaf');

    const nSource = biomeSource(createRepresentativeNOPQProject(), 'Surface', 'N');
    const nDecision = linkedDecision(nSource);
    const linkedTarget = nSource.occurrence(nDecision.normal.occurrenceId);
    const preboss = nSource.plan.topology?.occurrences.find(
      (occurrence) => occurrence.gameName === 'N_PreBoss01',
    );
    if (linkedTarget === undefined || preboss === undefined) {
      throw new Error('N linked Preboss fixture is missing');
    }
    const linkedPrebossSource: WorkspaceBiomeSource = {
      ...nSource,
      occurrence: (occurrenceId) =>
        occurrenceId === linkedTarget.occurrenceId
          ? { ...preboss, occurrenceId }
          : nSource.occurrence(occurrenceId),
    };
    const nKit = decisionKit(linkedPrebossSource);
    const nAssembly = assembleWorkspaceDecision({
      assembleOccurrence: nKit.assembleOccurrence,
      catalog,
      decision: nDecision,
      kind: 'linkedExit',
      markerDestinations: nKit.markers.emitter,
      source: linkedPrebossSource,
    });
    if (nAssembly.kind !== 'linkedExit') throw new Error('N Preboss target is not linked');
    expect(nAssembly.node.target.nextPath).toBe('startsCompletion');
  });

  it('publishes only the next physical target after declaration-owned batch setup', () => {
    const startId = createOccurrenceId('decision-assembly-setup-start');
    let project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      name: 'Decision assembly setup',
      projectId: 'decision-assembly-setup',
    });
    project = applyProjectCommand(project, catalog, {
      biome: goldenFBiome,
      gameName: 'F_Opening01',
      kind: 'CreateStart',
      occurrenceId: startId,
    });
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    project = applyProjectCommand(project, catalog, { decision: owner, kind: 'CreateBatch' });
    const beforeSetup = biomeSource(project, 'Underworld', 'F');
    const beforeKit = decisionKit(beforeSetup);
    const before = assembleWorkspaceDecision({
      assembleOccurrence: beforeKit.assembleOccurrence,
      catalog,
      decision: batchDecisionAt(beforeSetup, startId),
      kind: 'batch',
      markerDestinations: beforeKit.markers.emitter,
      source: beforeSetup,
    });
    if (before.kind !== 'batch') throw new Error('F setup decision is not a batch');
    expect(before.batch.missingTargets[0]?.authoring).toEqual({
      kind: 'awaitingBatchRewardStore',
      message: 'Choose the reward pool first.',
    });
    expect(
      before.batch.missingTargets.every(
        (target) => target.authoring.kind === 'awaitingBatchRewardStore',
      ),
    ).toBe(true);
    expect(before.roomControls).toMatchObject([
      {
        address: before.batch.missingTargets[0]?.marker.address,
        decisionOwner: owner,
        kind: 'decisionEntryRoomPicker',
        ordinaryTargetAuthoring: {
          kind: 'awaitingBatchRewardStore',
          message: 'Choose the reward pool first.',
        },
        ordinaryTargetGameNames: expect.arrayContaining(['F_Combat01']),
        takeoverGameNames: ['F_PreBoss01'],
      },
    ]);
    expect(beforeKit.markers.destinations().get(semanticAddressKey(owner))?.nodeKey).toBe(
      before.batch.key,
    );
    expect(
      beforeKit.markers.destinations().get(before.batch.missingTargets[0]?.marker.focusKey ?? '')
        ?.nodeKey,
    ).toBe(before.batch.key);

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, owner.source),
      storeKey: 'RunProgress',
    });
    const afterSetup = biomeSource(project, 'Underworld', 'F');
    const afterKit = decisionKit(afterSetup);
    const after = assembleWorkspaceDecision({
      assembleOccurrence: afterKit.assembleOccurrence,
      catalog,
      decision: batchDecisionAt(afterSetup, startId),
      kind: 'batch',
      markerDestinations: afterKit.markers.emitter,
      source: afterSetup,
    });
    if (after.kind !== 'batch') throw new Error('configured F decision is not a batch');
    expect(after.batch.missingTargets.map((target) => target.authoring)).toEqual([
      { kind: 'ready' },
    ]);
    expect(after.roomControls).toHaveLength(1);
    expect(after.roomControls[0]).toMatchObject({
      address: after.batch.missingTargets[0]?.marker.address,
      decisionOwner: owner,
      kind: 'decisionEntryRoomPicker',
      ordinaryTargetAuthoring: { kind: 'ready' },
      ordinaryTargetGameNames: expect.arrayContaining(['F_Combat01']),
      takeoverGameNames: ['F_PreBoss01'],
    });
  });

  it('projects an exact repair intent for unavailable authored exits', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      gameName: 'F_Combat01',
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
    });
    const source = biomeSource(project, 'Underworld', 'F');
    const decision = source.exitDecisions.find(
      (candidate) =>
        candidate.normal.kind === 'batch' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === goldenFOccurrenceId(1, 1),
    );
    if (decision?.normal.kind !== 'batch') throw new Error('narrowed F batch is missing');
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision: decision as WorkspaceAuthoredBatchDecision,
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch') throw new Error('narrowed F decision is not a batch');

    expect(assembly.batch.targets.map((target) => [target.exitKey, target.physicalState])).toEqual([
      ['exit1', 'available'],
      ['exit2', 'unavailable'],
    ]);
    expect(assembly.batch.repairIntent).toEqual({
      command: { kind: 'ReconcileBatchExitCapacity', decision: assembly.batch.owner },
      focus: { owner: assembly.batch.owner, timing: 'before' },
    });
  });

  it('retains repair controls for physically unavailable ordinary and takeover batches in blocked suffixes', () => {
    const fOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });
    let fProject = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      gameName: 'F_Combat01',
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
    });
    fProject = applyProjectCommand(fProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const fSource = biomeSource(fProject, 'Underworld', 'F');
    const fKit = decisionKit(fSource);
    const f = assembleWorkspaceDecision({
      assembleOccurrence: fKit.assembleOccurrence,
      catalog,
      decision: batchDecisionAt(fSource, goldenFOccurrenceId(1, 1)),
      kind: 'batch',
      markerDestinations: fKit.markers.emitter,
      source: fSource,
    });
    if (f.kind !== 'batch') throw new Error('blocked F ordinary batch is missing');
    expect(f.batch).toMatchObject({
      repairIntent: {
        command: { kind: 'ReconcileBatchExitCapacity', decision: fOwner },
        focus: { owner: fOwner, timing: 'before' },
      },
      topologyState: 'retained',
    });
    expect(f.batch.targets).toContainEqual(
      expect.objectContaining({ exitKey: 'exit2', index: 2, physicalState: 'unavailable' }),
    );

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
    let gProject = applyProjectCommand(base, catalog, {
      gameName: 'G_MiniBoss02',
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, gTakeover.source.occurrenceId),
    });
    gProject = applyProjectCommand(gProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const gSource = biomeSource(gProject, 'Underworld', 'G');
    const gDecision = gSource.exitDecision(gTakeover.source);
    if (gDecision?.normal.kind !== 'batch') throw new Error('blocked G takeover batch is missing');
    const gKit = decisionKit(gSource);
    const g = assembleWorkspaceDecision({
      assembleOccurrence: gKit.assembleOccurrence,
      catalog,
      decision: gDecision as WorkspaceAuthoredBatchDecision,
      kind: 'batch',
      markerDestinations: gKit.markers.emitter,
      source: gSource,
    });
    if (g.kind !== 'batch' || g.batch.kind !== 'takeoverBatch') {
      throw new Error('blocked G takeover batch is missing');
    }
    const unavailable = g.batch.targets
      .filter((target) => target.physicalState === 'unavailable')
      .map((target) => target.room.occurrenceId);
    expect(unavailable).not.toHaveLength(0);
    expect(g.batch).toMatchObject({
      topologyState: 'retained',
    });
    expect(g.batch.repairIntent).toBeUndefined();
  });

  it('keeps a reward-invalid physical peer as an authored target rather than a missing exit', () => {
    const peer = goldenFOccurrenceId(2, 2);
    const rewardInvalid = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, peer),
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    const project = applyProjectCommand(rewardInvalid, catalog, {
      decision: createExitDecisionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(10, 1),
      }),
      kind: 'RemoveExitDecision',
    });
    const source = biomeSource(project, 'Underworld', 'F');
    const decision = source.exitDecisions.find(
      (candidate) =>
        candidate.normal.kind === 'batch' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === goldenFOccurrenceId(1, 1),
    );
    if (decision?.normal.kind !== 'batch') throw new Error('F peer decision is missing');
    const kit = decisionKit(source);
    const assembly = assembleWorkspaceDecision({
      assembleOccurrence: kit.assembleOccurrence,
      catalog,
      decision: decision as WorkspaceAuthoredBatchDecision,
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch') throw new Error('F peer decision is not a batch');

    expect(assembly.batch.targets.map((target) => target.room.occurrenceId)).toEqual([
      goldenFOccurrenceId(2, 1),
      peer,
    ]);
    expect(assembly.batch.missingTargets).toEqual([]);
    const retainedPeer = assembly.batch.targets.find((target) => target.room.occurrenceId === peer);
    if (retainedPeer === undefined) throw new Error('reward-invalid F peer is missing');
    expect(assembly.batch.topologyState).toBe('retained');
    expect(retainedPeer.retained).toBe(true);
    expect(retainedPeer.room.rewardControls).toHaveLength(1);
  });
});
