import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
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
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHIProject, goldenFBiome } from '../../../test/fixtures/underworldProject';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
} from '../../../test/fixtures/surfaceProject';
import {
  createStructuredWorkspaceTestServices,
  requireWorkspaceBiome,
} from '../../../test/fixtures/structuredWorkspace';
import type {
  StructuredWorkspaceProjection,
  WorkspaceBiome,
  WorkspaceInspectorDestination,
} from './contract';

const { structuredWorkspace } = createStructuredWorkspaceTestServices();

function project(projectDocument: ProjectDocument): StructuredWorkspaceProjection {
  return structuredWorkspace.project(projectDocument, simulateProject(catalog, projectDocument));
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

function emptyProject(routeKey: 'Surface' | 'Underworld', count: number): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: `inspector-destinations-empty-${routeKey}-${count}`,
    name: `Inspector destinations empty ${routeKey}`,
    configuredBiomeCounts: { [routeKey]: count },
  });
}

describe('workspace inspector destinations', () => {
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

    const complete = project(createGoldenFGHIProject(catalog));
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
    expect(destination(complete, reward.marker.address)).toMatchObject({
      inspectorSubject: { kind: 'node', nodeKey: decision.key },
      selectedRailKey: decisionRail.marker.focusKey,
    });

    const i = biome(complete, 'I');
    const field = i.fields[0];
    if (field === undefined) throw new Error('I biome field is missing');
    for (const owner of [i.marker.address, field.marker.address]) {
      const fallback = destination(complete, owner);
      expect(fallback.inspectorSubject).toEqual(defaultSubject(i));
      expect(fallback.selectedRailKey).toBeUndefined();
    }
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

    const truncated = project(
      applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
        kind: 'RemoveHubVisitsFrom',
        visit: createHubVisitAddress(nBiome, 'hub', 4),
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
});
