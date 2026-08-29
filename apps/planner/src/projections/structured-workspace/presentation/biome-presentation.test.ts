import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBiomeAddress,
  createEchoKeepsakeReplayAddress,
  createHubDecisionAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { beforeAll, describe, expect, it } from 'vitest';

import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import {
  createSurfaceNUnresolvedBossHermesDeliveryCheckpoint,
  loadSurfaceNProject,
  loadSurfaceNPartialHubProject,
  loadSurfaceNOPQProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  nOccurrenceIds,
  nVisitSlotKeys,
} from '@run-planner/test-fixtures/surface';
import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceRailEntry,
} from '../contract';
import { workspaceDecisionOwnedMarkers } from '../navigation/marker-ownership';
import { summarizeRewardOffer } from '@planner/projections/rewardPicker';
import { presentWorkspaceBiome } from './biome-presentation';
import { assembleWorkspaceBiomeSemantics } from '../assembly/biome-semantic-assembly';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from '../source-index';

let goldenProject: ReturnType<typeof createGoldenFGHIProject>;
let surfaceProject: ReturnType<typeof loadSurfaceNOPQProject>;
let directRewardBiome: ReturnType<typeof present>['presentation']['biome'];
let fieldsRewardBiome: ReturnType<typeof present>['presentation']['biome'];
let fixedRewardBiome: ReturnType<typeof present>['presentation']['biome'];

beforeAll(() => {
  goldenProject = createGoldenFGHIProject();
  surfaceProject = loadSurfaceNOPQProject();
});

beforeAll(() => {
  directRewardBiome = present(goldenProject, 'Underworld', 'F').presentation.biome;
  fieldsRewardBiome = present(goldenProject, 'Underworld', 'H').presentation.biome;
  fixedRewardBiome = present(surfaceProject, 'Surface', 'O').presentation.biome;
});

function biomeSource(
  project: ProjectDocument,
  routeKey: 'Surface' | 'Underworld',
  biomeKey: string,
): WorkspaceBiomeSource {
  const assembly = simulateProjectAssembly(catalog, project);
  const source = createWorkspaceProjectSourceIndex(catalog, project, assembly.evaluation, (phase) =>
    encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase),
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function present(project: ProjectDocument, routeKey: 'Surface' | 'Underworld', biomeKey: string) {
  const assembly = assembleWorkspaceBiomeSemantics(
    catalog,
    biomeSource(project, routeKey, biomeKey),
  );
  return { assembly, presentation: presentWorkspaceBiome(catalog, assembly) };
}

function railShape(biome: WorkspaceBiome): readonly string[] {
  return biome.rail.map((entry) => {
    if (entry.kind === 'frontier') return `frontier:${entry.frontier.kind}`;
    if (entry.kind === 'hubGroup') return 'hub';
    return entry.node.kind === 'occurrenceWorkbench'
      ? `room:${entry.node.room.gameName}`
      : entry.node.kind;
  });
}

function hubRailEntry(rail: readonly WorkspaceRailEntry[]) {
  const entry = rail.find(
    (candidate): candidate is Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }> =>
      candidate.kind === 'hubGroup',
  );
  if (entry === undefined) throw new Error('Hub rail entry is missing');
  return entry;
}

