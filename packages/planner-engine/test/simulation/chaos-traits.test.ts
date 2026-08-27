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
} from '../../src/simulation/traits';
import { simulateProject } from '../../src/simulation';
import { evaluateCallingCardOffer } from '../../src/simulation/keepsakes';
import { createKeepsakeState } from '../../src/simulation/keepsakes';
import { boonRarityRollUnavailable } from '../../src/simulation/boon-rarity';
import { createTestArcanaFearState } from '../support/arcana-fear';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { assessArtificerConversion } from '../../src/simulation/rewards/acquisition-settlement';
import { processEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import type {
  AuthoredChaosTraitOffer,
  AuthoredTraitOfferTraits,
} from '../../src/authored-project/traits';
import { normalizeAuthoredChaosTraitOffer } from '../../src/authored-project/traits';
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import { evaluateBiomeRewardsAssemblyInternal } from '../../src/simulation/rewards/biome';
import { loadSurfaceNOPProject } from '@run-planner/test-fixtures/surface';

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
    history: attachTraitHistory(base.history, history),
    traitHistory: history,
  });
}

describe('Chaos paired-trait history', () => {
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
      createTraitHistoryState(),
      {},
      1,
      createTestArcanaFearState({ BanUnpickedBoonsShrineUpgrade: 1 }),
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
      evaluateReachedTraitOffer(catalog, rewardOwner, 'self', later, settled.history, {}, 2)
        .composition.legal,
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
      createTraitHistoryState(),
      {},
      1,
      createTestArcanaFearState({ BanUnpickedBoonsShrineUpgrade: 1 }),
    );
    expect(evaluation.composition.legal).toBe(false);
    const settled = recordReachedTraitOffer(catalog, evaluation, 1, 'reward');
    expect(settled.history).toBe(evaluation.before);
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
      before,
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
      boonRarityFactsForOffer(catalog, mature, { resolvedProviderKey: 'Zeus' })?.contributions,
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
    const before = boonRarityFactsForOffer(catalog, pending, { resolvedProviderKey: 'Zeus' });
    if (before === undefined) throw new Error('Zeus must own a rarity ledger');
    expect(boonRarityRollUnavailable(before, 'Common', ['Common', 'Rare', 'Epic'])).toBe(false);
    const mature = [2, 3, 4].reduce(
      (history, sequence) => advanceChaosClock(catalog, history, sequence, 'encounters'),
      pending,
    );
    const after = boonRarityFactsForOffer(catalog, mature, { resolvedProviderKey: 'Zeus' });
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
    const guaranteedFacts = boonRarityFactsForOffer(catalog, guaranteed, {
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
      createTraitHistoryState(),
      {},
      0,
    );
    expect(evaluation.composition.findings).toEqual([{ code: 'chaosPairUnavailable' }]);
    expect(recordReachedTraitOffer(catalog, evaluation, 1, 'reward').history).toBe(
      evaluation.before,
    );
  });

  it('forces Ordinary to Common and makes Rejected rows unavailable to select or Rarify', () => {
    const ordinaryHistory = pairHistory(chaos('ChaosCommonCurse', 'ChaosElementalBlessing'));
    const nonCommon: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Zeus',
      selectedOptionKey: 'option1',
      rarificationActions: Object.freeze([]),
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ZeusSecondaryBoon', rarity: 'Common' },
        { traitKey: 'ZeusCastBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
    });
    expect(
      evaluateReachedTraitOffer(catalog, owner, 'self', nonCommon, ordinaryHistory, {}, 0)
        .composition.findings,
    ).toContainEqual({ code: 'chaosOrdinaryRequiresCommon' });

    const rejectedHistory = pairHistory(chaos('ChaosRestrictBoonCurse', 'ChaosElementalBlessing'));
    const rejected: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Zeus',
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
        { traitKey: 'ZeusSecondaryBoon', rarity: 'Common' },
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
      rejectedHistory,
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

  it('retains Rejected repair states for missing, selected, or unexpected block keys', () => {
    const history = pairHistory(chaos('ChaosRestrictBoonCurse'));
    const base: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Zeus',
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
        { traitKey: 'ZeusSecondaryBoon', rarity: 'Common' },
        { traitKey: 'ZeusCastBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option2',
      rarificationActions: Object.freeze([]),
    });
    expect(
      evaluateReachedTraitOffer(catalog, owner, 'self', base, history, {}, 0).composition.findings,
    ).toContainEqual({ code: 'chaosRejectedBlockMissing' });
    expect(
      evaluateReachedTraitOffer(
        catalog,
        owner,
        'self',
        Object.freeze({ ...base, rejectedOptionKey: 'option2' }),
        history,
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
        expired,
        {},
        0,
      ).composition.findings,
    ).toContainEqual({ code: 'chaosRejectedBlockUnavailable', optionKey: 'option1' });
  });

  it('publishes only visible, unselected Rejected rows for a sparse two-option offer', () => {
    const history = pairHistory(chaos('ChaosRestrictBoonCurse'));
    const address = createTraitOfferAddress(rewardOwner, 'self');
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(address),
          Object.freeze([Object.freeze({ before: history, context: Object.freeze({}) })]),
        ],
      ]),
    ).at(address);
    const offer: AuthoredTraitOfferTraits = Object.freeze({
      kind: 'traits',
      giverKey: 'Zeus',
      options: Object.freeze([
        { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
        { traitKey: 'ZeusSecondaryBoon', rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option2',
      rarificationActions: Object.freeze([]),
    });
    expect(capability?.chaosOfferRules(offer)).toEqual([
      {
        ordinaryRequiresCommon: false,
        rejectedBlockRequired: true,
        rejectedBlockableOptionKeys: ['option1'],
        rejectedBlockNeedsRepair: true,
      },
    ]);
    expect(capability?.chaosOfferRules({ ...offer, giverKey: 'SpellDrop' })).toEqual([]);
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
      rejected,
      {},
      1,
      createTestArcanaFearState({ BanUnpickedBoonsShrineUpgrade: 1 }),
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
      boonRarityFactsForOffer(catalog, barren, { resolvedProviderKey: 'Zeus' }, arcana)
        ?.contributions,
    ).toEqual([]);
    const mature = [6, 7, 8].reduce(
      (history, sequence) => advanceChaosClock(catalog, history, sequence, 'encounters'),
      barren,
    );
    expect(
      boonRarityFactsForOffer(catalog, mature, { resolvedProviderKey: 'Zeus' }, arcana)
        ?.contributions,
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
      history: attachTraitHistory(base.history, barrenHistory),
      traitHistory: barrenHistory,
    });
    const source = Object.freeze({
      origin: rewardOwner,
      offer: Object.freeze({ rewardType: 'GiftDrop' }),
      producerLifecycleKey: 'RoomReward',
      instanceProvenance: 'free' as const,
    });
    const resolution = { role: 'self', lifecyclePoint: 'roomRewardPickup' as const };
    expect(assessArtificerConversion(catalog, branch, source, resolution)).toMatchObject({
      supported: false,
      evidence: { artificerCapacity: 0, artificerRemaining: 0 },
    });
    expect(branch.arcanaFear).toBe(arcanaFear);
    expect(branch.traitHistory).toBe(barrenHistory);

    const matureHistory = [6, 7, 8].reduce(
      (history, sequence) => advanceChaosClock(catalog, history, sequence, 'encounters'),
      barrenHistory,
    );
    const restored = Object.freeze({
      ...base,
      history: attachTraitHistory(base.history, matureHistory),
      traitHistory: matureHistory,
    });
    expect(assessArtificerConversion(catalog, restored, source, resolution)).toMatchObject({
      supported: true,
      evidence: { artificerCapacity: 3, artificerRemaining: 3 },
    });
    expect(restored.arcanaFear).toBe(arcanaFear);
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
    const settled = processEncounterTraitOffer(
      catalog,
      branchWithHistory(active),
      rewardOwner,
      hermes,
      3,
      'encounterCompleted',
    );
    expect(settled.traitHistory?.activeChaosCurses.map((curse) => curse.remaining)).toEqual([1, 1]);

    const exhausted = Object.freeze({
      ...active,
      bannedTraitKeys: Object.freeze([...catalog.traitGivers.byKey.Hermes!.traitKeys]),
    });
    const fallback = processEncounterTraitOffer(
      catalog,
      branchWithHistory(exhausted),
      rewardOwner,
      Object.freeze({ kind: 'fallbackGold' as const, giverKey: 'Hermes' }),
      3,
      'encounterCompleted',
    );
    expect(fallback.traitHistory?.activeChaosCurses.map((curse) => curse.remaining)).toEqual([
      1, 1,
    ]);
  });

  it('settles a TrialUpgrade-shaped self child through the shared acquisition path and starts its clock there', () => {
    const settled = processEncounterTraitOffer(
      catalog,
      branchWithHistory(createTraitHistoryState()),
      rewardOwner,
      chaos('ChaosNoMoneyCurse', 'ChaosElementalBlessing'),
      7,
      'echoLastReward',
      undefined,
      undefined,
      'self',
    );
    expect(settled.traitHistory?.activeChaosCurses).toMatchObject([
      { curseKey: 'ChaosNoMoneyCurse', remaining: 3 },
    ]);
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
      const route = project.routes.find((candidate) => candidate.routeKey === 'Surface');
      const p = simulateProject(catalog, project)
        .routes.find((candidate) => candidate.routeKey === 'Surface')
        ?.biomes.find((candidate) => candidate.biomeKey === 'P');
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
        3,
        route.loadout,
        [branchWithHistory(oneUseRemaining)],
      ).simulation;
      const newEncounterClocks =
        result.branches[0]?.traitHistory?.events.filter(
          (event) =>
            event.kind === 'chaosClock' && event.sequence > 3 && event.clock === 'encounters',
        ) ?? [];
      expect(newEncounterClocks).toEqual([
        expect.objectContaining({ sequence: terminal[0]?.sequence }),
      ]);
      expect(result.branches[0]?.traitHistory?.activeChaosCurses).toHaveLength(0);
    }
  });
});
