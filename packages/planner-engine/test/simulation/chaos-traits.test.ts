import { ordinaryPositionFor } from '../support/route-position';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  advanceChaosClock,
  boonRarityFactsForOffer,
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  recordReachedTraitOffer,
  attachTraitHistory,
  traitCandidates,
} from '../../src/simulation/traits';
import { simulateProject } from '../../src/simulation';
import { evaluateCallingCardOffer } from '../../src/simulation/keepsakes/reward-effects';
import { createKeepsakeState } from '../../src/simulation/keepsakes/state';
import { boonRarityRollUnavailable } from '../../src/simulation/traits/rarity';
import { createTestArcanaFearState } from '../support/arcana-fear';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { assessArtificerConversion } from '../../src/simulation/rewards/acquisition/conversions';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { applyStygianWellPurchase } from '../../src/simulation/commerce/stygian-well';
import type {
  AuthoredChaosTraitOffer,
  AuthoredTraitOfferTraits,
} from '../../src/authored-project/traits/state';
import { normalizeAuthoredChaosTraitOffer } from '../../src/authored-project/traits/state';
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer/capability';
import { evaluateBiomeRewardsAssemblyInternal } from '../../src/simulation/rewards/biome';
import { loadSurfaceNOPProject } from '@run-planner/test-fixtures/surface';
import { traitFrontierState } from '../support/simulation-state';

const owner = createBiomeAddress('Underworld', 'F');
const rewardOwner = createIncomingRewardAddress(owner, createOccurrenceId('chaos-test-reward'));

function chaos(
  curseKey = 'ChaosCommonCurse',
  blessingKey = 'ChaosElementalBlessing',
  rarity: AuthoredChaosTraitOffer['rarity'] = 'Common',
): AuthoredChaosTraitOffer {
  const curse = catalog.chaos.curses.byKey[curseKey];
  const blessing = catalog.chaos.blessings.byKey[blessingKey];
  if (curse === undefined || blessing === undefined)
    throw new Error(`unknown Chaos pair ${curseKey}/${blessingKey}`);
  return normalizeAuthoredChaosTraitOffer(catalog, {
    kind: 'chaos',
    giverKey: 'Chaos',
    curseOptions: [
      { curseKey, requirementCount: curse.duration.minimum },
      { curseKey, requirementCount: curse.duration.minimum },
      { curseKey, requirementCount: curse.duration.minimum },
    ],
    selectedOptionKey: 'option1',
    selectedCurseValues: Object.freeze(
      Object.fromEntries(curse.operands.map((operand) => [operand.key, operand.minimum])),
    ),
    blessingKey,
    rarity,
    blessingValues: Object.freeze(
      Object.fromEntries(
        blessing.operands.map((operand) => [
          operand.key,
          operand.byRarity?.[rarity]?.minimum ?? operand.minimum,
        ]),
      ),
    ),
  });
}

function pairHistory(offer: AuthoredChaosTraitOffer) {
  return foldTraitHistoryEvents(catalog, [
    Object.freeze({
      kind: 'chaosPair' as const,
      owner: rewardOwner,
      acquisitionRole: 'self',
      sequence: 1,
      acquisitionPoint: 'reward',
      acquisitionIdentity: 'chaos:1',
      offer,
    }),
  ]);
}

function historyWithMaturedCreation() {
  return [2, 3, 4].reduce(
    (history, sequence) => advanceChaosClock(catalog, history, sequence, 'encounters'),
    pairHistory(chaos('ChaosNoMoneyCurse', 'ChaosElementalBlessing', 'Common')),
  );
}

function historyWithActiveBarren() {
  const before = historyWithMaturedCreation();
  return foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'chaosPair' as const,
      owner,
      acquisitionRole: 'self',
      sequence: 5,
      acquisitionPoint: 'reward',
      acquisitionIdentity: 'chaos:barren',
      offer: chaos('ChaosMetaUpgradeCurse', 'ChaosElementalBlessing', 'Heroic'),
    }),
  ]);
}

function branchWithHistory(history: ReturnType<typeof createTraitHistoryState>) {
  const base = initializeTestRewardBranches()[0]!;
  return Object.freeze({
    ...base,
    state: Object.freeze({
      ...base.state,
      rewardHistory: attachTraitHistory(base.state.rewardHistory, history),
      traitHistory: history,
    }),
  });
}

function rankedNpcGodOffer(giverKey: 'Artemis' | 'Athena' | 'Dionysus') {
  const options =
    giverKey === 'Artemis'
      ? [
          { traitKey: 'SupportingFireBoon', rarity: 'Common' as const },
          { traitKey: 'CritBonusBoon', rarity: 'Common' as const },
          { traitKey: 'DashOmegaBuffBoon', rarity: 'Common' as const },
        ]
      : giverKey === 'Athena'
        ? [
            { traitKey: 'InvulnerabilityDashBoon', rarity: 'Common' as const },
            { traitKey: 'RetaliateInvulnerabilityBoon', rarity: 'Common' as const },
            { traitKey: 'FocusLastStandBoon', rarity: 'Common' as const },
          ]
        : [
            { traitKey: 'HiddenMaxHealthBoon', rarity: 'Common' as const },
            { traitKey: 'FirstHangoverBoon', rarity: 'Common' as const },
            { traitKey: 'CombatEncounterHealBoon', rarity: 'Common' as const },
          ];
  return Object.freeze({
    kind: 'traits' as const,
    giverKey,
    selectedOptionKey: 'option1' as const,
    rarificationActions: Object.freeze([]),
    options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
  });
}

