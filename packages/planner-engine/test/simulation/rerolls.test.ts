import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createHubRerollAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type BiomeAddress,
  type ProjectCommand,
  type ProjectDocument,
  type RerollRoomAction,
  type RerollTarget,
} from '@run-planner/engine/authored-project';
import {
  rerollSettlementForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  loadNemesisFieldsCheckpoint,
  loadUnderworldFGCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNOCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import {
  firstSupportedReroll,
  supportedRerollRewards,
  withArcana,
  withGoldenUnderworldJudgments,
  withJudgment,
} from '../support/rerolls';

const f = createBiomeAddress('Underworld', 'F');
const source = 'golden-f-b2-e1';
const pickedTarget = 'golden-f-b3-e1';
const otherTarget = 'golden-f-b3-e2';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate }).assembly.project;

function occurrence(project: ProjectDocument, id: string, biomeIndex = 0) {
  return project.route.biomes[biomeIndex]!.topology!.occurrences.find(
    (room) => room.occurrenceId === id,
  )!;
}

function rerolls(project: ProjectDocument, from = source): readonly RerollRoomAction[] {
  return occurrence(project, from).roomActions.order.flatMap((reference) =>
    reference.kind === 'reroll' ? [reference] : [],
  );
}

/** Appends a press to a room's action order, after its doors unlock. */
function insertReroll(
  project: ProjectDocument,
  target: RerollTarget,
  reward: ResolvedRewardOffer = { rewardType: 'RoomMoneyDrop' },
  from = source,
  biome: BiomeAddress = f,
  biomeIndex = 0,
): ProjectCommand {
  return {
    kind: 'InsertReroll',
    occurrence: createOccurrenceAddress(biome, from as never),
    target,
    reward,
    index: occurrence(project, from, biomeIndex).roomActions.order.length,
  };
}

const door = (exitKey: string, occurrenceId: string): RerollTarget => ({
  kind: 'door',
  exitKey,
  occurrenceId: occurrenceId as never,
});

/** The door of a room's exit decision into its authored target. */
function doorOf(project: ProjectDocument, from: string, exitKey: string): RerollTarget {
  const decision = project.route.biomes[0]!.topology!.decisions.find(
    (candidate) =>
      candidate.kind === 'exit' &&
      candidate.source.kind === 'occurrence' &&
      candidate.source.occurrenceId === from,
  );
  const target =
    decision?.kind === 'exit'
      ? decision.normal.targets.find((candidate) => candidate.exitKey === exitKey)
      : undefined;
  if (target === undefined) throw new Error(`${from} has no ${exitKey}`);
  return door(exitKey, target.occurrenceId);
}

const pressAt = (rerollId: string, from = source, biome: BiomeAddress = f) =>
  createRoomActionAddress(biome, from as never, JSON.stringify(['reroll', rerollId]));

/** Findings on reroll presses or on the owners they redraw. */
function rerollFindings(project: ProjectDocument) {
  return evaluate(project).evaluation.findings.filter(
    (finding) =>
      finding.origin.kind === 'roomAction' ||
      finding.origin.kind === 'hubReroll' ||
      finding.code.startsWith('reroll') ||
      finding.code === 'rerolledRewardMismatch',
  );
}

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
] as const;

function supportedTypes(
  project: ProjectDocument,
  reroll: ReturnType<typeof pressAt>,
): ReadonlySet<string> {
  return new Set(
    supportedRerollRewards(project, reroll, ROOM_REWARDS).map((offer) => offer.rewardType),
  );
}

/** Applies a press and gives it the first reward the candidate session accepts. */
function press(
  project: ProjectDocument,
  target: RerollTarget,
  from = source,
  biome: BiomeAddress = f,
  biomeIndex = 0,
): ProjectDocument {
  const inserted = applyProjectCommand(
    project,
    catalog,
    insertReroll(project, target, undefined, from, biome, biomeIndex),
  );
  const pressed = rerolls(inserted, from).at(-1)!;
  if (biomeIndex !== 0) {
    // Only the first biome's rooms are read by `rerolls`; a later one names its own press.
  }
  return applyProjectCommand(inserted, catalog, {
    kind: 'ReplaceRerollReward',
    action: pressAt(pressed.rerollId, from, biome),
    reward: firstSupportedReroll(inserted, pressAt(pressed.rerollId, from, biome), 'RunProgress'),
  });
}

