import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createOccurrenceId,
  createRouteAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHIProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject, nOccurrenceId } from '@run-planner/test-fixtures/surface';
import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import {
  nextRepairSelection,
  projectFeedbackHierarchy,
} from '@planner/projections/evaluationProjection';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';

const goldenEnd = createOccurrenceId('golden-f-b5-e1');

function endedAt(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePlanEnd',
    route: createRouteAddress(project.route.routeKey),
    planEnd: { biomeKey, occurrenceId: createOccurrenceId(occurrenceId) },
  });
}

function roomNode(biome: WorkspaceBiome, occurrenceId: string): WorkspaceOccurrenceWorkbenchNode {
  const node = biome.nodes.find(
    (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
      candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
  );
  if (node === undefined) throw new Error(`${occurrenceId} has no room workbench`);
  return node;
}

function railRelations(biome: WorkspaceBiome): readonly (readonly [string, string])[] {
  return biome.rail.flatMap((entry) =>
    entry.kind === 'node' ? [[entry.label, entry.planEnd ?? '-'] as const] : [],
  );
}

describe('plan end in the structured workspace', () => {
  it('binds every room to the route end and asks the engine whether it can end there', () => {
    const { workspace } = projectStructuredWorkspaceFixture(createGoldenFGHIProject());
    const erebus = requireWorkspaceBiome(workspace, 'F');
    const settled = roomNode(erebus, 'golden-f-b3-e1').planEnd;
    const offered = roomNode(erebus, 'golden-f-b3-e2').planEnd;

    expect(settled?.relation).toBeUndefined();
    expect(settled?.availability()).toEqual({ available: true });
    expect(offered?.availability()).toEqual({ available: false, reason: 'notOnRoute' });
    expect(settled?.endIntent.command).toEqual({
      kind: 'ReplacePlanEnd',
      route: createRouteAddress('Underworld'),
      planEnd: { biomeKey: 'F', occurrenceId: 'golden-f-b3-e1' },
    });
    expect(settled?.removeIntent.command).toEqual({
      kind: 'ReplacePlanEnd',
      route: createRouteAddress('Underworld'),
      planEnd: null,
    });
    expect(workspace.route.planEnd).toBeUndefined();
  });

  it('marks the end room and every room and biome past it', () => {
    const { workspace } = projectStructuredWorkspaceFixture(
      endedAt(createGoldenFGHIProject(), 'F', goldenEnd),
    );
    const erebus = requireWorkspaceBiome(workspace, 'F');

    expect(erebus.planEnd).toBe('end');
    expect(roomNode(erebus, goldenEnd).planEnd?.relation).toBe('end');
    expect(roomNode(erebus, 'golden-f-b7-e1').planEnd?.relation).toBe('pastEnd');
    expect(railRelations(erebus)).toEqual([
      ['Opening', '-'],
      ['Decision 1', '-'],
      ['Decision 2', '-'],
      ['Decision 3', '-'],
      ['Decision 4', '-'],
      ['Decision 5', 'end'],
      ['Decision 6', 'pastEnd'],
      ['Decision 7', 'pastEnd'],
      ['Decision 8', 'pastEnd'],
      ['Decision 9', 'pastEnd'],
      ['Decision 10', 'pastEnd'],
      ['Preboss', 'pastEnd'],
    ]);
    expect(erebus.completionOutline.map((node) => node.planEnd?.relation)).toEqual([
      'pastEnd',
      'pastEnd',
    ]);
    for (const biomeKey of ['G', 'H', 'I']) {
      expect(requireWorkspaceBiome(workspace, biomeKey).planEnd).toBe('pastEnd');
      expect(workspace.route.rail.find((biome) => biome.biomeKey === biomeKey)?.planEnd).toBe(
        'pastEnd',
      );
    }
    expect(workspace.route.planEnd).toMatchObject({
      biomeKey: 'F',
      biomeLabel: 'Erebus',
      roomLabel: 'Combat 06',
      room: { kind: 'occurrence', biomeKey: 'F', occurrenceId: goldenEnd },
    });
    expect(workspace.route.planEnd?.unreached).toBeUndefined();
  });

  it('keeps the end room complete without a missing exit when it has no doors yet', () => {
    const open = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenEnd,
      }),
    });
    const before = requireWorkspaceBiome(projectStructuredWorkspaceFixture(open).workspace, 'F');
    expect(before.frontier?.kind).toBe('exitDecision');

    const { evaluation, workspace } = projectStructuredWorkspaceFixture(
      endedAt(open, 'F', goldenEnd),
    );
    const erebus = requireWorkspaceBiome(workspace, 'F');
    const endStage = erebus.occurrenceStages.find(
      (stage) => stage.sourceOccurrenceNodeKey === roomNode(erebus, goldenEnd).key,
    );

    expect(evaluation.status).toBe('valid');
    expect(erebus.frontier).toBeNull();
    expect(erebus.rail.some((entry) => entry.kind === 'frontier')).toBe(false);
    expect(endStage?.outgoing.kind).toBe('planEnd');
  });

  it('ends a Hub stay with its visit and leaves later visits past the end', () => {
    const { workspace } = projectStructuredWorkspaceFixture(
      endedAt(loadSurfaceNOPQProject(), 'N', nOccurrenceId('combat02')),
    );
    const ephyra = requireWorkspaceBiome(workspace, 'N');
    const hub = ephyra.nodes.find((node) => node.kind === 'hubDecision');
    const rail = ephyra.rail.find((entry) => entry.kind === 'hubGroup');

    expect(hub?.planEnd).toBe('end');
    expect(hub?.visits.map((visit) => visit.planEnd ?? '-')).toEqual([
      '-',
      '-',
      'end',
      'pastEnd',
      'pastEnd',
      'pastEnd',
    ]);
    expect(rail?.visits.map((visit) => visit.planEnd ?? '-')).toEqual([
      '-',
      '-',
      'end',
      'pastEnd',
      'pastEnd',
      'pastEnd',
    ]);
    // The ended visit keeps its side rooms; a later visit's side rooms follow the end.
    expect(rail?.visits[2]?.sideVisits.map((side) => side.planEnd)).toEqual([undefined]);
    expect(rail?.visits[3]?.sideVisits.map((side) => side.planEnd)).toEqual(['pastEnd']);
  });

  it("takes past the end exactly from the engine: the end visit's side rooms and peers stay in", () => {
    const { workspace } = projectStructuredWorkspaceFixture(
      endedAt(loadSurfaceNOPQProject(), 'N', nOccurrenceId('combat05')),
    );
    const ephyra = requireWorkspaceBiome(workspace, 'N');
    const hub = ephyra.nodes.find((node) => node.kind === 'hubDecision');
    const rail = ephyra.rail.find((entry) => entry.kind === 'hubGroup');

    expect(hub?.visits.map((visit) => visit.planEnd ?? '-')).toEqual([
      'end',
      'pastEnd',
      'pastEnd',
      'pastEnd',
      'pastEnd',
      'pastEnd',
    ]);
    expect(rail?.visits[0]?.sideVisits.map((side) => side.planEnd)).toEqual([undefined, undefined]);
    // The end visit's order stays a reached context.
    if (hub?.kind !== 'hubDecision') throw new Error('Ephyra has no Hub');
    expect(workspace.interactions.hubActionOrders.get(hub.marker.focusKey)?.contextReached).toBe(
      true,
    );

    const erebus = requireWorkspaceBiome(
      projectStructuredWorkspaceFixture(endedAt(createGoldenFGHIProject(), 'F', goldenEnd))
        .workspace,
      'F',
    );
    // golden-f-b5-e2 was offered beside the end room; golden-f-b6-e2 by the end room's doors.
    expect(roomNode(erebus, 'golden-f-b5-e2').planEnd?.relation).toBeUndefined();
    expect(roomNode(erebus, 'golden-f-b6-e2').planEnd?.relation).toBe('pastEnd');
  });

  it("keeps the end room's hidden door with its doors, past the end", () => {
    const { workspace } = projectStructuredWorkspaceFixture(
      endedAt(loadSurfaceNOPQProject(), 'N', nOccurrenceId('combat05')),
    );
    const end = roomNode(requireWorkspaceBiome(workspace, 'N'), nOccurrenceId('combat05'));
    expect(end.room.phantomExit?.room.locked).toBe('pastEnd');
    expect(end.room.phantomExit?.reward.locked).toBe('pastEnd');
  });

  it('hosts an unreached end on the Route panel, where its control repairs it', () => {
    const { evaluation, workspace } = projectStructuredWorkspaceFixture(
      endedAt(createGoldenFGHIProject(), 'F', 'golden-f-b5-e2'),
    );
    const issue = evaluation.issue;
    if (issue === undefined) throw new Error('an unreached end is a finding');

    expect(workspace.route.planEnd?.unreached).toBe(true);
    expect(requireWorkspaceBiome(workspace, 'F').planEnd).toBeUndefined();
    expect(
      workspace.focusByOwner.get(semanticAddressKey(createRouteAddress('Underworld')))
        ?.presentationPanel,
    ).toBe('route');
    expect(nextRepairSelection(issue, workspace.focusByOwner).presentationPanel).toEqual({
      kind: 'route',
    });
    expect(projectFeedbackHierarchy(evaluation).route.loadout.findingCount).toBe(0);
  });

  it('reports the biomes after the end as past it, not blocked', () => {
    const { evaluation } = projectStructuredWorkspaceFixture(
      endedAt(createGoldenFGHIProject(), 'F', goldenEnd),
    );
    const feedback = projectFeedbackHierarchy(evaluation).route.biomes;

    expect(feedback.get('F')?.status.tone).toBe('valid');
    expect(feedback.get('G')).toMatchObject({
      context: 'pastPlanEnd',
      findingCount: 0,
    });
  });
});
