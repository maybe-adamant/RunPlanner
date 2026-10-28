import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createHubDecisionAddress,
  createHubRerollAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRoomActionAddress,
  rerollAppendIndex,
  sourceRerolledOwners,
  type ProjectCommand,
  type ProjectDocument,
  type RerollPressTarget,
  type RerollSurface,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  hubStaysForProjectEvaluationAssembly,
  rerollSettlementForProjectEvaluationAssembly,
  rerollSpendAllowanceForProjectEvaluationAssembly,
  rerollSurfaceForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
} from '@run-planner/engine/reward-kernel';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNOCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import { supportedRerollRewards, withArcana, withJudgment } from '../support/rerolls';

const f = createBiomeAddress('Underworld', 'F');
const n = createBiomeAddress('Surface', 'N');
const o = createBiomeAddress('Surface', 'O');
const hub = createHubDecisionAddress(n, 'hub');
const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);

const doors = (occurrenceId: string, biome = f): RerollSurface => ({
  kind: 'doors',
  occurrence: createOccurrenceAddress(biome, occurrenceId as never),
});
const stay = (precedingVisitCount: number): RerollSurface => ({
  kind: 'hubStay',
  hub,
  precedingVisitCount,
});
const door = (exitKey: string, occurrenceId: string): RerollPressTarget => ({
  kind: 'door',
  exitKey,
  occurrenceId: occurrenceId as never,
});
const slot = (hubSlotKey: string): RerollPressTarget => ({ kind: 'hubSlot', hubSlotKey });

const ROOM_REWARDS = [
  'RoomMoneyDrop',
  'MaxManaDrop',
  'MaxHealthDrop',
  'StackUpgrade',
  'WeaponUpgrade',
  'HermesUpgrade',
  'SpellDrop',
  'Devotion',
  'Boon',
];
const HUB_REWARDS = [
  'MaxHealthDropBig',
  'MaxManaDropBig',
  'WeaponUpgrade',
  'HermesUpgrade',
  'SpellDrop',
  'Boon',
];

const key = (offer: ResolvedRewardOffer) => JSON.stringify(offer);

/** Every reward the candidate session accepts for a press not yet authored. */
function pendingRewards(
  project: ProjectDocument,
  surface: RerollSurface,
  target: RerollPressTarget,
  rewardTypes: readonly string[],
): readonly ResolvedRewardOffer[] {
  const session = createPreparedProjectCandidateSession(catalog, evaluate(project));
  return rewardTypes
    .flatMap((type) => locallyValidRewardOffers(catalog.rewards, type))
    .filter((value) => {
      const result = session.evaluate({ kind: 'pendingRerollReward', surface, target, value });
      return result.kind === 'rerollReward' && result.result.supported;
    });
}

/** The command that appends a press to the surface. */
function appendPress(
  project: ProjectDocument,
  surface: RerollSurface,
  target: RerollPressTarget,
  reward: ResolvedRewardOffer,
): ProjectCommand {
  const index = rerollAppendIndex(project, surface)!;
  if (surface.kind === 'hubStay') {
    if (target.kind !== 'hubSlot') throw new Error('a Hub press names a slot');
    return {
      kind: 'InsertHubReroll',
      hub: surface.hub,
      hubSlotKey: target.hubSlotKey,
      reward,
      index,
    };
  }
  if (target.kind === 'hubSlot') throw new Error('a room press names a door or wheel offer');
  return {
    kind: 'InsertReroll',
    occurrence:
      surface.kind === 'doors'
        ? surface.occurrence
        : createOccurrenceAddress(
            createBiomeAddress(surface.wheel.routeKey, surface.wheel.biomeKey),
            surface.wheel.occurrenceId,
          ),
    target,
    reward,
    index,
  };
}

/** Appends a press with the first reward a press not yet authored accepts. */
function press(
  project: ProjectDocument,
  surface: RerollSurface,
  target: RerollPressTarget,
  rewardTypes: readonly string[] = surface.kind === 'hubStay' ? HUB_REWARDS : ROOM_REWARDS,
): { readonly project: ProjectDocument; readonly reward: ResolvedRewardOffer } {
  const [reward] = pendingRewards(project, surface, target, rewardTypes);
  if (reward === undefined) throw new Error('no reward is supported for the press');
  return {
    project: applyProjectCommand(project, catalog, appendPress(project, surface, target, reward)),
    reward,
  };
}

