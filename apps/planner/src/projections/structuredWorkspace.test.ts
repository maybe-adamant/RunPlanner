import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
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
} from '../../../../test/fixtures/authored-project';
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
} from '../../../../test/fixtures/authored-project';
import {
  assertExpectedWorkspaceLeafClosure,
  assertRenderedWorkspaceStructuralControlClosure,
} from '../../test/support/structuredWorkspaceClosure';
import { expectedWorkspaceLeafRequirements } from '../../test/support/structuredWorkspaceExpectations';
import { createCandidateSessionFactory } from './candidateProjection';
import { createContextualOptionResolver } from './contextualOptions';
import { createContextualPickerProjection } from './contextualPicker';
import { createRewardPickerProjection } from './rewardPicker';
import {
  createStructuredWorkspaceProjection,
  type WorkspaceBiome,
  type WorkspaceNode,
  type WorkspaceRailEntry,
  type WorkspaceRoomSummary,
} from './structured-workspace';

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

function assertIndependentWorkspaceInteractionClosure(
  project: ReturnType<typeof createProjectDocument>,
  projected: ReturnType<typeof workspace>,
  interactions: typeof projected.interactions,
): void {
  assertRenderedWorkspaceStructuralControlClosure({ interactions, routes: projected.routes });
  for (const route of project.routes) {
    for (const plan of route.biomes) {
      const projectedBiome = projected.routes
        .find((candidate) => candidate.routeKey === route.routeKey)
        ?.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey);
      if (projectedBiome === undefined)
        throw new Error(`${plan.biomeKey} workspace biome is missing`);
      assertExpectedWorkspaceLeafClosure({
        focusByOwner: projected.focusByOwner,
        interactions,
        nodes: projectedBiome.nodes,
        requirements: expectedWorkspaceLeafRequirements(
          catalog,
          { biomeKey: plan.biomeKey, kind: 'biome', routeKey: route.routeKey },
          plan,
        ),
      });
    }
  }
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
    if (entry.kind === 'hubGroup') return 'hubDecision';
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

