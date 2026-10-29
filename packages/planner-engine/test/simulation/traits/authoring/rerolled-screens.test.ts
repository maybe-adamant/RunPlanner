import { catalog } from '@run-planner/hades2-catalog';
import {
  rerolledTraitScreenSnapshot,
  type AuthoredRerolledTraitScreen,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import {
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  type ResolvedTraitOfferSource,
  type TraitHistoryState,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';
import {
  assessInitialOfferSupport,
  assessRerolledScreensSupport,
  firstScreenRerollRefused,
  guessRerolledScreens,
  initialOfferStartingOptions,
} from '../../../../src/simulation/traits/authoring/initial-composition';
import { traitOfferGenerationInput } from '../../../../src/simulation/traits/authoring/assessment';
import { isPomEligibleTrait } from '../../../../src/simulation/traits/history/upgrades';
import { rerolledLevelScreensGuess } from '../../../../src/simulation/traits/level-effects';
import { traitFrontierState } from '../../../support/simulation-state';

function history(entries: readonly [string, string, string][]): TraitHistoryState {
  return foldTraitHistoryEvents(
    catalog,
    entries.map(([giverKey, traitKey, rarity], sequence) => ({
      kind: 'traitOffer',
      owner: { kind: 'project' },
      acquisitionRole: 'source',
      sequence,
      giverKey,
      options: [{ traitKey, rarity }] as TraitOfferEvent['options'],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'roomRewardPickup',
    })),
  );
}

type Row = readonly [string, string];
const rows = (...entries: readonly Row[]) =>
  entries.map(([traitKey, rarity]) => ({ traitKey, rarity })) as never;
const screen = (...entries: readonly Row[]): AuthoredRerolledTraitScreen => ({
  options: rows(...entries),
});

function offer(
  final: readonly Row[],
  earlier: readonly (AuthoredRerolledTraitScreen | null)[],
): AuthoredTraitOfferTraits {
  return {
    kind: 'traits',
    giverKey: 'Apollo',
    options: rows(...final),
    selectedOptionKey: 'option1',
    ...(earlier.length === 0 ? {} : { rerolledScreens: earlier }),
  };
}

function input(
  before: TraitHistoryState,
  context: ResolvedTraitOfferSource = {},
  testCatalog = catalog,
) {
  return traitOfferGenerationInput(
    testCatalog,
    'Apollo',
    traitFrontierState(before, { catalog: testCatalog }),
    context,
  );
}

function finalSupported(
  value: AuthoredTraitOfferTraits,
  before = createTraitHistoryState(),
  context: ResolvedTraitOfferSource = {},
  testCatalog = catalog,
): boolean {
  return assessInitialOfferSupport({ ...input(before, context, testCatalog), offer: value }).legal;
}

/** Smaller declaration domains isolate generation stages, not a copied oracle. */
function apolloPool(keys: readonly string[], priority: readonly string[] = []) {
  const giver = {
    ...catalog.traitGivers.byKey.Apollo!,
    traitKeys: keys,
    priorityTraitKeys: priority,
  };
  return {
    ...catalog,
    traitGivers: {
      ...catalog.traitGivers,
      byKey: { ...catalog.traitGivers.byKey, Apollo: giver },
      values: catalog.traitGivers.values.map((entry) => (entry.key === 'Apollo' ? giver : entry)),
    },
  };
}

const cores: readonly Row[] = [
  ['ApolloWeaponBoon', 'Common'],
  ['ApolloCastBoon', 'Common'],
  ['ApolloManaBoon', 'Common'],
];

describe('rerolled screen chain', () => {
  it('bans one item of the previous screen, so a banned core seed gives way to any fill', () => {
    const afterCores: readonly Row[] = [
      ['ApolloWeaponBoon', 'Common'],
      ['ApolloCastBoon', 'Common'],
      ['PerfectDamageBonusBoon', 'Common'],
    ];
    // Not a first screen: a fresh god seeds three cores.
    expect(finalSupported(offer(afterCores, []))).toBe(false);
    // Banning Mana drops it from the seeded cores and the vacancy is filled.
    expect(finalSupported(offer(afterCores, [screen(...cores)]))).toBe(true);
    // Every ban removes one of the repeated rows, which nothing re-offers.
    expect(finalSupported(offer(cores, [screen(...cores)]))).toBe(false);
    const findings = (value: AuthoredTraitOfferTraits) =>
      assessInitialOfferSupport({ ...input(createTraitHistoryState()), offer: value }).findings;
    expect(findings(offer(cores, [screen(...cores)]))).toEqual([{ code: 'rollRepeatsAllOffers' }]);
    // Not a first screen either way, but a ban of Weapon admits it.
    expect(
      findings(
        offer(
          [
            ['ApolloCastBoon', 'Common'],
            ['ApolloManaBoon', 'Common'],
            ['ApolloSprintBoon', 'Common'],
          ],
          [screen(...cores)],
        ),
      ),
    ).toEqual([]);
    // Rows no screen can show are impossible rather than a repeat.
    expect(
      findings(
        offer(
          [
            ['ApolloWeaponBoon', 'Common'],
            ['ApolloManaBoon', 'Common'],
            ['PerfectDamageBonusBoon', 'Common'],
            ['ApolloSprintBoon', 'Common'],
          ] as never,
          [screen(...cores)],
        ),
      ),
    ).toEqual([{ code: 'traitOfferGenerationUnavailable' }]);
  });

  it('accept after an unauthored screen either a first screen or any single ban', () => {
    const afterCores: readonly Row[] = [
      ['ApolloWeaponBoon', 'Common'],
      ['ApolloCastBoon', 'Common'],
      ['PerfectDamageBonusBoon', 'Common'],
    ];
    expect(finalSupported(offer(afterCores, [null]))).toBe(true);
    expect(finalSupported(offer(cores, [null]))).toBe(true);
    expect(
      finalSupported(
        offer(
          [
            ['PerfectDamageBonusBoon', 'Common'],
            ['DoubleStrikeChanceBoon', 'Common'],
            ['ApolloSprintBoon', 'Common'],
          ],
          [null],
        ),
      ),
    ).toBe(false);
  });

  it('lets an unbanned item return at a freshly rolled rarity', () => {
    expect(
      finalSupported(
        offer(
          [
            ['ApolloWeaponBoon', 'Rare'],
            ['ApolloCastBoon', 'Epic'],
            ['ApolloSprintBoon', 'Common'],
          ],
          [screen(...cores)],
        ),
      ),
    ).toBe(true);
  });

  it('judges each earlier screen against the one before it, the first as a first screen', () => {
    const value = offer(cores, [
      screen(...cores),
      screen(
        ['ApolloWeaponBoon', 'Common'],
        ['ApolloCastBoon', 'Common'],
        ['ApolloSprintBoon', 'Common'],
      ),
      null,
      screen(...cores),
    ]);
    expect(
      assessRerolledScreensSupport(input(createTraitHistoryState()), value.rerolledScreens!).map(
        (support) => support?.legal,
      ),
    ).toEqual([true, true, undefined, true]);
    expect(
      assessRerolledScreensSupport(input(createTraitHistoryState()), [
        screen(
          ['ApolloWeaponBoon', 'Common'],
          ['ApolloCastBoon', 'Common'],
          ['PerfectDamageBonusBoon', 'Common'],
        ),
      ])[0]?.legal,
    ).toBe(false);
  });

  // Source reading (TraitLogic.lua SetTraitsOnLoot: the exclusion prunes seeds and
  // buckets only; the replacement rescue reads the unpruned core list), not yet
  // exercised in game: an exhausted screen may re-offer the banned exchange.
  it('re-offers a banned exchange through the replacement rescue of an exhausted screen', () => {
    const keys = ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'];
    const testCatalog = apolloPool(keys, keys);
    const before = history([
      ['Zeus', 'ZeusWeaponBoon', 'Common'],
      ['Zeus', 'ZeusSpecialBoon', 'Rare'],
      ['Zeus', 'ZeusCastBoon', 'Epic'],
    ]);
    const context = { freshRarityOverride: 'Common' as const, replacementRollChance: 0 };
    const exchanges: readonly Row[] = [
      ['ApolloCastBoon', 'Heroic'],
      ['ApolloWeaponBoon', 'Rare'],
      ['ApolloSpecialBoon', 'Epic'],
    ];
    expect(
      finalSupported(offer(exchanges, [screen(...exchanges)]), before, context, testCatalog),
    ).toBe(true);
    expect(
      finalSupported(
        offer(exchanges.slice(1), [screen(...exchanges)]),
        before,
        context,
        testCatalog,
      ),
    ).toBe(false);
  });

  it('guesses the first legal chain ending on an item whose ban admits the final rows', () => {
    const final: readonly Row[] = [
      ['ApolloWeaponBoon', 'Common'],
      ['ApolloCastBoon', 'Common'],
      ['PerfectDamageBonusBoon', 'Common'],
    ];
    const guessed = guessRerolledScreens(input(createTraitHistoryState()), rows(...final), 2);
    expect(guessed).toHaveLength(2);
    expect(finalSupported(offer(final, guessed!))).toBe(true);
    expect(
      assessRerolledScreensSupport(input(createTraitHistoryState()), guessed!).map(
        (support) => support?.legal,
      ),
    ).toEqual([true, true]);
  });

  it('records each earlier screen with its rows, generation and Hymn exchange', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Common']]);
    const state = traitFrontierState(before, { stygianWell: { hymnUses: 1 } });
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      { kind: 'project' },
      'source',
      offer(
        [
          ['ApolloCastBoon', 'Common'],
          ['PerfectDamageBonusBoon', 'Common'],
          ['DoubleStrikeChanceBoon', 'Common'],
        ],
        [
          screen(
            ['ApolloWeaponBoon', 'Rare'],
            ['PerfectDamageBonusBoon', 'Common'],
            ['DoubleStrikeChanceBoon', 'Common'],
          ),
          null,
        ],
      ),
      state,
      {},
      0,
    );
    expect(evaluation.rerolledScreens?.map((entry) => entry.screen)).toEqual([0, 1]);
    expect(evaluation.rerolledScreens?.[1]?.missing).toBe(true);
    expect(evaluation.rerolledScreens?.[0]?.generation?.legal).toBe(true);
    expect(
      evaluation.rerolledScreens?.[0]?.assessments.some(
        (assessment) => assessment.replacementTransition !== undefined,
      ),
    ).toBe(true);
  });
});