function acquireLegalTrait(
  before: ReturnType<typeof createTraitHistoryState>,
  giverKey: string,
  traitKey: string,
  rarity: AuthoredTraitOfferTraits['options'][number]['rarity'],
) {
  const selected = traitCandidates(catalog, giverKey, traitFrontierState(before), {}).find(
    (candidate) =>
      candidate.available && candidate.traitKey === traitKey && candidate.rarity === rarity,
  );
  const alternatives = traitCandidates(catalog, giverKey, traitFrontierState(before), {}).filter(
    (candidate) => candidate.available && candidate.traitKey !== traitKey,
  );
  const first = alternatives[0];
  const second = alternatives.find((candidate) => candidate.traitKey !== first?.traitKey);
  if (selected === undefined || first === undefined || second === undefined)
    throw new Error(`Missing legal ${giverKey}/${traitKey}/${rarity ?? 'untyped'} offer`);
  const sequence = before.events.length + 1;
  const evaluation = evaluateReachedTraitOffer(
    catalog,
    rewardOwner,
    `proper-${sequence}`,
    Object.freeze({
      kind: 'traits' as const,
      giverKey,
      options: Object.freeze([
        Object.freeze({ traitKey: selected.traitKey, rarity: selected.rarity }),
        Object.freeze({ traitKey: first.traitKey, rarity: first.rarity }),
        Object.freeze({ traitKey: second.traitKey, rarity: second.rarity }),
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
      rarificationActions: Object.freeze([]),
    }),
    traitFrontierState(before),
    {},
    sequence,
  );
  const applied = recordReachedTraitOffer(catalog, evaluation, sequence, 'test');
  if (applied.event === undefined) throw new Error(`Illegal ${giverKey}/${traitKey} acquisition`);
  return applied.history;
}

function historyWithActiveProper() {
  let history = createTraitHistoryState();
  for (const [giverKey, traitKey] of [
    ['Apollo', 'ApolloWeaponBoon'],
    ['Hermes', 'HermesWeaponBoon'],
    ['Hermes', 'HermesSpecialBoon'],
    ['Hermes', 'DodgeChanceBoon'],
    ['Hermes', 'SprintShieldBoon'],
    ['Hermes', 'RestockBoon'],
    ['Poseidon', 'DoubleRewardBoon'],
    ['Poseidon', 'FocusDamageShaveBoon'],
    ['Poseidon', 'ElementalHealthBoon'],
  ] as const)
    history = acquireLegalTrait(history, giverKey, traitKey, 'Common');
  return acquireLegalTrait(history, 'Hera', 'ElementalRarityUpgradeBoon', 'Common');
}

function historyWithInactiveProper() {
  let history = createTraitHistoryState();
  for (const [giverKey, traitKey] of [
    ['Hera', 'HeraWeaponBoon'],
    ['Hera', 'HeraCastBoon'],
    ['Hera', 'HeraSprintBoon'],
    ['Hera', 'HeraManaBoon'],
  ] as const)
    history = acquireLegalTrait(history, giverKey, traitKey, 'Common');
  return acquireLegalTrait(history, 'Hera', 'ElementalRarityUpgradeBoon', 'Common');
}

describe('Chaos paired-trait history', () => {
  it.each(['Underworld', 'Surface', 'Dream'])(
    'keeps Discovery selected and candidate eligibility aligned for %s',
    (routeKey) => {
      const biomeKey = routeKey === 'Surface' ? 'N' : 'G';
      const address = createTraitOfferAddress(
        createIncomingRewardAddress(
          createBiomeAddress(routeKey, biomeKey),
          createOccurrenceId('discovery-route'),
        ),
        'self',
      );
      const capability = createTraitOfferCandidateArtifacts(
        catalog,
        new Map([
          [
            semanticAddressKey(address),
            [{ state: traitFrontierState(undefined, { routeKey, biomeKey }), source: {} }],
          ],
        ]),
      ).at(address)!;
      const offer = chaos('ChaosCommonCurse', 'ChaosHarvestBlessing');
      expect(
        evaluateReachedTraitOffer(
          catalog,
          address,
          'self',
          offer,
          traitFrontierState(createTraitHistoryState(), { routeKey, biomeKey }),
          {},
          0,
        ).composition.legal,
      ).toBe(routeKey !== 'Dream');
      expect(
        capability.chaosOfferDomain()[0]?.availableBlessingKeys.includes('ChaosHarvestBlessing'),
      ).toBe(routeKey !== 'Dream');
    },
  );
  it('rechecks active Proper when Ordinary expires after its final affected settled screen', () => {
    const activeProper = historyWithActiveProper();
    expect(activeProper.properUpbringingActive).toBe(true);
    const ordinarySequence = activeProper.events.length + 1;
    const ordinary = settleEncounterTraitOffer(
      catalog,
      branchWithHistory(activeProper),
      rewardOwner,
      chaos('ChaosCommonCurse', 'ChaosWeaponBlessing'),
      ordinarySequence,
      'reward',
      undefined,
      'self',
    );
    const first = settleEncounterTraitOffer(
      catalog,
      ordinary.branch,
      rewardOwner,
      Object.freeze({
        kind: 'traits' as const,
        giverKey: 'Zeus',
        selectedOptionKey: 'option1' as const,
        rarificationActions: Object.freeze([]),
        options: Object.freeze([
          { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' },
          { traitKey: 'ZeusSprintBoon', rarity: 'Common' },
        ]) as AuthoredTraitOfferTraits['options'],
      }),
      ordinarySequence + 1,
      'reward',
      undefined,
      'self',
    );
    expect(first.branch.state.traitHistory?.equippedTraits.ZeusSpecialBoon?.rarity).toBe('Common');
    expect(first.branch.state.traitHistory?.activeChaosCurses).toMatchObject([
      { semanticTag: 'Ordinary', remaining: 1 },
    ]);
    const expired = settleEncounterTraitOffer(
      catalog,
      first.branch,
      rewardOwner,
      Object.freeze({
        kind: 'traits' as const,
        giverKey: 'Hermes',
        selectedOptionKey: 'option1' as const,
        rarificationActions: Object.freeze([]),
        options: Object.freeze([
          { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
          { traitKey: 'SorcerySpeedBoon', rarity: 'Common' },
          { traitKey: 'SlowProjectileBoon', rarity: 'Common' },
        ]) as AuthoredTraitOfferTraits['options'],
      }),
      ordinarySequence + 2,
      'reward',
      undefined,
      'self',
    );
    expect(expired.branch.state.traitHistory?.activeChaosCurses).toEqual([]);
    expect(expired.branch.state.traitHistory?.equippedTraits.ZeusSpecialBoon?.rarity).toBe('Rare');
    expect(expired.branch.state.traitHistory?.equippedTraits.HermesCastDiscountBoon?.rarity).toBe(
      'Rare',
    );
    expect(expired.branch.state.traitHistory?.equippedTraits.ElementalHealthBoon?.rarity).toBe(
      'Common',
    );
    expect(
      expired.branch.state.traitHistory?.events.find(
        (event) =>
          event.kind === 'traitOffer' &&
          event.giverKey === 'Hermes' &&
          event.options[0]?.traitKey === 'HermesCastDiscountBoon',
      ),
    ).toMatchObject({
      options: [
        expect.objectContaining({ traitKey: 'HermesCastDiscountBoon', rarity: 'Common' }),
        expect.anything(),
        expect.anything(),
      ],
    });
  });

  it('does not promote Common traits when Ordinary expires while Proper is inactive', () => {
    const inactiveProper = historyWithInactiveProper();
    expect(inactiveProper.properUpbringingActive).toBeUndefined();
    const curseSequence = inactiveProper.events.length + 1;
    const cursed = recordReachedTraitOffer(
      catalog,
      evaluateReachedTraitOffer(
        catalog,
        rewardOwner,
        'inactive-ordinary',
        chaos('ChaosCommonCurse', 'ChaosWeaponBlessing'),
        traitFrontierState(inactiveProper),
        {},
        curseSequence,
      ),
      curseSequence,
      'test',
    ).history;
    const traitSequence = curseSequence + 1;
    const withCommon = recordReachedTraitOffer(
      catalog,
      evaluateReachedTraitOffer(
        catalog,
        rewardOwner,
        'inactive-common',
        Object.freeze({
          kind: 'traits' as const,
          giverKey: 'Hermes',
          selectedOptionKey: 'option1' as const,
          rarificationActions: Object.freeze([]),
          options: Object.freeze([
            { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
            { traitKey: 'SorcerySpeedBoon', rarity: 'Common' },
            { traitKey: 'SlowProjectileBoon', rarity: 'Common' },
          ]) as AuthoredTraitOfferTraits['options'],
        }),
        traitFrontierState(cursed),
        {},
        traitSequence,
      ),
      traitSequence,
      'test',
    ).history;
    const firstClock = advanceChaosClock(catalog, withCommon, traitSequence, 'godBoonScreens');
    const expired = advanceChaosClock(catalog, firstClock, traitSequence + 1, 'godBoonScreens');
    expect(expired.activeChaosCurses).toEqual([]);
    expect(expired.properUpbringingActive).toBeUndefined();
    expect(expired.equippedTraits.HermesCastDiscountBoon?.rarity).toBe('Common');
  });

  it('bans only distinct unselected curses under Denial and blocks those curses later', () => {
    const offer = Object.freeze({
      ...chaos('ChaosNoMoneyCurse'),
      curseOptions: Object.freeze([
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
        { curseKey: 'ChaosHealthCurse', requirementCount: 3 },
      ]) as AuthoredChaosTraitOffer['curseOptions'],
    });
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      rewardOwner,
      'self',
      offer,
      traitFrontierState(createTraitHistoryState(), {
        arcanaFear: createTestArcanaFearState({ BanUnpickedBoonsShrineUpgrade: 1 }),
      }),
      {},
      1,
    );
    const settled = recordReachedTraitOffer(catalog, evaluation, 1, 'reward');
    expect(evaluation.composition.legal).toBe(true);
    expect(settled.history.events.at(-1)).toMatchObject({
      kind: 'chaosPair',
      bannedCurseKeys: ['ChaosHealthCurse'],
    });
    expect(settled.history.bannedTraitKeys).toEqual(['ChaosHealthCurse']);
    const later = Object.freeze({
      ...offer,
      curseOptions: Object.freeze([
        { curseKey: 'ChaosHealthCurse', requirementCount: 3 },
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
      ]) as AuthoredChaosTraitOffer['curseOptions'],
    });
    expect(
      evaluateReachedTraitOffer(
        catalog,
        rewardOwner,
        'self',
        later,
        traitFrontierState(settled.history),
        {},
        2,
      ).composition.legal,
    ).toBe(false);
  });

  it('rejects an authored Chaos offer when an unselected curse is unavailable at the same frontier', () => {
    const offer = Object.freeze({
      ...chaos('ChaosNoMoneyCurse'),
      curseOptions: Object.freeze([
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
        { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
      ]) as AuthoredChaosTraitOffer['curseOptions'],
    });
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      rewardOwner,
      'self',
      offer,
      traitFrontierState(createTraitHistoryState(), {
        arcanaFear: createTestArcanaFearState({ BanUnpickedBoonsShrineUpgrade: 1 }),
      }),
      {},
      1,
    );
    expect(evaluation.composition.legal).toBe(false);
    const settled = recordReachedTraitOffer(catalog, evaluation, 1, 'reward');
    expect(settled.history).toBe(evaluation.state.traitHistory);
  });

  it('rejects an authored Chaos offer when a peer curse was already banned by Denial', () => {
    const before = foldTraitHistoryEvents(catalog, [
      Object.freeze({
        kind: 'chaosPair' as const,
        owner: rewardOwner,
        acquisitionRole: 'self',
        sequence: 1,
        acquisitionPoint: 'reward',
        acquisitionIdentity: 'chaos:prior',
        offer: chaos('ChaosNoMoneyCurse'),
        bannedCurseKeys: ['ChaosHealthCurse'],
      }),
    ]);
    const offer = Object.freeze({
      ...chaos('ChaosNoMoneyCurse'),
      curseOptions: Object.freeze([
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
        { curseKey: 'ChaosHealthCurse', requirementCount: 3 },
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
      ]) as AuthoredChaosTraitOffer['curseOptions'],
    });
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      rewardOwner,
      'self',
      offer,
      traitFrontierState(before),
      {},
      2,
    );
    expect(evaluation.composition.legal).toBe(false);
    expect(recordReachedTraitOffer(catalog, evaluation, 2, 'reward').history).toBe(before);
  });

  it('closes blessing numeric values against the selected rarity, not the cross-rarity union', () => {
    expect(() =>
      normalizeAuthoredChaosTraitOffer(
        catalog,
        Object.freeze({
          ...chaos('ChaosNoMoneyCurse', 'ChaosWeaponBlessing', 'Common'),
          blessingValues: Object.freeze({ damageBonus: 0.75 }),
        }),
      ),
    ).toThrow('outside its declared domain');
    expect(
      normalizeAuthoredChaosTraitOffer(
        catalog,
        Object.freeze({
          ...chaos('ChaosNoMoneyCurse', 'ChaosWeaponBlessing', 'Rare'),
          blessingValues: Object.freeze({ damageBonus: 0.75 }),
        }),
      ).blessingValues.damageBonus,
    ).toBe(0.75);
  });
  it('keeps the blessing pending until its exact clock matures, then stacks Creation elements', () => {
    const pending = pairHistory(chaos());
    expect(pending.activeChaosCurses).toHaveLength(1);
    expect(pending.maturedChaosBlessings).toHaveLength(0);
    const one = advanceChaosClock(catalog, pending, 2, 'godBoonScreens');
    expect(one.activeChaosCurses[0]?.remaining).toBe(1);
    const mature = advanceChaosClock(catalog, one, 3, 'godBoonScreens');
    expect(mature.activeChaosCurses).toHaveLength(0);
    expect(mature.maturedChaosBlessings).toHaveLength(1);
    expect(mature.elementCounts).toMatchObject({ Aether: 1, Earth: 1, Air: 1, Fire: 1, Water: 1 });
  });

  it('permits repeated overlapping instances and folds Favor only after maturation', () => {
    const favor = Object.freeze({
      ...chaos('ChaosNoMoneyCurse', 'ChaosRarityBlessing', 'Rare'),
      blessingValues: Object.freeze({ rareBonus: 0.54 }),
    });
    const first = pairHistory(favor);
    const second = foldTraitHistoryEvents(catalog, [
      ...first.events,
      Object.freeze({
        kind: 'chaosPair' as const,
        owner,
        acquisitionRole: 'self',
        sequence: 2,
        acquisitionPoint: 'reward',
        acquisitionIdentity: 'chaos:2',
        offer: favor,
      }),
    ]);
    expect(second.activeChaosCurses).toHaveLength(2);
    const mature = [3, 4, 5].reduce(
      (history, sequence) => advanceChaosClock(catalog, history, sequence, 'encounters'),
      second,
    );
    expect(mature.maturedChaosBlessings).toHaveLength(2);
    expect(
      boonRarityFactsForOffer(catalog, traitFrontierState(mature), { resolvedProviderKey: 'Zeus' })
        ?.contributions,
    ).toHaveLength(2);
  });

  it('uses the three declared clocks independently and treats Expiring as encounter-counted', () => {
    const history = foldTraitHistoryEvents(catalog, [
      ...pairHistory(chaos('ChaosHiddenRoomRewardCurse')).events,
      Object.freeze({
        kind: 'chaosPair' as const,
        owner,
        acquisitionRole: 'self',
        sequence: 2,
        acquisitionPoint: 'reward',
        acquisitionIdentity: 'chaos:expiring',
        offer: Object.freeze({
          ...chaos('ChaosTimeCurse'),
          curseOptions: Object.freeze([
            { curseKey: 'ChaosTimeCurse', requirementCount: 2 },
            { curseKey: 'ChaosTimeCurse', requirementCount: 2 },
            { curseKey: 'ChaosTimeCurse', requirementCount: 2 },
          ]) as AuthoredChaosTraitOffer['curseOptions'],
        }),
      }),
    ]);
    const encounter = advanceChaosClock(catalog, history, 3, 'encounters');
    expect(encounter.activeChaosCurses).toMatchObject([
      { curseKey: 'ChaosHiddenRoomRewardCurse', remaining: 4 },
      { curseKey: 'ChaosTimeCurse', remaining: 1 },
    ]);
    const exited = advanceChaosClock(catalog, encounter, 4, 'locations');
    expect(exited.activeChaosCurses).toMatchObject([
      { curseKey: 'ChaosHiddenRoomRewardCurse', remaining: 3 },
      { curseKey: 'ChaosTimeCurse', remaining: 1 },
    ]);
    expect(advanceChaosClock(catalog, exited, 5, 'godBoonScreens')).toBe(exited);
  });

  it('derives Favor feasibility only after maturation, including stacking and the exact guarantee threshold', () => {
    const pending = pairHistory(
      Object.freeze({
        ...chaos('ChaosNoMoneyCurse', 'ChaosRarityBlessing', 'Rare'),
        blessingValues: Object.freeze({ rareBonus: 0.54 }),
      }),
    );
    const before = boonRarityFactsForOffer(catalog, traitFrontierState(pending), {
      resolvedProviderKey: 'Zeus',
    });
    if (before === undefined) throw new Error('Zeus must own a rarity ledger');
    expect(boonRarityRollUnavailable(before, 'Common', ['Common', 'Rare', 'Epic'])).toBe(false);
    const mature = [2, 3, 4].reduce(
      (history, sequence) => advanceChaosClock(catalog, history, sequence, 'encounters'),
      pending,
    );
    const after = boonRarityFactsForOffer(catalog, traitFrontierState(mature), {
      resolvedProviderKey: 'Zeus',
    });
    if (after === undefined) throw new Error('Zeus must own a rarity ledger');
    expect(boonRarityRollUnavailable(after, 'Common', ['Common', 'Rare', 'Epic'])).toBe(false);

    const guaranteed = foldTraitHistoryEvents(catalog, [
      ...mature.events,
      Object.freeze({
        kind: 'chaosPair' as const,
        owner,
        acquisitionRole: 'self',
        sequence: 5,
        acquisitionPoint: 'reward',
        acquisitionIdentity: 'chaos:favor-guarantee',
        offer: Object.freeze({
          ...chaos('ChaosNoMoneyCurse', 'ChaosRarityBlessing', 'Rare'),
          blessingValues: Object.freeze({ rareBonus: 0.54 }),
        }),
      }),
      Object.freeze({
        kind: 'chaosClock' as const,
        owner,
        acquisitionRole: 'chaosClock' as const,
        sequence: 6,
        clock: 'encounters' as const,
      }),
      Object.freeze({
        kind: 'chaosClock' as const,
        owner,
        acquisitionRole: 'chaosClock' as const,
        sequence: 7,
        clock: 'encounters' as const,
      }),
      Object.freeze({
        kind: 'chaosClock' as const,
        owner,
        acquisitionRole: 'chaosClock' as const,
        sequence: 8,
        clock: 'encounters' as const,
      }),
    ]);
    const guaranteedFacts = boonRarityFactsForOffer(catalog, traitFrontierState(guaranteed), {
      resolvedProviderKey: 'Zeus',
    });
    if (guaranteedFacts === undefined) throw new Error('Zeus must own a rarity ledger');
    expect(boonRarityRollUnavailable(guaranteedFacts, 'Common', ['Common', 'Rare', 'Epic'])).toBe(
      true,
    );
  });

  it('requires a mature Chaos blessing for Defiance and Barren but retains invalid pairs for repair', () => {
    const defiance = chaos('ChaosNoMoneyCurse', 'ChaosLastStandBlessing', 'Legendary');
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      rewardOwner,
      'self',
      defiance,
      traitFrontierState(createTraitHistoryState()),
      {},
      0,
    );
    expect(evaluation.composition.findings).toEqual([{ code: 'chaosPairUnavailable' }]);
    expect(recordReachedTraitOffer(catalog, evaluation, 1, 'reward').history).toBe(
      evaluation.state.traitHistory,
    );
    const mature = historyWithMaturedCreation();
    expect(
      evaluateReachedTraitOffer(
        catalog,
        rewardOwner,
        'self',
        defiance,
        traitFrontierState(mature),
        {},
        2,
      ).assessments,
    ).toEqual([{ legal: true, findings: [] }]);
    expect(
      evaluateReachedTraitOffer(
        catalog,
        rewardOwner,
        'self',
        chaos('ChaosMetaUpgradeCurse', 'ChaosElementalBlessing', 'Heroic'),
        traitFrontierState(mature),
        {},
        2,
      ).assessments,
    ).toEqual([{ legal: true, findings: [] }]);
  });

  it('excludes Atrophic while White Antler is held but retains the authored pair for repair', () => {
    const atrophic = chaos('ChaosHealthCurse', 'ChaosWeaponBlessing');
    const blocked = evaluateReachedTraitOffer(
      catalog,
      rewardOwner,
      'self',
      atrophic,
      traitFrontierState(createTraitHistoryState(), {
        startingKeepsakeKey: 'LowHealthCritKeepsake',
      }),
      {},
      0,
    );
    expect(blocked.composition.findings).toEqual([{ code: 'chaosPairUnavailable' }]);
    expect(recordReachedTraitOffer(catalog, blocked, 1, 'reward').history).toBe(
      blocked.state.traitHistory,
    );
    expect(
      evaluateReachedTraitOffer(
        catalog,
        rewardOwner,
        'self',
        atrophic,
        traitFrontierState(createTraitHistoryState()),
        {},
        0,
      ).composition.findings,
    ).toEqual([]);
  });

  it('rejects Common Chaos pairs and exposes the same repair rarities when rank-IV Excellence guarantees Rare', () => {
    const arcana = createTestArcanaFearState();
    const rankIVExcellence = Object.freeze({
      ...arcana,
      arcana: Object.freeze({
        ...arcana.arcana,
        active: Object.freeze([
          Object.freeze({
            key: 'RarityBoost',
            origin: 'manual' as const,
            rarity: 'Heroic' as const,
          }),
        ]),
      }),
    });
    const common = chaos('ChaosNoMoneyCurse', 'ChaosElementalBlessing', 'Common');
    const selected = evaluateReachedTraitOffer(
      catalog,
      rewardOwner,
      'self',
      common,
      traitFrontierState(createTraitHistoryState(), { arcanaFear: rankIVExcellence }),
      {},
      1,
    );
    expect(selected.assessments.some((assessment) => !assessment.legal)).toBe(true);
    expect(recordReachedTraitOffer(catalog, selected, 1, 'reward').history).toBe(
      selected.state.traitHistory,
    );

    const address = createTraitOfferAddress(rewardOwner, 'chaos-rarity');
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(address),
          Object.freeze([
            Object.freeze({
              state: traitFrontierState(undefined, { arcanaFear: rankIVExcellence }),
              source: Object.freeze({}),
            }),
          ]),
        ],
      ]),
    ).at(address);
    const domain = capability?.chaosOfferDomain(common)[0];
    expect(domain?.rarities).toEqual(['Rare', 'Epic']);
    expect(capability?.evaluateOffer(common)[0]?.assessments).toContainEqual(
      expect.objectContaining({ legal: false }),
    );
    const rare = chaos('ChaosNoMoneyCurse', 'ChaosElementalBlessing', 'Rare');
    expect(capability?.evaluateOffer(rare)[0]?.assessments).toEqual([
      { legal: true, findings: [] },
    ]);
    expect(
      recordReachedTraitOffer(
        catalog,
        evaluateReachedTraitOffer(
          catalog,
          rewardOwner,
          'self',
          rare,
          traitFrontierState(createTraitHistoryState(), { arcanaFear: rankIVExcellence }),
          {},
          1,
        ),
        1,
        'reward',
      ).history.events,
    ).toHaveLength(1);
    const source = initializeTestRewardBranches()[0]!;
    const impossible = settleEncounterTraitOffer(
      catalog,
      Object.freeze({
        ...source,
        state: Object.freeze({ ...source.state, arcanaFear: rankIVExcellence }),
      }),
      rewardOwner,
      common,
      1,
      'reward',
      undefined,
      'self',
    );
    expect(impossible.findingEntries).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({
          code: 'rarityRollUnavailable',
          origin: createTraitOfferAddress(rewardOwner, 'self'),
        }),
      }),
    );
    expect(impossible.branch.state.traitHistory?.events).toEqual([]);
  });

  it('uses the Trial source override before item facts, while excluding Proper and Yarn', () => {
    const common = chaos('ChaosNoMoneyCurse', 'ChaosElementalBlessing', 'Common');
    const bare = createTraitHistoryState();
    expect(
      evaluateReachedTraitOffer(
        catalog,
        rewardOwner,
        'self',
        common,
        traitFrontierState(bare),
        {},
        1,
      ).assessments,
    ).toEqual([{ legal: true, findings: [] }]);
    expect(
      evaluateReachedTraitOffer(
        catalog,
        rewardOwner,
        'self',
        common,
        traitFrontierState(bare),
        { boonRarityRoomOverride: { Rare: 1 } },
        1,
      ).assessments,
    ).toContainEqual(
      expect.objectContaining({
        legal: false,
        findings: [
          { code: 'rarityRollUnavailable', traitKey: 'ChaosElementalBlessing', detail: 'Common' },
        ],
      }),
    );
    const proper = Object.freeze({
      ...bare,
      equippedTraits: Object.freeze({
        ElementalRarityUpgradeBoon: {
          traitKey: 'ElementalRarityUpgradeBoon',
          giverKey: 'Hera',
          providerKind: 'olympian' as const,
          rarity: 'Common' as const,
          level: 1,
          sourceRole: 'test',
        },
      }),
      properUpbringingActive: true as const,
    });
    expect(
      evaluateReachedTraitOffer(
        catalog,
        rewardOwner,
        'self',
        common,
        traitFrontierState(proper, { stygianWell: { yarnUses: 1 } }),
        {},
        1,
      ).assessments,
    ).toEqual([{ legal: true, findings: [] }]);
  });

  it('suppresses Excellence for an active Barren curse while retaining the normal source domain', () => {
    const arcana = createTestArcanaFearState();
    const rankIVExcellence = Object.freeze({
      ...arcana,
      arcana: Object.freeze({
        ...arcana.arcana,
        active: Object.freeze([
          Object.freeze({
            key: 'RarityBoost',
            origin: 'manual' as const,
            rarity: 'Heroic' as const,
          }),
        ]),
      }),
    });
    expect(
      evaluateReachedTraitOffer(
        catalog,
        rewardOwner,
        'self',
        chaos('ChaosNoMoneyCurse', 'ChaosElementalBlessing', 'Common'),
        traitFrontierState(historyWithActiveBarren(), { arcanaFear: rankIVExcellence }),
        {},
        6,
      ).assessments,
    ).toEqual([{ legal: true, findings: [] }]);
  });

  it('forces only fresh Ordinary rows to Common and makes Rejected rows unavailable to select or Rarify', () => {
    const ordinaryHistory = pairHistory(chaos('ChaosCommonCurse', 'ChaosElementalBlessing'));
    const nonCommon: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Zeus',
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
        { traitKey: 'ZeusCastBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const invalidFresh = evaluateReachedTraitOffer(
      catalog,
      owner,
      'self',
      nonCommon,
      traitFrontierState(ordinaryHistory),
      {},
      0,
    );
    expect(invalidFresh.generation?.legal).toBe(false);
    expect(invalidFresh.source.replacementRollChance).toBe(0);

    const ordinaryWithOccupiedSlot = foldTraitHistoryEvents(catalog, [
      ...ordinaryHistory.events,
      Object.freeze({
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: 'ordinary-setup',
        sequence: 2,
        giverKey: 'Apollo',
        options: Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' as const },
        ]) as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'reward',
      }),
    ]);
    const replacement: AuthoredTraitOfferTraits = Object.freeze({
      ...nonCommon,
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
        { traitKey: 'ZeusCastBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const staleFacts = boonRarityFactsForOffer(
      catalog,
      traitFrontierState(createTraitHistoryState()),
      {
        resolvedProviderKey: 'Zeus',
      },
    );
    if (staleFacts === undefined) throw new Error('Zeus must own a rarity ledger');
    const staleContext = Object.freeze({ boonRarityFacts: staleFacts });
    const hymnState = traitFrontierState(ordinaryWithOccupiedSlot, {
      stygianWell: { hymnUses: 1 },
    });
    const mixed = evaluateReachedTraitOffer(
      catalog,
      owner,
      'self',
      replacement,
      hymnState,
      staleContext,
      0,
    );
    expect(mixed.assessments.every((assessment) => assessment.legal)).toBe(true);
    expect(mixed.assessments[0]?.replacementTransition).toMatchObject({
      replacedTraitKey: 'ApolloWeaponBoon',
      newTraitKey: 'ZeusWeaponBoon',
      requiredRarity: 'Rare',
    });
    expect(mixed.generation?.legal).toBe(true);
    expect(mixed.source.replacementRollChance).toBe(1);
    expect(mixed.source.boonRarityFacts).toBeUndefined();

    const address = createTraitOfferAddress(rewardOwner, 'ordinary-replacement');
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(address),
          Object.freeze([Object.freeze({ state: hymnState, source: staleContext })]),
        ],
      ]),
    ).at(address);
    const draft = capability?.traitOfferStartingOutcome('Zeus');
    if (draft?.kind !== 'traits') throw new Error('expected Zeus traits');
    expect(draft?.options.some((option) => option.rarity === 'Rare')).toBe(true);
    expect(
      draft?.options
        .filter((option) => option.rarity !== 'Rare')
        .every((option) => option.rarity === 'Common'),
    ).toBe(true);
    expect(capability?.evaluateOffer(replacement)[0]?.offerGenerationState).toMatchObject({
      rarity: { kind: 'fixed', rarity: 'Common' },
    });

    const rejectedHistory = pairHistory(chaos('ChaosRestrictBoonCurse', 'ChaosElementalBlessing'));
    const rejected: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Zeus',
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
        { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
        { traitKey: 'ZeusCastBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option2',
      rejectedOptionKey: 'option1',
      rarificationActions: Object.freeze(['option1'] as const),
    });
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      rewardOwner,
      'self',
      rejected,
      traitFrontierState(rejectedHistory),
      {},
      0,
    );
    expect(evaluation.composition.findings).not.toContainEqual({
      code: 'chaosRejectedBlockUnavailable',
      optionKey: 'option1',
    });
    const card = evaluateCallingCardOffer(
      catalog,
      createKeepsakeState(catalog, 'RarityBoostKeepsake'),
      rejected,
      true,
    );
    expect(card.invalidActions).toEqual([0]);
  });

  it('resolves Ordinary before room, Proper, and Yarn facts, then consumes Yarn on the next unforced screen', () => {
    const ordinary = pairHistory(chaos('ChaosCommonCurse', 'ChaosElementalBlessing'));
    const proper = Object.freeze({
      ...ordinary,
      equippedTraits: Object.freeze({
        ElementalRarityUpgradeBoon: {
          traitKey: 'ElementalRarityUpgradeBoon',
          giverKey: 'Hera',
          providerKind: 'olympian' as const,
          rarity: 'Common' as const,
          level: 1,
          sourceRole: 'test',
        },
      }),
      properUpbringingActive: true as const,
    });
    const source = initializeTestRewardBranches()[0]!;
    const withYarn = Object.freeze({
      ...source,
      state: Object.freeze({
        ...source.state,
        rewardHistory: attachTraitHistory(source.state.rewardHistory, proper),
        traitHistory: proper,
        stygianWell: Object.freeze({ ...source.state.stygianWell, yarnUses: 1 }),
      }),
    });
    const zeus: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Zeus',
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
        { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
        { traitKey: 'ZeusCastBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const first = settleEncounterTraitOffer(
      catalog,
      withYarn,
      rewardOwner,
      zeus,
      2,
      'reward',
      undefined,
      'selection',
      undefined,
      { boonRarityRoomOverride: { Rare: 1 } },
    );
    expect(first.findingEntries).not.toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ code: 'rarityRollUnavailable' }),
      }),
    );
    expect(first.branch.state.stygianWell.yarnUses).toBe(1);
    expect(first.branch.traitEvaluations?.at(-1)?.source).toMatchObject({
      freshRarityOverride: 'Common',
    });
    expect(first.branch.traitEvaluations?.at(-1)?.source.boonRarityFacts).toBeUndefined();
    expect(
      first.branch.traitEvaluations?.at(-1)?.assessments.every((assessment) => assessment.legal),
    ).toBe(true);

    const second = settleEncounterTraitOffer(
      catalog,
      first.branch,
      rewardOwner,
      Object.freeze({
        kind: 'traits',
        giverKey: 'Hermes',
        selectedOptionKey: 'option1',
        rarificationActions: Object.freeze([]),
        options: Object.freeze([
          { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
          { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
          { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
        ]) as AuthoredTraitOfferTraits['options'],
      }),
      3,
      'reward',
    );
    expect(second.branch.state.stygianWell.yarnUses).toBe(1);
    expect(second.branch.state.traitHistory?.activeChaosCurses).toEqual([]);
    const secondEvaluation = second.branch.traitEvaluations?.at(-1);
    if (secondEvaluation === undefined) throw new Error('Hermes screen did not settle');
    expect(secondEvaluation.assessments.every((assessment) => assessment.legal)).toBe(true);
    expect(secondEvaluation.composition.legal).toBe(true);
    expect(secondEvaluation.generation?.legal).toBe(true);
    expect(secondEvaluation.targetedAcquisition.legal).toBe(true);
    expect(second.branch.state.traitHistory?.equippedTraits.HermesWeaponBoon).toMatchObject({
      rarity: 'Common',
    });

    const third = settleEncounterTraitOffer(
      catalog,
      second.branch,
      rewardOwner,
      Object.freeze({
        kind: 'traits',
        giverKey: 'Demeter',
        selectedOptionKey: 'option1',
        rarificationActions: Object.freeze([]),
        options: Object.freeze([
          { traitKey: 'DemeterWeaponBoon', rarity: 'Rare' },
          { traitKey: 'DemeterSpecialBoon', rarity: 'Rare' },
          { traitKey: 'DemeterCastBoon', rarity: 'Rare' },
        ]) as AuthoredTraitOfferTraits['options'],
      }),
      4,
      'reward',
    );
    expect(third.branch.state.stygianWell.yarnUses).toBe(0);
    const thirdEvaluation = third.branch.traitEvaluations?.at(-1);
    if (thirdEvaluation === undefined) throw new Error('Demeter screen did not settle');
    expect(thirdEvaluation.source.freshRarityOverride).toBeUndefined();
    expect(thirdEvaluation.source.boonRarityFacts?.contributions).toContainEqual({
      additive: { Rare: 1, Epic: 0.25, Duo: 0.1, Legendary: 0.1 },
    });
    expect(thirdEvaluation.assessments.every((assessment) => assessment.legal)).toBe(true);
    expect(thirdEvaluation.composition.legal).toBe(true);
    expect(thirdEvaluation.generation?.legal).toBe(true);
    expect(thirdEvaluation.targetedAcquisition.legal).toBe(true);
    expect(third.branch.state.traitHistory?.equippedTraits.DemeterWeaponBoon).toMatchObject({
      rarity: 'Rare',
    });
  });

  it('gives pending Hymn precedence over Ordinary regardless of their acquisition order', () => {
    const occupiedHistory = foldTraitHistoryEvents(catalog, [
      Object.freeze({
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: 'ordinary-setup',
        sequence: 1,
        giverKey: 'Apollo',
        options: Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' as const },
        ]) as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'reward',
      }),
    ]);
    const base = branchWithHistory(occupiedHistory);
    const purchaseHymn = (branch: Parameters<typeof settleEncounterTraitOffer>[1]) =>
      Object.freeze({
        ...branch,
        state: Object.freeze({
          ...branch.state,
          stygianWell: applyStygianWellPurchase(
            catalog,
            branch.state.stygianWell,
            'LimitedSwapTraitDrop',
          ),
        }),
      });
    const acquireOrdinary = (branch: Parameters<typeof settleEncounterTraitOffer>[1]) =>
      settleEncounterTraitOffer(
        catalog,
        branch,
        rewardOwner,
        chaos('ChaosCommonCurse', 'ChaosElementalBlessing'),
        2,
        'reward',
      ).branch;
    const hymnThenOrdinary = acquireOrdinary(purchaseHymn(base));
    const ordinaryThenHymn = purchaseHymn(acquireOrdinary(base));
    const replacement: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Zeus',
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
        { traitKey: 'ZeusCastBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
    });

    const evaluations = [hymnThenOrdinary, ordinaryThenHymn].map((branch) =>
      evaluateReachedTraitOffer(catalog, owner, 'self', replacement, branch.state, {}, 3),
    );

    expect(evaluations.map((evaluation) => evaluation.source.replacementRollChance)).toEqual([
      1, 1,
    ]);
    expect(evaluations.every((evaluation) => evaluation.generation?.legal)).toBe(true);
    expect(
      [hymnThenOrdinary, ordinaryThenHymn].map((branch) => branch.state.stygianWell.hymnUses),
    ).toEqual([1, 1]);
  });

  it('retains Rejected repair states for missing, selected, or unexpected block keys', () => {
    const history = pairHistory(chaos('ChaosRestrictBoonCurse'));
    const base: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Zeus',
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
        { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
        { traitKey: 'ZeusCastBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option2',
      rarificationActions: Object.freeze([]),
    });
    expect(
      evaluateReachedTraitOffer(catalog, owner, 'self', base, traitFrontierState(history), {}, 0)
        .composition.findings,
    ).toContainEqual({ code: 'chaosRejectedBlockMissing' });
    expect(
      evaluateReachedTraitOffer(
        catalog,
        owner,
        'self',
        Object.freeze({ ...base, rejectedOptionKey: 'option2' }),
        traitFrontierState(history),
        {},
        0,
      ).composition.findings,
    ).toContainEqual({ code: 'chaosRejectedBlockUnavailable', optionKey: 'option2' });
    const expired = [2, 3, 4, 5].reduce(
      (current, sequence) => advanceChaosClock(catalog, current, sequence, 'godBoonScreens'),
      history,
    );
    expect(
      evaluateReachedTraitOffer(
        catalog,
        owner,
        'self',
        Object.freeze({ ...base, rejectedOptionKey: 'option1' }),
        traitFrontierState(expired),
        {},
        0,
      ).composition.findings,
    ).toContainEqual({ code: 'chaosRejectedBlockUnavailable', optionKey: 'option1' });
  });

  it('blocks a Rejected row only on a three-option screen', () => {
    // Native blocks the rows beyond Rejected's two choices, so only a full screen has one.
    const rows = [
      { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
      { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
      { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
    ] as const;
    const active = pairHistory(chaos('ChaosRestrictBoonCurse'));
    const exhaustedTo = (count: 1 | 2 | 3) =>
      Object.freeze({
        ...active,
        bannedTraitKeys: Object.freeze(
          catalog.traitGivers.byKey.Hermes!.traitKeys.filter(
            (key) => !rows.slice(0, count).some((row) => row.traitKey === key),
          ),
        ),
      });
    const screen = (count: 1 | 2 | 3): AuthoredTraitOfferTraits =>
      Object.freeze({
        kind: 'traits',
        giverKey: 'Hermes',
        options: Object.freeze(rows.slice(0, count)) as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1',
        rarificationActions: Object.freeze([]),
      });
    const address = createTraitOfferAddress(rewardOwner, 'self');
    const assess = (count: 1 | 2 | 3, offer: AuthoredTraitOfferTraits = screen(count)) => {
      const state = traitFrontierState(exhaustedTo(count));
      const capability = createTraitOfferCandidateArtifacts(
        catalog,
        new Map([
          [
            semanticAddressKey(address),
            Object.freeze([Object.freeze({ state, source: Object.freeze({}) })]),
          ],
        ]),
      ).at(address);
      return {
        composition: evaluateReachedTraitOffer(catalog, owner, 'self', offer, state, {}, 0)
          .composition,
        rules: capability?.chaosOfferRules(offer),
      };
    };

    for (const count of [1, 2] as const) {
      expect(assess(count)).toEqual({
        composition: expect.objectContaining({ legal: true, findings: [] }),
        rules: [
          {
            rejectedBlockRequired: false,
            rejectedBlockableOptionKeys: [],
            rejectedBlockNeedsRepair: false,
          },
        ],
      });
    }
    expect(assess(2, Object.freeze({ ...screen(2), rejectedOptionKey: 'option2' }))).toEqual({
      composition: expect.objectContaining({
        legal: false,
        findings: [{ code: 'chaosRejectedBlockUnavailable', optionKey: 'option2' }],
      }),
      rules: [
        {
          rejectedBlockRequired: false,
          rejectedBlockableOptionKeys: [],
          rejectedBlockNeedsRepair: true,
        },
      ],
    });

    expect(assess(3)).toEqual({
      composition: expect.objectContaining({
        legal: false,
        findings: [{ code: 'chaosRejectedBlockMissing' }],
      }),
      rules: [
        {
          rejectedBlockRequired: true,
          rejectedBlockableOptionKeys: ['option2', 'option3'],
          rejectedBlockNeedsRepair: true,
        },
      ],
    });
    expect(assess(3, Object.freeze({ ...screen(3), rejectedOptionKey: 'option3' }))).toEqual({
      composition: expect.objectContaining({ legal: true, findings: [] }),
      rules: [
        {
          rejectedBlockRequired: true,
          rejectedBlockableOptionKeys: ['option2', 'option3'],
          rejectedBlockNeedsRepair: false,
        },
      ],
    });
    expect(assess(3, Object.freeze({ ...screen(3), giverKey: 'SpellDrop' })).rules).toEqual([]);
  });

  it('settles a two-option screen under Rejected without a blocked row', () => {
    const active = pairHistory(chaos('ChaosRestrictBoonCurse'));
    const exhausted = Object.freeze({
      ...active,
      bannedTraitKeys: Object.freeze(
        catalog.traitGivers.byKey.Hermes!.traitKeys.filter(
          (key) => key !== 'HermesWeaponBoon' && key !== 'HermesSpecialBoon',
        ),
      ),
    });
    const settled = settleEncounterTraitOffer(
      catalog,
      branchWithHistory(exhausted),
      rewardOwner,
      Object.freeze({
        kind: 'traits' as const,
        giverKey: 'Hermes',
        selectedOptionKey: 'option1' as const,
        rarificationActions: Object.freeze([]),
        options: Object.freeze([
          { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
          { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
        ]) as AuthoredTraitOfferTraits['options'],
      }),
      2,
      'encounterCompleted',
    );
    expect(settled.branch.traitEvaluations?.at(-1)?.composition.findings).toEqual([]);
    expect(settled.branch.state.traitHistory?.equippedTraits.HermesWeaponBoon).toBeDefined();
    expect(
      settled.branch.state.traitHistory?.activeChaosCurses.map((curse) => curse.remaining),
    ).toEqual([active.activeChaosCurses[0]!.remaining - 1]);
  });

  it('keeps Rejected’s blocked identity visible to Denial as an unselected trait, not a replacement row', () => {
    const rejected = pairHistory(chaos('ChaosRestrictBoonCurse'));
    const offer: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Hermes',
      options: Object.freeze([
        { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
        { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
        { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option2',
      rejectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
    });
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      rewardOwner,
      'self',
      offer,
      traitFrontierState(rejected, {
        arcanaFear: createTestArcanaFearState({ BanUnpickedBoonsShrineUpgrade: 1 }),
      }),
      {},
      1,
    );
    expect(evaluation.composition.legal).toBe(true);
    expect(
      recordReachedTraitOffer(catalog, evaluation, 1, 'reward').history.events.at(-1),
    ).toMatchObject({
      kind: 'traitOffer',
      bannedTraitKeys: ['HermesWeaponBoon', 'HermesCastDiscountBoon'],
    });
  });

  it('suppresses Barren Arcana rarity contributions only until the exact encounter maturity', () => {
    const arcanaBase = createTestArcanaFearState();
    const arcana = Object.freeze({
      ...arcanaBase,
      arcana: Object.freeze({
        ...arcanaBase.arcana,
        active: Object.freeze([
          Object.freeze({ key: 'BonusRarity', origin: 'manual' as const, rarity: 'Epic' as const }),
        ]),
      }),
    });
    const barren = historyWithActiveBarren();
    expect(
      boonRarityFactsForOffer(catalog, traitFrontierState(barren, { arcanaFear: arcana }), {
        resolvedProviderKey: 'Zeus',
      })?.contributions,
    ).toEqual([]);
    const mature = [6, 7, 8].reduce(
      (history, sequence) => advanceChaosClock(catalog, history, sequence, 'encounters'),
      barren,
    );
    expect(
      boonRarityFactsForOffer(catalog, traitFrontierState(mature, { arcanaFear: arcana }), {
        resolvedProviderKey: 'Zeus',
      })?.contributions,
    ).toHaveLength(1);
  });

  it('suppresses and restores Artificer without mutating Arcana or Chaos history', () => {
    const loadout = createDefaultRouteLoadout(catalog);
    const arcanaFear = createArcanaFearState(catalog, {
      ...loadout,
      manualArcanaKeys: Object.freeze(['MetaToRunUpgrade']),
    });
    const barrenHistory = historyWithActiveBarren();
    const base = initializeTestRewardBranches(arcanaFear)[0]!;
    const branch = Object.freeze({
      ...base,
      state: Object.freeze({
        ...base.state,
        rewardHistory: attachTraitHistory(base.state.rewardHistory, barrenHistory),
        traitHistory: barrenHistory,
      }),
    });
    const source = Object.freeze({
      origin: rewardOwner,
      offer: Object.freeze({ rewardType: 'GiftDrop' }),
      producerLifecycleKey: 'RoomReward',
      instanceProvenance: 'free' as const,
      presentsMaterializedScreen: false,
    });
    const resolution = { role: 'self', lifecyclePoint: 'roomRewardPickup' as const };
    expect(assessArtificerConversion(catalog, branch, source, resolution)).toMatchObject({
      supported: false,
      evidence: { artificerCapacity: 0, artificerRemaining: 0 },
    });
    expect(branch.state.arcanaFear).toBe(arcanaFear);
    expect(branch.state.traitHistory).toBe(barrenHistory);

    const matureHistory = [6, 7, 8].reduce(
      (history, sequence) => advanceChaosClock(catalog, history, sequence, 'encounters'),
      barrenHistory,
    );
    const restored = Object.freeze({
      ...base,
      state: Object.freeze({
        ...base.state,
        rewardHistory: attachTraitHistory(base.state.rewardHistory, matureHistory),
        traitHistory: matureHistory,
      }),
    });
    expect(assessArtificerConversion(catalog, restored, source, resolution)).toMatchObject({
      supported: true,
      evidence: { artificerCapacity: 3, artificerRemaining: 3 },
    });
    expect(restored.state.arcanaFear).toBe(arcanaFear);
  });

  it('consumes Ordinary and Rejected after each eligible Hermes screen, including valid fallback Gold', () => {
    const active = foldTraitHistoryEvents(catalog, [
      ...pairHistory(chaos('ChaosCommonCurse')).events,
      Object.freeze({
        kind: 'chaosPair' as const,
        owner,
        acquisitionRole: 'self',
        sequence: 2,
        acquisitionPoint: 'reward',
        acquisitionIdentity: 'chaos:rejected',
        offer: chaos('ChaosRestrictBoonCurse'),
      }),
    ]);
    const hermes: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Hermes',
      selectedOptionKey: 'option2',
      rejectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
      options: Object.freeze([
        { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
        { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
        { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const settled = settleEncounterTraitOffer(
      catalog,
      branchWithHistory(active),
      rewardOwner,
      hermes,
      3,
      'encounterCompleted',
    );
    expect(
      settled.branch.state.traitHistory?.activeChaosCurses.map((curse) => curse.remaining),
    ).toEqual([1, 1]);

    const exhausted = Object.freeze({
      ...active,
      bannedTraitKeys: Object.freeze([...catalog.traitGivers.byKey.Hermes!.traitKeys]),
    });
    const fallback = settleEncounterTraitOffer(
      catalog,
      branchWithHistory(exhausted),
      rewardOwner,
      Object.freeze({ kind: 'fallbackGold' as const, giverKey: 'Hermes' }),
      3,
      'encounterCompleted',
    );
    expect(
      fallback.branch.state.traitHistory?.activeChaosCurses.map((curse) => curse.remaining),
    ).toEqual([1, 1]);
  });

  it('consumes Ordinary after each ranked NPC god screen', () => {
    for (const giverKey of ['Artemis', 'Athena', 'Dionysus'] as const) {
      const settled = settleEncounterTraitOffer(
        catalog,
        branchWithHistory(pairHistory(chaos('ChaosCommonCurse'))),
        rewardOwner,
        rankedNpcGodOffer(giverKey),
        2,
        'encounterCompleted',
      );
      expect(settled.branch.state.traitHistory?.activeChaosCurses).toMatchObject([
        { semanticTag: 'Ordinary', remaining: 1 },
      ]);
    }
  });

  it('shares Rejected’s selected validation, candidate repair, and screen use across ranked NPCs', () => {
    const active = foldTraitHistoryEvents(catalog, [
      ...pairHistory(chaos('ChaosCommonCurse')).events,
      Object.freeze({
        kind: 'chaosPair' as const,
        owner,
        acquisitionRole: 'self',
        sequence: 2,
        acquisitionPoint: 'reward',
        acquisitionIdentity: 'chaos:rejected-npc',
        offer: chaos('ChaosRestrictBoonCurse'),
      }),
    ]);
    const invalid = settleEncounterTraitOffer(
      catalog,
      branchWithHistory(active),
      rewardOwner,
      rankedNpcGodOffer('Artemis'),
      3,
      'encounterCompleted',
    );
    expect(invalid.branch.state.traitHistory?.activeChaosCurses).toMatchObject([
      { semanticTag: 'Ordinary', remaining: 2 },
      { semanticTag: 'Rejected', remaining: 2 },
    ]);
    expect(invalid.branch.traitEvaluations?.at(-1)?.composition.findings).toContainEqual({
      code: 'chaosRejectedBlockMissing',
    });
    const settled = settleEncounterTraitOffer(
      catalog,
      branchWithHistory(active),
      rewardOwner,
      Object.freeze({ ...rankedNpcGodOffer('Artemis'), rejectedOptionKey: 'option2' as const }),
      3,
      'encounterCompleted',
    );
    expect(settled.branch.state.traitHistory?.activeChaosCurses).toMatchObject([
      { semanticTag: 'Ordinary', remaining: 1 },
      { semanticTag: 'Rejected', remaining: 1 },
    ]);
    expect(settled.branch.state.traitHistory?.equippedTraits.SupportingFireBoon).toBeDefined();
  });

  it('rechecks active Proper after the final ranked NPC god screen expires Ordinary', () => {
    const activeProper = historyWithActiveProper();
    const ordinarySequence = activeProper.events.length + 1;
    const ordinary = settleEncounterTraitOffer(
      catalog,
      branchWithHistory(activeProper),
      rewardOwner,
      chaos('ChaosCommonCurse', 'ChaosWeaponBlessing'),
      ordinarySequence,
      'reward',
      undefined,
      'self',
    );
    const first = settleEncounterTraitOffer(
      catalog,
      ordinary.branch,
      rewardOwner,
      rankedNpcGodOffer('Artemis'),
      ordinarySequence + 1,
      'reward',
      undefined,
      'self',
    );
    const expired = settleEncounterTraitOffer(
      catalog,
      first.branch,
      rewardOwner,
      rankedNpcGodOffer('Athena'),
      ordinarySequence + 2,
      'reward',
      undefined,
      'gorgonAthena',
    );
    expect(expired.branch.state.traitHistory?.activeChaosCurses).toEqual([]);
    expect(expired.branch.state.traitHistory?.equippedTraits.SupportingFireBoon?.rarity).toBe(
      'Rare',
    );
    expect(expired.branch.state.traitHistory?.equippedTraits.InvulnerabilityDashBoon?.rarity).toBe(
      'Rare',
    );
  });

  it('does not consume Ordinary for rarityless Hades or other story screens', () => {
    // Native Hades is BlockForceCommon: Ordinary neither forces its screen nor spends a use.
    const offers = [
      {
        selectedTraitKey: 'HadesLifestealBoon',
        offer: Object.freeze({
          kind: 'traits' as const,
          giverKey: 'Hades',
          selectedOptionKey: 'option1' as const,
          rarificationActions: Object.freeze([]),
          options: Object.freeze([
            { traitKey: 'HadesLifestealBoon' },
            { traitKey: 'HadesPreDamageBoon' },
            { traitKey: 'HadesChronosDebuffBoon' },
          ]) as AuthoredTraitOfferTraits['options'],
        }),
      },
      {
        selectedTraitKey: 'NarcissusB',
        offer: Object.freeze({
          kind: 'traits' as const,
          giverKey: 'Narcissus',
          selectedOptionKey: 'option1' as const,
          rarificationActions: Object.freeze([]),
          options: Object.freeze([
            { traitKey: 'NarcissusB' },
            { traitKey: 'NarcissusC' },
            { traitKey: 'NarcissusD' },
          ]) as AuthoredTraitOfferTraits['options'],
        }),
      },
    ] as const;
    for (const { offer, selectedTraitKey } of offers) {
      const settled = settleEncounterTraitOffer(
        catalog,
        branchWithHistory(pairHistory(chaos('ChaosCommonCurse'))),
        rewardOwner,
        offer,
        2,
        'encounterCompleted',
      );
      expect(settled.branch.state.traitHistory?.activeChaosCurses).toMatchObject([
        { semanticTag: 'Ordinary', remaining: 2 },
      ]);
      expect(
        settled.branch.state.traitHistory?.equippedTraits[selectedTraitKey],
        `${offer.giverKey} selected trait should settle`,
      ).toBeDefined();
    }
  });

  it('settles a TrialUpgrade-shaped self child through the shared acquisition path and starts its clock there', () => {
    const source = initializeTestRewardBranches()[0]!;
    const settled = settleEncounterTraitOffer(
      catalog,
      Object.freeze({
        ...source,
        state: Object.freeze({
          ...source.state,
          stygianWell: Object.freeze({ ...source.state.stygianWell, yarnUses: 1 }),
        }),
      }),
      rewardOwner,
      chaos('ChaosNoMoneyCurse', 'ChaosElementalBlessing'),
      7,
      'echoLastReward',
      undefined,
      'self',
    );
    expect(settled.branch.state.traitHistory?.activeChaosCurses).toMatchObject([
      { curseKey: 'ChaosNoMoneyCurse', remaining: 3 },
    ]);
    expect(settled.branch.state.stygianWell.yarnUses).toBe(1);
    expect(settled.branch.traitEvaluations?.at(-1)?.source.boonRarityFacts).toBeUndefined();
  });

  it('advances an encounter-clocked curse once at the terminal P end-effects checkpoint for normal and Fig Leaf execution', () => {
    const pIntro = createEncounterPhaseAddress(
      createBiomeAddress('Surface', 'P'),
      {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('surface-p-1-1-p_combat03'),
      },
      'Intro',
    );
    let figLeafProject = applyProjectCommand(loadSurfaceNOPProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    figLeafProject = applyProjectCommand(figLeafProject, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: pIntro,
      value: true,
    });

    for (const [label, project] of [
      ['normal', loadSurfaceNOPProject()],
      ['figLeaf', figLeafProject],
    ] as const) {
      const route = project.route;
      const p = simulateProject(catalog, project).route?.biomes.find(
        (candidate) => candidate.biomeKey === 'P',
      );
      if (
        route === undefined ||
        p === undefined ||
        p.authoring !== 'complete' ||
        p.validity !== 'valid'
      ) {
        throw new Error(`${label} P lifecycle fixture is incomplete`);
      }
      const terminal = p.history.events.filter(
        (event) =>
          event.kind === 'encounterEndEffectsApplied' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === 'surface-p-1-1-p_combat03',
      );
      expect(terminal).toHaveLength(1);
      expect(terminal[0]).toMatchObject({
        phaseKey: 'Combat',
        execution: label === 'figLeaf' ? 'skippedByFigLeaf' : 'normal',
      });

      const oneUseRemaining = [2, 3].reduce(
        (history, sequence) => advanceChaosClock(catalog, history, sequence, 'encounters'),
        pairHistory(chaos('ChaosNoMoneyCurse', 'ChaosElementalBlessing')),
      );
      const terminalHistory = Object.freeze({
        ...p.history,
        events: Object.freeze(
          p.history.events.filter(
            (event) =>
              event.origin.kind === 'occurrence' &&
              event.origin.occurrenceId === 'surface-p-1-1-p_combat03',
          ),
        ),
      });
      const result = evaluateBiomeRewardsAssemblyInternal(
        catalog,
        p.snapshot,
        terminalHistory,
        ordinaryPositionFor(catalog, p.snapshot),
        route.loadout,
        [branchWithHistory(oneUseRemaining)],
      ).simulation;
      const newEncounterClocks =
        result.branches[0]?.state.traitHistory?.events.filter(
          (event) =>
            event.kind === 'chaosClock' && event.sequence > 3 && event.clock === 'encounters',
        ) ?? [];
      expect(newEncounterClocks).toEqual([
        expect.objectContaining({ sequence: terminal[0]?.sequence }),
      ]);
      expect(result.branches[0]?.state.traitHistory?.activeChaosCurses).toHaveLength(0);
    }
  });
});
