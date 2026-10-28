import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  rerollSettlementForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
  type ExecutionPlan,
} from '@run-planner/engine/execution-plan';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { withArcana, withGoldenUnderworldJudgments } from '../support/rerolls';

const g = createBiomeAddress('Underworld', 'G');
const gSource = 'golden-g-b1-e1';
const reroll = createRoomActionAddress(g, gSource as never, JSON.stringify(['reroll', 'r1']));

function occurrence(project: ProjectDocument, id: string, biomeIndex: number) {
  return project.route.biomes[biomeIndex]!.topology!.occurrences.find(
    (room) => room.occurrenceId === id,
  )!;
}

function planOf(project: ProjectDocument): ExecutionPlan {
  const assembly = simulateProjectAssembly(catalog, project);
  expect(assembly.evaluation.status).toBe('valid');
  return compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
}

/** The golden route with one G door press; holding the card makes both Judgments due. */
function rerolledProject(): ProjectDocument {
  const project = withGoldenUnderworldJudgments(
    withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
  );
  return applyProjectCommand(project, catalog, {
    kind: 'InsertReroll',
    occurrence: createOccurrenceAddress(g, gSource as never),
    target: { kind: 'door', exitKey: 'exit2', occurrenceId: 'golden-g-b2-e2' as never },
    reward: { rewardType: 'GiftDrop' },
    index: occurrence(project, gSource, 1).roomActions.order.length,
  });
}

describe('reroll publication', () => {
  it('keeps the first draw on the door and publishes the press in order', () => {
    const project = rerolledProject();
    const plan = planOf(project);
    const sourcePlan = plan.occurrences.find((candidate) => candidate.id === gSource)!;
    expect(sourcePlan.rerolls).toEqual([
      {
        owner: semanticAddressKey(reroll),
        target: { kind: 'door', exitKey: 'exit2' },
        reward: expect.objectContaining({ rewardType: 'GiftDrop' }),
      },
    ]);
    expect(
      sourcePlan.roomGuide.find((row) => row.key === JSON.stringify(['reroll', 'r1']))?.description
        .kind,
    ).toBe('reroll');
    const firstDraw = occurrence(project, 'golden-g-b2-e2', 1).state;
    expect(
      sourcePlan.doors.kind === 'batch'
        ? sourcePlan.doors.targets.find((door) => door.exitKey === 'exit2')?.reward?.rewardType
        : undefined,
    ).toBe(firstDraw.kind === 'counted' ? firstDraw.reward?.offer.rewardType : undefined);
    // The planned pool at the room's entry pays for the press.
    const settled = rerollSettlementForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, project),
      reroll,
    );
    expect(sourcePlan.rerollPoolAtEntry).toBe(settled!.poolRemainingAfter! + 1);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });

  it('publishes no reroll field while the plan authors none', () => {
    const plan = planOf(
      withGoldenUnderworldJudgments(withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll'])),
    );
    for (const room of plan.occurrences) {
      expect(room).not.toHaveProperty('rerolls');
      expect(room).not.toHaveProperty('rerollPoolAtEntry');
    }
    expect(JSON.stringify(plan)).not.toContain('rerollCount');
  });

  it('decodes reroll fields strictly', () => {
    const encoded = JSON.parse(encodeExecutionPlan(planOf(rerolledProject()))) as {
      occurrences: Record<string, unknown>[];
    };
    const decodeWith = (edit: (room: Record<string, unknown>) => void) => {
      const copy = structuredClone(encoded);
      edit(copy.occurrences.find((room) => room.id === gSource)!);
      return () => decodeExecutionPlan(copy);
    };
    const press = (room: Record<string, unknown>) =>
      (room.rerolls as Record<string, unknown>[])[0]!;
    expect(
      decodeWith((room) => {
        room.rerollPoolAtEntry = 1.5;
      }),
    ).toThrow('rerollPoolAtEntry');
    expect(
      decodeWith((room) => {
        room.rerollPoolAtEntry = '3';
      }),
    ).toThrow('rerollPoolAtEntry');
    expect(
      decodeWith((room) => {
        room.rerolls = [];
      }),
    ).toThrow('rerolls');
    expect(
      decodeWith((room) => {
        press(room).extra = true;
      }),
    ).toThrow('extra');
    expect(
      decodeWith((room) => {
        press(room).target = { kind: 'hub', exitKey: 'exit2' };
      }),
    ).toThrow('target');
    expect(
      decodeWith((room) => {
        press(room).target = { kind: 'cage', exitKey: 'exit2' };
      }),
    ).toThrow('cageIndex');
    expect(
      decodeWith((room) => {
        delete press(room).reward;
      }),
    ).toThrow('reward');
  });
});
