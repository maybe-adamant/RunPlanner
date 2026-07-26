import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
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
    expect(projected.interactions.takeoverBatches.get(semanticAddressKey(owner))).toMatchObject({
      action: 'create',
      owner,
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
    for (const target of partialBatch.missingTargets) {
      expect(batchWorkspace.interactions.rooms.get(semanticAddressKey(target.owner))).toMatchObject(
        {
          owner: target.owner,
        },
      );
    }

    const initialN = createProjectDocument(catalog, {
      projectId: 'n-authoring-frontier',
      name: 'N authoring frontier',
      configuredBiomeCounts: { Surface: 1 },
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

  it('preserves incomplete and upstream-blocked workspace states with an explicit start frontier', () => {
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
