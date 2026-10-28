import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createHubRerollAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionKey,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
  type RerollRoomAction,
} from '@run-planner/engine/authored-project';
import {
  activateTemporaryArcana,
  createArcanaFearState,
  createPreparedProjectCandidateSession,
  promoteArcana,
  rerollSettlementForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
} from '@run-planner/engine/reward-kernel';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
} from '@run-planner/engine/execution-plan';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNOCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import {
  reconcileBarrenArcana,
  rerollKindEnabled,
  rerollPoolRemaining,
} from '../../src/simulation/arcana-fear';

const f = createBiomeAddress('Underworld', 'F');
const source = 'golden-f-b2-e1';
const pickedTarget = 'golden-f-b3-e1';
const otherTarget = 'golden-f-b3-e2';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate }).assembly.project;

function withArcana(project: ProjectDocument, arcanaKeys: readonly string[]): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: 'Underworld' },
    arcanaKeys,
  });
}

function occurrence(project: ProjectDocument, id: string, biomeIndex = 0) {
  return project.route.biomes[biomeIndex]!.topology!.occurrences.find(
    (room) => room.occurrenceId === id,
  )!;
}

function rerolls(project: ProjectDocument): readonly RerollRoomAction[] {
  return occurrence(project, source).roomActions.order.flatMap((reference) =>
    reference.kind === 'reroll' ? [reference] : [],
  );
}

function insertReroll(
  project: ProjectDocument,
  exitKey: string,
  targetId: string,
  reward: ResolvedRewardOffer,
): ProjectCommand {
  return {
    kind: 'InsertReroll',
    occurrence: createOccurrenceAddress(f, source as never),
    target: { kind: 'door', exitKey, occurrenceId: targetId as never },
    reward,
    index: occurrence(project, source).roomActions.order.length,
  };
}

function rerollAddress(rerollId: string) {
  return createRoomActionAddress(
    f,
    source as never,
    roomActionKey({
      kind: 'reroll',
      rerollId,
      target: { kind: 'door', exitKey: 'exit1', occurrenceId: pickedTarget as never },
      reward: { rewardType: 'MaxHealthDrop' },
    }),
  );
}

/** The first reward the exact candidate session accepts for a press. */
function supportedReroll(project: ProjectDocument, rerollId: string): ResolvedRewardOffer {
  const session = createPreparedProjectCandidateSession(catalog, evaluate(project));
  const types = [
    ...new Set(catalog.rewards.stores.byKey.RunProgress!.entries.map((e) => e.rewardType)),
  ];
  for (const value of types.flatMap((type) => locallyValidRewardOffers(catalog.rewards, type))) {
    const result = session.evaluate({
      kind: 'rerollReward',
      reroll: rerollAddress(rerollId),
      value,
    });
    if (result.kind === 'rerollReward' && result.result.supported) return value;
  }
  throw new Error('no reroll reward is supported');
}