describe('Fallback Gold screen rerolls', () => {
  // Denial turns off the rarity rescue: a failed Duo or Legendary check leaves
  // Gold while those boons stay in their buckets, so the game allows a reroll.
  const before = history([
    ['Apollo', 'ApolloWeaponBoon', 'Common'],
    ['Apollo', 'ApolloCastBoon', 'Common'],
    ['Apollo', 'DoubleStrikeChanceBoon', 'Common'],
    ['Apollo', 'ApolloExCastBoon', 'Common'],
    ['Zeus', 'ZeusSpecialBoon', 'Common'],
  ]);
  const testCatalog = apolloPool(['DoubleExManaBoon', 'ApolloSecondStageCastBoon']);
  const denial: ResolvedTraitOfferSource = {
    boonRarityFacts: {
      providerBase: { Rare: 0, Epic: 0, Heroic: 0, Duo: 0.12, Legendary: 0.1 },
      rollOrder: catalog.boonRarityRollOrder,
      contributions: [],
    },
    finalRarityRescueDisabled: true,
  };
  const gold = { options: [] } as AuthoredRerolledTraitScreen;
  const goldFinal = (
    earlier: readonly (AuthoredRerolledTraitScreen | null)[],
  ): import('@run-planner/engine/authored-project').AuthoredTraitOffer => ({
    kind: 'fallbackGold',
    giverKey: 'Apollo',
    rerolledScreens: earlier,
  });
  const supported = (value: import('@run-planner/engine/authored-project').AuthoredTraitOffer) =>
    assessInitialOfferSupport({ ...input(before, denial, testCatalog), offer: value }).legal;

  it('reroll a Gold screen into the Duo it failed to roll, or into Gold again', () => {
    expect(supported(offer([['ApolloSecondStageCastBoon', 'Duo']], [gold]))).toBe(true);
    expect(supported(goldFinal([gold]))).toBe(true);
    expect(supported(goldFinal([screen(['ApolloSecondStageCastBoon', 'Duo'])]))).toBe(true);
    // An Olympian's declared cores keep the reroll available on a Gold screen.
    expect(firstScreenRerollRefused(input(before, denial, testCatalog), gold)).toBe(false);
  });

  it('refuse rerolling a Gold screen with nothing left to draw', () => {
    const hermes = {
      ...catalog.traitGivers.byKey.Hermes!,
      traitKeys: [],
    };
    const emptyCatalog = {
      ...catalog,
      traitGivers: {
        ...catalog.traitGivers,
        byKey: { ...catalog.traitGivers.byKey, Hermes: hermes },
        values: catalog.traitGivers.values.map((entry) =>
          entry.key === 'Hermes' ? hermes : entry,
        ),
      },
    };
    const evaluation = evaluateReachedTraitOffer(
      emptyCatalog,
      { kind: 'project' },
      'source',
      { kind: 'fallbackGold', giverKey: 'Hermes', rerolledScreens: [gold] },
      traitFrontierState(createTraitHistoryState(), { catalog: emptyCatalog }),
      {},
      0,
    );
    expect(evaluation.rerolledScreens?.[0]).toMatchObject({ rerollRefused: true });
    expect(evaluation.generation?.legal).toBe(true);
  });
});