/** The Run State snapshot at one room checkpoint. */
function snapshotAt(
  project: ProjectDocument,
  occurrenceId: string,
  checkpoint: 'roomEntered' | 'beforeRoomExit',
  biomeIndex = 0,
) {
  const biome = evaluate(project).evaluation.route.biomes[biomeIndex]!;
  if (!('rewards' in biome)) throw new Error('biome was not evaluated');
  const snapshot = biome.rewards.runStateSnapshots.find(
    (candidate) =>
      candidate.owner.kind === 'roomRunStateCheckpoint' &&
      candidate.owner.occurrenceId === occurrenceId &&
      candidate.owner.checkpoint.kind === checkpoint,
  );
  if (snapshot === undefined) throw new Error(`${occurrenceId} ${checkpoint} was not reached`);
  return snapshot;
}

function runProgress(snapshot: ReturnType<typeof snapshotAt>): readonly number[] {
  return snapshot.rewardStores.find((store) => store.storeKey === 'RunProgress')!
    .remainingEntryCounts;
}

describe('door rerolls', () => {
  it('keep the first draw and enter the reward of the last reroll', () => {
    // Holding the card auto-activates Judgment, whose Boss draw must then be authored.
    const base = withJudgment(
      withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']),
      'F',
      'golden-f-preboss-shop:boss',
      ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    );
    const first = settle(
      base,
      insertReroll(base, door('exit1', pickedTarget), { rewardType: 'RoomMoneyDrop' }),
    );
    expect(rerolls(first).map((reroll) => reroll.rerollId)).toEqual(['r1']);
    const reward = firstSupportedReroll(first, pressAt('r1'), 'RunProgress');
    const project = settle(first, {
      kind: 'ReplaceRerollReward',
      action: pressAt('r1'),
      reward,
    });
    const target = occurrence(project, pickedTarget);
    expect(target.state.kind === 'counted' && target.state.reward?.offer).toEqual({
      rewardType: 'MaxHealthDrop',
    });
    expect(target.rerolledIncomingReward?.offer).toEqual(reward);
    expect(rerollFindings(project)).toEqual([]);
    expect(
      rerollSettlementForProjectEvaluationAssembly(evaluate(project), pressAt('r1')),
    ).toMatchObject({
      reward,
      poolRemainingAfter: 2,
      target: createIncomingRewardAddress(f, pickedTarget as never),
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('need a door-reroll card held when the doors unlock', () => {
    const plain = loadUnderworldFGCheckpoint();
    const unequipped = applyProjectCommand(
      plain,
      catalog,
      insertReroll(plain, door('exit2', otherTarget)),
    );
    expect(
      rerollFindings(unequipped).map((finding) => [finding.code, finding.evidence]),
    ).toContainEqual(['rerollUnavailable', { kind: 'doors' }]);
  });

  it('spend and report a press past the pool', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    for (let count = 0; count < 3; count += 1) project = press(project, door('exit2', otherTarget));
    expect(rerollFindings(project)).toEqual([]);
    expect(() => settle(project, insertReroll(project, door('exit2', otherTarget)))).toThrow(
      'the reroll pool has nothing left for this spend',
    );

    // A preserved over-spend still draws, so the timeline continues past it.
    const over = press(project, door('exit2', otherTarget));
    expect(rerollFindings(over).map((finding) => [finding.code, finding.evidence])).toEqual([
      ['rerollPoolExceeded', { cost: 1, remaining: 0 }],
    ]);
    const settled = rerollSettlementForProjectEvaluationAssembly(evaluate(over), pressAt('r4'));
    expect(settled?.poolRemainingAfter).toBe(-1);
    expect(occurrence(over, otherTarget).rerolledIncomingReward?.offer).toEqual(settled?.reward);

    // An upstream edit that empties the pool keeps the presses.
    const shrunk = settle(project, {
      kind: 'ReplaceManualArcanaSelection',
      route: { kind: 'route', routeKey: 'Underworld' },
      arcanaKeys: [],
    });
    expect(rerolls(shrunk)).toHaveLength(3);
  });
});

describe('reroll settlement', () => {
  const base = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);

  function rerolledTo(from: string, target: RerollTarget, rewardType: string): ProjectDocument {
    const inserted = applyProjectCommand(
      base,
      catalog,
      insertReroll(base, target, undefined, from),
    );
    const reward = supportedRerollRewards(inserted, pressAt('r1', from), [rewardType])[0];
    if (reward === undefined) throw new Error(`${rewardType} is not supported`);
    return applyProjectCommand(inserted, catalog, {
      kind: 'ReplaceRerollReward',
      action: pressAt('r1', from),
      reward,
    });
  }

  it('removes the redrawn reward from its store', () => {
    const from = 'golden-f-b6-e1';
    const before = runProgress(snapshotAt(base, from, 'beforeRoomExit'));
    const after = runProgress(
      snapshotAt(
        rerolledTo(from, doorOf(base, from, 'exit1'), 'RoomMoneyDrop'),
        from,
        'beforeRoomExit',
      ),
    );
    const store = catalog.rewards.stores.byKey.RunProgress!;
    const removed = after.flatMap((count, index) =>
      count === before[index]! - 1 ? [store.entries[index]!.rewardType] : [],
    );
    expect(removed).toEqual(['RoomMoneyDrop']);
    expect(after.reduce((sum, count) => sum + count, 0)).toBe(
      before.reduce((sum, count) => sum + count, 0) - 1,
    );
  });

  it('refills an exhausted store before the redraw', () => {
    const from = 'golden-f-b10-e1';
    const before = runProgress(snapshotAt(base, from, 'beforeRoomExit'));
    const after = runProgress(
      snapshotAt(
        rerolledTo(from, doorOf(base, from, 'exit2'), 'MaxHealthDrop'),
        from,
        'beforeRoomExit',
      ),
    );
    const store = catalog.rewards.stores.byKey.RunProgress!;
    expect(after.reduce((sum, count) => sum + count, 0)).toBe(
      before.reduce((sum, count) => sum + count, 0) + store.entries.length - 1,
    );
  });

  it('records the Devotion depth of a redrawn Devotion', () => {
    const from = 'golden-f-b7-e1';
    expect(snapshotAt(base, from, 'beforeRoomExit').counters.lastDevotionDepth).toBeUndefined();
    const project = rerolledTo(from, doorOf(base, from, 'exit1'), 'Devotion');
    expect(snapshotAt(project, from, 'beforeRoomExit').counters.lastDevotionDepth).toBe(
      snapshotAt(project, from, 'roomEntered').counters.runDepthCache,
    );
  });

  it("excludes the target's original and every door's current reward", () => {
    // exit1 first drew MaxHealthDrop and exit2 MaxManaDrop; one MaxManaDrop entry remains.
    const exit1 = door('exit1', pickedTarget);
    const exit2 = door('exit2', otherTarget);
    const plain = applyProjectCommand(base, catalog, insertReroll(base, exit1));
    const before = supportedTypes(plain, pressAt('r1'));
    expect(before.has('MaxHealthDrop')).toBe(false);
    expect(before.has('MaxManaDrop')).toBe(false);
    expect(before.has('RoomMoneyDrop')).toBe(true);

    const redrawn = rerolledTo(source, exit2, 'RoomMoneyDrop');
    const after = applyProjectCommand(redrawn, catalog, insertReroll(redrawn, exit1));
    const current = supportedTypes(after, pressAt('r2'));
    expect(current.has('MaxManaDrop')).toBe(true);
    expect(current.has('RoomMoneyDrop')).toBe(false);
    expect(current.has('MaxHealthDrop')).toBe(false);
  });
});

describe('rerolled reward repair', () => {
  const owner = createIncomingRewardAddress(f, otherTarget as never);

  function mismatched(project: ProjectDocument): ProjectDocument {
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      route: { biomes: { topology: { occurrences: Record<string, unknown>[] } }[] };
    };
    const room = encoded.route.biomes[0]!.topology.occurrences.find(
      (entry) => entry.occurrenceId === otherTarget,
    )!;
    (room.rerolledIncomingReward as { offer: unknown }).offer = { rewardType: 'MaxManaDrop' };
    return decodeProjectDocument(encoded as never, catalog);
  }

  it('reports a rerolled reward that does not match until it is adopted', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, door('exit2', otherTarget)),
    );
    expect(rerollFindings(project)).toEqual([]);
    const broken = mismatched(project);
    expect(
      rerollFindings(broken).map((finding) => [finding.code, semanticAddressKey(finding.origin)]),
    ).toEqual([['rerolledRewardMismatch', semanticAddressKey(owner)]]);
    expect(
      rerollFindings(applyProjectCommand(broken, catalog, { kind: 'AdoptRerolledReward', owner })),
    ).toEqual([]);
  });

  it('reports a rerolled reward that outlived its rerolls until it is dropped', () => {
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    project = applyProjectCommand(
      project,
      catalog,
      insertReroll(project, door('exit2', otherTarget), {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      }),
    );
    // An authored screen makes the rerolled reward more than its unresolved default.
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: {
        kind: 'traitOffer',
        routeKey: 'Underworld',
        biomeKey: 'F',
        owner,
        acquisitionRole: 'source',
      },
      value: {
        kind: 'traits',
        giverKey: 'Zeus',
        options: [
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' },
          { traitKey: 'ZeusSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    const dormant = applyProjectCommand(project, catalog, {
      kind: 'RemoveRoomAction',
      action: pressAt('r1'),
    });
    expect(rerolls(dormant)).toEqual([]);
    expect(rerollFindings(dormant).map((finding) => finding.code)).toEqual([
      'rerolledRewardMismatch',
    ]);
    expect(
      rerollFindings(applyProjectCommand(dormant, catalog, { kind: 'DropRerolledReward', owner })),
    ).toEqual([]);
  });
});

