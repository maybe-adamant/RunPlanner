import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
  goldenFOccurrenceId,
  goldenFStartId,
} from '../../test/fixtures/underworldProject';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  nVisitSlotKeys,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  qBiome,
  qOccurrenceIds,
} from '../../test/fixtures/surfaceProject';
import { createCandidateSessionFactory } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';
import { createRewardPickerProjection } from './rewardPicker';
import {
  createStructuredWorkspaceProjection,
  type WorkspaceBiome,
  type WorkspaceNode,
} from './structuredWorkspace';

const projection = createStructuredWorkspaceProjection(catalog, {
  candidateSessions: createCandidateSessionFactory(catalog),
  contextualPicker: createContextualPickerProjection(createContextualOptionResolver(catalog)),
  rewardPicker: createRewardPickerProjection(
    catalog,
    createContextualPickerProjection(createContextualOptionResolver(catalog)),
  ),
});

function workspace(project: ReturnType<typeof createProjectDocument>) {
  const evaluation = simulateProject(catalog, project);
  return projection.project(project, evaluation);
}

function biome(projected: ReturnType<typeof workspace>, biomeKey: string): WorkspaceBiome {
  const value = projected.routes
    .flatMap((route) => route.biomes)
    .find((candidate) => candidate.biomeKey === biomeKey);
  if (value === undefined) throw new Error(`workspace omitted ${biomeKey}`);
  return value;
}

function kinds(projected: WorkspaceBiome): readonly WorkspaceNode['kind'][] {
  return projected.nodes.map((node) => node.kind);
}

function railShape(projected: WorkspaceBiome): readonly string[] {
  return projected.rail.map((entry) => {
    if (entry.kind === 'frontier') return `frontier:${entry.frontier.kind}`;
    const { node } = entry;
    switch (node.kind) {
      case 'occurrenceWorkbench':
        return `room:${node.room.gameName}`;
      case 'ordinaryBatch':
      case 'mixedBatch':
      case 'takeoverBatch':
        return node.kind;
      case 'linkedExit':
        return `linked:${node.target.room.gameName}`;
      case 'completion':
        return `completion:${node.role}:${node.gameName}`;
      case 'hubDecision':
        return 'hubDecision';
    }
  });
}

function roomWorkbench(
  projected: ReturnType<typeof workspace>,
  biomeKey: string,
  gameName: string,
) {
  const node = biome(projected, biomeKey).nodes.find(
    (candidate): candidate is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
      candidate.kind === 'occurrenceWorkbench' && candidate.room.gameName === gameName,
  );
  if (node === undefined) throw new Error(`${gameName} workbench is missing`);
  return node.room;
}

const workspaceNodeKinds: Readonly<Record<WorkspaceNode['kind'], true>> = Object.freeze({
  completion: true,
  hubDecision: true,
  linkedExit: true,
  mixedBatch: true,
  occurrenceWorkbench: true,
  ordinaryBatch: true,
  takeoverBatch: true,
});