describe('rerolled screen snapshot', () => {
  it('copies every shown row field and leaves the pick and its dependents', () => {
    expect(
      rerolledTraitScreenSnapshot({
        options: [
          {
            traitKey: 'ApolloWeaponBoon',
            rarity: 'Rare',
            persephoneLevelBonus: 2,
            targetTraitKey: 'ZeusWeaponBoon',
          },
          { traitKey: 'ApolloCastBoon', rarity: 'Common', maxHealthRoll: 1 },
          { traitKey: 'ApolloManaBoon', rarity: 'Epic' },
        ],
        rejectedOptionKey: 'option3',
      }),
    ).toEqual({
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare', persephoneLevelBonus: 2 },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloManaBoon', rarity: 'Epic' },
      ],
      rejectedOptionKey: 'option3',
    });
  });
});

describe('NPC rerolled screens', () => {
  const npcInput = (testCatalog = catalog) =>
    traitOfferGenerationInput(
      testCatalog,
      'Artemis',
      traitFrontierState(createTraitHistoryState(), { catalog: testCatalog }),
      {},
    );
  const npcOffer = (
    final: readonly { readonly traitKey: string }[],
    earlier: readonly (AuthoredRerolledTraitScreen | null)[],
  ): AuthoredTraitOfferTraits => ({
    kind: 'traits',
    giverKey: 'Artemis',
    options: final.map(({ traitKey }) => ({ traitKey, rarity: 'Common' })) as never,
    selectedOptionKey: 'option1',
    ...(earlier.length === 0 ? {} : { rerolledScreens: earlier }),
  });
  const first = () => initialOfferStartingOptions(npcInput())!;

  it('ban one item of the previous screen once a screen is rerolled', () => {
    const rows = first();
    expect(rows).toHaveLength(3);
    const shown = { options: rows.map(({ traitKey }) => ({ traitKey, rarity: 'Common' })) };
    // An unrerolled NPC screen keeps its row checks only.
    expect(assessInitialOfferSupport({ ...npcInput(), offer: npcOffer(rows, []) }).applies).toBe(
      false,
    );
    expect(
      assessInitialOfferSupport({ ...npcInput(), offer: npcOffer(rows, [shown as never]) })
        .findings,
    ).toEqual([{ code: 'rollRepeatsAllOffers' }]);
    const chain = guessRerolledScreens(npcInput(), rows, 1)!;
    expect(assessInitialOfferSupport({ ...npcInput(), offer: npcOffer(rows, chain) }).legal).toBe(
      true,
    );
  });

  it('refuse the reroll of a first screen that shows every fresh trait', () => {
    const rows = first();
    const giver = {
      ...catalog.traitGivers.byKey.Artemis!,
      traitKeys: rows.map((row) => row.traitKey),
    };
    const testCatalog = {
      ...catalog,
      traitGivers: {
        ...catalog.traitGivers,
        byKey: { ...catalog.traitGivers.byKey, Artemis: giver },
        values: catalog.traitGivers.values.map((entry) =>
          entry.key === 'Artemis' ? giver : entry,
        ),
      },
    };
    const shown = {
      options: rows.map(({ traitKey }) => ({ traitKey, rarity: 'Common' as const })),
    };
    const evaluation = evaluateReachedTraitOffer(
      testCatalog,
      { kind: 'project' },
      'source',
      npcOffer(rows, [shown]),
      traitFrontierState(createTraitHistoryState(), { catalog: testCatalog }),
      {},
      0,
    );
    expect(evaluation.rerolledScreens?.[0]?.rerollRefused).toBe(true);
  });
});