describe('Fields cage rerolls', () => {
  const h = createBiomeAddress('Underworld', 'H');
  const base = withGoldenUnderworldJudgments(
    withArcana(loadNemesisFieldsCheckpoint(), ['DoorReroll']),
  );
  const cage = (exitKey: string, occurrenceId: string, slotKey: string): RerollTarget => ({
    kind: 'cage',
    exitKey,
    occurrenceId: occurrenceId as never,
    slotKey,
  });

  it('redraw one cage of a door into a Fields room', () => {
    const from = 'golden-h-miniboss01';
    const target = 'golden-h-combat05';
    const inserted = applyProjectCommand(
      base,
      catalog,
      insertReroll(base, cage('exit1', target, 'cage1'), undefined, from, h, 2),
    );
    const reroll = pressAt('r1', from, h);
    const reward = firstSupportedReroll(inserted, reroll, 'RunProgress');
    const project = applyProjectCommand(inserted, catalog, {
      kind: 'ReplaceRerollReward',
      action: reroll,
      reward,
    });
    const room = occurrence(project, target, 2);
    expect(room.state.kind === 'fieldsCombat' && room.state.rerolledCages?.cage1?.offer).toEqual(
      reward,
    );
    expect(rerollSettlementForProjectEvaluationAssembly(evaluate(project), reroll)).toMatchObject({
      reward,
      target: createLocalRewardAddress(h, target as never, 'cages', 'cage1'),
    });
    expect(rerollFindings(project)).toEqual([]);
  });

  it("exclude the cage's original and its sibling cages' current rewards", () => {
    const from = 'golden-h-intro';
    // combat02's cage1 first drew MaxHealthDrop and cage2 MaxManaDrop.
    const inserted = applyProjectCommand(
      base,
      catalog,
      insertReroll(base, cage('exit1', 'golden-h-combat02', 'cage1'), undefined, from, h, 2),
    );
    const types = supportedTypes(inserted, pressAt('r1', from, h));
    expect(types.has('MaxHealthDrop')).toBe(false);
    expect(types.has('MaxManaDrop')).toBe(false);
    expect(types.has('RoomMoneyDrop')).toBe(true);
  });
});