describe('door rerolls', () => {
  it('keeps the first draw and enters the reward of the last reroll', () => {
    // Holding the card auto-activates Judgment, whose Boss draw must then be authored.
    const base = applyProjectCommand(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      catalog,
      {
        kind: 'ReplaceJudgmentArcana',
        judgment: {
          kind: 'judgmentArcana',
          routeKey: 'Underworld',
          biomeKey: 'F',
          occurrenceId: 'golden-f-preboss-shop:boss' as never,
          phaseKey: 'Encounter',
        },
        arcanaKeys: ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
      },
    );
    const first = settle(
      base,
      insertReroll(base, 'exit1', pickedTarget, { rewardType: 'RoomMoneyDrop' }),
    );
    const pressed = rerolls(first);
    expect(pressed.map((reroll) => reroll.rerollId)).toEqual(['r1']);
    const reward = supportedReroll(first, 'r1');
    const project = settle(first, {
      kind: 'ReplaceRerollReward',
      action: rerollAddress('r1'),
      reward,
    });
    const target = occurrence(project, pickedTarget);
    expect(target.state.kind === 'counted' && target.state.reward?.offer).toEqual({
      rewardType: 'MaxHealthDrop',
    });
    expect(target.rerolledIncomingReward?.offer).toEqual(reward);
    const assembly = evaluate(project);
    expect(rerollFindings(project)).toEqual([]);
    expect(
      rerollSettlementForProjectEvaluationAssembly(assembly, rerollAddress('r1')),
    ).toMatchObject({
      reward,
      poolRemainingAfter: 2,
      target: createIncomingRewardAddress(f, pickedTarget as never),
    });
    const decoded = decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);
    expect(decoded).toEqual(project);
  });

  it('needs a held door-reroll card and refuses presses past the pool', () => {
    const plain = loadUnderworldFGCheckpoint();
    const unequipped = applyProjectCommand(
      plain,
      catalog,
      insertReroll(plain, 'exit2', otherTarget, { rewardType: 'RoomMoneyDrop' }),
    );
    expect(evaluate(unequipped).evaluation.findings.map((finding) => finding.code)).toContain(
      'rerollUnavailable',
    );

    let project = withArcana(plain, ['DoorReroll']);
    for (let press = 1; press <= 3; press += 1) {
      project = applyProjectCommand(
        project,
        catalog,
        insertReroll(project, 'exit2', otherTarget, { rewardType: 'RoomMoneyDrop' }),
      );
      const rerollId = `r${press}`;
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceRerollReward',
        action: createRoomActionAddress(f, source as never, JSON.stringify(['reroll', rerollId])),
        reward: supportedRerollAt(project, rerollId),
      });
    }
    expect(rerollFindings(project)).toEqual([]);
    expect(() =>
      settle(project, insertReroll(project, 'exit2', otherTarget, { rewardType: 'RoomMoneyDrop' })),
    ).toThrow('the reroll pool has nothing left for this spend');
    // An upstream edit that shrinks the pool keeps the presses with a finding.
    const shrunk = settle(project, {
      kind: 'ReplaceManualArcanaSelection',
      route: { kind: 'route', routeKey: 'Underworld' },
      arcanaKeys: [],
    });
    expect(rerolls(shrunk)).toHaveLength(3);
  });

  it('keeps a removed reroll target addressable by its identity', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, 'exit2', otherTarget, { rewardType: 'RoomMoneyDrop' }),
    );
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, 'exit2', otherTarget, { rewardType: 'RoomMoneyDrop' }),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(f, source as never, JSON.stringify(['reroll', 'r1'])),
    });
    expect(rerolls(project).map((reroll) => reroll.rerollId)).toEqual(['r2']);
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, 'exit2', otherTarget, { rewardType: 'RoomMoneyDrop' }),
    );
    expect(rerolls(project).map((reroll) => reroll.rerollId)).toEqual(['r2', 'r1']);
  });

  it('preserves an authored rerolled acquisition that no longer matches', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, 'exit1', pickedTarget, { rewardType: 'StackUpgrade' }),
    );
    const owner = createIncomingRewardAddress(f, pickedTarget as never);
    const authored = occurrence(project, pickedTarget).rerolledIncomingReward;
    expect(authored?.offer).toEqual({ rewardType: 'StackUpgrade' });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(f, source as never, JSON.stringify(['reroll', 'r1'])),
    });
    // The unauthored default leaves with its last reroll.
    expect(occurrence(project, pickedTarget).rerolledIncomingReward).toBeUndefined();
    expect(semanticAddressKey(owner)).toContain(pickedTarget);
  });
});

/** Findings on reroll presses or on the owners they redraw. */
function rerollFindings(project: ProjectDocument) {
  return evaluate(project).evaluation.findings.filter(
    (finding) =>
      finding.origin.kind === 'roomAction' ||
      finding.code.startsWith('reroll') ||
      finding.code === 'rerolledRewardMismatch',
  );
}

function supportedRerollAt(project: ProjectDocument, rerollId: string): ResolvedRewardOffer {
  const assembly = evaluate(project);
  const session = createPreparedProjectCandidateSession(catalog, assembly);
  const reroll = createRoomActionAddress(f, source as never, JSON.stringify(['reroll', rerollId]));
  for (const rewardType of [
    'RoomMoneyDrop',
    'MaxManaDrop',
    'MaxHealthDrop',
    'StackUpgrade',
    'MetaCurrencyDrop',
    'MetaCardPointsCommonDrop',
    'MemPointsCommonDrop',
  ]) {
    const value = { rewardType };
    const result = session.evaluate({ kind: 'rerollReward', reroll, value });
    if (result.kind === 'rerollReward' && result.result.supported) return value;
  }
  throw new Error(`no reward is supported for ${rerollId}`);
}