const settles = (project: ProjectDocument, command: ProjectCommand) => () =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });

describe('room door surfaces', () => {
  const base = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
  const source = 'golden-f-b2-e1';

  it("publish each door's first draw and its current reward after the presses", () => {
    expect(rerollSurfaceForProjectEvaluationAssembly(evaluate(base), doors(source))).toMatchObject({
      enabled: true,
      poolRemainingAtStart: 3,
      poolRemaining: 3,
      targets: [
        {
          target: door('exit1', 'golden-f-b3-e1'),
          assigned: { rewardType: 'MaxHealthDrop' },
          current: { rewardType: 'MaxHealthDrop' },
        },
        {
          target: door('exit2', 'golden-f-b3-e2'),
          assigned: { rewardType: 'MaxManaDrop' },
          current: { rewardType: 'MaxManaDrop' },
        },
      ],
    });
    const { project, reward } = press(base, doors(source), door('exit2', 'golden-f-b3-e2'));
    const assembly = evaluate(project);
    const surface = rerollSurfaceForProjectEvaluationAssembly(assembly, doors(source));
    expect(surface).toMatchObject({ poolRemainingAtStart: 3, poolRemaining: 2 });
    expect(surface?.targets[1]).toMatchObject({ assigned: { rewardType: 'MaxManaDrop' } });
    expect(surface?.targets[1]?.current).toEqual(reward);
    expect(
      rerollSettlementForProjectEvaluationAssembly(
        assembly,
        createRoomActionAddress(f, source as never, JSON.stringify(['reroll', 'r1'])),
      ),
    ).toMatchObject({ poolRemainingBefore: 3, poolRemainingAfter: 2 });
  });

  it('keep the current reward a refused press leaves', () => {
    // exit2 offers MaxManaDrop, so exit1 cannot be redrawn to it.
    const project = applyProjectCommand(
      base,
      catalog,
      appendPress(base, doors(source), door('exit1', 'golden-f-b3-e1'), {
        rewardType: 'MaxManaDrop',
      }),
    );
    const owner = [
      ...sourceRerolledOwners(
        f,
        project.route.biomes[0]!.topology!.occurrences.find(
          (room) => room.occurrenceId === source,
        )!,
      ).values(),
    ][0];
    expect(owner?.effectiveOffer).toEqual({ rewardType: 'MaxManaDrop' });
    expect(
      rerollSurfaceForProjectEvaluationAssembly(evaluate(project), doors(source))?.targets[0]
        ?.current,
    ).toEqual({ rewardType: 'MaxHealthDrop' });
  });

  it('name the doors the game never rerolls', () => {
    const surface = rerollSurfaceForProjectEvaluationAssembly(
      evaluate(base),
      doors('golden-f-b10-e1'),
    );
    expect(
      surface?.targets.map((target) => [target.target, target.unavailable ?? null]),
    ).toContainEqual([door('exit1', 'golden-f-preboss-shop'), 'notRerollable']);
    expect(
      createPreparedProjectCandidateSession(catalog, evaluate(base)).evaluate({
        kind: 'pendingRerollReward',
        surface: doors('golden-f-b10-e1'),
        target: door('exit1', 'golden-f-preboss-shop'),
        value: { rewardType: 'RoomMoneyDrop' },
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'targetNotReachable' });
  });

  it('evaluate a press not yet authored as the same press once appended', () => {
    const target = door('exit1', 'golden-f-b3-e1');
    const pending = pendingRewards(base, doors(source), target, ROOM_REWARDS).map(key);
    expect(pending.length).toBeGreaterThan(0);
    const inserted = applyProjectCommand(
      base,
      catalog,
      appendPress(base, doors(source), target, { rewardType: 'RoomMoneyDrop' }),
    );
    expect(
      supportedRerollRewards(
        inserted,
        createRoomActionAddress(f, source as never, JSON.stringify(['reroll', 'r1'])),
        ROOM_REWARDS,
      ).map(key),
    ).toEqual(pending);
  });
});

describe('reroll spend allowance', () => {
  const base = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);

  it('refuses a press that a later spend leaves the pool short for', () => {
    const later = doors('golden-f-b6-e1');
    const exit = rerollSurfaceForProjectEvaluationAssembly(evaluate(base), later)!.targets[0]!
      .target;
    // The later presses draw no Boon and the earlier one a Boon on the door not taken, so no
    // draw starves another and nothing new is entered.
    const resources = ROOM_REWARDS.filter((type) => type !== 'Boon');
    let project = base;
    for (let count = 0; count < 2; count += 1)
      project = press(project, later, exit, resources).project;
    const earlier = doors('golden-f-b2-e1');
    const allowance = (surface: RerollSurface) =>
      rerollSpendAllowanceForProjectEvaluationAssembly(evaluate(project), {
        kind: 'press',
        surface,
      });
    expect(allowance(earlier)).toEqual({
      kind: 'reached',
      cost: 1,
      lowestRemaining: 1,
      allowed: true,
    });
    const reward = pendingRewards(project, earlier, door('exit2', 'golden-f-b3-e2'), ['Boon'])[0]!;
    expect(
      settles(project, appendPress(project, earlier, door('exit2', 'golden-f-b3-e2'), reward)),
    ).not.toThrow();

    project = press(project, later, exit, resources).project;
    expect(allowance(earlier)).toMatchObject({ lowestRemaining: 0, allowed: false });
    expect(allowance(later)).toMatchObject({ lowestRemaining: 0, allowed: false });
    expect(
      settles(project, appendPress(project, earlier, door('exit2', 'golden-f-b3-e2'), reward)),
    ).toThrow('the reroll pool has nothing left for this spend');
  });

  it("answers a screen's next reroll as the settlement does", () => {
    const project = withArcana(loadUnderworldFGCheckpoint(), ['ScreenReroll']);
    const source = 'golden-f-b2-e1';
    const zeus = project.route.biomes[0]!.topology!.occurrences.find(
      (room) => room.occurrenceId === source,
    )!;
    const trait =
      zeus.state.kind === 'counted' ? zeus.state.reward?.traitOffersByAcquisitionRole : undefined;
    const [role, offer] = Object.entries(trait ?? {})[0]!;
    if (offer === null || offer === undefined || offer.kind === 'fallbackGold')
      throw new Error('fixture lacks an authored Zeus screen');
    const count = (rerollCount: number): ProjectCommand => ({
      kind: 'ReplaceTraitOffer',
      trait: {
        kind: 'traitOffer',
        routeKey: 'Underworld',
        biomeKey: 'F',
        owner: {
          kind: 'incomingReward',
          routeKey: 'Underworld',
          biomeKey: 'F',
          occurrenceId: source as never,
        },
        acquisitionRole: role,
      },
      value: { ...offer, rerollCount },
    });
    const once = applyProjectCommand(project, catalog, count(1));
    const screen = (from: ProjectDocument, fromCount: number) =>
      rerollSpendAllowanceForProjectEvaluationAssembly(evaluate(from), {
        kind: 'screen',
        occurrence: createOccurrenceAddress(f, source as never),
        fromCount,
      });
    // Three in the pool; one reroll costs 1, two cost 3, three cost 6.
    expect(screen(once, 1)).toEqual({
      kind: 'reached',
      cost: 2,
      lowestRemaining: 2,
      allowed: true,
    });
    expect(settles(once, count(2))).not.toThrow();
    const twice = applyProjectCommand(project, catalog, count(2));
    expect(screen(twice, 2)).toMatchObject({ cost: 3, lowestRemaining: 0, allowed: false });
    expect(settles(twice, count(3))).toThrow('the reroll pool has nothing left for this spend');
  });

  it('is unreached for a surface the walk never reached', () => {
    expect(
      rerollSpendAllowanceForProjectEvaluationAssembly(evaluate(base), {
        kind: 'press',
        surface: doors('golden-f-preboss-shop'),
      }),
    ).toEqual({ kind: 'unreached' });
  });
});

