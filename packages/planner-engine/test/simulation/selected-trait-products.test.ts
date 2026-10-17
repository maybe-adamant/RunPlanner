import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createDefaultAuthoredHexTree,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';

import { selectedTraitOfferProducts } from '../../src/simulation/rewards/biome/selected-trait-products';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  type ReachedLevelResolutionEvaluation,
} from '../../src/simulation/traits';
import { normalizeAuthoredChaosTraitOffer } from '../../src/authored-project/traits/state';
import {
  createTestArcanaFearState,
  initializeTestRewardBranchesForRoute as initializeRewardBranches,
} from '../support/arcana-fear';
import { maybeAddGodSent } from '../../src/simulation/hex-progress';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';

describe('selected trait products', () => {
  it('publishes Echo nested rarities after Proper Upbringing applies its floor', () => {
    const origin = createIncomingRewardAddress(
      { kind: 'biome', routeKey: 'Underworld', biomeKey: 'H' },
      createOccurrenceId('echo'),
    );
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const history = Object.freeze({
      ...createTraitHistoryState(),
      properUpbringingActive: true as const,
    });
    const branch = Object.freeze({
      ...initial,
      state: Object.freeze({
        ...initial.state,
        rewardHistory: attachTraitHistory(initial.state.rewardHistory, history),
        traitHistory: history,
      }),
    });
    const offer = {
      kind: 'traits' as const,
      giverKey: 'Echo',
      options: [
        {
          traitKey: 'EchoLastRunBoon',
          echoLastRunBoon: {
            options: [
              {
                giverKey: 'Aphrodite',
                traitKey: 'HighHealthOffenseBoon',
                rarity: 'Common' as const,
              },
            ] as const,
            selectedOptionKey: 'option1' as const,
          },
        },
        { traitKey: 'DiminishingDodgeBoon' },
      ] as const,
      selectedOptionKey: 'option1' as const,
      rarificationActions: [] as const,
    };
    const settled = settleEncounterTraitOffer(catalog, branch, origin, offer, 1, 'pickup').branch;

    expect(
      selectedTraitOfferProducts([settled], Object.freeze([]), catalog).selectedTraitOffers[0]
        ?.branches[0]?.effectiveEchoLastRunBoon?.options[0]?.rarity,
    ).toBe('Rare');
  });

  it('settles Echo last-run boon rows on the Echo screen without curse or Yarn effects', () => {
    const origin = createIncomingRewardAddress(
      { kind: 'biome', routeKey: 'Underworld', biomeKey: 'H' },
      createOccurrenceId('echo'),
    );
    const chaosPair = (curseKey: string, sequence: number) => {
      const curse = catalog.chaos.curses.byKey[curseKey]!;
      const blessing = catalog.chaos.blessings.byKey.ChaosElementalBlessing!;
      const curseOption = { curseKey, requirementCount: curse.duration.minimum };
      return Object.freeze({
        kind: 'chaosPair' as const,
        owner: origin,
        acquisitionRole: `chaos${sequence}`,
        sequence,
        acquisitionPoint: 'test',
        acquisitionIdentity: `chaos:${sequence}`,
        offer: normalizeAuthoredChaosTraitOffer(catalog, {
          kind: 'chaos',
          giverKey: 'Chaos',
          curseOptions: [curseOption, curseOption, curseOption],
          selectedOptionKey: 'option1',
          selectedCurseValues: Object.fromEntries(
            curse.operands.map((operand) => [operand.key, operand.minimum]),
          ),
          blessingKey: blessing.key,
          rarity: 'Common',
          blessingValues: Object.fromEntries(
            blessing.operands.map((operand) => [
              operand.key,
              operand.byRarity?.Common?.minimum ?? operand.minimum,
            ]),
          ),
        }),
      });
    };
    const history = foldTraitHistoryEvents(catalog, [
      chaosPair('ChaosRestrictBoonCurse', 0),
      chaosPair('ChaosCommonCurse', 1),
    ]);
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const branch = Object.freeze({
      ...initial,
      state: Object.freeze({
        ...initial.state,
        rewardHistory: attachTraitHistory(initial.state.rewardHistory, history),
        traitHistory: history,
        stygianWell: Object.freeze({ ...initial.state.stygianWell, yarnUses: 1 }),
      }),
    });
    const offer = {
      kind: 'traits' as const,
      giverKey: 'Echo',
      options: [
        {
          traitKey: 'EchoLastRunBoon',
          echoLastRunBoon: {
            options: [
              {
                giverKey: 'Aphrodite',
                traitKey: 'HighHealthOffenseBoon',
                rarity: 'Common' as const,
              },
            ] as const,
            selectedOptionKey: 'option1' as const,
          },
        },
        { traitKey: 'DiminishingDodgeBoon' },
        { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
      ] as const,
      selectedOptionKey: 'option1' as const,
      rarificationActions: [] as const,
    };
    const settlement = settleEncounterTraitOffer(catalog, branch, origin, offer, 2, 'pickup');
    expect(settlement.findingEntries).toEqual([]);
    const settled = settlement.branch;

    expect(settled.state.traitHistory.equippedTraits.HighHealthOffenseBoon).toBeDefined();
    expect(settled.state.traitHistory.activeChaosCurses).toEqual(history.activeChaosCurses);
    expect(settled.state.stygianWell.yarnUses).toBe(1);
    const published = selectedTraitOfferProducts(
      [settled],
      Object.freeze([]),
      catalog,
    ).selectedTraitOffers;
    expect(published.map((entry) => entry.offer.giverKey)).toEqual(['Echo']);
    const published0 = published[0]?.branches[0];
    expect(published0?.screenExpectation).toBeUndefined();
    expect(published0?.effectiveEchoLastRunBoon?.rarityFloor).toBe(false);
  });

  it('retains absent Spell God Sent evidence when a later same-biome keepsake adds it', () => {
    const origin = createIncomingRewardAddress(
      { kind: 'biome', routeKey: 'Underworld', biomeKey: 'F' },
      createOccurrenceId('spell'),
    );
    const initial = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ManaOverTimeRefundKeepsake',
    )[0]!;
    const offer = {
      kind: 'traits' as const,
      giverKey: 'SpellDrop',
      options: [
        { traitKey: 'SpellPolymorphTrait' },
        { traitKey: 'SpellMeteorTrait' },
        { traitKey: 'SpellTransformTrait' },
      ] as const,
      selectedOptionKey: 'option1' as const,
      hexTree: createDefaultAuthoredHexTree(catalog, 'SpellPolymorphTrait', 'Lung'),
      rarificationActions: [] as const,
    };
    const spell = settleEncounterTraitOffer(catalog, initial, origin, offer, 1, 'pickup').branch;
    expect(spell.state.hexProgress.godSentAdded).toBe(false);
    const laterKeepsake = initializeRewardBranches(
      undefined,
      createTestArcanaFearState(),
      catalog,
      'ForceZeusBoonKeepsake',
    )[0]!;
    const late = maybeAddGodSent(catalog, {
      ...spell,
      state: Object.freeze({
        ...spell.state,
        keepsakes: {
          ...spell.state.keepsakes,
          olympianSources: laterKeepsake.state.keepsakes.olympianSources,
        },
      }),
    });
    expect(late.state.hexProgress.godSentAdded).toBe(true);
    expect(
      selectedTraitOfferProducts([late]).selectedTraitOffers[0]?.branches[0]?.settledHexTree,
    ).not.toHaveProperty('godSent');
  });

  it('retains divergent reached level-resolution publication and candidate contexts', () => {
    const address = createLevelResolutionAddress(
      {
        kind: 'incomingReward',
        routeKey: 'Underworld',
        biomeKey: 'F',
        occurrenceId: createOccurrenceId('test'),
      },
      'self',
    );
    const retained: readonly ReachedLevelResolutionEvaluation[] = Object.freeze([
      Object.freeze({
        address,
        value: Object.freeze({
          kind: 'choice',
          offeredTraitKeys: Object.freeze([]),
          selectedTraitKey: null,
        }),
        findings: Object.freeze(['missingTarget'] as const),
        levelCount: 1,
        effectKind: 'choice',
        emptyTargetAllowed: false,
        chronologicalIndex: 1,
        before: Object.freeze({ ...createTraitHistoryState(), upgradableTraitCount: 1 }),
        reached: true,
      }),
      Object.freeze({
        address,
        value: Object.freeze({
          kind: 'choice',
          offeredTraitKeys: Object.freeze([]),
          selectedTraitKey: null,
        }),
        findings: Object.freeze(['missingTarget', 'wrongOfferCount'] as const),
        levelCount: 2,
        effectKind: 'choice',
        emptyTargetAllowed: false,
        chronologicalIndex: 2,
        before: Object.freeze({ ...createTraitHistoryState(), upgradableTraitCount: 2 }),
        reached: true,
      }),
    ]);
    const products = selectedTraitOfferProducts(Object.freeze([]), retained);
    expect(products.selectedLevelResolutions).toEqual([
      expect.objectContaining({
        address,
        chronologicalIndex: 1,
        branches: [
          expect.objectContaining({ findings: ['missingTarget'], eligibleTargetCount: 1 }),
          expect.objectContaining({
            findings: ['missingTarget', 'wrongOfferCount'],
            eligibleTargetCount: 2,
          }),
        ],
      }),
    ]);
    expect(products.levelCandidateContexts.get(semanticAddressKey(address))).toEqual([
      expect.objectContaining({ address, levelCount: 1, effectKind: 'choice' }),
      expect.objectContaining({ address, levelCount: 2, effectKind: 'choice' }),
    ]);
  });
});
