import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
} from '../../../../../../test/fixtures/authored-project';
import { assembleWorkspaceHub } from './hub-assembly';
import {
  assembleWorkspaceOccurrence,
  type WorkspaceOccurrenceAssemblyRequest,
} from './occurrence-assembly';
import { createWorkspaceFieldsActiveCageCounts } from './fields-cage-counts';
import { createWorkspaceBiomeOccurrenceAssemblyFacts } from './occurrence-facts';
import { createWorkspaceBiomeMarkerDestinationBuilder } from '../navigation/marker-builder';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from '../source-index';

function biomeSource(project: ProjectDocument): WorkspaceBiomeSource {
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    project,
    simulateProject(catalog, project),
  )
    .routes.find((route) => route.routeKey === 'Surface')
    ?.biomes.find((biome) => biome.plan.biomeKey === 'N');
  if (source === undefined) throw new Error('Surface/N source is missing');
  return source;
}

function hubKit(source: WorkspaceBiomeSource) {
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
  const descriptor = source.layout.progression;
  if (descriptor.kind !== 'hub') throw new Error('N Hub descriptor is missing');
  const assembleOccurrence = (input: WorkspaceOccurrenceAssemblyRequest) => {
    const occurrenceFacts = facts.occurrence(input.occurrence.occurrenceId);
    const fieldsActiveCageCount = fieldsActiveCageCounts.countForOccurrence(
      input.occurrence.occurrenceId,
    );
    if (occurrenceFacts === undefined) {
      throw new Error(input.occurrence.occurrenceId + ' occurrence facts are missing');
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
  const owner = createHubDecisionAddress(source.biome, descriptor.hubKey);
  const hub = source.hubDecision(descriptor.hubKey);
  return { assembleOccurrence, descriptor, hub, markers, owner };
}

function emptyNProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    configuredBiomeCounts: { Surface: 1 },
    name: 'Empty N Hub assembly',
    projectId: 'empty-n-hub-assembly',
  });
}

