import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject, goldenFBiome } from '@run-planner/test-fixtures';
import {
  appendCompleteN,
  appendNEntry,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  nVisitSlotKeys,
} from '@run-planner/test-fixtures';
import {
  createStructuredWorkspaceTestServices,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';
import type {
  StructuredWorkspaceProjection,
  WorkspaceBiome,
  WorkspaceInspectorDestination,
} from '../contract';

const { structuredWorkspace } = createStructuredWorkspaceTestServices();

function project(projectDocument: ProjectDocument): StructuredWorkspaceProjection {
  return structuredWorkspace.project(simulateProjectAssembly(catalog, projectDocument));
}

function biome(workspace: StructuredWorkspaceProjection, biomeKey: string): WorkspaceBiome {
  return requireWorkspaceBiome(workspace, biomeKey);
}

function destination(
  workspace: StructuredWorkspaceProjection,
  address: SemanticAddress,
): WorkspaceInspectorDestination {
  const key = semanticAddressKey(address);
  const value = workspace.focusByOwner.get(key);
  if (value === undefined) throw new Error(`${key} has no inspector destination`);
  return value;
}

function defaultSubject(biome: WorkspaceBiome) {
  const value = biome.defaultInspectorDestination;
  if (value === null) throw new Error(`${biome.biomeKey} has no default inspector subject`);
  return value.kind === 'node'
    ? { kind: 'node' as const, nodeKey: value.nodeKey }
    : { frontierFocusKey: value.frontierFocusKey, kind: 'frontier' as const };
}

function railKeyForNode(biome: WorkspaceBiome, nodeKey: string): string {
  const entry = biome.rail.find(
    (candidate): candidate is Extract<(typeof biome.rail)[number], { readonly kind: 'node' }> =>
      candidate.kind === 'node' && candidate.node.key === nodeKey,
  );
  if (entry === undefined) throw new Error(`${nodeKey} has no rendered rail stop`);
  return entry.marker.focusKey;
}

function expectNodeRailDestination(
  workspace: StructuredWorkspaceProjection,
  address: SemanticAddress,
  nodeKey: string,
  selectedRailKey: string,
): void {
  expect(destination(workspace, address)).toMatchObject({
    inspectorSubject: { kind: 'node', nodeKey },
    selectedRailKey,
  });
}

function emptyProject(routeKey: 'Surface' | 'Underworld', count: number): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: `inspector-destinations-empty-${routeKey}-${count}`,
    name: `Inspector destinations empty ${routeKey}`,
    configuredBiomeCounts: { [routeKey]: count },
  });
}