const surface = { kind: 'route', routeKey: 'Surface' } as const;
const n = createBiomeAddress('Surface', 'N');
const o = createBiomeAddress('Surface', 'O');

function surfaceWithArcana(project: ProjectDocument, arcanaKeys: readonly string[]) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: surface,
    arcanaKeys,
  });
}

/** The first offer of the target's store the exact candidate session accepts for a press. */
function firstSupported(
  project: ProjectDocument,
  reroll: Parameters<typeof rerollSettlementForProjectEvaluationAssembly>[1],
  storeKey: string,
): ResolvedRewardOffer {
  const session = createPreparedProjectCandidateSession(catalog, evaluate(project));
  const types = [
    ...new Set(catalog.rewards.stores.byKey[storeKey]!.entries.map((e) => e.rewardType)),
  ];
  for (const value of types.flatMap((type) => locallyValidRewardOffers(catalog.rewards, type))) {
    const result = session.evaluate({ kind: 'rerollReward', reroll, value });
    if (result.kind === 'rerollReward' && result.result.supported) return value;
  }
  throw new Error(`no reward is supported for ${semanticAddressKey(reroll)}`);
}

describe('reroll publication', () => {
  it('keeps the first draw on the door and publishes the press in order', () => {
    const g = createBiomeAddress('Underworld', 'G');
    const judgment = (biomeKey: string, occurrenceId: string, arcanaKeys: readonly string[]) =>
      ({
        kind: 'ReplaceJudgmentArcana',
        judgment: {
          kind: 'judgmentArcana',
          routeKey: 'Underworld',
          biomeKey,
          occurrenceId: occurrenceId as never,
          phaseKey: 'Encounter',
        },
        arcanaKeys,
      }) as const;
    // Holding the card auto-activates Judgment, whose Boss draws must then be authored.
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(
      project,
      catalog,
      judgment('F', 'golden-f-preboss-shop:boss', [
        'ScreenReroll',
        'StartingGold',
        'HealthRegen',
        'BonusDodge',
        'TradeOff',
      ]),
    );
    project = applyProjectCommand(
      project,
      catalog,
      judgment('G', 'golden-g-preboss-shop:boss', [
        'LowManaDamageBonus',
        'CastCount',
        'SorceryRegenUpgrade',
        'CastBuff',
        'BonusHealth',
      ]),
    );
    const gSource = 'golden-g-b1-e1';
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertReroll',
      occurrence: createOccurrenceAddress(g, gSource as never),
      target: { kind: 'door', exitKey: 'exit2', occurrenceId: 'golden-g-b2-e2' as never },
      reward: { rewardType: 'GiftDrop' },
      index: occurrence(project, gSource, 1).roomActions.order.length,
    });
    const assembly = evaluate(project);
    expect(assembly.evaluation.status).toBe('valid');
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({ assembly, catalog }),
    });
    const sourcePlan = plan.occurrences.find((candidate) => candidate.id === gSource)!;
    expect(sourcePlan.rerolls).toEqual([
      {
        owner: semanticAddressKey(
          createRoomActionAddress(g, gSource as never, JSON.stringify(['reroll', 'r1'])),
        ),
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
      assembly,
      createRoomActionAddress(g, gSource as never, JSON.stringify(['reroll', 'r1'])),
    );
    expect(sourcePlan.rerollPoolAtEntry).toBe(settled!.poolRemainingAfter! + 1);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });
});