function projectedRooms(projected: ReturnType<typeof workspace>): readonly WorkspaceRoomSummary[] {
  const rooms = new Map<string, WorkspaceRoomSummary>();
  const include = (room: WorkspaceRoomSummary) => {
    rooms.set(semanticAddressKey(room.address), room);
  };
  for (const biome of projected.routes.flatMap((route) => route.biomes)) {
    for (const node of biome.nodes) {
      switch (node.kind) {
        case 'occurrenceWorkbench':
          include(node.room);
          break;
        case 'linkedExit':
          include(node.target.room);
          break;
        case 'ordinaryBatch':
        case 'mixedBatch':
        case 'takeoverBatch':
          node.targets.forEach((target) => include(target.room));
          break;
        case 'hubDecision':
          node.slots.forEach((slot) => {
            if (slot.room !== undefined) include(slot.room);
          });
          break;
        case 'completion':
          break;
      }
    }
  }
  return Object.freeze([...rooms.values()]);
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
    const underworld = workspace(createGoldenFGHIProject());
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

  it('publishes generic topology removals with engine-owned removal impact', () => {
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
    const preboss = createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    const removeLinked = projected.interactions.topologyRemovals.get(semanticAddressKey(linked));
    const removePreboss = projected.interactions.topologyRemovals.get(semanticAddressKey(preboss));

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
    expect(removePreboss).toMatchObject({
      action: 'removeExitDecision',
      command: { kind: 'RemoveExitDecision', decision: preboss },
      owner: preboss,
      impact: { removedOccurrenceIds: [nOccurrenceIds.preboss] },
    });
    expect(
      projected.interactions.topologyRemovals.has(
        semanticAddressKey(createHubDecisionAddress(nBiome, 'hub')),
      ),
    ).toBe(false);

    const empty = workspace(
      createProjectDocument(catalog, {
        projectId: 'topology-removal-outline',
        name: 'Topology removal outline',
        configuredBiomeCounts: { Surface: 1 },
      }),
    );
    expect(empty.interactions.topologyRemovals).toHaveLength(0);
  });

  it('keeps declaration and canonical decision order rather than array-position topology rules', () => {
    const underworld = workspace(createGoldenFGHIProject());
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

  it('orders a selected authored subtree before retained peers independently of serialization order', () => {
    const base = createGoldenFGHIProject();
    const forkSource = goldenFOccurrenceId(1, 1);
    const selectedChildSource = goldenFOccurrenceId(2, 2);
    const retainedChildSource = goldenFOccurrenceId(2, 1);
    const movedDecisionSource = goldenFOccurrenceId(3, 1);
    const withSelectedSpine = (reverse: boolean): typeof base =>
      ({
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
      }) as typeof base;
    const projected = workspace(withSelectedSpine(false));
    const reversed = workspace(withSelectedSpine(true));
    const orderedDecisionOwners = (value: ReturnType<typeof workspace>) =>
      biome(value, 'F')
        .nodes.filter(
          (
            node,
          ): node is Extract<
            WorkspaceNode,
            {
              readonly kind: 'linkedExit' | 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch';
            }
          > =>
            node.kind === 'linkedExit' ||
            node.kind === 'ordinaryBatch' ||
            node.kind === 'mixedBatch' ||
            node.kind === 'takeoverBatch',
        )
        .map((node) => semanticAddressKey(node.owner));
    const sourceOwner = (occurrenceId: ReturnType<typeof goldenFOccurrenceId>) =>
      semanticAddressKey(
        createExitDecisionAddress(goldenFBiome, { kind: 'occurrence', occurrenceId }),
      );
    const owners = orderedDecisionOwners(projected);
    expect(owners).toEqual(
      [
        goldenFStartId,
        forkSource,
        selectedChildSource,
        goldenFOccurrenceId(4, 1),
        goldenFOccurrenceId(5, 1),
        goldenFOccurrenceId(6, 1),
        goldenFOccurrenceId(7, 1),
        goldenFOccurrenceId(8, 1),
        goldenFOccurrenceId(9, 1),
        goldenFOccurrenceId(10, 1),
        retainedChildSource,
      ].map(sourceOwner),
    );
    expect(orderedDecisionOwners(reversed)).toEqual(owners);

    const selectedNode = biome(projected, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === sourceOwner(selectedChildSource),
    );
    const reversedSelectedNode = biome(reversed, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === sourceOwner(selectedChildSource),
    );
    if (selectedNode === undefined || reversedSelectedNode === undefined) {
      throw new Error('selected F retained-subtree decision is missing');
    }
    expect(reversedSelectedNode.targets.map((target) => target.exitKey)).toEqual(
      selectedNode.targets.map((target) => target.exitKey),
    );
    expect(
      reversed.interactions.exitSelections
        .get(reversedSelectedNode.selection.focusKey)
        ?.targets.map((choice) => choice.value),
    ).toEqual(
      projected.interactions.exitSelections
        .get(selectedNode.selection.focusKey)
        ?.targets.map((choice) => choice.value),
    );
    const forkNode = biome(projected, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' && semanticAddressKey(node.owner) === sourceOwner(forkSource),
    );
    const reversedForkNode = biome(reversed, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' && semanticAddressKey(node.owner) === sourceOwner(forkSource),
    );
    if (forkNode === undefined || reversedForkNode === undefined) {
      throw new Error('selected F fork decision is missing');
    }
    const expectedForkSelection = {
      key: forkNode.selection.focusKey,
      owner: forkNode.owner,
      selectedExitKey: 'exit2',
      targets: [
        { label: 'exit1', value: 'exit1' },
        { label: 'exit2', value: 'exit2' },
      ],
    };
    expect(projected.interactions.exitSelections.get(forkNode.selection.focusKey)).toEqual(
      expectedForkSelection,
    );
    expect(reversed.interactions.exitSelections.get(reversedForkNode.selection.focusKey)).toEqual({
      ...expectedForkSelection,
      key: reversedForkNode.selection.focusKey,
      owner: reversedForkNode.owner,
    });
    expect(forkNode.selection.address).not.toEqual(forkNode.owner);
  });

  it('projects each ordinary-biome rail as decision points with picked summaries', () => {
    const underworld = workspace(createGoldenFGHIProject());
    const surface = workspace(createRepresentativeNOPQProject());
    const expected = {
      F: { decisions: 10, entry: 'Opening', preboss: true },
      G: { decisions: 7, entry: 'Entrance', preboss: true },
      H: { decisions: 4, entry: 'Entrance', preboss: true },
      I: { decisions: 6, entry: 'Entrance', preboss: false },
      O: { decisions: 6, entry: 'Entrance', preboss: true },
      P: { decisions: 8, entry: 'Entrance', preboss: true },
      Q: { decisions: 6, entry: 'Entrance', preboss: true },
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
      const projectedBiome = biome(projected, biomeKey);
      const contract = expected[biomeKey];
      const nodeEntries = projectedBiome.rail.filter(
        (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
          entry.kind === 'node',
      );
      expect(nodeEntries.map((entry) => entry.label)).toEqual([
        contract.entry,
        ...Array.from({ length: contract.decisions }, (_, index) => `Decision ${index + 1}`),
        ...(contract.preboss ? ['Preboss'] : []),
      ]);
      expect(
        nodeEntries
          .filter(
            (entry) =>
              entry.node.kind === 'ordinaryBatch' ||
              entry.node.kind === 'mixedBatch' ||
              entry.node.kind === 'takeoverBatch',
          )
          .every((entry) => entry.summary !== undefined),
      ).toBe(true);
      expect(
        nodeEntries.some(
          (entry) =>
            entry.node.kind === 'occurrenceWorkbench' &&
            entry.node.key !== projectedBiome.entry?.key,
        ),
      ).toBe(false);
    }

    const firstFDecision = biome(underworld, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch',
    );
    const firstFTarget = firstFDecision?.targets[0];
    if (firstFDecision === undefined || firstFTarget === undefined) {
      throw new Error('F Decision 1 target is missing');
    }
    expect(underworld.focusByOwner.get(firstFTarget.room.marker.focusKey)).toMatchObject({
      focusAddress: firstFTarget.room.marker.address,
      nodeKey: firstFDecision.key,
    });
    expect(
      underworld.focusByOwner.get(firstFTarget.room.rewardControls[0]!.marker.focusKey),
    ).toMatchObject({
      nodeKey: firstFDecision.key,
    });
  });

  it('keeps completion landmarks outside the decision-point rail', () => {
    const empty = createProjectDocument(catalog, {
      projectId: 'frontier-before-completion',
      name: 'Frontier before completion',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const emptyBiome = biome(workspace(empty), 'F');
    expect(railShape(emptyBiome)).toEqual(['frontier:start']);
    expect(emptyBiome.completionOutline.map((node) => node.label)).toEqual(['Hecate', 'Postboss']);

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
    ]);
  });

  it('keeps physical target order and selection separate from retained target workbenches', () => {
    const projected = biome(workspace(createGoldenFGHIProject()), 'F');
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
    const projectedWorkspace = workspace(createRepresentativeNOPQProject());
    const projected = biome(projectedWorkspace, 'N');
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
    const combat02Room = combat02?.room;
    if (
      combat02 === undefined ||
      combat02Room === undefined ||
      combat02Room.roomLocal.kind !== 'ephyra' ||
      combat02Room.roomLocal.sideRooms.kind !== 'published'
    ) {
      throw new Error('N Combat 02 side-room workbench is missing');
    }
    expect(combat02).toMatchObject({
      label: 'Combat 02',
      roomKind: 'Combat',
      visited: true,
    });
    expect(combat02Room.roomLocal.sideRooms.group).toMatchObject({
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
    ).toMatchObject({ inspectorPresentation: 'hubRoomLocal', railVisibility: 'inspectorOnly' });

    const railHub = projected.rail.find(
      (entry): entry is Extract<(typeof projected.rail)[number], { readonly kind: 'hubGroup' }> =>
        entry.kind === 'hubGroup',
    );
    if (railHub === undefined) throw new Error('N Hub rail group is missing');
    expect(railHub.visits.map((visit) => visit.label)).toEqual([
      'Visit 1 · Combat 05',
      'Visit 2 · Satyr Champion',
      'Visit 3 · Combat 02',
      'Visit 4 · Combat 11',
      'Visit 5 · Combat 23',
      'Visit 6 · Combat 09',
    ]);
    expect(railHub.visits.map((visit) => visit.marker.address.kind)).toEqual(
      railHub.visits.map(() => 'occurrence'),
    );
    expect(railHub.visits[2]).toMatchObject({
      marker: combat02Room.marker,
      node: { key: `occurrence:${semanticAddressKey(combat02Room.address)}` },
      visitMarker: hub.visits[2]?.marker,
    });
    const mainReward = createIncomingRewardAddress(nBiome, nOccurrenceId('combat02'));
    expect(projectedWorkspace.focusByOwner.get(semanticAddressKey(mainReward))).toMatchObject({
      focusAddress: hub.owner,
      ownerAddress: mainReward,
    });
    const preHub = projected.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' && node.room.gameName === 'N_PreHub01',
    );
    const preboss = projected.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' && node.room.gameName === 'N_PreBoss01',
    );
    const preHubDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });
    const prebossDecision = createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    expect(preHub?.sourceDecisionRemoval).toEqual({
      interactionKey: semanticAddressKey(preHubDecision),
      label: 'Remove PreHub',
    });
    expect(preboss?.sourceDecisionRemoval).toEqual({
      interactionKey: semanticAddressKey(prebossDecision),
      label: 'Remove Preboss',
    });
    expect(
      projectedWorkspace.interactions.topologyRemovals.get(semanticAddressKey(preHubDecision)),
    ).toMatchObject({ owner: preHubDecision });
    expect(
      projectedWorkspace.interactions.topologyRemovals.get(semanticAddressKey(prebossDecision)),
    ).toMatchObject({ owner: prebossDecision });
    expect(
      projected.rail.map((entry) => {
        if (entry.kind === 'hubGroup') return 'hub';
        if (entry.kind === 'frontier') return `frontier:${entry.frontier.kind}`;
        return entry.node.kind === 'occurrenceWorkbench'
          ? `room:${entry.node.room.gameName}`
          : entry.node.kind;
      }),
    ).toEqual(['room:N_Opening01', 'room:N_PreHub01', 'hub', 'room:N_PreBoss01']);
    expect(
      projected.rail.some((entry) => entry.kind === 'node' && entry.node.kind === 'linkedExit'),
    ).toBe(false);
    expect(
      projected.rail.some(
        (entry) =>
          entry.kind === 'node' &&
          (entry.node.kind === 'ordinaryBatch' ||
            entry.node.kind === 'mixedBatch' ||
            entry.node.kind === 'takeoverBatch') &&
          entry.node.owner.source.kind === 'hubDecision',
      ),
    ).toBe(false);
    expect(projected.completionOutline.map((node) => node.label)).toEqual([
      'Polyphemus',
      'Postboss',
    ]);
  });

  it('projects every direct Ephyra side-room position as a complete candidate proposal', () => {
    const projectedWorkspace = workspace(createRepresentativeNOPQProject());
    const combat05 = roomWorkbench(projectedWorkspace, 'N', 'N_Combat05');
    if (combat05.roomLocal.kind !== 'ephyra' || combat05.roomLocal.sideRooms.kind !== 'published') {
      throw new Error('N Combat 05 side-room workbench is missing');
    }
    const group = combat05.roomLocal.sideRooms.group;
    const sideDoor2 = group.slots.find((slot) => slot.key === 'sideDoor2');
    const sideDoor3 = group.slots.find((slot) => slot.key === 'sideDoor3');
    if (sideDoor2 === undefined || sideDoor3 === undefined) {
      throw new Error('N Combat 05 side-room slots are missing');
    }

    expect(sideDoor2.entryOrder).toEqual({
      interactionKey: semanticAddressKey(sideDoor2.address) + ':entry-order',
      options: [
        {
          key: 'notEntered',
          label: 'Not entered',
          position: null,
          proposedEnteredSlotKeys: ['sideDoor1'],
        },
        {
          key: 'position:1',
          label: '1st',
          position: 1,
          proposedEnteredSlotKeys: ['sideDoor2', 'sideDoor1'],
        },
        {
          key: 'position:2',
          label: '2nd',
          position: 2,
          proposedEnteredSlotKeys: ['sideDoor1', 'sideDoor2'],
        },
      ],
      selectedKey: 'position:1',
    });
    expect(sideDoor3.entryOrder).toEqual({
      interactionKey: semanticAddressKey(sideDoor3.address) + ':entry-order',
      options: [
        {
          key: 'notEntered',
          label: 'Not entered',
          position: null,
          proposedEnteredSlotKeys: ['sideDoor2', 'sideDoor1'],
        },
        {
          key: 'position:1',
          label: '1st',
          position: 1,
          proposedEnteredSlotKeys: ['sideDoor3', 'sideDoor2', 'sideDoor1'],
        },
        {
          key: 'position:2',
          label: '2nd',
          position: 2,
          proposedEnteredSlotKeys: ['sideDoor2', 'sideDoor3', 'sideDoor1'],
        },
        {
          key: 'position:3',
          label: '3rd',
          position: 3,
          proposedEnteredSlotKeys: ['sideDoor2', 'sideDoor1', 'sideDoor3'],
        },
      ],
      selectedKey: 'notEntered',
    });
    expect(
      projectedWorkspace.interactions.sideRoomEntryOrders
        .get(sideDoor3.entryOrder.interactionKey)
        ?.choices.map((choice) => choice.value),
    ).toEqual(sideDoor3.entryOrder.options.map((option) => option.proposedEnteredSlotKeys));
    for (const sideRoom of [sideDoor2, sideDoor3]) {
      const selected = sideRoom.entryOrder.options.find(
        (option) => option.key === sideRoom.entryOrder.selectedKey,
      );
      if (selected === undefined)
        throw new Error(`${sideRoom.key} has no selected entry-order option`);
      expect(
        projectedWorkspace.interactions.sideRoomGenerations.get(
          semanticAddressKey(sideRoom.address),
        ),
      ).toMatchObject({ owner: sideRoom.address, selected: sideRoom.generation });
      expect(
        projectedWorkspace.interactions.sideRoomEntryOrders.get(sideRoom.entryOrder.interactionKey),
      ).toMatchObject({
        owner: group.address,
        selected: selected.proposedEnteredSlotKeys,
      });
    }
  });

  it('withholds dormant Ephyra side-room owners, controls, and interactions', () => {
    const projectedWorkspace = workspace(createRepresentativeNOPQProject());
    const combat10 = roomWorkbench(projectedWorkspace, 'N', 'N_Combat10');
    if (combat10.roomLocal.kind !== 'ephyra') {
      throw new Error('N Combat 10 side-room workbench is missing');
    }
    const group = createLocalChildGroupAddress(nBiome, nOccurrenceId('combat10'), 'sideRooms');
    const sideRoom = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat10'),
      'sideRooms',
      'sideDoor1',
    );
    const sideReward = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat10'),
      'sideRooms',
      'sideDoor1',
    );

    expect(combat10.detailsActive).toBe(false);
    expect(combat10.roomLocal.sideRooms).toEqual({ kind: 'withheld' });
    expect(combat10.rewardControls).toHaveLength(1);
    expect(projectedWorkspace.focusByOwner.has(semanticAddressKey(group))).toBe(false);
    expect(projectedWorkspace.focusByOwner.has(semanticAddressKey(sideRoom))).toBe(false);
    expect(projectedWorkspace.focusByOwner.has(semanticAddressKey(sideReward))).toBe(false);
    expect(projectedWorkspace.interactions.rewards.has(semanticAddressKey(sideReward))).toBe(false);
    expect(
      projectedWorkspace.interactions.sideRoomGenerations.has(semanticAddressKey(sideRoom)),
    ).toBe(false);
    expect(
      projectedWorkspace.interactions.sideRoomEntryOrders.has(
        `${semanticAddressKey(sideRoom)}:entry-order`,
      ),
    ).toBe(false);
  });

  it('keeps authored-active Ephyra side details published when their Hub evaluation is invalid', () => {
    const invalidBoard = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat05')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const projectedWorkspace = workspace(invalidBoard);
    const combat05 = roomWorkbench(projectedWorkspace, 'N', 'N_Combat05');
    if (combat05.roomLocal.kind !== 'ephyra' || combat05.roomLocal.sideRooms.kind !== 'published') {
      throw new Error('invalid N Combat 05 side-room workbench is missing');
    }
    const sideRoom = combat05.roomLocal.sideRooms.group.slots.find(
      (slot) => slot.key === 'sideDoor1',
    );
    if (sideRoom === undefined) throw new Error('invalid N Combat 05 side room is missing');

    expect(biome(projectedWorkspace, 'N').status).toBe('invalid');
    expect(combat05.detailsActive).toBe(true);
    expect(combat05.roomLocal.sideRooms.kind).toBe('published');
    expect(
      combat05.rewardControls.some(
        (control) =>
          semanticAddressKey(control.owner.address) ===
          semanticAddressKey(sideRoom.rewardControl.owner.address),
      ),
    ).toBe(true);
    expect(
      projectedWorkspace.interactions.sideRoomGenerations.get(semanticAddressKey(sideRoom.address)),
    ).toMatchObject({ owner: sideRoom.address, selected: sideRoom.generation });
    expect(
      projectedWorkspace.interactions.sideRoomEntryOrders.get(sideRoom.entryOrder.interactionKey),
    ).toMatchObject({
      owner: combat05.roomLocal.sideRooms.group.address,
    });
  });

  it('reprojects authored Hub visit children in visit order after replacement and truncation', () => {
    const initial = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'n-rail-visit-reprojection',
        name: 'N rail visit reprojection',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false, visitSlotKeys: nVisitSlotKeys.slice(0, 3) },
    );
    const hubChildren = (project: ReturnType<typeof createProjectDocument>) => {
      const entry = biome(workspace(project), 'N').rail.find(
        (candidate): candidate is Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }> =>
          candidate.kind === 'hubGroup',
      );
      if (entry === undefined) throw new Error('N Hub rail group is missing');
      return entry.visits;
    };

    expect(hubChildren(initial).map((visit) => visit.label)).toEqual([
      'Visit 1 · Combat 05',
      'Visit 2 · Satyr Champion',
      'Visit 3 · Combat 02',
    ]);
    const replaced = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceHubVisit',
      hubSlotKey: 'combat10',
      visit: createHubVisitAddress(nBiome, 'hub', 2),
    });
    expect(hubChildren(replaced).map((visit) => visit.label)).toEqual([
      'Visit 1 · Combat 05',
      'Visit 2 · Combat 10',
      'Visit 3 · Combat 02',
    ]);
    const truncated = applyProjectCommand(replaced, catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 2),
    });
    expect(hubChildren(truncated).map((visit) => visit.label)).toEqual(['Visit 1 · Combat 05']);
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
    expect(railShape(biome(workspace(empty), 'N'))).toEqual(['frontier:start', 'hubDecision']);

    const withOpening = applyProjectCommand(empty, catalog, {
      kind: 'CreateStart',
      biome: biomeAddress,
      occurrenceId: nOccurrenceIds.opening,
    });
    const openingWorkspace = biome(workspace(withOpening), 'N');
    expect(railShape(openingWorkspace)).toEqual([
      'room:N_Opening01',
      'frontier:exitDecision',
      'hubDecision',
    ]);
    expect(
      openingWorkspace.nodes.some(
        (node) => node.kind === 'occurrenceWorkbench' && node.sourceDecisionRemoval !== undefined,
      ),
    ).toBe(false);

    const withPreHub = applyProjectCommand(withOpening, catalog, {
      kind: 'CreateLinkedExit',
      decision: createExitDecisionAddress(biomeAddress, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.opening,
      }),
      occurrenceId: nOccurrenceIds.preHub,
    });
    const preHubWorkspace = biome(workspace(withPreHub), 'N');
    expect(railShape(preHubWorkspace).slice(0, 3)).toEqual([
      'room:N_Opening01',
      'room:N_PreHub01',
      'hubDecision',
    ]);
    expect(
      preHubWorkspace.nodes.find(
        (node): node is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
          node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceIds.preHub,
      )?.sourceDecisionRemoval,
    ).toMatchObject({ label: 'Remove PreHub' });
    expect(
      preHubWorkspace.nodes.some(
        (node) =>
          node.kind === 'occurrenceWorkbench' &&
          node.room.gameName === 'N_PreBoss01' &&
          node.sourceDecisionRemoval !== undefined,
      ),
    ).toBe(false);
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
    const retainedRailHub = n.rail.find(
      (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'hubGroup' }> =>
        entry.kind === 'hubGroup',
    );
    if (retainedRailHub === undefined) throw new Error('retained N Hub rail group is missing');
    expect(retainedRailHub.visits.map((visit) => visit.label)).toEqual([
      'Visit 1 · Combat 05',
      'Visit 2 · Satyr Champion',
      'Visit 3 · Combat 02',
    ]);
    expect(retainedRailHub.visits.map((visit) => visit.visitMarker.assessment)).toEqual([
      'unassessed',
      'unassessed',
      'unassessed',
    ]);
    expect(retainedRailHub.visits.map((visit) => visit.marker.assessment)).toEqual([
      'assessed',
      'assessed',
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
      kind: 'choice',
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
    expect(workspace(startedF).interactions.starts.has(semanticAddressKey(fBiome))).toBe(false);
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
    expect(batchWorkspace.interactions.exitSelections.get(partialBatch.selection.focusKey)).toEqual(
      {
        key: partialBatch.selection.focusKey,
        owner: partialBatch.owner,
        targets: [],
      },
    );
    if (partialBatch.rewardStore === undefined) {
      throw new Error('empty F batch reward-store marker is missing');
    }
    expect(
      batchWorkspace.interactions.batchRewardStores.get(partialBatch.rewardStore.focusKey),
    ).toMatchObject({
      choices: [
        { label: 'Run Progress', value: 'RunProgress' },
        { label: 'Meta Progress', value: 'MetaProgress' },
      ],
      key: partialBatch.rewardStore.focusKey,
      owner: partialBatch.rewardStore.address,
    });
    expect(
      batchWorkspace.interactions.batchRewardStores.get(partialBatch.rewardStore.focusKey)
        ?.selected,
    ).toBeUndefined();
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
    const projectedBiome = biome(projected, 'F');
    const batch = projectedBiome.nodes.find(
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
    expect(first.marker.findingCount).toBeGreaterThan(0);
    const railDecision = projectedBiome.rail.find(
      (entry): entry is Extract<WorkspaceRailEntry, { readonly kind: 'node' }> =>
        entry.kind === 'node' && entry.node.key === batch.key,
    );
    if (railDecision === undefined) throw new Error('F partial decision rail stop is missing');
    expect(railDecision.marker.findingCount).toBeGreaterThanOrEqual(first.marker.findingCount);
    expect(projected.focusByOwner.get(first.marker.focusKey)).toMatchObject({
      nodeKey: batch.key,
    });
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
    if (fieldsBatch.fieldsCageOutcome === undefined) {
      throw new Error('H Fields cage-outcome marker is missing');
    }
    expect(
      projected.interactions.fieldsCageOutcomes.get(fieldsBatch.fieldsCageOutcome.focusKey),
    ).toMatchObject({
      choices: [
        { label: 'Minimum', value: 'min' },
        { label: 'Maximum', value: 'max' },
      ],
      key: fieldsBatch.fieldsCageOutcome.focusKey,
      owner: fieldsBatch.owner,
    });
    expect(
      projected.interactions.fieldsCageOutcomes.get(fieldsBatch.fieldsCageOutcome.focusKey)
        ?.selected,
    ).toBeUndefined();
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
    const blockedBatch = biome(projected, 'H').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' | 'mixedBatch' }> =>
        (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') &&
        node.fieldsCageOutcome !== undefined,
    );
    if (blockedBatch?.fieldsCageOutcome === undefined) {
      throw new Error('blocked H Fields batch is missing');
    }
    expect(
      projected.interactions.fieldsCageOutcomes.get(blockedBatch.fieldsCageOutcome.focusKey),
    ).toMatchObject({
      choices: [
        { label: 'Minimum', value: 'min' },
        { label: 'Maximum', value: 'max' },
      ],
      key: blockedBatch.fieldsCageOutcome.focusKey,
      owner: blockedBatch.owner,
      selected: 'min',
    });
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
    const hub = biome(projected, 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (hub === undefined) throw new Error('authored N Hub board is missing');
    expect(projected.interactions.hubSlots).toHaveLength(descriptor.slots.length);
    for (const slot of hub.slots) {
      const interaction = projected.interactions.hubSlots.get(slot.marker.focusKey);
      expect(interaction).toMatchObject({
        key: slot.marker.focusKey,
        owner: slot.marker.address,
        roomGameName: descriptor.slots.find(
          (descriptorSlot) => descriptorSlot.slotKey === slot.hubSlotKey,
        )?.roomGameName,
        selected: slot.open,
      });
    }
    const visitedSlot = hub.slots.find((slot) => slot.open && slot.visited);
    if (visitedSlot === undefined) throw new Error('visited N Hub slot is missing');
    expect(visitedSlot.canClose).toBe(false);
    expect(projected.interactions.hubSlots.get(visitedSlot.marker.focusKey)?.close).toBeDefined();
    const unvisitedSlot = createHubSlotAddress(nBiome, descriptor.hubKey, 'combat03');
    expect(projected.interactions.hubSlots.get(semanticAddressKey(unvisitedSlot))).toMatchObject({
      close: {
        command: { kind: 'CloseHubSlot', slot: unvisitedSlot },
        impact: { removedOccurrenceIds: [nOccurrenceId('combat03')] },
      },
    });
    const nextVisit = createHubVisitAddress(nBiome, descriptor.hubKey, descriptor.requiredVisits);
    expect(projected.interactions.hubVisits).toHaveLength(descriptor.requiredVisits);
    const selectedSlots = hub.visits.flatMap((visit) =>
      visit.hubSlotKey === undefined ? [] : [visit.hubSlotKey],
    );
    for (const visit of hub.visits) {
      const interaction = projected.interactions.hubVisits.get(visit.marker.focusKey);
      expect(interaction).toMatchObject({
        key: visit.marker.focusKey,
        owner: visit.marker.address,
        ...(visit.hubSlotKey === undefined ? {} : { selected: visit.hubSlotKey }),
      });
      expect(interaction?.choices.map((choice) => choice.value)).toEqual(
        hub.slots
          .filter(
            (slot) =>
              slot.open &&
              (slot.hubSlotKey === visit.hubSlotKey || !selectedSlots.includes(slot.hubSlotKey)),
          )
          .map((slot) => slot.hubSlotKey),
      );
    }
    expect(projected.interactions.hubVisits.get(semanticAddressKey(nextVisit))).toMatchObject({
      owner: nextVisit,
    });
  });

  it('keeps Hub control publication authored-first while retaining the structural next visit', () => {
    const initial = createProjectDocument(catalog, {
      projectId: 'n-authored-hub-control-publication',
      name: 'N authored Hub control publication',
      configuredBiomeCounts: { Surface: 1 },
    });
    const outline = workspace(initial);
    expect(outline.interactions.hubSlots).toHaveLength(0);
    expect(outline.interactions.hubVisits).toHaveLength(0);

    const opening = createOccurrenceId('n-authored-hub-control-opening');
    let project = applyProjectCommand(initial, catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: opening,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateLinkedExit',
      decision: createExitDecisionAddress(nBiome, { kind: 'occurrence', occurrenceId: opening }),
      occurrenceId: createOccurrenceId('n-authored-hub-control-prehub'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateHubDecision',
      hub: createHubDecisionAddress(nBiome, 'hub'),
    });

    const projected = workspace(project);
    const hub = biome(projected, 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (hub === undefined) throw new Error('fresh authored N Hub board is missing');
    expect(hub.authoring).toBe('authored');
    expect(projected.interactions.hubSlots).toHaveLength(hub.slots.length);
    expect(hub.visits[0]?.authoring).toBe('locked');
    const firstVisit = createHubVisitAddress(nBiome, 'hub', 1);
    expect(projected.interactions.hubVisits.get(semanticAddressKey(firstVisit))).toMatchObject({
      choices: [],
      key: semanticAddressKey(firstVisit),
      owner: firstVisit,
    });
  });

  it('projects the completed-Hub handoff in the ninth-slot closure scope', () => {
    const projected = workspace(
      appendCompleteN(
        createProjectDocument(catalog, {
          projectId: 'n-completed-hub-close',
          name: 'N completed Hub close',
          configuredBiomeCounts: { Surface: 1 },
        }),
      ),
    );
    const slot = createHubSlotAddress(nBiome, 'hub', 'combat03');
    expect(projected.interactions.hubSlots.get(semanticAddressKey(slot))).toMatchObject({
      close: {
        command: { kind: 'CloseHubSlot', slot },
        impact: {
          removedDecisionOwners: [
            createExitDecisionAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }),
          ],
          removedOccurrenceIds: [nOccurrenceId('combat03'), nOccurrenceIds.preboss],
        },
      },
    });
  });

  it('exposes all F-through-Q takeover batches only from their decision owners while I keeps its Preboss target replaceable', () => {
    const underworld = workspace(createGoldenFGHIProject());
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
      throw new Error('F candidate takeover interaction is missing');
    }
    const candidates = interaction.load();
    expect(candidates).not.toHaveLength(0);
    expect(candidates.every((candidate) => candidate.value.label.length > 0)).toBe(true);
    expect(candidates.every((candidate) => candidate.value.gameName.startsWith('F_'))).toBe(true);
  });

  it('projects O and Q fixed width-one Preboss takeovers only at their bounded final frontiers', () => {
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
        throw new Error(`${biomeAddress.biomeKey} fixed width-one frontier is missing`);
      }
      const interaction = projected.interactions.takeoverBatches.get(
        semanticAddressKey(frontier.owner),
      );
      if (interaction?.presentation !== 'fixedWidthOneTakeover') {
        throw new Error(`${biomeAddress.biomeKey} fixed width-one takeover interaction is missing`);
      }
      expect(interaction.action).toBe('create');
      expect(interaction.label).toBe(catalog.rooms.byKey[gameName]!.label);
      expect('load' in interaction).toBe(false);
      expect(projected.interactions.structural.has(semanticAddressKey(frontier.owner))).toBe(false);
      const result = interaction.execute();
      if (result.kind !== 'command') {
        throw new Error(
          `${biomeAddress.biomeKey} fixed width-one takeover is unexpectedly unavailable`,
        );
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

  it('does not misclassify candidate, mixed, linked, or Hub progression as a fixed width-one takeover', () => {
    const underworld = workspace(createGoldenFGHIProject());
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
      expect(
        interactions.some((interaction) => interaction.presentation === 'fixedWidthOneTakeover'),
      ).toBe(false);
    }
  });

  it('projects declaration-owned reward domains for side rooms, wheels, shops, and free Preboss rewards', () => {
    const underworld = workspace(createGoldenFGHIProject());
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

  it('binds every returned room reward control from entry, batch, linked, and Hub assembly', () => {
    const underworld = workspace(createGoldenFGHIProject());
    const surface = workspace(createRepresentativeNOPQProject());
    const entry = biome(underworld, 'F').entry;
    const ordinary = biome(underworld, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch',
    );
    const linked = biome(surface, 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'linkedExit' }> =>
        node.kind === 'linkedExit',
    );
    const hub = biome(surface, 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    const hubRoom = hub?.slots.find((slot) => slot.open)?.room;
    const ordinaryRoom = ordinary?.targets[0]?.room;
    if (
      entry === undefined ||
      ordinaryRoom === undefined ||
      linked === undefined ||
      hubRoom === undefined
    ) {
      throw new Error('entry, ordinary, linked, and Hub reward assembly fixtures are missing');
    }

    for (const room of [entry.room, ordinaryRoom, linked.target.room, hubRoom]) {
      expect(room.rewardControls.length).toBeGreaterThan(0);
    }
    for (const projected of [underworld, surface]) {
      for (const room of projectedRooms(projected)) {
        for (const control of room.rewardControls) {
          expect(
            projected.interactions.rewards.get(semanticAddressKey(control.owner.address))?.owner,
          ).toEqual(control.owner.address);
        }
      }
    }
  });

  it('binds explicit start, authored target, and ready target-picker products by exact owner', () => {
    const complete = workspace(createGoldenFGHIProject());
    const completeF = biome(complete, 'F');
    const startPicker = completeF.entry?.room.roomPicker;
    const authoredBatch = completeF.nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch',
    );
    const authoredTarget = authoredBatch?.targets[0];
    if (
      startPicker?.kind !== 'startRoomPicker' ||
      authoredTarget === undefined ||
      authoredTarget.marker.address.kind !== 'target'
    ) {
      throw new Error('complete F room-picker fixtures are missing');
    }

    const fBiome = createBiomeAddress('Underworld', 'F');
    const startId = createOccurrenceId('ready-room-picker-start');
    let incomplete = createProjectDocument(catalog, {
      projectId: 'ready-room-picker',
      name: 'Ready room picker',
      configuredBiomeCounts: { Underworld: 1 },
    });
    incomplete = applyProjectCommand(incomplete, catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    const decision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    incomplete = applyProjectCommand(incomplete, catalog, { kind: 'CreateBatch', decision });
    incomplete = applyProjectCommand(incomplete, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey: 'RunProgress',
    });
    const partial = workspace(incomplete);
    const missing = biome(partial, 'F')
      .nodes.find(
        (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
          node.kind === 'ordinaryBatch' &&
          node.owner.source.kind === 'occurrence' &&
          node.owner.source.occurrenceId === startId,
      )
      ?.missingTargets.find((target) => target.authoring.kind === 'ready');
    if (missing === undefined) throw new Error('ready F target picker is missing');

    for (const { projected, owner } of [
      { owner: startPicker.address, projected: complete },
      { owner: authoredTarget.marker.address, projected: complete },
      { owner: missing.owner, projected: partial },
    ]) {
      expect(projected.interactions.rooms.get(semanticAddressKey(owner))).toMatchObject({ owner });
    }
  });

  it('keeps fixed, Fields, ship-wheel, and Shop reward state in compact room summaries', () => {
    const underworld = workspace(createGoldenFGHIProject());
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
    const underworld = workspace(createGoldenFGHIProject());
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
    expect(
      surface.interactions.shipEncounterCounts.get(semanticAddressKey(ship.address)),
    ).toMatchObject({
      owner: ship.address,
      selected: ship.roomLocal.encounterCount,
    });
    for (const wheel of ship.roomLocal.wheels) {
      const key = semanticAddressKey(wheel.address);
      expect(surface.interactions.rewardWheelOfferCounts.get(key)).toMatchObject({
        owner: wheel.address,
        selected: wheel.offerCount,
      });
      expect(surface.interactions.rewardWheelStores.get(key)).toMatchObject({
        owner: wheel.address,
        selected: wheel.storeKey,
      });
      expect(surface.interactions.rewardWheelPicks.get(key)).toMatchObject({
        owner: wheel.address,
        selected: wheel.pickedOfferIndex,
      });
    }

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
    const decodedPlan = decoded.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (decodedPlan === undefined) throw new Error('decoded F plan is missing');
    expect(
      expectedWorkspaceLeafRequirements(catalog, fBiome, decodedPlan).some(
        (requirement) =>
          semanticAddressKey(requirement.address) ===
          semanticAddressKey(createShopOfferAddress(fBiome, shop, offerKey)),
      ),
    ).toBe(false);

    const projected = workspace(decoded);
    const dormant = roomWorkbench(projected, 'F', 'F_Shop01');
    expect(dormant.detailsActive).toBe(false);
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

  it('keeps a selected Shop detailed and editable behind an unresolved authored prefix', () => {
    const project = createGoldenFGHIProject();
    const f = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (f?.topology === null || f === undefined) throw new Error('golden F topology is missing');
    const boundary = f.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === goldenFOccurrenceId(1, 1),
    );
    if (boundary?.kind !== 'exit') throw new Error('golden F width-two decision is missing');
    const blocked = {
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
                          decision === boundary
                            ? { ...decision, selection: { kind: 'unresolved' as const } }
                            : decision,
                        ),
                      },
                    },
              ),
            },
      ),
    };
    const projected = workspace(blocked);
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const selectedShop = biome(projected, 'F').nodes.find(
      (candidate): candidate is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === shopId,
    )?.room;
    if (selectedShop === undefined) throw new Error('selected F Preboss Shop is missing');

    expect(selectedShop.detailsActive).toBe(true);
    expect(selectedShop.entered).toBe(false);
    expect(selectedShop.roomLocal).toMatchObject({ kind: 'shop', materialized: true });
    expect(selectedShop.rewardControls).not.toHaveLength(0);
    const offer = createShopOfferAddress(goldenFBiome, shopId, 'MajorNonBoon');
    const purchase = createShopPurchaseAddress(goldenFBiome, shopId, 'MajorNonBoon');
    expect(projected.interactions.rewards.has(semanticAddressKey(offer))).toBe(true);
    expect(projected.interactions.shopPurchases.get(semanticAddressKey(purchase))).toMatchObject({
      owner: purchase,
      selected: false,
    });
  });

  it('fails fast when a hard-required projected control lacks its exact interaction', () => {
    const assertMissingInteraction = (
      project: ReturnType<typeof createProjectDocument>,
      projected: ReturnType<typeof workspace>,
      interactions: typeof projected.interactions,
      expected: RegExp,
    ) => {
      expect(() =>
        assertIndependentWorkspaceInteractionClosure(project, projected, interactions),
      ).toThrow(expected);
    };
    const surfaceProject = createRepresentativeNOPQProject();
    const surface = workspace(surfaceProject);
    const underworldProject = createGoldenFGHIProject();
    const underworld = workspace(underworldProject);

    const purchase = createShopPurchaseAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon');
    const withoutShopPurchase = {
      ...surface.interactions,
      shopPurchases: new Map(surface.interactions.shopPurchases),
    };
    withoutShopPurchase.shopPurchases.delete(semanticAddressKey(purchase));
    assertMissingInteraction(
      surfaceProject,
      surface,
      withoutShopPurchase,
      /Shop purchase .* has no exact workspace interaction/,
    );

    const ship = roomWorkbench(surface, 'O', 'O_Combat04');
    if (ship.roomLocal.kind !== 'ship') throw new Error('O Ship room is missing');
    const withoutShipEncounter = {
      ...surface.interactions,
      shipEncounterCounts: new Map(surface.interactions.shipEncounterCounts),
    };
    withoutShipEncounter.shipEncounterCounts.delete(ship.marker.focusKey);
    assertMissingInteraction(
      surfaceProject,
      surface,
      withoutShipEncounter,
      /Ship encounter count .* has no exact workspace interaction/,
    );

    const fields = biome(underworld, 'H').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' | 'mixedBatch' }> =>
        (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') &&
        node.fieldsCageOutcome !== undefined,
    );
    if (fields?.fieldsCageOutcome === undefined) throw new Error('H Fields batch is missing');
    const withoutFieldsOutcome = {
      ...underworld.interactions,
      fieldsCageOutcomes: new Map(underworld.interactions.fieldsCageOutcomes),
    };
    withoutFieldsOutcome.fieldsCageOutcomes.delete(fields.fieldsCageOutcome.focusKey);
    assertMissingInteraction(
      underworldProject,
      underworld,
      withoutFieldsOutcome,
      /Fields cage outcome .* has no exact workspace interaction/,
    );

    const takeover = biome(underworld, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (takeover === undefined) throw new Error('F takeover batch is missing');
    const withoutTakeover = {
      ...underworld.interactions,
      takeoverBatches: new Map(underworld.interactions.takeoverBatches),
    };
    withoutTakeover.takeoverBatches.delete(takeover.takeoverInteractionKey);
    assertMissingInteraction(
      underworldProject,
      underworld,
      withoutTakeover,
      /takeover batch .* has no exact workspace interaction/,
    );

    const emptyN = createProjectDocument(catalog, {
      projectId: 'missing-start-interaction',
      name: 'Missing start interaction',
      configuredBiomeCounts: { Surface: 1 },
    });
    const startWorkspace = workspace(emptyN);
    const startFrontier = biome(startWorkspace, 'N').frontier;
    if (startFrontier?.kind !== 'start') throw new Error('N start frontier is missing');
    const withoutStart = {
      ...startWorkspace.interactions,
      starts: new Map(startWorkspace.interactions.starts),
    };
    withoutStart.starts.delete(startFrontier.interactionKey);
    assertMissingInteraction(
      emptyN,
      startWorkspace,
      withoutStart,
      /start frontier .* has no exact workspace interaction/,
    );

    const withOpening = applyProjectCommand(emptyN, catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: nOccurrenceIds.opening,
    });
    const atHub = applyProjectCommand(withOpening, catalog, {
      kind: 'CreateLinkedExit',
      decision: createExitDecisionAddress(nBiome, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.opening,
      }),
      occurrenceId: nOccurrenceIds.preHub,
    });
    const hubWorkspace = workspace(atHub);
    const hubFrontier = biome(hubWorkspace, 'N').frontier;
    if (hubFrontier?.kind !== 'hubDecision') throw new Error('N Hub creation frontier is missing');
    const withoutHubCreation = {
      ...hubWorkspace.interactions,
      structural: new Map(hubWorkspace.interactions.structural),
    };
    withoutHubCreation.structural.delete(hubFrontier.interactionKey);
    assertMissingInteraction(
      atHub,
      hubWorkspace,
      withoutHubCreation,
      /Hub creation frontier .* has no exact workspace interaction/,
    );

    const staged = biome(surface, 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' && node.sourceDecisionRemoval !== undefined,
    );
    if (staged?.sourceDecisionRemoval === undefined) throw new Error('N staged removal is missing');
    const withoutStagedRemoval = {
      ...surface.interactions,
      topologyRemovals: new Map(surface.interactions.topologyRemovals),
    };
    withoutStagedRemoval.topologyRemovals.delete(staged.sourceDecisionRemoval.interactionKey);
    assertMissingInteraction(
      surfaceProject,
      surface,
      withoutStagedRemoval,
      /(?:linked-exit topology removal|staged decision removal) .* has no exact workspace interaction/,
    );
  });

  it('requires direct removals and every advertised frontier capability', () => {
    const assertMissingInteraction = (
      project: ReturnType<typeof createProjectDocument>,
      projected: ReturnType<typeof workspace>,
      interactions: typeof projected.interactions,
      expected: RegExp,
    ) => {
      expect(() =>
        assertIndependentWorkspaceInteractionClosure(project, projected, interactions),
      ).toThrow(expected);
    };
    const underworldProject = createGoldenFGHIProject();
    const underworld = workspace(underworldProject);
    const surfaceProject = createRepresentativeNOPQProject();
    const surface = workspace(surfaceProject);

    const ordinary = biome(underworld, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch',
    );
    if (ordinary === undefined) throw new Error('F ordinary batch is missing');
    const withoutOrdinaryRemoval = {
      ...underworld.interactions,
      topologyRemovals: new Map(underworld.interactions.topologyRemovals),
    };
    withoutOrdinaryRemoval.topologyRemovals.delete(semanticAddressKey(ordinary.owner));
    assertMissingInteraction(
      underworldProject,
      underworld,
      withoutOrdinaryRemoval,
      /decision topology removal .* has no exact workspace interaction/,
    );

    const linked = biome(surface, 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'linkedExit' }> =>
        node.kind === 'linkedExit',
    );
    if (linked === undefined) throw new Error('N linked exit is missing');
    const withoutLinkedRemoval = {
      ...surface.interactions,
      topologyRemovals: new Map(surface.interactions.topologyRemovals),
    };
    withoutLinkedRemoval.topologyRemovals.delete(semanticAddressKey(linked.owner));
    assertMissingInteraction(
      surfaceProject,
      surface,
      withoutLinkedRemoval,
      /linked-exit topology removal .* has no exact workspace interaction/,
    );

    const withoutBiomeRemoval = {
      ...surface.interactions,
      topologyRemovals: new Map(surface.interactions.topologyRemovals),
    };
    withoutBiomeRemoval.topologyRemovals.delete(
      semanticAddressKey(biome(surface, 'N').marker.address),
    );
    assertMissingInteraction(
      surfaceProject,
      surface,
      withoutBiomeRemoval,
      /biome topology removal .* has no exact workspace interaction/,
    );

    const takeover = biome(underworld, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (takeover === undefined || takeover.targets.length === 1) {
      throw new Error('F multi-target takeover batch is missing');
    }
    expect(takeover.rewardStore).toBeUndefined();
    expect(
      underworld.interactions.batchRewardStores.has(
        semanticAddressKey(createBatchRewardStoreAddress(goldenFBiome, takeover.source)),
      ),
    ).toBe(false);
    const withoutTakeoverSelection = {
      ...underworld.interactions,
      exitSelections: new Map(underworld.interactions.exitSelections),
    };
    withoutTakeoverSelection.exitSelections.delete(takeover.selection.focusKey);
    assertMissingInteraction(
      underworldProject,
      underworld,
      withoutTakeoverSelection,
      /exit selection .* has no exact workspace interaction/,
    );

    const storedTakeoverProject = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, takeover.source),
      storeKey: 'RunProgress',
    });
    const storedTakeoverWorkspace = workspace(storedTakeoverProject);
    const storedTakeover = biome(storedTakeoverWorkspace, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (storedTakeover?.rewardStore === undefined) {
      throw new Error('non-null F takeover reward store is not projected');
    }
    expect(
      storedTakeoverWorkspace.interactions.batchRewardStores.get(
        storedTakeover.rewardStore.focusKey,
      ),
    ).toMatchObject({
      choices: [
        { label: 'Run Progress', value: 'RunProgress' },
        { label: 'Meta Progress', value: 'MetaProgress' },
      ],
      key: storedTakeover.rewardStore.focusKey,
      owner: storedTakeover.rewardStore.address,
      selected: 'RunProgress',
    });
    const withoutTakeoverStore = {
      ...storedTakeoverWorkspace.interactions,
      batchRewardStores: new Map(storedTakeoverWorkspace.interactions.batchRewardStores),
    };
    withoutTakeoverStore.batchRewardStores.delete(storedTakeover.rewardStore.focusKey);
    assertMissingInteraction(
      storedTakeoverProject,
      storedTakeoverWorkspace,
      withoutTakeoverStore,
      /batch reward store .* has no exact workspace interaction/,
    );

    const hub = biome(surface, 'N').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    const closableSlot = hub?.slots.find((slot) => slot.canClose);
    if (closableSlot === undefined) throw new Error('closable N Hub slot is missing');
    const hubSlot = surface.interactions.hubSlots.get(closableSlot.marker.focusKey);
    if (hubSlot === undefined) throw new Error('closable N Hub interaction is missing');
    const withoutHubClose = {
      ...surface.interactions,
      hubSlots: new Map(surface.interactions.hubSlots),
    };
    const { close, ...hubSlotWithoutClose } = hubSlot;
    expect(close).toBeDefined();
    withoutHubClose.hubSlots.set(closableSlot.marker.focusKey, hubSlotWithoutClose);
    assertMissingInteraction(
      surfaceProject,
      surface,
      withoutHubClose,
      /.*closable Hub slot has no exact close interaction/,
    );

    const emptyF = createProjectDocument(catalog, {
      projectId: 'missing-frontier-capability',
      name: 'Missing frontier capability',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const atFExitFrontier = applyProjectCommand(emptyF, catalog, {
      kind: 'CreateStart',
      biome: goldenFBiome,
      occurrenceId: goldenFStartId,
      gameName: 'F_Opening01',
    });
    const frontierWorkspace = workspace(atFExitFrontier);
    const frontier = biome(frontierWorkspace, 'F').frontier;
    if (frontier?.kind !== 'exitDecision') throw new Error('F exit frontier is missing');
    expect(
      frontierWorkspace.interactions.exitFrontierCapabilities.get(frontier.interactionKey),
    ).toEqual({ structural: 'createBatch', takeover: true });
    const withoutFrontierStructural = {
      ...frontierWorkspace.interactions,
      structural: new Map(frontierWorkspace.interactions.structural),
    };
    withoutFrontierStructural.structural.delete(frontier.interactionKey);
    assertMissingInteraction(
      atFExitFrontier,
      frontierWorkspace,
      withoutFrontierStructural,
      /exit frontier structural action .* has no exact workspace interaction/,
    );
    const withoutFrontierTakeover = {
      ...frontierWorkspace.interactions,
      takeoverBatches: new Map(frontierWorkspace.interactions.takeoverBatches),
    };
    withoutFrontierTakeover.takeoverBatches.delete(frontier.interactionKey);
    assertMissingInteraction(
      atFExitFrontier,
      frontierWorkspace,
      withoutFrontierTakeover,
      /exit frontier takeover action .* has no exact workspace interaction/,
    );
  });

  it('projects biome-field, fixed-payload, and authored-choice-start controls with exact owners', () => {
    const underworld = workspace(createGoldenFGHIProject());
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
    const projected = workspace(createGoldenFGHIProject());
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
    const narrowedF = applyProjectCommand(createGoldenFGHIProject(), catalog, {
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
      command: { kind: 'ReconcileBatchExitCapacity', decision: ordinary.owner },
      commandKind: 'ReconcileBatchExitCapacity',
      owner: ordinary.owner,
      removedDecisionOwners: [],
      removedOccurrenceIds: [goldenFOccurrenceId(2, 2)],
    });

    const gPlan = createGoldenFGHIProject().routes[0]!.biomes.find(
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
    const narrowedG = applyProjectCommand(createGoldenFGHIProject(), catalog, {
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
      commandKind: 'ReconcileTakeoverBatch',
      owner: takeover.owner,
      removedOccurrenceIds: unavailable,
    });
  });

  it('retains exact repair scopes for physically unavailable batches in blocked authored suffixes', () => {
    const fOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });
    let fProject = applyProjectCommand(createGoldenFGHIProject(), catalog, {
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
        command: { kind: 'ReconcileBatchExitCapacity', decision: fOwner },
        commandKind: 'ReconcileBatchExitCapacity',
        owner: fOwner,
        removedOccurrenceIds: [goldenFOccurrenceId(2, 2)],
      },
    });
    expect(rawOrdinary.targets).toContainEqual(
      expect.objectContaining({ exitKey: 'exit2', index: 2, physicalState: 'unavailable' }),
    );

    const base = createGoldenFGHIProject();
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
      commandKind: 'ReconcileTakeoverBatch',
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
    const project = createGoldenFGHIProject();
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
    const project = createGoldenFGHIProject();
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
    const projected = workspace(incomplete);
    const retained = biome(projected, 'F').nodes.find(
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
    const retainedTarget = retained.targets.find((target) => target.room.rewardControls.length > 0);
    if (retainedTarget === undefined) throw new Error('retained F reward target is missing');
    expect(projected.focusByOwner.get(retainedTarget.room.marker.focusKey)).toMatchObject({
      nodeKey: retained.key,
    });
    expect(
      projected.focusByOwner.get(retainedTarget.room.rewardControls[0]!.marker.focusKey),
    ).toMatchObject({
      nodeKey: retained.key,
    });
  });

  it('keeps a reward-invalid physical peer as an authored offer instead of a blank exit', () => {
    const secondPeer = goldenFOccurrenceId(2, 2);
    const rewardInvalid = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, secondPeer),
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    const invalid = applyProjectCommand(rewardInvalid, catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(10, 1),
      }),
    });
    const projected = workspace(invalid);
    const decision = biome(projected, 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.owner.source.kind === 'occurrence' &&
        node.owner.source.occurrenceId === goldenFOccurrenceId(1, 1),
    );
    if (decision === undefined) throw new Error('F peer decision is missing');

    expect(decision.targets.map((target) => target.room.occurrenceId)).toEqual([
      goldenFOccurrenceId(2, 1),
      secondPeer,
    ]);
    expect(decision.missingTargets).toEqual([]);
    const retainedPeer = decision.targets.find((target) => target.room.occurrenceId === secondPeer);
    if (retainedPeer === undefined) throw new Error('invalid F peer is missing');
    expect(retainedPeer.retained).toBe(true);
    expect(retainedPeer.room.rewardControls).toHaveLength(1);
    expect(retainedPeer.room.rewardControls[0]?.owner.kind).toBe('incomingReward');
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