describe('Hub stays', () => {
  const base = () => withArcana(loadSurfaceNProject(), ['DoorReroll']);
  // Visits: combat05, miniBoss01, combat02, combat11, combat23, then combat09.

  it('publish each stay with the doors its visits closed', () => {
    const stays = hubStaysForProjectEvaluationAssembly(evaluate(base()), hub);
    expect(stays.map((entry) => entry.surface)).toEqual([0, 1, 2, 3, 4, 5, 6].map(stay));
    expect(
      stays.map((entry) =>
        entry.targets.flatMap((target) =>
          target.unavailable === 'slotEntered' && target.target.kind === 'hubSlot'
            ? [target.target.hubSlotKey]
            : [],
        ),
      ),
    ).toEqual([
      [],
      ['combat05'],
      ['combat05', 'miniBoss01'],
      ['combat02', 'combat05', 'miniBoss01'],
      ['combat02', 'combat05', 'combat11', 'miniBoss01'],
      ['combat02', 'combat05', 'combat11', 'combat23', 'miniBoss01'],
      ['combat02', 'combat05', 'combat09', 'combat11', 'combat23', 'miniBoss01'],
    ]);
  });

  it("carry a stay's press into the next stays' board and pool", () => {
    // combat03 is never entered.
    const { project, reward } = press(base(), stay(2), slot('combat03'));
    const stays = hubStaysForProjectEvaluationAssembly(evaluate(project), hub);
    const combat03 = (index: number) =>
      stays[index]!.targets.find(
        (target) => target.target.kind === 'hubSlot' && target.target.hubSlotKey === 'combat03',
      )!;
    expect(combat03(1)).toMatchObject({
      assigned: { rewardType: 'WeaponUpgrade' },
      current: { rewardType: 'WeaponUpgrade' },
    });
    expect(combat03(2).assigned).toEqual({ rewardType: 'WeaponUpgrade' });
    expect(combat03(2).current).toEqual(reward);
    expect(combat03(6)).toMatchObject({ assigned: reward, current: reward });
    expect(stays.map((entry) => [entry.poolRemainingAtStart, entry.poolRemaining])).toEqual([
      [3, 3],
      [3, 3],
      [3, 2],
      [2, 2],
      [2, 2],
      [2, 2],
      [2, 2],
    ]);
  });

  it('evaluate a press not yet authored as the same press once appended', () => {
    const pending = pendingRewards(base(), stay(3), slot('combat09'), HUB_REWARDS).map(key);
    expect(pending.length).toBeGreaterThan(0);
    const inserted = applyProjectCommand(
      base(),
      catalog,
      appendPress(base(), stay(3), slot('combat09'), { rewardType: 'MaxHealthDropBig' }),
    );
    expect(
      supportedRerollRewards(inserted, createHubRerollAddress(n, 'hub', 'r1'), HUB_REWARDS).map(
        key,
      ),
    ).toEqual(pending);
    // A door whose room was entered is closed.
    expect(
      createPreparedProjectCandidateSession(catalog, evaluate(base())).evaluate({
        kind: 'pendingRerollReward',
        surface: stay(1),
        target: slot('combat05'),
        value: { rewardType: 'MaxHealthDropBig' },
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'targetNotReachable' });
  });

  it('append a press before the next visit', () => {
    const project = base();
    expect([0, 1, 6].map((count) => rerollAppendIndex(project, stay(count)))).toEqual([1, 2, 7]);
  });
});

describe('ship wheel surfaces', () => {
  it('evaluate a press not yet authored as the same press once appended', () => {
    const base = withJudgment(
      withArcana(loadSurfaceNOCheckpoint(), ['DoorReroll']),
      'N',
      'surface-n-preboss:boss',
      ['ScreenReroll', 'TradeOff', 'StartingGold', 'HealthRegen', 'BonusDodge'],
    );
    const ship = 'surface-o-combat04';
    const surface: RerollSurface = {
      kind: 'rewardWheel',
      wheel: createRewardWheelAddress(o, ship as never, 'wheel1'),
    };
    const wheel = rerollSurfaceForProjectEvaluationAssembly(evaluate(base), surface);
    expect(wheel).toMatchObject({ enabled: true, poolRemaining: 10 });
    expect(wheel?.targets.map((target) => target.target)).toEqual([
      { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
    ]);
    const target = wheel!.targets[0]!.target;
    const pending = pendingRewards(base, surface, target, ROOM_REWARDS).map(key);
    expect(pending.length).toBeGreaterThan(0);
    const inserted = applyProjectCommand(
      base,
      catalog,
      appendPress(base, surface, target, { rewardType: 'MaxManaDrop' }),
    );
    expect(
      supportedRerollRewards(
        inserted,
        createRoomActionAddress(o, ship as never, JSON.stringify(['reroll', 'r1'])),
        ROOM_REWARDS,
      ).map(key),
    ).toEqual(pending);
  });
});
