import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  authoredProjectCommandsDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  createPlannerStore,
  selectPresentProject,
  selectProjectHistory,
} from '@planner/state/store';
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

function mainRoom(project: ReturnType<typeof loadSurfaceNOPQProject>, slotKey: string) {
  const projected = projectStructuredWorkspaceFixture(project);
  const node = requireWorkspaceBiome(projected.workspace, 'N').nodes.find(
    (candidate) =>
      candidate.kind === 'occurrenceWorkbench' &&
      candidate.room.occurrenceId === nOccurrenceId(slotKey),
  );
  if (node?.kind !== 'occurrenceWorkbench' || node.localVisit === undefined)
    throw new Error(`N ${slotKey} has no side visits`);
  return { localVisit: node.localVisit, planEnd: node.planEnd, workspace: projected.workspace };
}

const combat05 = (project: ReturnType<typeof loadSurfaceNOPQProject>) =>
  mainRoom(project, 'combat05');

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

  it('ends the plan in a middle Hub visit’s main room from an early exit as one edit', () => {
    const base = loadSurfaceNOPQProject();
    // Combat 02 is the third of the Hub's visits and visits one side room before its Hub return.
    const { localVisit, workspace } = mainRoom(base, 'combat02');
    expect(localVisit.visitOrder).toHaveLength(1);
    const first = localVisit.leaves[0]!;
    const intent = workspace.interactions.localVisitOrders.get(first.interactionKey)!.endPlanIntent;

    const store = createPlannerStore({
      assembleProjectEvaluation: (project) => simulateProjectAssembly(catalog, project),
      catalog,
    });
    store.dispatch(authoredProjectReplaced(base));
    store.dispatch(authoredProjectCommandsDispatched(intent.commands));
    const ended = selectPresentProject(store.getState())!;
    expect(selectProjectHistory(store.getState())!.past).toEqual([base]);
    expect(ended.route.planEnd).toEqual({ biomeKey: 'N', occurrenceId: nOccurrenceId('combat02') });

    const after = mainRoom(ended, 'combat02');
    expect(after.localVisit.visitOrder).toEqual([]);
    expect(after.localVisit.leaves.map((leave) => leave.selectedKey)).toEqual(['hub']);
    expect(after.planEnd?.relation).toBe('end');

    store.dispatch(authoredProjectUndoRequested());
    expect(selectPresentProject(store.getState())).toBe(base);
  });

  it('judges each exit’s End plan with its Hub return applied, as the last exit is judged', () => {
    const base = loadSurfaceNOPQProject();
    const ends = (project: typeof base) => {
      const { localVisit, planEnd, workspace } = combat05(project);
      return {
        exits: localVisit.leaves.map((leave) =>
          workspace.interactions.localVisitOrders.get(leave.interactionKey)!.endPlanAvailability(),
        ),
        last: planEnd!.availability(),
      };
    };
    expect(ends(base)).toEqual({
      exits: [{ available: true }, { available: true }, { available: true }],
      last: { available: true },
    });

    // The main room's reward left unpicked: no exit can end the plan there.
    const main = nOccurrenceId('combat05');
    const pickup = base.route.biomes
      .find((biome) => biome.biomeKey === 'N')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === main)!.roomActions
      .order[0]!;
    const unfinished = applyProjectCommand(base, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(
        createBiomeAddress('Surface', 'N'),
        main,
        roomActionKey(pickup),
      ),
    });
    const unsettled = { available: false, reason: 'notSettled' };
    expect(ends(unfinished)).toEqual({
      exits: [unsettled, unsettled, unsettled],
      last: unsettled,
    });
  });
});