describe('structured workspace Hub assembly', () => {
  it('returns the authored board, room-local workbenches, exact controls, and Hub reward redirects', () => {
    const source = biomeSource(appendCompleteN(emptyNProject()));
    const kit = hubKit(source);
    if (kit.hub === undefined) throw new Error('authored N Hub is missing');
    const evaluated = source.evaluatedHub(kit.owner);
    const assembly =
      evaluated === undefined
        ? assembleWorkspaceHub({
            assembleOccurrence: kit.assembleOccurrence,
            biome: source.biome,
            catalog,
            descriptor: kit.descriptor,
            hub: kit.hub,
            markerDestinations: kit.markers.emitter,
            topology: source.plan.topology,
          })
        : assembleWorkspaceHub({
            assembleOccurrence: kit.assembleOccurrence,
            biome: source.biome,
            catalog,
            descriptor: kit.descriptor,
            evaluated,
            hub: kit.hub,
            markerDestinations: kit.markers.emitter,
            topology: source.plan.topology,
          });

    expect(assembly.node.slots).toHaveLength(kit.descriptor.slots.length);
    expect(assembly.node.openSlotCount).toEqual({ current: 9, min: 9, max: 10 });
    expect(assembly.node.visits).toHaveLength(kit.descriptor.requiredVisits);
    expect(assembly.workbenches).toHaveLength(kit.hub.openTargets.length);
    expect(
      assembly.workbenches.every((node) => node.inspectorPresentation === 'hubRoomLocal'),
    ).toBe(true);
    expect(assembly.workbenches.every((node) => node.railVisibility === 'inspectorOnly')).toBe(
      true,
    );
    expect(assembly.hubInteractionRequirements).toHaveLength(1);
    expect(assembly.hubInteractionRequirements[0]?.slots).toHaveLength(kit.descriptor.slots.length);
    expect(assembly.hubInteractionRequirements[0]?.visits).toHaveLength(
      kit.descriptor.requiredVisits,
    );

    const visited = assembly.node.slots.find((slot) => slot.hubSlotKey === 'combat02');
    const unvisited = assembly.node.slots.find((slot) => slot.hubSlotKey === 'combat03');
    expect(visited).toMatchObject({ canClose: false, open: true, visited: true });
    expect(unvisited).toMatchObject({ canClose: true, open: true, visited: false });
    const close = assembly.hubInteractionRequirements[0]?.slots.find(
      (slot) => slot.owner.hubSlotKey === 'combat03',
    )?.close;
    expect(close).toMatchObject({
      command: { kind: 'CloseHubSlot' },
      impact: {
        removedDecisionOwners: [
          createExitDecisionAddress(nBiome, {
            kind: 'hubDecision',
            decisionKey: kit.descriptor.hubKey,
          }),
        ],
        removedOccurrenceIds: [nOccurrenceId('combat03'), nOccurrenceIds.preboss],
      },
    });

    const incoming = createIncomingRewardAddress(nBiome, nOccurrenceId('combat02'));
    expect(kit.markers.destinations().get(semanticAddressKey(incoming))).toMatchObject({
      focusAddress: assembly.node.owner,
      nodeKey: assembly.node.key,
      ownerAddress: incoming,
    });
  });

  it('returns a non-interactive declaration-owned outline before the Hub is authored', () => {
    const source = biomeSource(emptyNProject());
    const kit = hubKit(source);
    const assembly = assembleWorkspaceHub({
      assembleOccurrence: kit.assembleOccurrence,
      biome: source.biome,
      catalog,
      descriptor: kit.descriptor,
      markerDestinations: kit.markers.emitter,
      topology: source.plan.topology,
    });

    expect(assembly.node.authoring).toBe('outline');
    expect(assembly.node.slots.every((slot) => !slot.open)).toBe(true);
    expect(assembly.node.visits.map((visit) => visit.authoring)).toEqual(
      Array.from({ length: kit.descriptor.requiredVisits }, () => 'locked'),
    );
    expect(assembly.hubInteractionRequirements).toEqual([]);
    expect(assembly.occurrenceInteractionRequirements).toEqual([]);
    expect(assembly.roomControls).toEqual([]);
    expect(assembly.rewardControls).toEqual([]);
    expect(assembly.workbenches).toEqual([]);
  });

  it('retains the authored Hub board and its room-local controls without an evaluator overlay', () => {
    const source = biomeSource(appendCompleteN(emptyNProject()));
    const kit = hubKit(source);
    if (kit.hub === undefined) throw new Error('authored N Hub is missing');
    const assembly = assembleWorkspaceHub({
      assembleOccurrence: kit.assembleOccurrence,
      biome: source.biome,
      catalog,
      descriptor: kit.descriptor,
      hub: kit.hub,
      markerDestinations: kit.markers.emitter,
      topology: source.plan.topology,
    });

    expect(assembly.node.authoring).toBe('authored');
    expect(assembly.node.slots.filter((slot) => slot.open)).toHaveLength(
      kit.hub.openTargets.length,
    );
    expect(assembly.node.visits.map((visit) => visit.hubSlotKey)).toEqual(kit.hub.visitOrder);
    expect(assembly.workbenches.map((node) => node.room.occurrenceId)).toEqual(
      assembly.node.slots.flatMap((slot) =>
        slot.room === undefined ? [] : [slot.room.occurrenceId],
      ),
    );
    expect(assembly.rewardControls.length).toBeGreaterThan(0);
  });

  it('retains invalid Hub board state and the authored/next/locked visit suffix after visit removal', () => {
    const invalidBoard = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const source = biomeSource(invalidBoard);
    const kit = hubKit(source);
    if (kit.hub === undefined) throw new Error('invalid N Hub is missing');
    const evaluated = source.evaluatedHub(kit.owner);
    const complete =
      evaluated === undefined
        ? assembleWorkspaceHub({
            assembleOccurrence: kit.assembleOccurrence,
            biome: source.biome,
            catalog,
            descriptor: kit.descriptor,
            hub: kit.hub,
            markerDestinations: kit.markers.emitter,
            topology: source.plan.topology,
          })
        : assembleWorkspaceHub({
            assembleOccurrence: kit.assembleOccurrence,
            biome: source.biome,
            catalog,
            descriptor: kit.descriptor,
            evaluated,
            hub: kit.hub,
            markerDestinations: kit.markers.emitter,
            topology: source.plan.topology,
          });

    expect(source.evaluation).toMatchObject({ authoring: 'complete', validity: 'invalid' });
    expect(complete.node.slots).toHaveLength(kit.descriptor.slots.length);
    expect(complete.node.visits.map((visit) => visit.authoring)).toEqual([
      'authored',
      'authored',
      'authored',
      'authored',
      'authored',
      'authored',
    ]);
    expect(
      complete.node.slots.find((slot) => slot.hubSlotKey === 'combat10')?.room?.rewardControls[0]
        ?.marker.findingCount,
    ).toBe(1);

    const retainedProject = applyProjectCommand(invalidBoard, catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, kit.descriptor.hubKey, 4),
    });
    const retainedSource = biomeSource(retainedProject);
    const retainedKit = hubKit(retainedSource);
    if (retainedKit.hub === undefined) throw new Error('retained N Hub is missing');
    const retainedEvaluated = retainedSource.evaluatedHub(retainedKit.owner);
    const retained =
      retainedEvaluated === undefined
        ? assembleWorkspaceHub({
            assembleOccurrence: retainedKit.assembleOccurrence,
            biome: retainedSource.biome,
            catalog,
            descriptor: retainedKit.descriptor,
            hub: retainedKit.hub,
            markerDestinations: retainedKit.markers.emitter,
            nextVisitIndex: 4,
            topology: retainedSource.plan.topology,
          })
        : assembleWorkspaceHub({
            assembleOccurrence: retainedKit.assembleOccurrence,
            biome: retainedSource.biome,
            catalog,
            descriptor: retainedKit.descriptor,
            evaluated: retainedEvaluated,
            hub: retainedKit.hub,
            markerDestinations: retainedKit.markers.emitter,
            nextVisitIndex: 4,
            topology: retainedSource.plan.topology,
          });

    expect(retained.node.slots).toHaveLength(retainedKit.descriptor.slots.length);
    expect(retained.node.openSlotCount).toEqual({ current: 9, min: 9, max: 10 });
    expect(retained.node.visits.map((visit) => visit.authoring)).toEqual([
      'authored',
      'authored',
      'authored',
      'next',
      'locked',
      'locked',
    ]);
    expect(retained.node.visits.slice(0, 4).map((visit) => visit.marker.assessment)).toEqual([
      'unassessed',
      'unassessed',
      'unassessed',
      'assessed',
    ]);
    expect(retained.hubInteractionRequirements[0]?.visits.at(-1)).toMatchObject({
      owner: createHubVisitAddress(nBiome, retainedKit.descriptor.hubKey, 4),
    });
  });

  it('publishes authored Hub controls and the structural first visit before evaluation enters it', () => {
    const opening = createOccurrenceId('hub-assembly-authored-opening');
    let project = applyProjectCommand(emptyNProject(), catalog, {
      biome: nBiome,
      kind: 'CreateStart',
      occurrenceId: opening,
    });
    project = applyProjectCommand(project, catalog, {
      decision: createExitDecisionAddress(nBiome, { kind: 'occurrence', occurrenceId: opening }),
      kind: 'CreateLinkedExit',
      occurrenceId: createOccurrenceId('hub-assembly-authored-prehub'),
    });
    project = applyProjectCommand(project, catalog, {
      hub: createHubDecisionAddress(nBiome, 'hub'),
      kind: 'CreateHubDecision',
    });
    const source = biomeSource(project);
    const kit = hubKit(source);
    if (kit.hub === undefined) throw new Error('fresh authored N Hub is missing');
    const assembly = assembleWorkspaceHub({
      assembleOccurrence: kit.assembleOccurrence,
      biome: source.biome,
      catalog,
      descriptor: kit.descriptor,
      hub: kit.hub,
      markerDestinations: kit.markers.emitter,
      topology: source.plan.topology,
    });
    const requirement = assembly.hubInteractionRequirements[0];

    expect(assembly.node.authoring).toBe('authored');
    expect(requirement?.slots).toHaveLength(kit.descriptor.slots.length);
    expect(requirement?.visits).toEqual([
      {
        choices: [],
        owner: createHubVisitAddress(nBiome, kit.descriptor.hubKey, 1),
      },
    ]);
    expect(assembly.node.visits[0]?.authoring).toBe('locked');
  });
});
