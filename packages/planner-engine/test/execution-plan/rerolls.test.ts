import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createHubRerollAddress,
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
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import {
  firstSupportedReroll,
  withArcana,
  withGoldenUnderworldJudgments,
  withJudgment,
} from '../support/rerolls';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

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

  it('publishes Hub board presses of every stay in authored order', () => {
    const n = createBiomeAddress('Surface', 'N');
    const hub = { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' } as const;
    // combat03 is never entered; one press in the first stay, one after the third visit.
    const rewards: ResolvedRewardOffer[] = [];
    const project = [1, 5].reduce(
      (current, index) => {
        const inserted = applyProjectCommand(current, catalog, {
          kind: 'InsertHubReroll',
          hub,
          hubSlotKey: 'combat03',
          reward: { rewardType: 'MaxHealthDropBig' },
          index,
        });
        const reroll = createHubRerollAddress(n, 'hub', `r${rewards.length + 1}`);
        const reward = firstSupportedReroll(inserted, reroll, 'HubRewards');
        rewards.push(reward);
        return applyProjectCommand(inserted, catalog, {
          kind: 'ReplaceHubRerollReward',
          reroll,
          reward,
        });
      },
      withJudgment(
        withArcana(loadSurfaceNProject(), ['DoorReroll']),
        'N',
        'surface-n-preboss:boss',
        ['ScreenReroll', 'TradeOff', 'StartingGold', 'HealthRegen', 'BonusDodge'],
      ),
    );
    const assembly = simulateProjectAssembly(catalog, project);
    const later = createHubRerollAddress(n, 'hub', 'r2');
    expect(rerollSettlementForProjectEvaluationAssembly(assembly, later)).toMatchObject({
      poolRemainingAfter: 1,
    });
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({ assembly, catalog }),
    });
    const published = plan.occurrences.flatMap((entry) =>
      entry.overview.hub === undefined ? [] : [entry.overview.hub],
    );
    expect(published).toHaveLength(1);
    expect(published[0]!.rerolls).toEqual([
      {
        owner: semanticAddressKey(createHubRerollAddress(n, 'hub', 'r1')),
        slotKey: 'combat03',
        reward: expect.objectContaining({ rewardType: rewards[0]!.rewardType }),
      },
      {
        owner: semanticAddressKey(later),
        slotKey: 'combat03',
        reward: expect.objectContaining({ rewardType: rewards[1]!.rewardType }),
      },
    ]);
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

describe('Well and Pool roll publication', () => {
  const f = createBiomeAddress('Underworld', 'F');
  const postboss = 'golden-f-preboss-shop:postboss';
  const room = createOccurrenceAddress(f, postboss as never);
  const action = (key: unknown[]) =>
    createRoomActionAddress(f, postboss as never, JSON.stringify(key));

  function rolledProject(): ProjectDocument {
    let project = withJudgment(
      withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
      'F',
      'golden-f-preboss-shop:boss',
      ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    );
    const end = () => occurrence(project, postboss, 0).roomActions.order.length;
    const apply = (command: Parameters<typeof applyProjectCommand>[2]) => {
      project = applyProjectCommand(project, catalog, command);
    };
    apply({ kind: 'InsertStygianWellReroll', occurrence: room, index: end() });
    apply({
      kind: 'ReplaceStygianWellRollOffer',
      action: action(['rerollStygianWell', 'r1']),
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });
    apply({
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: true,
    });
    apply({ kind: 'SetPurgingPoolInteraction', occurrence: room, interacted: true });
    apply({ kind: 'InsertPurgingPoolReroll', occurrence: room, index: end() });
    apply({
      kind: 'ReplacePurgingPoolRollSlot',
      action: action(['rerollPurgingPool', 'r1']),
      slotKey: 'middle',
      traitKey: 'HeraCastBoon',
    });
    const sale = { kind: 'sellPurgingPoolTrait', slotKey: 'middle', rollKey: 'r1' } as const;
    apply({
      kind: 'InsertRoomAction',
      action: action(['sellPurgingPoolTrait', 'middle', 'r1']),
      reference: sale,
      index: end(),
    });
    return project;
  }

  it('publishes each roll in action order and the purchases and sales naming them', () => {
    const plan = planOf(rolledProject());
    const roomPlan = plan.occurrences.find((candidate) => candidate.id === postboss)!;
    expect(roomPlan.overview.stygianWell?.rerolls).toEqual([
      { rollKey: 'r1', offers: [{ generationKey: 'r1:healing', offerKey: 'ArmorBoostStore' }] },
    ]);
    expect(roomPlan.overview.purgingPool?.rerolls).toEqual([
      { rollKey: 'r1', traits: [{ slotKey: 'middle', traitKey: 'HeraCastBoon' }] },
    ]);
    const guide = roomPlan.roomGuide.map((row) => row.description);
    expect(guide).toContainEqual({ kind: 'rerollStygianWell', rollKey: 'r1' });
    expect(guide).toContainEqual({ kind: 'rerollPurgingPool', rollKey: 'r1' });
    expect(guide).toContainEqual(
      expect.objectContaining({ kind: 'purchaseStygianWellOffer', generationKey: 'r1:healing' }),
    );
    expect(guide).toContainEqual({
      kind: 'sellPurgingPoolTrait',
      slotKey: 'middle',
      rollKey: 'r1',
      traitKey: 'HeraCastBoon',
    });
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });
});
