import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
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
  goldenIBiome,
} from '@run-planner/test-fixtures';
import { createRepresentativeNOPQProject } from '@run-planner/test-fixtures';
import {
  assembleWorkspaceDecision,
  type WorkspaceAuthoredBatchDecision,
  type WorkspaceAuthoredLinkedExitDecision,
} from './decision-assembly';
import {
  assembleWorkspaceOccurrence,
  type WorkspaceOccurrenceAssemblyRequest,
} from './occurrence-assembly';
import { createWorkspaceFieldsActiveCageCounts } from './fields-cage-counts';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from './occurrence-facts';
import { createWorkspaceBiomeMarkerDestinationBuilder } from '../navigation/marker-builder';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from '../source-index';

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
  const fieldsActiveCageCounts = createWorkspaceFieldsActiveCageCounts(catalog, source);
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
    const fieldsActiveCageCount = fieldsActiveCageCounts.countForOccurrence(
      input.occurrence.occurrenceId,
    );
    if (occurrenceFacts === undefined) {
      throw new Error(`${input.occurrence.occurrenceId} occurrence facts are missing`);
    }
    return assembleWorkspaceOccurrence({
      biome: source.biome,
      catalog,
      ...(input.evaluatedRoom === undefined ? {} : { evaluatedRoom: input.evaluatedRoom }),
      ...(fieldsActiveCageCount === undefined ? {} : { fieldsActiveCageCount }),
      facts: occurrenceFacts,
      markerDestinations: markers.emitter,
      occurrence: input.occurrence,
    });
  };
  return { assembleOccurrence, fieldsActiveCageCounts, markers };
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
      fieldsActiveCageCounts: kit.fieldsActiveCageCounts,
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
      fieldsActiveCageCounts: kit.fieldsActiveCageCounts,
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
      fieldsActiveCageCounts: kit.fieldsActiveCageCounts,
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
      fieldsActiveCageCounts: kit.fieldsActiveCageCounts,
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
      fieldsActiveCageCounts: kit.fieldsActiveCageCounts,
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
          control.kind === 'targetRoomPicker' && control.selectedGameName === 'I_PreBoss02',
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
        fieldsActiveCageCounts: kit.fieldsActiveCageCounts,
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
      fieldsActiveCageCounts: kit.fieldsActiveCageCounts,
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
      fieldsActiveCageCounts: beforeKit.fieldsActiveCageCounts,
      kind: 'batch',
      markerDestinations: beforeKit.markers.emitter,
      source: beforeSetup,
    });
    if (before.kind !== 'batch') throw new Error('F setup decision is not a batch');
    expect(
      before.batch.missingTargets.every(
        (target) => target.authoring.kind === 'awaitingBatchRewardStore',
      ),
    ).toBe(true);
    expect(before.roomControls).toEqual([]);

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
      fieldsActiveCageCounts: afterKit.fieldsActiveCageCounts,
      kind: 'batch',
      markerDestinations: afterKit.markers.emitter,
      source: afterSetup,
    });
    if (after.kind !== 'batch') throw new Error('configured F decision is not a batch');
    expect(after.batch.missingTargets.map((target) => target.authoring)).toEqual([
      { kind: 'ready' },
    ]);
    expect(after.roomControls).toHaveLength(1);
    expect(after.roomControls[0]?.address).toEqual(after.batch.missingTargets[0]?.owner);
  });

  it('projects exact repair scope for unavailable authored exits', () => {
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
      fieldsActiveCageCounts: kit.fieldsActiveCageCounts,
      kind: 'batch',
      markerDestinations: kit.markers.emitter,
      source,
    });
    if (assembly.kind !== 'batch') throw new Error('narrowed F decision is not a batch');

    expect(assembly.batch.targets.map((target) => [target.exitKey, target.physicalState])).toEqual([
      ['exit1', 'available'],
      ['exit2', 'unavailable'],
    ]);
    expect(assembly.batch.repairScope).toEqual({
      command: { kind: 'ReconcileBatchExitCapacity', decision: assembly.batch.owner },
      commandKind: 'ReconcileBatchExitCapacity',
      owner: assembly.batch.owner,
      removedDecisionOwners: [],
      removedOccurrenceIds: [goldenFOccurrenceId(2, 2)],
    });
  });

  it('retains repair scopes for physically unavailable ordinary and takeover batches in blocked suffixes', () => {
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
      fieldsActiveCageCounts: fKit.fieldsActiveCageCounts,
      kind: 'batch',
      markerDestinations: fKit.markers.emitter,
      source: fSource,
    });
    if (f.kind !== 'batch') throw new Error('blocked F ordinary batch is missing');
    expect(f.batch).toMatchObject({
      repairScope: {
        command: { kind: 'ReconcileBatchExitCapacity', decision: fOwner },
        commandKind: 'ReconcileBatchExitCapacity',
        owner: fOwner,
        removedOccurrenceIds: [goldenFOccurrenceId(2, 2)],
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
      fieldsActiveCageCounts: gKit.fieldsActiveCageCounts,
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
      repairScope: {
        commandKind: 'ReconcileTakeoverBatch',
        owner: g.batch.owner,
        removedOccurrenceIds: unavailable,
      },
      topologyState: 'retained',
    });
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
      fieldsActiveCageCounts: kit.fieldsActiveCageCounts,
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