describe('Hub board rerolls', () => {
  it('redraws a board door before the first visit and refuses one after it', () => {
    const base = surfaceWithArcana(loadSurfaceNProject(), ['DoorReroll']);
    const hub = { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' } as const;
    const inserted = applyProjectCommand(base, catalog, {
      kind: 'InsertHubReroll',
      hub,
      hubSlotKey: 'combat05',
      reward: { rewardType: 'MaxHealthDrop' },
      index: 0,
    });
    const reroll = createHubRerollAddress(n, 'hub', 'r1');
    const reward = firstSupported(inserted, reroll, 'HubRewards');
    const project = applyProjectCommand(inserted, catalog, {
      kind: 'ReplaceHubRerollReward',
      reroll,
      reward,
    });
    const assembly = evaluate(project);
    expect(rerollSettlementForProjectEvaluationAssembly(assembly, reroll)).toMatchObject({
      reward,
      poolRemainingAfter: 2,
    });
    expect(
      assembly.evaluation.findings.filter((finding) => finding.origin.kind === 'hubReroll'),
    ).toEqual([]);

    const hubDecision = project.route.biomes[0]!.topology!.decisions.find(
      (decision) => decision.kind === 'hub',
    )!;
    const late = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHubActionOrder',
      hub,
      actions:
        hubDecision.kind === 'hub'
          ? [...hubDecision.actions.slice(1), hubDecision.actions[0]!]
          : [],
    });
    expect(
      evaluate(late)
        .evaluation.findings.filter((finding) => finding.origin.kind === 'hubReroll')
        .map((finding) => [finding.code, finding.evidence.reason]),
    ).toEqual([['rerollTargetUnavailable', 'afterHubVisit']]);
  });
});

describe('ship wheel rerolls', () => {
  it('redraws an offer before the wheel is used', () => {
    // N's Judgment grants two more cards mid-run, each adding its full count to the pool.
    const base = applyProjectCommand(
      surfaceWithArcana(loadSurfaceNOCheckpoint(), ['DoorReroll']),
      catalog,
      {
        kind: 'ReplaceJudgmentArcana',
        judgment: {
          kind: 'judgmentArcana',
          routeKey: 'Surface',
          biomeKey: 'N',
          occurrenceId: 'surface-n-preboss:boss' as never,
          phaseKey: 'Encounter',
        },
        arcanaKeys: ['ScreenReroll', 'TradeOff', 'StartingGold', 'HealthRegen', 'BonusDodge'],
      },
    );
    const ship = base.route.biomes[1]!.topology!.occurrences.find(
      (room) => room.occurrenceId === 'surface-o-combat04',
    )!;
    const useIndex = ship.roomActions.order.findIndex(
      (reference) => reference.kind === 'chooseRewardWheel',
    );
    const inserted = applyProjectCommand(base, catalog, {
      kind: 'InsertReroll',
      occurrence: createOccurrenceAddress(o, ship.occurrenceId),
      target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
      reward: { rewardType: 'MaxManaDrop' },
      index: useIndex,
    });
    const reroll = createRoomActionAddress(o, ship.occurrenceId, JSON.stringify(['reroll', 'r1']));
    const reward = firstSupported(inserted, reroll, 'RunProgress');
    const project = applyProjectCommand(inserted, catalog, {
      kind: 'ReplaceRerollReward',
      action: reroll,
      reward,
    });
    const assembly = evaluate(project);
    expect(rerollSettlementForProjectEvaluationAssembly(assembly, reroll)).toMatchObject({
      reward,
      // Door 3, Screen 3 and the Fates 4 at Epic, less this press.
      poolRemainingAfter: 9,
    });
    expect(
      assembly.evaluation.findings.filter(
        (finding) =>
          semanticAddressKey(finding.origin) === semanticAddressKey(reroll) ||
          finding.code === 'rerolledRewardMismatch',
      ),
    ).toEqual([]);
  });
});

describe('screen rerolls', () => {
  it('spend k(k+1)/2 from the pool while screen rerolls are enabled', () => {
    const project = withArcana(loadUnderworldFGCheckpoint(), ['ScreenReroll']);
    const zeus = occurrence(project, source);
    const trait =
      zeus.state.kind === 'counted' ? zeus.state.reward?.traitOffersByAcquisitionRole : undefined;
    const [role, offer] = Object.entries(trait ?? {})[0]!;
    if (offer === null || offer === undefined || offer.kind === 'fallbackGold')
      throw new Error('fixture lacks an authored Zeus screen');
    const address = {
      kind: 'traitOffer',
      routeKey: 'Underworld',
      biomeKey: 'F',
      owner: createIncomingRewardAddress(f, source as never),
      acquisitionRole: role,
    } as const;
    const twice = settle(project, {
      kind: 'ReplaceTraitOffer',
      trait: address,
      value: { ...offer, rerollCount: 2 },
    });
    expect(rerollFindings(twice)).toEqual([]);
    expect(() =>
      settle(twice, {
        kind: 'ReplaceTraitOffer',
        trait: address,
        value: { ...offer, rerollCount: 3 },
      }),
    ).toThrow('the reroll pool has nothing left for this spend');
    const disabled = settle(twice, {
      kind: 'ReplaceManualArcanaSelection',
      route: { kind: 'route', routeKey: 'Underworld' },
      arcanaKeys: [],
    });
    expect(evaluate(disabled).evaluation.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['screenRerollUnavailable', 'rerollPoolExceeded']),
    );
  });
});

