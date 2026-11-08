import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { applyProjectCommand, semanticAddressKey } from '@run-planner/engine/authored-project';
import { loadSurfaceNOPQProject, nOccurrenceId } from '@run-planner/test-fixtures/surface';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';
import {
  findingControlKey,
  sideVisitControl,
  type WorkspaceLocalVisitDecision,
} from '@planner/projections/structured-workspace';
import { presentFinding, projectFindingLabels } from '@planner/projections/evaluationProjection';

function combat05(project: ReturnType<typeof loadSurfaceNOPQProject>) {
  const projected = projectStructuredWorkspaceFixture(project);
  const node = requireWorkspaceBiome(projected.workspace, 'N').nodes.find(
    (candidate) =>
      candidate.kind === 'occurrenceWorkbench' &&
      candidate.room.occurrenceId === nOccurrenceId('combat05'),
  );
  if (node?.kind !== 'occurrenceWorkbench' || node.localVisit === undefined)
    throw new Error('N Combat 05 has no side visits');
  return { localVisit: node.localVisit, workspace: projected.workspace };
}

function optionFor(localVisit: WorkspaceLocalVisitDecision, position: number, key: string) {
  const option = localVisit.leaves[position - 1]?.options.find(
    (candidate) => candidate.key === key,
  );
  if (option === undefined) throw new Error(`Leave ${position} has no ${key} option`);
  return option;
}

describe('main room side-visit Leave rows', () => {
  it('publishes one exit per side visit and the Hub return, each authoring its own place', () => {
    const { localVisit } = combat05(loadSurfaceNOPQProject());
    const [first, second] = localVisit.visitOrder;
    if (first === undefined || second === undefined)
      throw new Error('N Combat 05 visits fewer than two side rooms');
    const slotOf = (occurrenceId: string) =>
      localVisit.slots.find((slot) => slot.occurrenceId === occurrenceId)!.key;
    expect(localVisit.leaves.map((leave) => leave.selectedKey)).toEqual([
      slotOf(first),
      slotOf(second),
      'hub',
    ]);
    // The Hub ends the visits at its exit; a side room replaces that visit and keeps the later ones.
    expect(optionFor(localVisit, 2, 'hub').proposedOccurrenceIds).toEqual([first]);
    const unvisited = localVisit.slots.find(
      (slot) => slot.generation === 'generated' && !slot.entered,
    );
    if (unvisited === undefined) throw new Error('N Combat 05 has no open unvisited side room');
    expect(optionFor(localVisit, 1, unvisited.key).proposedOccurrenceIds).toEqual([
      unvisited.occurrenceId,
      second,
    ]);
    expect(optionFor(localVisit, 3, unvisited.key).proposedOccurrenceIds).toEqual([
      first,
      second,
      unvisited.occurrenceId,
    ]);
    // Only open side doors are ways out.
    expect(
      localVisit.leaves.every((leave) =>
        leave.options.every(
          (option) =>
            option.key === 'hub' ||
            localVisit.slots.find((slot) => slot.key === option.key)?.generation === 'generated',
        ),
      ),
    ).toBe(true);
  });

  it('offers each exit only rooms not visited before it, from the engine candidates', () => {
    const { localVisit, workspace } = combat05(loadSurfaceNOPQProject());
    const [first] = localVisit.visitOrder;
    const firstKey = localVisit.slots.find((slot) => slot.occurrenceId === first)!.key;
    const leave = localVisit.leaves[1]!;
    const candidates = workspace.interactions.localVisitOrders.get(leave.interactionKey)!.load();
    const supported = (key: string) =>
      candidates[leave.options.findIndex((option) => option.key === key)]?.evaluation;
    expect(supported(firstKey)).toMatchObject({
      kind: 'sideRoomEntryOrder',
      result: { selectedPossible: false, findings: [] },
    });
    expect(supported('hub')).toMatchObject({
      kind: 'sideRoomEntryOrder',
      result: { selectedPossible: true },
    });
  });

  it('keeps a later visit an earlier change repeats, with its finding on that visit’s exit', () => {
    const base = loadSurfaceNOPQProject();
    const { localVisit } = combat05(base);
    const second = localVisit.visitOrder[1]!;
    const repeated = applyProjectCommand(base, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: localVisit.order,
      occurrenceIds: [second, second],
    });
    const { localVisit: after, workspace } = combat05(repeated);
    expect(after.visitOrder).toEqual([second, second]);
    expect(after.leaves).toHaveLength(3);
    const marked = workspace.findingsByRepairTarget.get(
      findingControlKey(after.order, sideVisitControl(2)),
    );
    expect(marked?.map((finding) => finding.code)).toEqual(['roomAlreadyVisited']);
    expect(
      workspace.findingsByRepairTarget.get(findingControlKey(after.order, sideVisitControl(1))),
    ).toBeUndefined();
    const label = after.slots.find((slot) => slot.occurrenceId === second)!.label;
    expect(presentFinding(marked![0]!, projectFindingLabels(catalog, repeated)).title).toBe(
      `${label} is already visited`,
    );
    expect(semanticAddressKey(marked![0]!.origin)).toBe(semanticAddressKey(after.order));
  });
});