describe('workspace inspector destinations', () => {
  it('routes nested trait owners to their containing Fields, Ephyra, Ship, and Shop workbenches', () => {
    for (const document of [createGoldenFGHIProject(), createRepresentativeNOPQProject()]) {
      const workspace = project(document);
      for (const route of workspace.routes) {
        for (const projectedBiome of route.biomes) {
          for (const node of projectedBiome.nodes) {
            if (node.kind === 'occurrenceWorkbench') {
              for (const marker of node.room.localDetailMarkers) {
                if (marker.address.kind !== 'traitOffer') continue;
                expect(destination(workspace, marker.address)).toMatchObject({
                  ownerAddress: marker.address,
                  inspectorSubject: { kind: 'node' },
                });
                expect(destination(workspace, marker.address).selectedRailKey).toBeDefined();
              }
              continue;
            }
            if (
              node.kind !== 'ordinaryBatch' &&
              node.kind !== 'mixedBatch' &&
              node.kind !== 'takeoverBatch'
            ) {
              continue;
            }
            for (const target of node.targets) {
              for (const marker of target.room.localDetailMarkers) {
                if (marker.address.kind !== 'traitOffer') continue;
                expect(destination(workspace, marker.address)).toMatchObject({
                  ownerAddress: marker.address,
                  inspectorSubject: { kind: 'node' },
                });
                expect(destination(workspace, marker.address).selectedRailKey).toBeDefined();
              }
            }
          }
        }
      }
    }
  }, 15_000);

  it('publishes distinct Chosen God and Spurned God role labels for Devotion traits', () => {
    const workspace = project(createRepresentativeNOPQProject());
    const labels = new Set(
      [...workspace.interactions.traitOffers.values()].map(
        (interaction) => interaction.acquisitionRoleLabel,
      ),
    );
    expect([...labels]).toEqual(expect.arrayContaining(['Chosen God', 'Spurned God']));
  });

  it('binds exact frontier and ordinary nested focus while leaving coarse fallback unselected', () => {
    const empty = project(emptyProject('Underworld', 1));
    const emptyF = biome(empty, 'F');
    if (emptyF.frontier?.kind !== 'start') throw new Error('empty F start frontier is missing');
    expect(destination(empty, emptyF.frontier.owner)).toMatchObject({
      inspectorSubject: {
        frontierFocusKey: emptyF.frontier.marker.focusKey,
        kind: 'frontier',
      },
      selectedRailKey: emptyF.frontier.marker.focusKey,
    });

    const started = applyProjectCommand(emptyProject('Underworld', 1), catalog, {
      kind: 'CreateStart',
      biome: goldenFBiome,
      occurrenceId: createOccurrenceId('inspector-destinations-f-start'),
      gameName: 'F_Opening01',
    });
    const startedWorkspace = project(started);
    const startedF = biome(startedWorkspace, 'F');
    if (startedF.frontier?.kind !== 'exitDecision') {
      throw new Error('start-only F exit frontier is missing');
    }
    expect(destination(startedWorkspace, startedF.frontier.owner)).toMatchObject({
      inspectorSubject: {
        frontierFocusKey: startedF.frontier.marker.focusKey,
        kind: 'frontier',
      },
      selectedRailKey: startedF.frontier.marker.focusKey,
    });

    const complete = project(createGoldenFGHIProject());
    const f = biome(complete, 'F');
    const decision = f.nodes.find(
      (node): node is Extract<typeof node, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        node.targets.some((target) => target.room.rewardControls.length > 0),
    );
    const reward = decision?.targets.find((target) => target.room.rewardControls.length > 0)?.room
      .rewardControls[0];
    if (decision === undefined || reward === undefined) {
      throw new Error('F ordinary reward target is missing');
    }
    const decisionRail = f.rail.find(
      (entry): entry is Extract<(typeof f.rail)[number], { readonly kind: 'node' }> =>
        entry.kind === 'node' && entry.node.key === decision.key,
    );
    if (decisionRail === undefined) throw new Error('F ordinary decision rail stop is missing');
    const target = decision.targets.find((candidate) => candidate.room.rewardControls.length > 0);
    if (target === undefined) throw new Error('F ordinary reward target is missing');
    for (const owner of [
      decision.marker.address,
      decision.selection.address,
      ...(decision.rewardStore === undefined ? [] : [decision.rewardStore.address]),
      target.marker.address,
      target.room.marker.address,
      ...target.room.rewardControls.map((control) => control.marker.address),
    ]) {
      expectNodeRailDestination(complete, owner, decision.key, decisionRail.marker.focusKey);
    }

    const i = biome(complete, 'I');
    const field = i.fields[0];
    if (field === undefined) throw new Error('I biome field is missing');
    for (const owner of [i.marker.address, field.marker.address]) {
      const fallback = destination(complete, owner);
      expect(fallback.inspectorSubject).toEqual(defaultSubject(i));
      expect(fallback.selectedRailKey).toBeUndefined();
    }
  });

  it('routes the terminal Hub owner to its persisted PreHub decision before the board exists', () => {
    const terminal = project(appendNEntry(emptyProject('Surface', 1)));
    const n = biome(terminal, 'N');
    const owner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    });
    const batch = n.nodes.find(
      (node): node is Extract<(typeof n.nodes)[number], { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(owner),
    );
    if (batch === undefined || batch.hubTakeover === undefined) {
      throw new Error('terminal N Hub takeover batch is missing');
    }
    expect(n.nodes.some((node) => node.kind === 'hubDecision')).toBe(false);
    const railKey = railKeyForNode(n, batch.key);
    const hub = createHubDecisionAddress(nBiome, 'hub');

    expect(batch.hubTakeover.marker.address).toEqual(hub);
    expectNodeRailDestination(terminal, hub, batch.key, railKey);
  });

  it('binds Hub board, visit, handoff, and fixed-stage presentation without React ownership scans', () => {
    const complete = project(createRepresentativeNOPQProject());
    const n = biome(complete, 'N');
    const hub = n.nodes.find(
      (node): node is Extract<(typeof n.nodes)[number], { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    const hubRail = n.rail.find(
      (entry): entry is Extract<(typeof n.rail)[number], { readonly kind: 'hubGroup' }> =>
        entry.kind === 'hubGroup',
    );
    if (hub === undefined || hubRail === undefined) throw new Error('complete N Hub is missing');

    const preHubDecision = n.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof n.nodes)[number],
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
      > =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.source.kind === 'occurrence' &&
        node.source.occurrenceId === nOccurrenceIds.opening,
    );
    if (preHubDecision === undefined) throw new Error('complete N PreHub decision is missing');
    const preHubTarget = preHubDecision.targets.find(
      (target) => target.room.occurrenceId === nOccurrenceIds.preHub,
    );
    if (preHubTarget === undefined) throw new Error('complete N PreHub target is missing');
    const preHubWorkbench = n.nodes.find(
      (node): node is Extract<(typeof n.nodes)[number], { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' &&
        node.room.occurrenceId === preHubTarget.room.occurrenceId,
    );
    if (preHubWorkbench === undefined) throw new Error('complete N PreHub workbench is missing');
    const preHubSource = destination(complete, preHubDecision.marker.address);
    const preHubRailKey = railKeyForNode(n, preHubDecision.key);
    expect(preHubSource.inspectorSubject).toEqual({ kind: 'node', nodeKey: preHubDecision.key });
    expect(preHubSource.selectedRailKey).toBe(preHubRailKey);
    for (const owner of [
      preHubTarget.marker.address,
      preHubTarget.room.marker.address,
      ...preHubTarget.room.rewardControls.map((control) => control.marker.address),
    ]) {
      expectNodeRailDestination(complete, owner, preHubDecision.key, preHubRailKey);
    }

    const visit = hubRail.visits.find((candidate) => candidate.visitIndex === 3);
    if (visit === undefined) throw new Error('N authored Hub visit 3 is missing');
    expect(destination(complete, createHubVisitAddress(nBiome, 'hub', 3))).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: hub.key },
      selectedRailKey: visit.marker.focusKey,
    });
    expect(destination(complete, createHubSlotAddress(nBiome, 'hub', 'combat02'))).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: hub.key },
      selectedRailKey: hubRail.marker.focusKey,
    });
    expect(
      destination(complete, createIncomingRewardAddress(nBiome, nOccurrenceId('combat02'))),
    ).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: hub.key },
      selectedRailKey: hubRail.marker.focusKey,
    });
    const hubTrait = hub.slots
      .flatMap((slot) => slot.room?.rewardControls ?? [])
      .flatMap((control) => control.traitOffers ?? [])
      .find((trait) => trait.address.owner.kind === 'incomingReward');
    if (hubTrait === undefined) throw new Error('Hub main-reward trait marker is missing');
    expect(destination(complete, hubTrait.address)).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: hub.key },
      ownerAddress: hubTrait.address,
      selectedRailKey: hubRail.marker.focusKey,
      traitDialogTarget: hubTrait.address,
    });

    const sideRoom = createLocalChildAddress(
      nBiome,
      nOccurrenceId('combat05'),
      'sideRooms',
      'sideDoor1',
    );
    const sideVisit = hubRail.visits.find(
      (candidate) => candidate.node.room.occurrenceId === nOccurrenceId('combat05'),
    );
    if (sideVisit === undefined) throw new Error('N Combat 05 Hub visit is missing');
    expect(destination(complete, sideRoom)).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: sideVisit.node.key },
      selectedRailKey: sideVisit.marker.focusKey,
    });

    const handoffOwner = createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    const preboss = n.nodes.find(
      (node): node is Extract<(typeof n.nodes)[number], { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' &&
        node.room.occurrenceId === nOccurrenceIds.preboss &&
        node.sourceDecisionRemoval !== undefined,
    );
    const prebossTarget = createTargetAddress(nBiome, handoffOwner.source, 'preboss');
    if (preboss === undefined) throw new Error('N fixed Preboss workbench is missing');
    expect(destination(complete, handoffOwner)).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: preboss.key },
    });
    expect(destination(complete, handoffOwner).selectedRailKey).toBeUndefined();
    expect(destination(complete, prebossTarget)).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: preboss.key },
      selectedRailKey: semanticAddressKey(prebossTarget),
    });
    if (preboss.room.roomLocal.kind !== 'shop' || !preboss.room.roomLocal.materialized) {
      throw new Error('N fixed Preboss Shop surface is missing');
    }
    const prebossRailKey = railKeyForNode(n, preboss.key);
    for (const offer of preboss.room.roomLocal.offers) {
      expectNodeRailDestination(
        complete,
        offer.purchase.marker.address,
        preboss.key,
        prebossRailKey,
      );
      expectNodeRailDestination(
        complete,
        offer.rewardControl.marker.address,
        preboss.key,
        prebossRailKey,
      );
    }

    const truncated = project(
      applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
        hub: createHubDecisionAddress(nBiome, 'hub'),
        hubSlotKeys: nVisitSlotKeys.slice(0, 3),
        kind: 'ReplaceHubVisitOrder',
      }),
    );
    const truncatedN = biome(truncated, 'N');
    const truncatedHub = truncatedN.nodes.find(
      (
        node,
      ): node is Extract<(typeof truncatedN.nodes)[number], { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (truncatedHub === undefined) throw new Error('truncated N Hub is missing');
    const unroomedVisit = destination(truncated, createHubVisitAddress(nBiome, 'hub', 4));
    expect(unroomedVisit.inspectorSubject).toEqual({ kind: 'node', nodeKey: truncatedHub.key });
    expect(unroomedVisit.selectedRailKey).toBeUndefined();

    const handoff = project(
      appendCompleteN(
        createProjectDocument(catalog, {
          projectId: 'inspector-destinations-handoff',
          name: 'Inspector destinations Hub handoff',
          configuredBiomeCounts: { Surface: 1 },
        }),
        { includePreboss: false },
      ),
    );
    const handoffN = biome(handoff, 'N');
    const handoffHub = handoffN.nodes.find(
      (node): node is Extract<(typeof handoffN.nodes)[number], { readonly kind: 'hubDecision' }> =>
        node.kind === 'hubDecision',
    );
    if (handoffHub === undefined) throw new Error('completed N Hub handoff board is missing');
    const handoffDestination = destination(handoff, handoffOwner);
    expect(handoffDestination.inspectorSubject).toEqual({ kind: 'node', nodeKey: handoffHub.key });
    expect(handoffDestination.selectedRailKey).toBeUndefined();
  });

  it('binds Fields and Ship local leaves to their containing decision rail', () => {
    const underworld = project(createGoldenFGHIProject());
    const h = biome(underworld, 'H');
    const fieldsDecision = h.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof h.nodes)[number],
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
      > =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.targets.some((target) => target.room.roomLocal.kind === 'fields'),
    );
    const fieldsRoom = fieldsDecision?.targets.find(
      (target) => target.room.roomLocal.kind === 'fields',
    )?.room;
    if (fieldsDecision === undefined || fieldsRoom?.roomLocal.kind !== 'fields') {
      throw new Error('H Fields room-local surface is missing');
    }
    const fieldsRailKey = railKeyForNode(h, fieldsDecision.key);
    for (const owner of [
      ...(fieldsDecision.fieldsCageOutcome === undefined
        ? []
        : [fieldsDecision.fieldsCageOutcome.address]),
      ...fieldsRoom.roomLocal.cages.map((cage) => cage.control.marker.address),
    ]) {
      expectNodeRailDestination(underworld, owner, fieldsDecision.key, fieldsRailKey);
    }

    const surface = project(createRepresentativeNOPQProject());
    const o = biome(surface, 'O');
    const shipDecision = o.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof o.nodes)[number],
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' | 'takeoverBatch' }
      > =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.targets.some((target) => target.room.roomLocal.kind === 'ship'),
    );
    const shipRoom = shipDecision?.targets.find(
      (target) => target.room.roomLocal.kind === 'ship',
    )?.room;
    if (shipDecision === undefined || shipRoom?.roomLocal.kind !== 'ship') {
      throw new Error('O Ship room-local surface is missing');
    }
    const shipRailKey = railKeyForNode(o, shipDecision.key);
    for (const owner of shipRoom.roomLocal.wheels.flatMap((wheel) => [
      wheel.marker.address,
      ...wheel.offers.map((offer) => offer.control.marker.address),
    ])) {
      expectNodeRailDestination(surface, owner, shipDecision.key, shipRailKey);
    }
  });
});