describe('reroll pool', () => {
  it('counts held cards, mid-run grants and upgrades, and keeps Barren to enablement', () => {
    const loadout = {
      manualArcanaKeys: ['DoorReroll'],
      fearRanks: loadUnderworldFGCheckpoint().route.loadout.fearRanks,
    };
    const state = (arcanaFear: ReturnType<typeof createArcanaFearState>) => ({
      arcanaFear,
      traitHistory: {},
    });
    const start = createArcanaFearState(catalog, loadout);
    expect(rerollPoolRemaining(state(start))).toBe(3);
    const evidence = { owner: createOccurrenceAddress(f, source as never), sequence: 1 };
    const granted = activateTemporaryArcana(catalog, start, ['ScreenReroll'], evidence);
    if (!granted.legal) throw new Error('grant refused');
    expect(rerollPoolRemaining(state(granted.state))).toBe(6);
    const promoted = promoteArcana(catalog, granted.state, ['DoorReroll'], {
      ...evidence,
      sequence: 2,
    });
    if (!promoted.legal) throw new Error('promotion refused');
    // Epic to Heroic adds only the difference.
    expect(rerollPoolRemaining(state(promoted.state))).toBe(7);
    const barren = reconcileBarrenArcana(promoted.state, false, true);
    expect(rerollKindEnabled(catalog, barren, 'doors')).toBe(false);
    expect(rerollPoolRemaining(state(barren))).toBe(7);
    expect(rerollKindEnabled(catalog, reconcileBarrenArcana(barren, true, false), 'doors')).toBe(
      true,
    );
  });
});

describe('reroll codec', () => {
  it('decodes rerolls and screen counts strictly', () => {
    const encoded = JSON.parse(encodeProjectDocument(loadUnderworldFGCheckpoint())) as {
      route: { biomes: { topology: { occurrences: Record<string, unknown>[] } }[] };
    };
    const decodeWith = (edit: (room: Record<string, unknown>) => void) => {
      const copy = structuredClone(encoded);
      edit(
        copy.route.biomes[0]!.topology.occurrences.find((room) => room.occurrenceId === source)!,
      );
      return () => decodeProjectDocument(copy as never, catalog);
    };
    const reroll = (rerollId: string) => ({
      kind: 'reroll',
      rerollId,
      target: { kind: 'door', exitKey: 'exit2', occurrenceId: otherTarget },
      reward: { rewardType: 'RoomMoneyDrop' },
    });
    const withOrder =
      (...actions: unknown[]) =>
      (room: Record<string, unknown>) => {
        const order = (room.roomActions as { order: unknown[] }).order;
        order.push(...actions);
      };
    expect(decodeWith(withOrder(reroll('r1'), reroll('r2')))).not.toThrow();
    expect(decodeWith(withOrder(reroll('first')))).toThrow('must be a reroll id');
    expect(decodeWith(withOrder(reroll('r1'), reroll('r1')))).toThrow('duplicates room action');
    expect(
      decodeWith(
        withOrder({
          kind: 'reroll',
          rerollId: 'r1',
          target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
          reward: { rewardType: 'RoomMoneyDrop' },
        }),
      ),
    ).toThrow('names no wheel offer of this room');
    const withCount = (count: number) => (room: Record<string, unknown>) => {
      const reward = (room.state as { reward: { traitOffersByAcquisitionRole: object } }).reward;
      for (const offer of Object.values(reward.traitOffersByAcquisitionRole))
        (offer as Record<string, unknown>).rerollCount = count;
    };
    expect(decodeWith(withCount(2))).not.toThrow();
    expect(decodeWith(withCount(0))).toThrow('rerollCount');
  });
});