describe('Hub board rerolls', () => {
  it('redraw a board door before the first visit and refuse one after it', () => {
    const n = createBiomeAddress('Surface', 'N');
    const base = withArcana(loadSurfaceNProject(), ['DoorReroll']);
    const hub = { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' } as const;
    const inserted = applyProjectCommand(base, catalog, {
      kind: 'InsertHubReroll',
      hub,
      hubSlotKey: 'combat05',
      reward: { rewardType: 'MaxHealthDrop' },
      index: 0,
    });
    const reroll = createHubRerollAddress(n, 'hub', 'r1');
    const reward = firstSupportedReroll(inserted, reroll, 'HubRewards');
    const project = applyProjectCommand(inserted, catalog, {
      kind: 'ReplaceHubRerollReward',
      reroll,
      reward,
    });
    expect(rerollSettlementForProjectEvaluationAssembly(evaluate(project), reroll)).toMatchObject({
      reward,
      poolRemainingAfter: 2,
    });
    expect(rerollFindings(project)).toEqual([]);

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
  it('redraw an offer before the wheel is used', () => {
    const o = createBiomeAddress('Surface', 'O');
    // N's Judgment grants two more cards mid-run, each adding its full count to the pool.
    const base = withJudgment(
      withArcana(loadSurfaceNOCheckpoint(), ['DoorReroll']),
      'N',
      'surface-n-preboss:boss',
      ['ScreenReroll', 'TradeOff', 'StartingGold', 'HealthRegen', 'BonusDodge'],
    );
    const ship = occurrence(base, 'surface-o-combat04', 1);
    const inserted = applyProjectCommand(base, catalog, {
      kind: 'InsertReroll',
      occurrence: createOccurrenceAddress(o, ship.occurrenceId),
      target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
      reward: { rewardType: 'MaxManaDrop' },
      index: ship.roomActions.order.findIndex(
        (reference) => reference.kind === 'chooseRewardWheel',
      ),
    });
    const reroll = pressAt('r1', ship.occurrenceId, o);
    const reward = firstSupportedReroll(inserted, reroll, 'RunProgress');
    const project = applyProjectCommand(inserted, catalog, {
      kind: 'ReplaceRerollReward',
      action: reroll,
      reward,
    });
    expect(rerollSettlementForProjectEvaluationAssembly(evaluate(project), reroll)).toMatchObject({
      reward,
      // Door 3, Screen 3 and the Fates 4 at Epic, less this press.
      poolRemainingAfter: 9,
    });
    expect(rerollFindings(project)).toEqual([]);
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

  it('refuse raising a count that already over-spends the pool', () => {
    const project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll', 'ScreenReroll']);
    const zeus = occurrence(project, source);
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
        owner: createIncomingRewardAddress(f, source as never),
        acquisitionRole: role,
      },
      value: { ...offer, rerollCount },
    });
    // Three rerolls cost 6, the whole pool of both cards.
    const thrice = settle(project, count(3));
    const shrunk = settle(thrice, {
      kind: 'ReplaceManualArcanaSelection',
      route: { kind: 'route', routeKey: 'Underworld' },
      arcanaKeys: ['ScreenReroll'],
    });
    expect(rerollFindings(shrunk).map((finding) => [finding.code, finding.evidence])).toEqual([
      ['rerollPoolExceeded', { cost: 6, remaining: 3 }],
    ]);
    expect(() => settle(shrunk, count(4))).toThrow(
      'the reroll pool has nothing left for this spend',
    );
    expect(rerollFindings(settle(shrunk, count(2)))).toEqual([]);
  });

  it('spend a Pom of Power screen count when it is acquired', () => {
    const pom = 'golden-f-b4-e1';
    const project = applyProjectCommand(
      withArcana(loadUnderworldFGCheckpoint(), ['ScreenReroll']),
      catalog,
      {
        kind: 'ReplaceLevelResolution',
        levelResolution: createLevelResolutionAddress(
          createIncomingRewardAddress(f, pom as never),
          'self',
        ),
        value: {
          kind: 'choice',
          offeredTraitKeys: ['ApolloWeaponBoon', 'ZeusSpecialBoon'],
          selectedTraitKey: 'ApolloWeaponBoon',
          rerollCount: 2,
        },
      },
    );
    expect(snapshotAt(project, pom, 'roomEntered').rerolls.remaining).toBe(3);
    expect(snapshotAt(project, pom, 'beforeRoomExit').rerolls.remaining).toBe(0);
    expect(rerollFindings(project)).toEqual([]);
  });

  it('spend Stygian Well and Purging Pool counts when they are opened', () => {
    const postboss = 'golden-f-preboss-shop:postboss';
    const room = createOccurrenceAddress(f, postboss as never);
    // The F Judgment grants the screen card at the Boss, before the Well and the Pool.
    let project = withJudgment(
      withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
      'F',
      'golden-f-preboss-shop:boss',
      ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    );
    const entered = snapshotAt(project, postboss, 'roomEntered');
    expect(entered.rerolls.screensEnabled).toBe(true);
    project = settle(project, { kind: 'SetStygianWellRerollCount', occurrence: room, count: 2 });
    expect(snapshotAt(project, postboss, 'beforeRoomExit').rerolls.remaining).toBe(
      entered.rerolls.remaining - 3,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPurgingPoolInteraction',
      occurrence: room,
      interacted: true,
    });
    project = settle(project, { kind: 'SetPurgingPoolRerollCount', occurrence: room, count: 1 });
    expect(snapshotAt(project, postboss, 'beforeRoomExit').rerolls.remaining).toBe(
      entered.rerolls.remaining - 4,
    );
    expect(rerollFindings(project)).toEqual([]);
  });
});