describe('unified structured workspace projection', () => {
  it('uses one workspace envelope and exhaustive unified node union across both routes', () => {
    const underworld = workspace(createGoldenFGHIProject(catalog));
    const surface = workspace(createRepresentativeNOPQProject());

    for (const projected of [...underworld.routes, ...surface.routes].flatMap(
      (route) => route.biomes,
    )) {
      expect('kind' in projected).toBe(false);
      expect(Object.isFrozen(projected.nodes)).toBe(true);
      expect(projected.nodes.every((node) => node.kind in workspaceNodeKinds)).toBe(true);
    }

    expect(kinds(biome(underworld, 'F'))).toContain('takeoverBatch');
    expect(kinds(biome(underworld, 'G'))).toContain('takeoverBatch');
    expect(kinds(biome(underworld, 'H'))).toContain('takeoverBatch');
    expect(kinds(biome(underworld, 'I'))).toContain('mixedBatch');
    expect(kinds(biome(surface, 'N'))).toContain('hubDecision');
    expect(kinds(biome(surface, 'O'))).toContain('takeoverBatch');
    expect(kinds(biome(surface, 'P'))).toContain('takeoverBatch');
    expect(kinds(biome(surface, 'Q'))).toContain('ordinaryBatch');
    expect(kinds(biome(surface, 'Q'))).toContain('takeoverBatch');
  });

  it('publishes generic topology removals with engine-owned destructive scope', () => {
    const project = createRepresentativeNOPQProject();
    const projected = workspace(project);
    const nPlan = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    if (nPlan?.topology === null || nPlan?.topology === undefined) {
      throw new Error('complete N fixture lost authored topology');
    }
    const clear = projected.interactions.topologyRemovals.get(semanticAddressKey(nBiome));
    const linked = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });
    const removeLinked = projected.interactions.topologyRemovals.get(semanticAddressKey(linked));

    expect(clear).toMatchObject({
      action: 'clearTopology',
      command: { kind: 'ClearTopology', biome: nBiome },
      owner: nBiome,
      impact: {
        removedOccurrenceIds: nPlan.topology.occurrences.map((room) => room.occurrenceId),
        removedDecisionOwners: expect.arrayContaining([
          createExitDecisionAddress(nBiome, {
            kind: 'hubDecision',
            decisionKey: 'hub',
          }),
        ]),
        removedHubDecisionKeys: ['hub'],
      },
    });
    expect(removeLinked).toMatchObject({
      action: 'removeExitDecision',
      command: { kind: 'RemoveExitDecision', decision: linked },
      owner: linked,
      impact: {
        removedHubDecisionKeys: ['hub'],
        removedOccurrenceIds: expect.arrayContaining([
          nOccurrenceIds.preHub,
          nOccurrenceIds.preboss,
        ]),
      },
    });
  });

  it('keeps declaration and canonical decision order rather than array-position topology rules', () => {
    const underworld = workspace(createGoldenFGHIProject(catalog));
    const surface = workspace(createRepresentativeNOPQProject());
    const structuralKinds = (value: WorkspaceBiome) =>
      value.nodes
        .filter(
          (node) =>
            node.kind === 'linkedExit' ||
            node.kind === 'ordinaryBatch' ||
            node.kind === 'takeoverBatch' ||
            node.kind === 'mixedBatch' ||
            node.kind === 'hubDecision',
        )
        .map((node) => node.kind);

    expect(structuralKinds(biome(underworld, 'F'))).toEqual([
      'ordinaryBatch',
      'ordinaryBatch',
      'ordinaryBatch',
      'ordinaryBatch',
      'ordinaryBatch',
      'ordinaryBatch',
      'ordinaryBatch',
      'ordinaryBatch',
      'ordinaryBatch',
      'ordinaryBatch',
      'takeoverBatch',
    ]);
    expect(structuralKinds(biome(surface, 'N'))).toEqual([
      'linkedExit',
      'hubDecision',
      'takeoverBatch',
    ]);
  });

  it('freezes each ordinary-decision rail in game-domain order', () => {
    const underworld = workspace(createGoldenFGHIProject(catalog));
    const surface = workspace(createRepresentativeNOPQProject());
    const expected = {
      F: [
        'room:F_Opening01',
        'ordinaryBatch',
        'room:F_Combat02',
        'ordinaryBatch',
        'room:F_Combat03',
        'room:F_Combat03',
        'ordinaryBatch',
        'room:F_Combat04',
        'room:F_Combat04',
        'ordinaryBatch',
        'room:F_Combat05',
        'room:F_Combat11',
        'ordinaryBatch',
        'room:F_Combat06',
        'room:F_Combat06',
        'ordinaryBatch',
        'room:F_MiniBoss01',
        'room:F_MiniBoss02',
        'ordinaryBatch',
        'room:F_Combat11',
        'ordinaryBatch',
        'room:F_Combat12',
        'room:F_Combat12',
        'ordinaryBatch',
        'room:F_Combat14',
        'room:F_Combat14',
        'ordinaryBatch',
        'room:F_Combat15',
        'room:F_Combat15',
        'takeoverBatch',
        'room:F_PreBoss01',
        'room:F_PreBoss01',
        'completion:boss:F_Boss01',
        'completion:postboss:F_PostBoss01',
      ],
      G: [
        'room:G_Intro',
        'ordinaryBatch',
        'room:G_Combat01',
        'ordinaryBatch',
        'room:G_Combat02',
        'room:G_Combat02',
        'ordinaryBatch',
        'room:G_Story01',
        'room:G_Combat03',
        'room:G_Combat03',
        'ordinaryBatch',
        'room:G_Combat10',
        'ordinaryBatch',
        'room:G_Shop01',
        'room:G_Combat12',
        'ordinaryBatch',
        'room:G_MiniBoss01',
        'room:G_MiniBoss02',
        'ordinaryBatch',
        'room:G_Combat12',
        'room:G_Combat13',
        'takeoverBatch',
        'room:G_PreBoss01',
        'room:G_PreBoss01',
        'completion:boss:G_Boss01',
        'completion:postboss:G_PostBoss01',
      ],
      H: [
        'room:H_Intro',
        'ordinaryBatch',
        'room:H_Combat02',
        'ordinaryBatch',
        'room:H_Combat09',
        'room:H_Combat03',
        'ordinaryBatch',
        'room:H_MiniBoss01',
        'room:H_Bridge01',
        'ordinaryBatch',
        'room:H_Combat05',
        'room:H_Combat04',
        'takeoverBatch',
        'room:H_PreBoss01',
        'room:H_PreBoss01',
        'completion:boss:H_Boss01',
        'completion:postboss:H_PostBoss01',
      ],
      I: [
        'room:I_Intro',
        'ordinaryBatch',
        'room:I_Combat01',
        'ordinaryBatch',
        'room:I_Combat03',
        'room:I_Story01',
        'ordinaryBatch',
        'room:I_Combat05',
        'room:I_Combat02',
        'ordinaryBatch',
        'room:I_Combat06',
        'ordinaryBatch',
        'room:I_Combat09',
        'mixedBatch',
        'room:I_PreBoss02',
        'room:I_MiniBoss01',
        'completion:boss:I_Boss01',
        'completion:postboss:I_PostBoss01',
      ],
      O: [
        'room:O_Intro',
        'ordinaryBatch',
        'room:O_Combat04',
        'ordinaryBatch',
        'room:O_Combat07',
        'ordinaryBatch',
        'room:O_Combat01',
        'ordinaryBatch',
        'room:O_Devotion01',
        'ordinaryBatch',
        'room:O_Story01',
        'ordinaryBatch',
        'room:O_Combat02',
        'takeoverBatch',
        'room:O_PreBoss01',
        'completion:boss:O_Boss01',
        'completion:postboss:O_PostBoss01',
      ],
      P: [
        'room:P_Intro',
        'ordinaryBatch',
        'room:P_Combat03',
        'room:P_Combat05',
        'ordinaryBatch',
        'room:P_Combat02',
        'room:P_Combat06',
        'ordinaryBatch',
        'room:P_Combat04',
        'room:P_Combat08',
        'ordinaryBatch',
        'room:P_Combat07',
        'room:P_Combat11',
        'ordinaryBatch',
        'room:P_MiniBoss01',
        'room:P_Combat09',
        'ordinaryBatch',
        'room:P_Combat10',
        'room:P_Combat13',
        'ordinaryBatch',
        'room:P_Story01',
        'room:P_Reprieve01',
        'ordinaryBatch',
        'room:P_Combat12',
        'room:P_Combat14',
        'takeoverBatch',
        'room:P_PreBoss01',
        'room:P_PreBoss01',
        'completion:boss:P_Boss01',
        'completion:postboss:P_PostBoss01',
      ],
      Q: [
        'room:Q_Intro',
        'ordinaryBatch',
        'room:Q_Combat10',
        'ordinaryBatch',
        'room:Q_Combat03',
        'ordinaryBatch',
        'room:Q_MiniBoss02',
        'room:Q_MiniBoss05',
        'ordinaryBatch',
        'room:Q_Combat01',
        'ordinaryBatch',
        'room:Q_Combat12',
        'ordinaryBatch',
        'room:Q_MiniBoss03',
        'room:Q_MiniBoss04',
        'takeoverBatch',
        'room:Q_PreBoss01',
        'completion:boss:Q_Boss01',
      ],
    } as const;

    for (const [projected, biomeKey] of [
      [underworld, 'F'],
      [underworld, 'G'],
      [underworld, 'H'],
      [underworld, 'I'],
      [surface, 'O'],
      [surface, 'P'],
      [surface, 'Q'],
    ] as const) {
      expect(railShape(biome(projected, biomeKey))).toEqual(expected[biomeKey]);
    }
  });

  it('places an active ordinary frontier before derived completion endpoints', () => {
    const empty = createProjectDocument(catalog, {
      projectId: 'frontier-before-completion',
      name: 'Frontier before completion',
      configuredBiomeCounts: { Underworld: 1 },
    });
    expect(railShape(biome(workspace(empty), 'F'))).toEqual([
      'frontier:start',
      'completion:boss:F_Boss01',
      'completion:postboss:F_PostBoss01',
    ]);

    const startId = createOccurrenceId('frontier-before-completion-start');
    const started = applyProjectCommand(empty, catalog, {
      kind: 'CreateStart',
      biome: goldenFBiome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    expect(railShape(biome(workspace(started), 'F'))).toEqual([
      'room:F_Opening01',
      'frontier:exitDecision',
      'completion:boss:F_Boss01',
      'completion:postboss:F_PostBoss01',
    ]);
  });

  it('keeps physical target order and selection separate from retained target workbenches', () => {
    const projected = biome(workspace(createGoldenFGHIProject(catalog)), 'F');
    const takeover = projected.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (takeover === undefined) throw new Error('F takeover was not projected');

    expect(takeover.targets.map((target) => target.index)).toEqual(
      [...takeover.targets].map((target) => target.index).sort((left, right) => left - right),
    );
    expect(takeover.targets.some((target) => !target.selected && !target.retained)).toBe(true);
    expect(takeover.targetInteraction).toBe('readOnly');
    expect(
      projected.nodes.filter(
        (node) =>
          node.kind === 'occurrenceWorkbench' &&
          takeover.targets.some((target) => target.room.occurrenceId === node.room.occurrenceId),
      ),
    ).toHaveLength(takeover.targets.length);
  });

  it('projects one declaration-owned Hub node with all physical slots and stable visit owners', () => {
    const projected = biome(workspace(createRepresentativeNOPQProject()), 'N');
    const hub = projected.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (hub === undefined) throw new Error('N Hub decision was not projected');

    expect(hub.slots).toHaveLength(
      catalog.biomeLayouts.byKey.N!.progression.kind === 'hub'
        ? catalog.biomeLayouts.byKey.N!.progression.slots.length
        : 0,
    );
    expect(hub.slots.map((slot) => slot.physicalDoorId)).toEqual(
      catalog.biomeLayouts.byKey.N!.progression.kind === 'hub'
        ? catalog.biomeLayouts.byKey.N!.progression.slots.map((slot) => slot.physicalDoorId)
        : [],
    );
    expect(hub.visits.map((visit) => visit.marker.address.kind)).toEqual(
      hub.visits.map(() => 'hubVisit'),
    );
    expect(hub.openSlotCount).toEqual({ current: 9, min: 9, max: 10 });
    expect(hub.visits).toHaveLength(6);
    expect(hub.visits.map((visit) => visit.authoring)).toEqual([
      'authored',
      'authored',
      'authored',
      'authored',
      'authored',
      'authored',
    ]);
    const combat02 = hub.slots.find((slot) => slot.hubSlotKey === 'combat02');
    if (combat02?.room?.roomLocal.kind !== 'ephyra') {
      throw new Error('N Combat 02 side-room workbench is missing');
    }
    expect(combat02).toMatchObject({
      label: 'Combat 02',
      roomKind: 'Combat',
      visited: true,
    });
    expect(combat02.room.roomLocal.sideRooms).toMatchObject({
      enteredSlotKeys: ['sideDoor1'],
      slots: [
        { key: 'sideDoor1', physicalDoorId: 558353, entered: true },
        { key: 'sideDoor2', physicalDoorId: 558352, entered: false },
      ],
    });
    expect(
      projected.nodes.find(
        (node) =>
          node.kind === 'occurrenceWorkbench' &&
          node.room.occurrenceId === combat02.room?.occurrenceId,
      ),
    ).toMatchObject({ railVisibility: 'inspectorOnly' });
  });

  it('keeps the complete Hub board outline visible before N has authored its fixed start', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'n-hub-outline',
      name: 'N Hub outline',
      configuredBiomeCounts: { Surface: 1 },
    });
    const projected = biome(workspace(project), 'N');
    const hub = projected.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (hub === undefined) throw new Error('N Hub outline was not projected');

    expect(hub.slots).toHaveLength(26);
    expect(hub.slots.every((slot) => !slot.open && !slot.canOpen && !slot.canClose)).toBe(true);
    expect(hub.visits).toHaveLength(6);
    expect(hub.visits.every((visit) => visit.authoring === 'locked')).toBe(true);
  });

  it('places N’s Hub outline after the authored entry frontier that reaches it', () => {
    const biomeAddress = createBiomeAddress('Surface', 'N');
    const empty = createProjectDocument(catalog, {
      projectId: 'n-entry-before-hub-outline',
      name: 'N entry before Hub outline',
      configuredBiomeCounts: { Surface: 1 },
    });
    expect(railShape(biome(workspace(empty), 'N'))).toEqual([
      'frontier:start',
      'hubDecision',
      'completion:boss:N_Boss01',
      'completion:postboss:N_PostBoss01',
    ]);

    const withOpening = applyProjectCommand(empty, catalog, {
      kind: 'CreateStart',
      biome: biomeAddress,
      occurrenceId: nOccurrenceIds.opening,
    });
    expect(railShape(biome(workspace(withOpening), 'N'))).toEqual([
      'room:N_Opening01',
      'frontier:exitDecision',
      'hubDecision',
      'completion:boss:N_Boss01',
      'completion:postboss:N_PostBoss01',
    ]);

    const withPreHub = applyProjectCommand(withOpening, catalog, {
      kind: 'CreateLinkedExit',
      decision: createExitDecisionAddress(biomeAddress, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.opening,
      }),
      occurrenceId: nOccurrenceIds.preHub,
    });
    expect(railShape(biome(workspace(withPreHub), 'N')).slice(0, 4)).toEqual([
      'room:N_Opening01',
      'linked:N_PreHub01',
      'room:N_PreHub01',
      'hubDecision',
    ]);
  });

  it('projects the completed-Hub handoff as one source-owned takeover action before N Preboss exists', () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'n-handoff',
        name: 'N handoff',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const projected = workspace(project);
    const owner = createExitDecisionAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' });
    const handoff = projected.interactions.takeoverBatches.get(semanticAddressKey(owner));
    expect(handoff).toMatchObject({
      action: 'create',
      owner,
      presentation: 'completedHubHandoff',
    });
    if (handoff?.presentation !== 'completedHubHandoff') {
      throw new Error('N completed Hub handoff is missing');
    }
    expect('load' in handoff).toBe(false);

    const withPreboss = applyProjectCommand(project, catalog, handoff.execute());
    const n = biome(workspace(withPreboss), 'N');
    const batch = n.nodes.find(
      (
        node,
      ): node is Extract<
        WorkspaceNode,
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
      > =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        semanticAddressKey(node.owner) === semanticAddressKey(owner),
    );
    expect(batch?.targets).toMatchObject([
      {
        exitKey: 'preboss',
        selected: true,
        room: { entered: true, gameName: 'N_PreBoss01', roomLocal: { kind: 'shop' } },
      },
    ]);
  });

  it('keeps N’s invalid board and its locally blocked retained visit suffix visible', () => {
    const invalidBoard = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const complete = biome(workspace(invalidBoard), 'N');
    const completeHub = complete.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (completeHub === undefined) throw new Error('invalid N Hub board was not projected');

    const invalidCombat = completeHub.slots.find((slot) => slot.hubSlotKey === 'combat10');
    expect(complete.status).toBe('invalid');
    expect(completeHub.slots).toHaveLength(26);
    expect(completeHub.visits.map((visit) => visit.authoring)).toEqual([
      'authored',
      'authored',
      'authored',
      'authored',
      'authored',
      'authored',
    ]);
    expect(invalidCombat?.room?.rewardControls[0]?.marker.findingCount).toBe(1);

    const retained = applyProjectCommand(invalidBoard, catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 4),
    });
    const retainedWorkspace = workspace(retained);
    const n = biome(retainedWorkspace, 'N');
    const hub = n.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (hub === undefined) throw new Error('retained N Hub board was not projected');
    const nextVisit = createHubVisitAddress(nBiome, 'hub', 4);

    expect(n).toMatchObject({
      frontier: { kind: 'hubVisit', owner: nextVisit },
      source: 'progressive',
      status: 'incomplete',
    });
    expect(hub.slots).toHaveLength(26);
    expect(hub.openSlotCount).toEqual({ current: 9, min: 9, max: 10 });
    expect(hub.visits.map((visit) => visit.authoring)).toEqual([
      'authored',
      'authored',
      'authored',
      'next',
      'locked',
      'locked',
    ]);
    expect(hub.visits.slice(0, 4).map((visit) => visit.marker.assessment)).toEqual([
      'unassessed',
      'unassessed',
      'unassessed',
      'assessed',
    ]);
    expect(
      retainedWorkspace.interactions.hubVisits.get(semanticAddressKey(nextVisit)),
    ).toMatchObject({
      owner: nextVisit,
    });
  });

  it('exposes start, ordinary, linked, and Hub creation frontiers without React reconstructing topology', () => {
    const fBiome = createBiomeAddress('Underworld', 'F');
    const initialF = createProjectDocument(catalog, {
      projectId: 'f-authoring-frontier',
      name: 'F authoring frontier',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const empty = workspace(initialF);
    const emptyF = biome(empty, 'F');
    expect(emptyF.frontier).toMatchObject({ kind: 'start', owner: fBiome });
    if (emptyF.frontier?.kind !== 'start') throw new Error('F start frontier is missing');
    expect(empty.interactions.starts.get(emptyF.frontier.interactionKey)).toMatchObject({
      owner: fBiome,
    });

    const fStart = createOccurrenceId('f-authoring-start');
    const startedF = applyProjectCommand(initialF, catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: fStart,
      gameName: 'F_Opening01',
    });
    const batchOwner = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: fStart,
    });
    expect(
      workspace(startedF).interactions.structural.get(semanticAddressKey(batchOwner)),
    ).toMatchObject({
      action: 'createBatch',
      owner: batchOwner,
    });

    const batch = applyProjectCommand(startedF, catalog, {
      kind: 'CreateBatch',
      decision: batchOwner,
    });
    const batchWorkspace = workspace(batch);
    const partialBatch = biome(batchWorkspace, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch',
    );
    if (partialBatch === undefined) throw new Error('empty F batch was not projected');
    expect(partialBatch.missingTargets.map((target) => target.exitKey)).not.toHaveLength(0);
    const [firstMissingTarget, ...laterMissingTargets] = partialBatch.missingTargets;
    if (firstMissingTarget === undefined) throw new Error('F target frontier is missing');
    expect(firstMissingTarget.authoring).toEqual({
      kind: 'awaitingBatchRewardStore',
      message: 'Select the batch reward store first.',
    });
    expect(
      batchWorkspace.interactions.rooms.has(semanticAddressKey(firstMissingTarget.owner)),
    ).toBe(false);
    for (const target of laterMissingTargets) {
      expect(target.authoring.kind).toBe('awaitingBatchRewardStore');
      expect(batchWorkspace.interactions.rooms.has(semanticAddressKey(target.owner))).toBe(false);
    }

    const initialN = createProjectDocument(catalog, {
      projectId: 'n-authoring-frontier',
      name: 'N authoring frontier',
      configuredBiomeCounts: { Surface: 1 },
    });
    const emptyN = workspace(initialN);
    const nStart = biome(emptyN, 'N').frontier;
    if (nStart?.kind !== 'start') throw new Error('N start frontier is missing');
    expect(emptyN.interactions.starts.get(nStart.interactionKey)).toMatchObject({
      fixedGameName: 'N_Opening01',
      fixedLabel: 'Opening',
      owner: nBiome,
    });
    const startedN = applyProjectCommand(initialN, catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: nOccurrenceIds.opening,
    });
    const linkedOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });
    expect(
      workspace(startedN).interactions.structural.get(semanticAddressKey(linkedOwner)),
    ).toMatchObject({
      action: 'createLinkedExit',
      owner: linkedOwner,
      targetGameName: 'N_PreHub01',
    });
    const linked = applyProjectCommand(startedN, catalog, {
      kind: 'CreateLinkedExit',
      decision: linkedOwner,
      occurrenceId: nOccurrenceIds.preHub,
    });
    const hubOwner = createHubDecisionAddress(nBiome, 'hub');
    expect(
      workspace(linked).interactions.structural.get(semanticAddressKey(hubOwner)),
    ).toMatchObject({
      action: 'createHubDecision',
      owner: hubOwner,
    });
  });

  it('publishes only the next missing physical target as an authorable room picker', () => {
    const fBiome = createBiomeAddress('Underworld', 'F');
    const initial = createProjectDocument(catalog, {
      projectId: 'sequential-targets',
      name: 'Sequential targets',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const startId = createOccurrenceId('sequential-targets-start');
    const started = applyProjectCommand(initial, catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    const firstDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    const firstBatch = applyProjectCommand(started, catalog, {
      kind: 'CreateBatch',
      decision: firstDecision,
    });
    const configuredFirstBatch = applyProjectCommand(firstBatch, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, firstDecision.source),
      storeKey: 'RunProgress',
    });
    const firstTargetId = createOccurrenceId('sequential-targets-combat03');
    const withFirstTarget = applyProjectCommand(configuredFirstBatch, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, firstDecision.source, 'exit1'),
      occurrenceId: firstTargetId,
      gameName: 'F_Combat03',
    });
    const secondDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: firstTargetId,
    });
    const partial = applyProjectCommand(withFirstTarget, catalog, {
      kind: 'CreateBatch',
      decision: secondDecision,
    });
    const configuredPartial = applyProjectCommand(partial, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, secondDecision.source),
      storeKey: 'RunProgress',
    });
    const projected = workspace(configuredPartial);
    const batch = biome(projected, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.owner.source.kind === 'occurrence' &&
        node.owner.source.occurrenceId === firstTargetId,
    );
    if (batch === undefined) throw new Error('F combat batch was not projected');
    expect(batch.missingTargets.map((target) => target.authoring)).toEqual([
      { kind: 'ready' },
      {
        kind: 'awaitingPriorExit',
        message: 'Choose Exit 1 first.',
        prerequisiteExitKey: 'exit1',
      },
    ]);
    const [first, second] = batch.missingTargets;
    if (first === undefined || second === undefined)
      throw new Error('F physical exits are missing');
    expect(projected.interactions.rooms.get(semanticAddressKey(first.owner))).toMatchObject({
      owner: first.owner,
    });
    expect(projected.interactions.rooms.has(semanticAddressKey(second.owner))).toBe(false);
  });

  it('keeps target authoring behind its declaration-owned batch setup', () => {
    const hStartId = createOccurrenceId('fields-setup-start');
    const initial = createProjectDocument(catalog, {
      projectId: 'fields-setup',
      name: 'Fields setup',
      configuredBiomeCounts: { Underworld: 3 },
    });
    const started = applyProjectCommand(initial, catalog, {
      kind: 'CreateStart',
      biome: goldenHBiome,
      occurrenceId: hStartId,
    });
    const decision = createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: hStartId,
    });
    const batch = applyProjectCommand(started, catalog, {
      kind: 'CreateBatch',
      decision,
    });
    const projected = workspace(batch);
    const fieldsBatch = biome(projected, 'H').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.owner.source.kind === 'occurrence' &&
        node.owner.source.occurrenceId === hStartId,
    );
    if (fieldsBatch === undefined) throw new Error('H Fields batch was not projected');
    const target = fieldsBatch.missingTargets[0];
    if (target === undefined) throw new Error('H Fields target is missing');
    expect(target.authoring).toEqual({
      kind: 'awaitingFieldsCageOutcome',
      message: 'Select the Fields cage outcome first.',
    });
    expect(projected.interactions.rooms.has(semanticAddressKey(target.owner))).toBe(false);
  });

  it('keeps an authored Fields cage outcome visible in a blocked suffix', () => {
    const startId = createOccurrenceId('blocked-fields-start');
    const combatId = createOccurrenceId('blocked-fields-combat');
    let project = createProjectDocument(catalog, {
      projectId: 'blocked-fields',
      name: 'Blocked Fields',
      configuredBiomeCounts: { Underworld: 3 },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: goldenHBiome,
      occurrenceId: startId,
    });
    const decision = createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: 'min',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenHBiome, decision.source, 'exit1'),
      occurrenceId: combatId,
      gameName: 'H_Combat02',
    });

    const projected = workspace(project);
    expect(biome(projected, 'H').status).toBe('blocked');
    const fields = roomWorkbench(projected, 'H', 'H_Combat02');
    if (fields.roomLocal.kind !== 'fields') throw new Error('Fields room-local state is missing');
    expect(fields.roomLocal.cages.map((cage) => cage.active)).toEqual([true, true, false]);
  });

  it('projects every Hub slot and the next visit frontier before it is authored', () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'n-next-visit',
        name: 'N next visit',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false, visitSlotKeys: nVisitSlotKeys.slice(0, -1) },
    );
    const projected = workspace(project);
    const descriptor = catalog.biomeLayouts.byKey.N?.progression;
    if (descriptor?.kind !== 'hub') throw new Error('N Hub descriptor is missing');
    expect(projected.interactions.hubSlots).toHaveLength(descriptor.slots.length);
    const nextVisit = createHubVisitAddress(nBiome, descriptor.hubKey, descriptor.requiredVisits);
    expect(projected.interactions.hubVisits.get(semanticAddressKey(nextVisit))).toMatchObject({
      owner: nextVisit,
    });
  });

  it('exposes all F-through-Q takeover batches only from their decision owners while I keeps its Preboss target replaceable', () => {
    const underworld = workspace(createGoldenFGHIProject(catalog));
    const surface = workspace(createRepresentativeNOPQProject());
    for (const [projected, biomeKey] of [
      [underworld, 'F'],
      [underworld, 'G'],
      [underworld, 'H'],
      [surface, 'N'],
      [surface, 'O'],
      [surface, 'P'],
      [surface, 'Q'],
    ] as const) {
      const value = biome(projected, biomeKey);
      const takeover = value.nodes.find(
        (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
          node.kind === 'takeoverBatch',
      );
      if (takeover === undefined) throw new Error(`${biomeKey} takeover was not projected`);

      expect(
        projected.interactions.takeoverBatches.get(takeover.takeoverInteractionKey),
      ).toMatchObject({ action: 'reconcile', owner: takeover.owner });
      for (const target of takeover.targets) {
        expect(projected.interactions.rooms.has(semanticAddressKey(target.marker.address))).toBe(
          false,
        );
      }
    }

    const i = biome(underworld, 'I');
    const mixed = i.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'mixedBatch' }> =>
        node.kind === 'mixedBatch',
    );
    const preboss = mixed?.targets.find((target) => target.room.gameName === 'I_PreBoss02');
    if (preboss === undefined) throw new Error('I mixed Preboss target was not projected');
    expect(mixed?.targetInteraction).toBe('replaceable');
    expect(underworld.interactions.rooms.has(semanticAddressKey(preboss.marker.address))).toBe(
      true,
    );

    const incomplete = createProjectDocument(catalog, {
      projectId: 'f-frontier',
      name: 'F frontier',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const started = applyProjectCommand(incomplete, catalog, {
      kind: 'CreateStart',
      biome: createBiomeAddress('Underworld', 'F'),
      occurrenceId: createOccurrenceId('f-frontier-start'),
      gameName: 'F_Opening01',
    });
    const frontier = workspace(started);
    const owner = createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('f-frontier-start'),
    });
    expect(frontier.interactions.takeoverBatches.get(semanticAddressKey(owner))).toMatchObject({
      action: 'create',
      owner,
    });
  });

  it('presents takeover candidates through declaration-owned labels and command identities', () => {
    const project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'f-takeover-frontier',
        name: 'F takeover frontier',
        configuredBiomeCounts: { Underworld: 1 },
      }),
      catalog,
      {
        kind: 'CreateStart',
        biome: createBiomeAddress('Underworld', 'F'),
        occurrenceId: createOccurrenceId('f-takeover-frontier-start'),
        gameName: 'F_Opening01',
      },
    );
    const projected = workspace(project);
    const owner = createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('f-takeover-frontier-start'),
    });
    const interaction = projected.interactions.takeoverBatches.get(semanticAddressKey(owner));
    if (interaction?.presentation !== 'candidate') {
      throw new Error('F forked takeover candidate interaction is missing');
    }
    const candidates = interaction.load();
    expect(candidates).not.toHaveLength(0);
    expect(candidates.every((candidate) => candidate.value.label.length > 0)).toBe(true);
    expect(candidates.every((candidate) => candidate.value.gameName.startsWith('F_'))).toBe(true);
  });

  it('projects O and Q Shop-only Preboss actions only at their bounded final frontiers', () => {
    const complete = createRepresentativeNOPQProject();
    const cases = [
      [oBiome, oOccurrenceIds.combat02, 'O_PreBoss01'],
      [qBiome, qOccurrenceIds.secondMiniboss1, 'Q_PreBoss01'],
    ] as const;

    for (const [biomeAddress, parent, gameName] of cases) {
      const project = applyProjectCommand(complete, catalog, {
        kind: 'RemoveExitDecision',
        decision: createExitDecisionAddress(biomeAddress, {
          kind: 'occurrence',
          occurrenceId: parent,
        }),
      });
      const projected = workspace(project);
      const current = biome(projected, biomeAddress.biomeKey);
      const frontier = current.frontier;
      if (frontier?.kind !== 'exitDecision') {
        throw new Error(`${biomeAddress.biomeKey} direct frontier is missing`);
      }
      const interaction = projected.interactions.takeoverBatches.get(
        semanticAddressKey(frontier.owner),
      );
      if (interaction?.presentation !== 'directPreboss') {
        throw new Error(`${biomeAddress.biomeKey} direct Preboss interaction is missing`);
      }
      expect(interaction.action).toBe('create');
      expect(interaction.label).toBe(catalog.rooms.byKey[gameName]!.label);
      expect('load' in interaction).toBe(false);
      expect(projected.interactions.structural.has(semanticAddressKey(frontier.owner))).toBe(false);
      const result = interaction.execute();
      if (result.kind !== 'command') {
        throw new Error(`${biomeAddress.biomeKey} direct Preboss is unexpectedly unavailable`);
      }
      expect(result.command).toMatchObject({
        kind: 'CreateTakeoverBatch',
        decision: frontier.owner,
        gameName,
        targetOccurrenceIds: { exit1: expect.any(String) },
      });
    }

    const beforeFinal = applyProjectCommand(complete, catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(oBiome, {
        kind: 'occurrence',
        occurrenceId: oOccurrenceIds.story,
      }),
    });
    const projected = workspace(beforeFinal);
    const frontier = biome(projected, 'O').frontier;
    if (frontier?.kind !== 'exitDecision') throw new Error('O ordinary frontier is missing');
    expect(projected.interactions.takeoverBatches.has(semanticAddressKey(frontier.owner))).toBe(
      false,
    );
    expect(projected.interactions.structural.get(semanticAddressKey(frontier.owner))).toMatchObject(
      {
        action: 'createBatch',
        owner: frontier.owner,
      },
    );
  });

  it('does not misclassify forked, mixed, linked, or Hub progression as a direct Preboss', () => {
    const underworld = workspace(createGoldenFGHIProject(catalog));
    const surface = workspace(createRepresentativeNOPQProject());
    const cases = [
      [underworld, 'F'],
      [underworld, 'G'],
      [underworld, 'H'],
      [underworld, 'I'],
      [surface, 'N'],
      [surface, 'P'],
    ] as const;

    for (const [projected, biomeKey] of cases) {
      const interactions = [...projected.interactions.takeoverBatches.values()].filter(
        (interaction) => interaction.owner.biomeKey === biomeKey,
      );
      expect(interactions.some((interaction) => interaction.presentation === 'directPreboss')).toBe(
        false,
      );
    }
  });

  it('projects declaration-owned reward domains for side rooms, wheels, shops, and free Preboss rewards', () => {
    const underworld = workspace(createGoldenFGHIProject(catalog));
    const surface = workspace(createRepresentativeNOPQProject());
    const nCombat = catalog.rooms.byKey.N_Combat05;
    const sideGroup = nCombat?.localChildren.find((child) => child.kind === 'fixedRoomSlots');
    const firstSide = sideGroup?.kind === 'fixedRoomSlots' ? sideGroup.slots[0] : undefined;
    if (sideGroup?.kind !== 'fixedRoomSlots' || firstSide === undefined) {
      throw new Error('N side-room fixture is missing');
    }
    const side = surface.interactions.rewards.get(
      semanticAddressKey(
        createLocalRewardAddress(
          nBiome,
          nOccurrenceId('combat05'),
          sideGroup.key,
          firstSide.slotKey,
        ),
      ),
    );
    const wheel = surface.interactions.rewards.get(
      semanticAddressKey(
        createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
      ),
    );
    const shop = surface.interactions.rewards.get(
      semanticAddressKey(createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon')),
    );
    const freePreboss = underworld.interactions.rewards.get(
      semanticAddressKey(
        createIncomingRewardAddress(
          createBiomeAddress('Underworld', 'F'),
          createOccurrenceId('golden-f-preboss-free'),
        ),
      ),
    );

    for (const interaction of [side, wheel, shop, freePreboss]) {
      expect(interaction).toBeDefined();
      expect(interaction!.authoredRewardTypes.length).toBeGreaterThan(1);
    }
    const shopProfile = catalog.rewards.shops.byKey.WorldShop;
    const shopSlot = shopProfile?.slots.byKey.MajorNonBoon;
    if (shopProfile === undefined || shopSlot === undefined)
      throw new Error('N Shop fixture is missing');
    expect(shop!.authoredRewardTypes).toEqual(
      shopProfile.groups.byKey[shopSlot.groupKey]!.rewardTypes,
    );
  });

  it('keeps fixed, Fields, ship-wheel, and Shop reward state in compact room summaries', () => {
    const underworld = workspace(createGoldenFGHIProject(catalog));
    const surface = workspace(createRepresentativeNOPQProject());
    const summary = (
      projected: ReturnType<typeof workspace>,
      biomeKey: string,
      gameName: string,
    ) => {
      const node = biome(projected, biomeKey).nodes.find(
        (
          candidate,
        ): candidate is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
          candidate.kind === 'occurrenceWorkbench' && candidate.room.gameName === gameName,
      );
      if (node === undefined) throw new Error(`${gameName} workbench is missing`);
      return node.room.rewardSummary;
    };

    expect(summary(surface, 'P', 'P_Story01')).toBeDefined();
    expect(summary(underworld, 'H', 'H_Combat02')).toMatch(/^Cages · /);
    expect(summary(surface, 'O', 'O_Combat04')).toMatch(/^\d encounters · /);
    expect(summary(surface, 'N', 'N_PreBoss01')).toMatch(/^\d offers · \d purchased$/);
  });

  it('projects immutable Fields, Ship, and Shop workbench leaves in declaration order', () => {
    const underworld = workspace(createGoldenFGHIProject(catalog));
    const surface = workspace(createRepresentativeNOPQProject());

    const fields = roomWorkbench(underworld, 'H', 'H_Combat02');
    expect(fields.roomLocal.kind).toBe('fields');
    if (fields.roomLocal.kind !== 'fields') throw new Error('Fields local workbench is missing');
    expect(Object.isFrozen(fields.roomLocal)).toBe(true);
    expect(fields.roomLocal.cages.map((cage) => [cage.key, cage.label, cage.active])).toEqual([
      ['cage1', 'Cage 1', true],
      ['cage2', 'Cage 2', true],
      ['cage3', 'Cage 3', false],
    ]);
    expect(fields.roomLocal.cages[0]?.control.owner.address).toEqual(
      createLocalRewardAddress(
        goldenHBiome,
        createOccurrenceId('golden-h-combat02'),
        'cages',
        'cage1',
      ),
    );
    expect(fields.roomLocal.cages.every((cage) => Object.isFrozen(cage))).toBe(true);

    const clockwork = roomWorkbench(underworld, 'I', 'I_Combat01');
    expect(clockwork.roomLocal).toMatchObject({
      kind: 'incomingReward',
      clockworkReward: 'goal',
    });
    const firstClockworkBatch = biome(underworld, 'I').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.targets.some((target) => target.room.gameName === 'I_Combat01'),
    );
    if (firstClockworkBatch === undefined) throw new Error('I Clockwork batch is missing');
    expect(
      firstClockworkBatch.targets.find((target) => target.room.gameName === 'I_Combat01'),
    ).toMatchObject({
      clockworkReward: 'goal',
    });

    const ship = roomWorkbench(surface, 'O', 'O_Combat04');
    expect(ship.roomLocal.kind).toBe('ship');
    if (ship.roomLocal.kind !== 'ship') throw new Error('Ship local workbench is missing');
    expect(ship.roomLocal.encounterCount).toBe(2);
    expect(
      ship.roomLocal.wheels.map((wheel) => [
        wheel.key,
        wheel.label,
        wheel.active,
        wheel.offerCount,
        wheel.pickedOfferIndex,
        wheel.storeKey,
      ]),
    ).toEqual([
      ['wheel1', 'Reward wheel 1', true, 1, 1, 'RunProgress'],
      ['wheel2', 'Reward wheel 2', false, 1, 1, 'RunProgress'],
    ]);
    expect(ship.roomLocal.wheels[0]?.address).toEqual(
      createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
    );
    expect(
      ship.roomLocal.wheels[0]?.offers.map((offer) => [offer.key, offer.label, offer.active]),
    ).toEqual([
      ['offer1', 'Offer 1', true],
      ['offer2', 'Offer 2', false],
    ]);
    expect(ship.roomLocal.wheels[0]?.offers[0]?.control.owner.address).toEqual(
      createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
    );

    const shop = roomWorkbench(surface, 'N', 'N_PreBoss01');
    expect(shop.roomLocal.kind).toBe('shop');
    if (shop.roomLocal.kind !== 'shop') throw new Error('Shop local workbench is missing');
    expect(shop.roomLocal.materialized).toBe(true);
    expect(Object.isFrozen(shop.roomLocal.offers)).toBe(true);
    const majorNonBoon = shop.roomLocal.offers.find((offer) => offer.key === 'MajorNonBoon');
    if (majorNonBoon === undefined) throw new Error('MajorNonBoon Shop offer is missing');
    expect(majorNonBoon.label).toBe('Offer 2');
    expect(majorNonBoon.rewardControl.owner.address).toEqual(
      createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
    );
    expect(majorNonBoon.purchase).toMatchObject({
      address: createShopPurchaseAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
      purchased: false,
    });
  });

  it('keeps a decoded unpicked Shop inventory dormant without publishing its controls', () => {
    const fBiome = createBiomeAddress('Underworld', 'F');
    const start = createOccurrenceId('dormant-shop-start');
    const combat = createOccurrenceId('dormant-shop-parent');
    const ordinarySibling = createOccurrenceId('dormant-shop-combat');
    const shop = createOccurrenceId('dormant-shop');
    const startSource = { kind: 'occurrence' as const, occurrenceId: start };
    let project = createProjectDocument(catalog, {
      projectId: 'dormant-shop',
      name: 'Dormant Shop',
      configuredBiomeCounts: { Underworld: 1 },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: start,
      gameName: 'F_Opening01',
    });
    const startDecision = createExitDecisionAddress(fBiome, startSource);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: startDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, startSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, startSource, 'exit1'),
      occurrenceId: combat,
      gameName: 'F_Combat03',
    });
    const source = { kind: 'occurrence' as const, occurrenceId: combat };
    const decision = createExitDecisionAddress(fBiome, source);
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, source, 'exit1'),
      occurrenceId: ordinarySibling,
      gameName: 'F_Combat04',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, source, 'exit2'),
      occurrenceId: shop,
      gameName: 'F_Shop01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, source),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const authoredShop = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === shop);
    if (authoredShop?.state.kind !== 'shop' || authoredShop.state.shop === undefined) {
      throw new Error('selected Shop must materialize its complete inventory');
    }
    const [offerKey] = Object.keys(authoredShop.state.shop.offers);
    if (offerKey === undefined) throw new Error('selected Shop must have an offer');

    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{
          biomeKey: string;
          topology: {
            decisions: Array<{
              kind: 'exit';
              source: { kind: 'occurrence'; occurrenceId: string };
              selection: { kind: 'derived' | 'normal' | 'unresolved'; exitKey?: string };
            }>;
          } | null;
        }>;
      }>;
    };
    const encodedDecision = encoded.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F')
      ?.topology?.decisions.find((candidate) => candidate.source.occurrenceId === combat);
    if (encodedDecision === undefined) throw new Error('encoded F decision is missing');
    // The codec allows state retained from an earlier selected Shop even when
    // a later persisted selection picks its sibling.
    encodedDecision.selection = { kind: 'normal', exitKey: 'exit1' };
    const decoded = decodeProjectDocument(encoded, catalog);

    const projected = workspace(decoded);
    const dormant = roomWorkbench(projected, 'F', 'F_Shop01');
    expect(dormant.entered).toBe(false);
    expect(dormant.rewardSummary).toBeUndefined();
    expect(dormant.rewardControls).toEqual([]);
    expect(dormant.roomLocal).toEqual({
      kind: 'shop',
      materialized: false,
      offers: [],
    });
    expect(
      projected.interactions.rewards.has(
        semanticAddressKey(createShopOfferAddress(fBiome, shop, offerKey)),
      ),
    ).toBe(false);
    expect(
      projected.interactions.shopPurchases.has(
        semanticAddressKey(createShopPurchaseAddress(fBiome, shop, offerKey)),
      ),
    ).toBe(false);
  });

  it('projects biome-field, fixed-payload, and authored-choice-start controls with exact owners', () => {
    const underworld = workspace(createGoldenFGHIProject(catalog));
    const surface = workspace(createRepresentativeNOPQProject());

    const i = biome(underworld, 'I');
    expect(i.fields).toEqual([
      {
        address: createBiomeFieldAddress(goldenIBiome, 'maxNonGoalRewards'),
        key: 'maxNonGoalRewards',
        kind: 'boundedInteger',
        label: 'Rolled non-goal limit',
        marker: expect.objectContaining({
          address: createBiomeFieldAddress(goldenIBiome, 'maxNonGoalRewards'),
        }),
        value: 3,
        values: [3, 4, 5, 6],
      },
    ]);

    const fEntry = biome(underworld, 'F').entry?.room;
    if (fEntry?.roomPicker?.kind !== 'startRoomPicker') {
      throw new Error('F authored-choice start picker is missing');
    }
    expect(fEntry.roomPicker).toMatchObject({
      address: createOccurrenceAddress(goldenFBiome, goldenFStartId),
      candidateGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
      selectedGameName: 'F_Opening01',
    });
    expect(
      underworld.interactions.rooms.get(semanticAddressKey(fEntry.roomPicker.address)),
    ).toMatchObject({
      owner: fEntry.roomPicker.address,
    });

    const devotion = roomWorkbench(surface, 'O', 'O_Devotion01');
    expect(devotion.roomLocal.kind).toBe('fixed');
    if (devotion.roomLocal.kind !== 'fixed') throw new Error('Devotion fixed state is missing');
    expect(devotion.roomLocal.marker.address).toEqual(
      createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion),
    );
    expect(devotion.roomLocal.control).toMatchObject({
      kind: 'explicitReward',
      owner: { address: createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion) },
      rewardTypes: ['Devotion'],
    });
    expect(
      surface.interactions.rewards.has(
        semanticAddressKey(createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion)),
      ),
    ).toBe(true);

    const story = roomWorkbench(surface, 'P', 'P_Story01');
    expect(story.roomLocal.kind).toBe('fixed');
    if (story.roomLocal.kind !== 'fixed') throw new Error('Story fixed state is missing');
    expect(story.roomLocal.marker.address).toEqual(
      createIncomingRewardAddress(pBiome, pOccurrenceId('P_Story01', 7, 1)),
    );
    expect(story.roomLocal.control).toBeUndefined();
  });

  it('keeps target identity allocation and takeover command construction in the interaction adapter', () => {
    const projected = workspace(createGoldenFGHIProject(catalog));
    const f = biome(projected, 'F');
    const takeover = f.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (takeover === undefined) throw new Error('F takeover batch is missing');
    const interaction = projected.interactions.takeoverBatches.get(takeover.takeoverInteractionKey);
    if (interaction?.presentation !== 'repair') {
      throw new Error('F takeover repair capability is missing');
    }

    expect(interaction.execute()).toEqual({
      kind: 'ReconcileTakeoverBatch',
      decision: takeover.owner,
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: Object.fromEntries(
        takeover.targets.map((target) => [target.exitKey, target.room.occurrenceId]),
      ),
    });
  });

  it('projects the exact command-owned removal scope for retained ordinary and takeover batches', () => {
    const narrowedF = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(
        createBiomeAddress('Underworld', 'F'),
        goldenFOccurrenceId(1, 1),
      ),
      gameName: 'F_Combat01',
    });
    const f = biome(workspace(narrowedF), 'F');
    const ordinary = f.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.owner.source.kind === 'occurrence' &&
        node.owner.source.occurrenceId === goldenFOccurrenceId(1, 1),
    );
    if (ordinary === undefined) throw new Error('narrowed F batch was not projected');
    expect(ordinary.targets.map((target) => [target.exitKey, target.physicalState])).toEqual([
      ['exit1', 'available'],
      ['exit2', 'unavailable'],
    ]);
    expect(ordinary.repairScope).toEqual({
      command: 'ReconcileBatchExitCapacity',
      owner: ordinary.owner,
      removedDecisionOwners: [],
      removedOccurrenceIds: [goldenFOccurrenceId(2, 2)],
    });

    const gPlan = createGoldenFGHIProject(catalog).routes[0]!.biomes.find(
      (candidate) => candidate.biomeKey === 'G',
    );
    const takeoverDecision = gPlan?.topology?.decisions.find(
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
    if (takeoverDecision?.kind !== 'exit' || takeoverDecision.source.kind !== 'occurrence') {
      throw new Error('G takeover source is missing');
    }
    const narrowedG = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(
        createBiomeAddress('Underworld', 'G'),
        takeoverDecision.source.occurrenceId,
      ),
      gameName: 'G_MiniBoss02',
    });
    const g = biome(workspace(narrowedG), 'G');
    const takeover = g.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (takeover === undefined) throw new Error('narrowed G takeover was not projected');
    const unavailable = takeover.targets
      .filter((target) => target.physicalState === 'unavailable')
      .map((target) => target.room.occurrenceId);
    expect(unavailable).not.toHaveLength(0);
    expect(takeover.repairScope).toMatchObject({
      command: 'ReconcileTakeoverBatch',
      owner: takeover.owner,
      removedOccurrenceIds: unavailable,
    });
  });

  it('retains exact repair scopes for physically unavailable batches in blocked authored suffixes', () => {
    const fOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });
    let fProject = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      gameName: 'F_Combat01',
    });
    fProject = applyProjectCommand(fProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const f = biome(workspace(fProject), 'F');
    const rawOrdinary = f.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(fOwner),
    );
    if (rawOrdinary === undefined) throw new Error('blocked F retained ordinary batch is missing');
    expect(rawOrdinary).toMatchObject({
      topologyState: 'retained',
      repairScope: {
        command: 'ReconcileBatchExitCapacity',
        owner: fOwner,
        removedOccurrenceIds: [goldenFOccurrenceId(2, 2)],
      },
    });
    expect(rawOrdinary.targets).toContainEqual(
      expect.objectContaining({ exitKey: 'exit2', index: 2, physicalState: 'unavailable' }),
    );

    const base = createGoldenFGHIProject(catalog);
    const gPlan = base.routes[0]?.biomes.find((candidate) => candidate.biomeKey === 'G');
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
    let blockedProject = applyProjectCommand(base, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, gTakeover.source.occurrenceId),
      gameName: 'G_MiniBoss02',
    });
    blockedProject = applyProjectCommand(blockedProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const projected = workspace(blockedProject);
    const g = biome(projected, 'G');
    const rawTakeover = g.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch' &&
        semanticAddressKey(node.owner) ===
          semanticAddressKey(createExitDecisionAddress(goldenGBiome, gTakeover.source)),
    );
    if (rawTakeover === undefined) throw new Error('blocked G retained takeover batch is missing');
    const unavailable = rawTakeover.targets
      .filter((target) => target.physicalState === 'unavailable')
      .map((target) => target.room.occurrenceId);
    expect(g.status).toBe('blocked');
    expect(rawTakeover.topologyState).toBe('retained');
    expect(unavailable).not.toHaveLength(0);
    expect(rawTakeover.repairScope).toMatchObject({
      command: 'ReconcileTakeoverBatch',
      owner: rawTakeover.owner,
      removedOccurrenceIds: unavailable,
    });
    expect(
      projected.interactions.takeoverBatches.get(rawTakeover.takeoverInteractionKey),
    ).toMatchObject({
      action: 'reconcile',
      presentation: 'repair',
    });
  });

  it('exposes the exact reset-and-descendant impact before replacing an ordinary batch with a takeover', () => {
    const project = createGoldenFGHIProject(catalog);
    const projected = workspace(project);
    const owner = createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const interaction = projected.interactions.takeoverBatches.get(semanticAddressKey(owner));
    expect(interaction).toMatchObject({ action: 'replace', owner });
    expect(interaction?.impact).toMatchObject({
      command: 'ReplaceWithTakeoverBatch',
      owner,
      replacedOccurrenceIds: [goldenFOccurrenceId(1, 1)],
    });
    expect(interaction?.impact?.removedDecisionOwners).toContainEqual(
      createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(1, 1),
      }),
    );
    expect(interaction?.impact?.removedOccurrenceIds).toContain(goldenFOccurrenceId(1, 1));
    expect(interaction?.impact?.removedOccurrenceIds).toContain(goldenFOccurrenceId(2, 1));
  });

  it('preserves incomplete and route-prefix-blocked workspace states with an explicit start frontier', () => {
    const initial = createProjectDocument(catalog, {
      projectId: 'prefix',
      name: 'Prefix',
      configuredBiomeCounts: { Underworld: 2 },
    });
    const projected = workspace(initial);
    const f = biome(projected, 'F');
    const g = biome(projected, 'G');

    expect(f.status).toBe('incomplete');
    expect(g.status).toBe('blocked');
    expect(f.nodes.map((node) => node.kind)).toEqual(['completion', 'completion']);
    expect(g.nodes.map((node) => node.kind)).toEqual(['completion', 'completion']);
    expect(f.frontier).toMatchObject({
      kind: 'start',
      owner: createBiomeAddress('Underworld', 'F'),
    });
    if (f.frontier?.kind !== 'start') throw new Error('F start frontier is missing');
    expect(projected.interactions.starts.get(f.frontier.interactionKey)).toMatchObject({
      owner: createBiomeAddress('Underworld', 'F'),
    });

    const gBiome = createBiomeAddress('Underworld', 'G');
    const gStart = createOccurrenceId('blocked-g-start');
    const startedG = applyProjectCommand(initial, catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: gStart,
    });
    const blocked = workspace(startedG);
    const blockedG = biome(blocked, 'G');
    const decision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: gStart,
    });
    expect(blockedG.status).toBe('blocked');
    expect(blockedG.frontier).toMatchObject({ kind: 'exitDecision', owner: decision });
    expect(blocked.interactions.structural.get(semanticAddressKey(decision))).toMatchObject({
      action: 'createBatch',
      owner: decision,
    });

    const surfaceInitial = createProjectDocument(catalog, {
      projectId: 'surface-prefix',
      name: 'Surface prefix',
      configuredBiomeCounts: { Surface: 4 },
    });
    const surface = workspace(surfaceInitial);
    expect(biome(surface, 'N').status).toBe('incomplete');
    for (const biomeKey of ['O', 'P', 'Q'] as const) {
      const blockedSurfaceBiome = biome(surface, biomeKey);
      const owner = createBiomeAddress('Surface', biomeKey);
      expect(blockedSurfaceBiome.status).toBe('blocked');
      expect(blockedSurfaceBiome.frontier).toMatchObject({ kind: 'start', owner });
      if (blockedSurfaceBiome.frontier?.kind !== 'start') {
        throw new Error(`${biomeKey} start frontier is missing`);
      }
      expect(
        surface.interactions.starts.get(blockedSurfaceBiome.frontier.interactionKey),
      ).toMatchObject({ owner });
    }
  });

  it('distinguishes a materialized partial prefix from complete invalid and retained structures', () => {
    const partial = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'partial-f',
        name: 'Partial F',
        configuredBiomeCounts: { Underworld: 1 },
      }),
      catalog,
      {
        kind: 'CreateStart',
        biome: createBiomeAddress('Underworld', 'F'),
        occurrenceId: createOccurrenceId('partial-f-start'),
        gameName: 'F_Opening01',
      },
    );
    const partialF = biome(workspace(partial), 'F');
    expect(partialF.status).toBe('incomplete');
    expect(partialF.source).toBe('progressive');
    expect(partialF.entry?.room.gameName).toBe('F_Opening01');
    expect(partialF.frontier?.marker.address).toEqual(
      createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('partial-f-start'),
      }),
    );

    const invalidP = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
      gameName: 'P_Combat02',
    });
    const p = biome(workspace(invalidP), 'P');
    expect(p.status).toBe('invalid');
    expect(p.source).toBe('canonical');
    expect(
      p.nodes.some(
        (node) =>
          (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') &&
          node.targets.some((target) => target.marker.findingCount > 0),
      ),
    ).toBe(true);
  });

  it('keeps later authored decisions visible as retained and unassessed after an incomplete prefix', () => {
    const project = createGoldenFGHIProject(catalog);
    const f = project.routes[0]!.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (f?.topology === null || f === undefined) throw new Error('golden F topology is missing');
    const first = f.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === goldenFStartId,
    );
    if (first?.kind !== 'exit') throw new Error('golden F opening decision is missing');
    const incomplete = {
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
                          decision === first
                            ? { ...decision, selection: { kind: 'unresolved' as const } }
                            : decision,
                        ),
                      },
                    },
              ),
            },
      ),
    };
    const retained = biome(workspace(incomplete), 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.owner.source.kind === 'occurrence' &&
        node.owner.source.occurrenceId === goldenFOccurrenceId(1, 1),
    );
    if (retained === undefined) throw new Error('retained F batch was not projected');
    expect(retained.topologyState).toBe('retained');
    expect(retained.marker.assessment).toBe('unassessed');
    expect(retained.targets.every((target) => target.retained)).toBe(true);
    expect(retained.targets.every((target) => target.marker.assessment === 'unassessed')).toBe(
      true,
    );
  });

  it('indexes exact finding owners and falls back only to the owning biome shell', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'finding-owner',
      name: 'Finding owner',
      configuredBiomeCounts: { Surface: 1 },
    });
    const projected = workspace(project);
    const finding = simulateProject(catalog, project).findings[0];
    if (finding === undefined) throw new Error('expected a topology finding');

    const destination = projected.focusByOwner.get(semanticAddressKey(finding.origin));
    expect(destination).toMatchObject({
      ownerAddress: finding.origin,
      biomeKey: nBiome.biomeKey,
      routeKey: nBiome.routeKey,
    });
  });
});