describe('structured workspace biome presentation', () => {
  it('retains the reached Gift Hammer child and its entry-bound focus destination', () => {
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'I');
    const address = createKeepsakeEquipResultAddress(
      createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'I')),
      'experimentalHammer',
    );
    const semantic = assembleWorkspaceBiomeSemantics(
      catalog,
      source,
      (candidate) => semanticAddressKey(candidate) === semanticAddressKey(address),
    );
    const presented = presentWorkspaceBiome(catalog, semantic);
    expect(presented.biome.echoKeepsakeReplay?.address).toEqual(address);
    expect(presented.focusDestinations.get(semanticAddressKey(address))).toMatchObject({
      ownerAddress: address,
      region: 'structure',
      nodeKey: presented.biome.entry?.key,
    });
  });

  it('retires ordinary outer-decision Run State launchers in favor of occurrence checkpoints', () => {
    const project = createGoldenFGHIProject();
    const biome = present(project, 'Underworld', 'F').presentation.biome;
    const decisionLaunchers = biome.nodes.flatMap((node) =>
      node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' || node.kind === 'takeoverBatch'
        ? node.runState === undefined
          ? []
          : [node.runState]
        : [],
    );

    expect(decisionLaunchers).toEqual([]);
    const occurrences = biome.nodes.filter(
      (node): node is WorkspaceOccurrenceWorkbenchNode =>
        node.kind === 'occurrenceWorkbench' && node.room.entered,
    );
    expect(occurrences.length).toBeGreaterThan(0);
    expect(
      occurrences.every(
        (node) =>
          node.room.runStateByTab.overview === node.room.runStateByTab.actions &&
          node.room.runStateByTab.overview?.owner.kind === 'roomRunStateCheckpoint' &&
          node.room.runStateByTab.overview.owner.checkpoint.kind === 'roomEntered' &&
          node.room.runStateByTab.doors?.owner.kind === 'roomRunStateCheckpoint' &&
          node.room.runStateByTab.doors.owner.checkpoint.kind === 'beforeRoomExit',
      ),
    ).toBe(true);
  });

  it('keeps Run State on N outer decisions and binds the completed-Hub handoff to visible Preboss', () => {
    const project = loadSurfaceNProject();
    const biome = present(project, 'Surface', 'N').presentation.biome;
    const launchers = biome.nodes.flatMap((node) => {
      if (
        node.kind === 'hubDecision' ||
        node.kind === 'ordinaryBatch' ||
        node.kind === 'mixedBatch' ||
        node.kind === 'takeoverBatch'
      )
        return node.runState === undefined ? [] : [node.runState];
      if (node.kind === 'occurrenceWorkbench')
        return node.runState === undefined ? [] : [node.runState];
      return [];
    });
    expect(launchers.map((launcher) => launcher.title)).toEqual(['Hub', 'Preboss']);
    const source = biomeSource(project, 'Surface', 'N');
    const handoff = source.exitDecisions.find(
      (decision) => decision.source.kind === 'hubDecision' && decision.source.decisionKey === 'hub',
    );
    if (handoff === undefined) throw new Error('N Hub handoff owner missing');
    expect(launchers.map((launcher) => semanticAddressKey(launcher.owner))).toEqual([
      semanticAddressKey(createHubDecisionAddress(source.biome, 'hub')),
      semanticAddressKey(createExitDecisionAddress(source.biome, handoff.source)),
    ]);
    const preboss = biome.nodes.find(
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceId('preboss'),
    );
    expect(preboss?.kind === 'occurrenceWorkbench' && preboss.runState?.title).toBe('Preboss');
    const hub = biome.nodes.find((node) => node.kind === 'hubDecision');
    expect(hub?.kind === 'hubDecision' && hub.visits.some((visit) => 'runState' in visit)).toBe(
      false,
    );
    expect(
      biome.nodes
        .filter((node) => node.kind === 'occurrenceWorkbench')
        .every((node) => node.runState === undefined),
    ).toBe(false);
    expect(hub?.kind === 'hubDecision' && hub.visits.every((visit) => !('runState' in visit))).toBe(
      true,
    );
  });
  it('presents the Hub only after it is authored, then nests only authored visit workbenches', () => {
    const empty = createProjectDocument(catalog, {
      configuredBiomeCounts: { Surface: 1 },
      projectId: 'empty-n-presentation',
    });
    const emptyPresentation = present(empty, 'Surface', 'N');

    expect(emptyPresentation.assembly.progressionKind).toBe('hub');
    expect(railShape(emptyPresentation.presentation.biome)).toEqual(['frontier:start']);
    expect(emptyPresentation.presentation.biome.defaultInspectorDestination).toMatchObject({
      kind: 'frontier',
      frontierFocusKey: emptyPresentation.presentation.biome.frontier?.marker.focusKey,
    });

    const completePresentation = present(loadSurfaceNProject(), 'Surface', 'N');
    const biome = completePresentation.presentation.biome;
    const hub = hubRailEntry(biome.rail);

    expect(railShape(biome)).toEqual([
      'room:N_Opening01',
      'ordinaryBatch',
      'hub',
      'room:N_PreBoss01',
    ]);
    expect(
      biome.rail.some(
        (entry) =>
          entry.kind === 'node' &&
          (entry.node.kind === 'ordinaryBatch' ||
            entry.node.kind === 'mixedBatch' ||
            entry.node.kind === 'takeoverBatch') &&
          entry.node.owner.source.kind === 'hubDecision',
      ),
    ).toBe(false);
    expect(hub.visits.map((visit) => visit.node.room.occurrenceId)).toEqual(
      nVisitSlotKeys.map(nOccurrenceId),
    );
    expect(hub.visits.every((visit) => visit.node.inspectorPresentation === 'hubRoomLocal')).toBe(
      true,
    );
    const combat05 = hub.visits.find(
      (visit) => visit.node.room.occurrenceId === nOccurrenceId('combat05'),
    );
    if (combat05 === undefined) throw new Error('N Combat 05 Hub visit is missing');
    expect(combat05.sideVisits.map((side) => side.node.room.occurrenceId)).toEqual([
      nLocalOccurrenceId('combat05', 'sideDoor2'),
      nLocalOccurrenceId('combat05', 'sideDoor1'),
    ]);
    expect(combat05.sideVisits.map((side) => side.label)).toEqual([
      'Side 1 · Room 07',
      'Side 2 · Room 02',
    ]);

    const opening = biome.rail.find(
      (entry) =>
        entry.kind === 'node' &&
        entry.node.kind === 'occurrenceWorkbench' &&
        entry.node.room.gameName === 'N_Opening01',
    );
    const preHubDecision = biome.rail.find(
      (entry) =>
        entry.kind === 'node' &&
        (entry.node.kind === 'ordinaryBatch' || entry.node.kind === 'mixedBatch') &&
        entry.node.targets.some((target) => target.room.gameName === 'N_PreHub01'),
    );
    const preHubDecisionNode =
      preHubDecision?.kind === 'node' &&
      (preHubDecision.node.kind === 'ordinaryBatch' || preHubDecision.node.kind === 'mixedBatch')
        ? preHubDecision.node
        : undefined;
    const preHubSelectedTarget =
      preHubDecision?.kind === 'node' ? preHubDecision.selectedTarget : undefined;
    if (
      opening?.kind !== 'node' ||
      opening.node.kind !== 'occurrenceWorkbench' ||
      opening.node.room.roomLocal.kind !== 'incomingReward' ||
      opening.node.room.roomLocal.control.offer === null ||
      preHubDecisionNode === undefined ||
      preHubSelectedTarget?.reward === undefined
    ) {
      throw new Error('N Opening and selected PreHub primary rewards are missing');
    }
    expect(opening.mainReward).toEqual({
      label: summarizeRewardOffer(catalog, opening.node.room.roomLocal.control.offer),
      offer: opening.node.room.roomLocal.control.offer,
    });
    const preHub = preHubDecisionNode.targets.find(
      (target) => target.room.gameName === 'N_PreHub01',
    );
    if (
      preHub?.room.roomLocal.kind !== 'incomingReward' ||
      preHub.room.roomLocal.control.offer === null
    ) {
      throw new Error('N PreHub incoming reward is missing');
    }
    expect(preHubSelectedTarget.reward).toEqual({
      label: summarizeRewardOffer(catalog, preHub.room.roomLocal.control.offer),
      offer: preHub.room.roomLocal.control.offer,
    });

    const firstVisit = hub.visits[0];
    if (
      firstVisit === undefined ||
      firstVisit.node.room.roomLocal.kind !== 'incomingReward' ||
      firstVisit.node.room.roomLocal.control.offer === null
    ) {
      throw new Error('first Hub visit is missing its Ephyra main reward');
    }
    const firstVisitModel = hub.node.visits.find(
      (visit) => visit.visitIndex === firstVisit.visitIndex,
    );
    const firstVisitSlot = hub.node.slots.find(
      (slot) => slot.hubSlotKey === firstVisitModel?.hubSlotKey,
    );
    const firstDoorReward =
      firstVisitSlot?.door?.offerRewardSurface.visibility === 'visible'
        ? firstVisitSlot.door.offerRewardSurface.rewards[0]
        : undefined;
    if (firstDoorReward?.offer === null || firstDoorReward?.offer === undefined) {
      throw new Error('first Hub visit has no slot-owned door reward');
    }
    expect(firstVisit.node.incomingDoor).toBe(firstVisitSlot?.door);
    expect(firstVisit.mainReward).toEqual({
      label: firstDoorReward.summary,
      offer: firstDoorReward.offer,
    });
    expect(
      completePresentation.presentation.focusDestinations.get(firstVisit.node.room.marker.focusKey),
    ).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: firstVisit.node.key },
      selectedRailKey: firstVisit.marker.focusKey,
    });
  });

  it('uses the generated semantic rail policy for ordinary decisions and exact destinations', () => {
    const { assembly, presentation } = present(createGoldenFGHIProject(), 'Underworld', 'F');
    const decision = presentation.biome.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof presentation.biome.nodes)[number],
        { readonly kind: 'ordinaryBatch' }
      > => node.kind === 'ordinaryBatch' && node.targets.length > 0,
    );
    if (decision === undefined) throw new Error('F ordinary decision is missing');
    const rail = presentation.biome.rail.find(
      (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
        entry.kind === 'node' && entry.node.key === decision.key,
    );
    if (rail === undefined) throw new Error('F ordinary decision rail entry is missing');

    expect(assembly.progressionKind).toBe('generated');
    expect(rail.label).toBe('Decision 1');
    const ownedMarkers = new Map(
      workspaceDecisionOwnedMarkers(decision).map((marker) => [marker.focusKey, marker]),
    );
    expect(rail.marker.findingCount).toBe(
      [...ownedMarkers.values()].reduce((total, marker) => total + marker.findingCount, 0),
    );
    const selectedTarget = decision.targets.find((target) => target.selected);
    if (selectedTarget === undefined) throw new Error('F selected continuation is missing');
    const selectedWorkbench = presentation.biome.nodes.find(
      (node) =>
        node.kind === 'occurrenceWorkbench' &&
        node.room.occurrenceId === selectedTarget.room.occurrenceId,
    );
    if (selectedWorkbench === undefined) throw new Error('F selected workbench is missing');
    expect(rail.focusMarker?.focusKey).toBe(selectedTarget.room.marker.focusKey);
    expect(presentation.focusDestinations.get(selectedTarget.room.marker.focusKey)).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: selectedWorkbench.key },
      selectedRailKey: rail.marker.focusKey,
    });
    expect(presentation.focusDestinations.get(decision.selection.focusKey)).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: decision.key },
      selectedRailKey: rail.marker.focusKey,
    });
  });

  it('keeps selected N Opening Chaos on its decision rail stop without a duplicate room stop', () => {
    const source = {
      kind: 'occurrence' as const,
      occurrenceId: nOccurrenceIds.opening,
    };
    const owner = createExitDecisionAddress(nBiome, source);
    const additional = createAdditionalExitAddress(nBiome, source.occurrenceId, 'naturalChaos');
    const chaosOccurrenceId = createOccurrenceId('presentation-n-opening-chaos');
    let project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: owner,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'AddNaturalChaos',
      additional,
      occurrenceId: chaosOccurrenceId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(nBiome, source),
      value: { kind: 'additional', additionalExitKey: 'naturalChaos' },
    });

    const biome = present(project, 'Surface', 'N').presentation.biome;
    const decision = biome.rail.find(
      (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
        entry.kind === 'node' &&
        (entry.node.kind === 'ordinaryBatch' || entry.node.kind === 'mixedBatch') &&
        semanticAddressKey(entry.node.owner) === semanticAddressKey(owner),
    );
    if (decision === undefined) throw new Error('N Opening decision rail entry is missing');

    expect(decision.focusMarker.address).toEqual(
      createOccurrenceAddress(nBiome, chaosOccurrenceId),
    );
    expect(decision.selectedTarget?.roomLabel).toMatch(/^Chaos/);
    expect(
      biome.rail.filter(
        (entry) =>
          entry.kind === 'node' &&
          entry.node.kind === 'occurrenceWorkbench' &&
          entry.node.room.occurrenceId === chaosOccurrenceId,
      ),
    ).toHaveLength(0);
  });

  it('labels a takeover-selected Chaos room instead of presenting a false Preboss stop', () => {
    const base = createGoldenFGHIProject();
    const plan = base.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (plan?.topology === null || plan === undefined) {
      throw new Error('complete F topology fixture is missing');
    }
    const occurrenceById = new Map(
      plan.topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence] as const),
    );
    const takeover = plan.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.normal.targets.length > 0 &&
        decision.normal.targets.every((target) => {
          const occurrence = occurrenceById.get(target.occurrenceId);
          return (
            occurrence !== undefined && catalog.rooms.byKey[occurrence.gameName]?.kind === 'Preboss'
          );
        }),
    );
    if (takeover?.kind !== 'exit' || takeover.source.kind !== 'occurrence') {
      throw new Error('complete F takeover decision is missing');
    }
    const biome = createBiomeAddress('Underworld', 'F');
    const additional = createAdditionalExitAddress(
      biome,
      takeover.source.occurrenceId,
      'naturalChaos',
    );
    const chaosOccurrenceId = createOccurrenceId('presentation-f-preboss-chaos');
    let project = applyProjectCommand(base, catalog, {
      kind: 'AddNaturalChaos',
      additional,
      occurrenceId: chaosOccurrenceId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, takeover.source),
      value: { kind: 'additional', additionalExitKey: 'naturalChaos' },
    });

    const presented = present(project, 'Underworld', 'F').presentation.biome;
    const rail = presented.rail.find(
      (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
        entry.kind === 'node' &&
        entry.node.kind === 'takeoverBatch' &&
        semanticAddressKey(entry.node.owner) ===
          semanticAddressKey(createExitDecisionAddress(biome, takeover.source)),
    );
    if (rail === undefined || rail.node.kind !== 'takeoverBatch') {
      throw new Error('selected F takeover rail entry is missing');
    }
    expect(rail.node.naturalChaos?.selected).toBe(true);
    expect(rail.label).toBe(rail.node.naturalChaos?.door.room.label);
    expect(rail.label).toMatch(/^Chaos/);
  });

  it('progressively presents one selected room and its direct reward token', () => {
    const direct = directRewardBiome;
    const directDecision = direct.nodes.find(
      (node): node is Extract<(typeof direct.nodes)[number], { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.targets.some(
          (target) => target.selected && target.room.roomLocal.kind === 'incomingReward',
        ),
    );
    if (directDecision === undefined) throw new Error('F direct-reward decision is missing');
    const directTarget = directDecision.targets.find(
      (target) => target.selected && target.room.roomLocal.kind === 'incomingReward',
    );
    if (
      directTarget === undefined ||
      directTarget.room.roomLocal.kind !== 'incomingReward' ||
      directTarget.room.roomLocal.control.offer === null
    ) {
      throw new Error('F direct selected target is missing');
    }
    const directRail = direct.rail.find(
      (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
        entry.kind === 'node' && entry.node.key === directDecision.key,
    );
    if (directRail === undefined) throw new Error('F direct decision rail entry is missing');
    expect(directRail.selectedTarget).toEqual({
      roomLabel: directTarget.room.label,
      reward: {
        label: summarizeRewardOffer(catalog, directTarget.room.roomLocal.control.offer),
        offer: directTarget.room.roomLocal.control.offer,
      },
    });

    const fields = fieldsRewardBiome;
    const fieldsDecision = fields.nodes.find(
      (node): node is Extract<(typeof fields.nodes)[number], { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.targets.some((target) => target.selected && target.room.roomLocal.kind === 'fields'),
    );
    if (fieldsDecision === undefined) throw new Error('H Fields decision is missing');
    const fieldsTarget = fieldsDecision.targets.find(
      (target) => target.selected && target.room.roomLocal.kind === 'fields',
    );
    if (fieldsTarget === undefined) throw new Error('H selected Fields target is missing');
    const fieldsRail = fields.rail.find(
      (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
        entry.kind === 'node' && entry.node.key === fieldsDecision.key,
    );
    if (fieldsRail === undefined) throw new Error('H Fields decision rail entry is missing');
    expect(fieldsRail.selectedTarget).toEqual({ roomLabel: fieldsTarget.room.label });

    const fixed = fixedRewardBiome;
    const fixedDecision = fixed.nodes.find(
      (node): node is Extract<(typeof fixed.nodes)[number], { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.targets.some((target) => target.selected && target.room.roomLocal.kind === 'fixed'),
    );
    if (fixedDecision === undefined) throw new Error('O fixed-reward decision is missing');
    const fixedTarget = fixedDecision.targets.find(
      (target) => target.selected && target.room.roomLocal.kind === 'fixed',
    );
    if (fixedTarget === undefined || fixedTarget.room.roomLocal.kind !== 'fixed') {
      throw new Error('O fixed selected target is missing');
    }
    const fixedRail = fixed.rail.find(
      (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
        entry.kind === 'node' && entry.node.key === fixedDecision.key,
    );
    if (fixedRail === undefined) throw new Error('O fixed decision rail entry is missing');
    expect(fixedRail.selectedTarget).toEqual({
      roomLabel: fixedTarget.room.label,
      reward: {
        label: fixedTarget.room.roomLocal.summary,
        offer: fixedTarget.room.roomLocal.offer,
      },
    });
  });

  it('does not present a Clockwork Goal room dormant concrete reward on the rail', () => {
    const biome = present(createGoldenFGHIProject(), 'Underworld', 'I').presentation.biome;
    const goalDecision = biome.nodes.find(
      (node): node is Extract<(typeof biome.nodes)[number], { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.targets.length === 1 &&
        node.targets[0]?.selected === true &&
        node.targets[0].clockworkReward === 'goal',
    );
    if (goalDecision === undefined) {
      throw new Error('I one-room Clockwork Goal decision is missing');
    }
    const goalTarget = goalDecision.targets[0];
    if (goalTarget?.room.roomLocal.kind !== 'incomingReward') {
      throw new Error('I Clockwork Goal target lost its dormant counted reward control');
    }
    const rail = biome.rail.find(
      (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
        entry.kind === 'node' && entry.node.key === goalDecision.key,
    );
    if (rail === undefined) throw new Error('I Clockwork Goal decision rail entry is missing');

    expect(goalTarget.room.roomLocal.control.offer).toBeNull();
    expect(goalDecision.missingTargets).toEqual([]);
    expect(rail.selectedTarget).toEqual({ roomLabel: goalTarget.room.label });
  });

  it('presents every generated biome as entry, numbered decision stops, and bounded Preboss', () => {
    const underworld = createGoldenFGHIProject();
    const surface = loadSurfaceNOPQProject();
    const expected = {
      F: {
        decisions: 10,
        entry: 'Opening',
        preboss: true,
        project: underworld,
        route: 'Underworld',
      },
      G: {
        decisions: 7,
        entry: 'Entrance',
        preboss: true,
        project: underworld,
        route: 'Underworld',
      },
      H: {
        decisions: 4,
        entry: 'Entrance',
        preboss: true,
        project: underworld,
        route: 'Underworld',
      },
      I: {
        decisions: 6,
        entry: 'Entrance',
        preboss: false,
        project: underworld,
        route: 'Underworld',
      },
      O: { decisions: 6, entry: 'Entrance', preboss: true, project: surface, route: 'Surface' },
      P: { decisions: 8, entry: 'Entrance', preboss: true, project: surface, route: 'Surface' },
      Q: { decisions: 6, entry: 'Entrance', preboss: true, project: surface, route: 'Surface' },
    } as const;

    for (const [biomeKey, contract] of Object.entries(expected)) {
      const biome = present(contract.project, contract.route, biomeKey).presentation.biome;
      const entries = biome.rail.filter(
        (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
          entry.kind === 'node',
      );
      expect(entries.map((entry) => entry.label)).toEqual([
        contract.entry,
        ...Array.from({ length: contract.decisions }, (_, index) => `Decision ${index + 1}`),
        ...(contract.preboss ? ['Preboss'] : []),
      ]);
      expect(
        entries.some(
          (entry) =>
            entry.node.kind === 'occurrenceWorkbench' && entry.node.key !== biome.entry?.key,
        ),
      ).toBe(false);
    }
  });

  it('keeps Preboss assessed when an unresolved fixed Boss delivery blocks Postboss', () => {
    const project = createSurfaceNUnresolvedBossHermesDeliveryCheckpoint();
    const source = biomeSource(project, 'Surface', 'N');
    const biome = present(project, 'Surface', 'N').presentation.biome;
    const preboss = biome.rail.find((entry) => entry.kind === 'node' && entry.label === 'Preboss');
    expect(preboss?.marker.assessment).toBe('assessed');
    expect(
      source.isAssessed(
        createOccurrenceAddress(nBiome, createOccurrenceId(`${nOccurrenceIds.preboss}:boss`)),
      ),
    ).toBe(true);
    expect(
      source.isAssessed(
        createOccurrenceAddress(nBiome, createOccurrenceId(`${nOccurrenceIds.preboss}:postboss`)),
      ),
    ).toBe(false);
  });

  it('does not project completion landmarks before the Preboss is selected', () => {
    const empty = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      projectId: 'presentation-completion-outline',
    });
    const biome = present(empty, 'Underworld', 'F').presentation.biome;

    expect(railShape(biome)).toEqual(['frontier:start']);
    expect(biome.completionOutline).toEqual([]);
  });

  it('reprojects only authored Hub visit children after replacement and truncation', () => {
    const initial = loadSurfaceNPartialHubProject();
    const labels = (project: ProjectDocument) =>
      hubRailEntry(present(project, 'Surface', 'N').presentation.biome.rail).visits.map(
        (visit) => visit.label,
      );

    expect(labels(initial)).toEqual([
      'Visit 1 · Combat 05',
      'Visit 2 · Satyr Champion',
      'Visit 3 · Combat 02',
    ]);
    const replaced = applyProjectCommand(initial, catalog, {
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: [nVisitSlotKeys[0], 'combat10', nVisitSlotKeys[2]],
      kind: 'ReplaceHubVisitOrder',
    });
    expect(labels(replaced)).toEqual([
      'Visit 1 · Combat 05',
      'Visit 2 · Combat 10',
      'Visit 3 · Combat 02',
    ]);
    const truncated = applyProjectCommand(replaced, catalog, {
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: nVisitSlotKeys.slice(0, 1),
      kind: 'ReplaceHubVisitOrder',
    });
    expect(labels(truncated)).toEqual(['Visit 1 · Combat 05']);
  });
});