describe('Pom level screens', () => {
  // Source reading (TraitLogic.lua: a forced-Common Pom screen fills only from the
  // Common bucket): a Duo- or Legendary-only boon is never a Pom level target.
  it('never level a Duo- or Legendary-only boon', () => {
    const highOnly = catalog.traits.values.filter(
      (trait) =>
        trait.rarityDomain.kind === 'ranked' &&
        trait.rarityDomain.freshOfferRarities.every(
          (rarity) => rarity === 'Duo' || rarity === 'Legendary',
        ),
    );
    expect(highOnly.length).toBeGreaterThan(0);
    expect(highOnly.filter((trait) => isPomEligibleTrait(catalog, trait.key))).toEqual([]);
  });

  it('guess a chain that never repeats the screen before, and none with nothing left', () => {
    const pool = ['A', 'B', 'C', 'D'];
    const guess = rerolledLevelScreensGuess(pool, ['A', 'B', 'C'], 3);
    const screens = [...guess!.map((screen) => screen.offeredTraitKeys), ['A', 'B', 'C']];
    for (let index = 1; index < screens.length; index += 1)
      expect([...screens[index]!].sort()).not.toEqual([...screens[index - 1]!].sort());
    expect(rerolledLevelScreensGuess(['A', 'B', 'C'], ['A', 'B', 'C'], 1)).toBeUndefined();
  });
});
