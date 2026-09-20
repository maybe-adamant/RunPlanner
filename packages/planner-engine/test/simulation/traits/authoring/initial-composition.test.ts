import { catalog } from '@run-planner/hades2-catalog';
import type {
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import {
  createTraitHistoryState,
  assessTraitOption,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  recordReachedTraitOffer,
  type TraitHistoryState,
  type ResolvedTraitOfferSource,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';
import {
  assessInitialOfferSupport,
  initialOfferStartingOptions,
} from '../../../../src/simulation/traits/authoring/initial-composition';
import { traitOfferGenerationInput } from '../../../../src/simulation/traits/authoring/assessment';
import { createTestArcanaFearState } from '../../../support/arcana-fear';
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

function offer(options: AuthoredTraitOfferTraits['options']): AuthoredTraitOfferTraits {
  return { kind: 'traits', giverKey: 'Apollo', options, selectedOptionKey: 'option1' };
}

const gold: AuthoredTraitOffer = { kind: 'fallbackGold', giverKey: 'Apollo' };
const fresh = createTraitHistoryState();

function supports(
  value: AuthoredTraitOffer,
  before = fresh,
  context: ResolvedTraitOfferSource = {},
  testCatalog = catalog,
  frontier: Parameters<typeof traitFrontierState>[1] = {},
): boolean {
  return assessInitialOfferSupport({
    ...traitOfferGenerationInput(
      testCatalog,
      value.giverKey,
      traitFrontierState(before, { catalog: testCatalog, ...frontier }),
      context,
    ),
    offer: value,
  }).legal;
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

describe('native initial offer construction', () => {
  it('reaches the Trial Duo rescue through valid acquired screens', () => {
    // Static authored choices reproduce the source witness; no generation helper
    // chooses the test's inputs and no equipped state is patched into place.
    const acquisitions = [
      ['Zeus', ['ZeusSpecialBoon', 'Epic'], 'ZeusWeaponBoon', 'ZeusCastBoon'],
      ['Apollo', 'ApolloWeaponBoon', 'ApolloCastBoon', 'ApolloManaBoon'],
      ['Apollo', 'ApolloCastBoon', 'PerfectDamageBonusBoon', 'ApolloRetaliateBoon'],
      ['Apollo', 'ApolloSprintBoon', 'PerfectDamageBonusBoon', 'ApolloRetaliateBoon'],
      ['Apollo', 'ApolloManaBoon', 'PerfectDamageBonusBoon', 'ApolloRetaliateBoon'],
      ['Apollo', 'ApolloRetaliateBoon', 'PerfectDamageBonusBoon', 'BlindChanceBoon'],
      ['Apollo', 'BlindChanceBoon', 'PerfectDamageBonusBoon', 'ApolloBlindBoon'],
      ['Apollo', 'ApolloBlindBoon', 'PerfectDamageBonusBoon', 'ApolloExCastBoon'],
      ['Apollo', 'ApolloExCastBoon', 'PerfectDamageBonusBoon', 'ApolloCastAreaBoon'],
      ['Apollo', 'ApolloCastAreaBoon', 'PerfectDamageBonusBoon', 'DoubleStrikeChanceBoon'],
      ['Apollo', 'DoubleStrikeChanceBoon', 'PerfectDamageBonusBoon', 'ElementalRallyBoon'],
      ['Apollo', 'ElementalRallyBoon', 'PerfectDamageBonusBoon', ['DoubleExManaBoon', 'Legendary']],
      [
        'Apollo',
        ['DoubleExManaBoon', 'Legendary'],
        'PerfectDamageBonusBoon',
        ['ApolloSpecialBoon', 'Heroic'],
      ],
    ] as const;
    const owner = { kind: 'project' } as const;
    let before = createTraitHistoryState();
    for (const [sequence, [giverKey, ...choices]] of acquisitions.entries()) {
      const value: AuthoredTraitOfferTraits = {
        kind: 'traits',
        giverKey,
        options: choices.map((choice) =>
          typeof choice === 'string'
            ? { traitKey: choice, rarity: 'Common' as const }
            : { traitKey: choice[0], rarity: choice[1] },
        ) as unknown as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1',
      };
      const reached = evaluateReachedTraitOffer(
        catalog,
        owner,
        'source',
        value,
        traitFrontierState(before),
        {},
        sequence,
      );
      expect(reached.generation?.legal, `acquisition ${sequence + 1}`).toBe(true);
      const acquired = recordReachedTraitOffer(catalog, reached, sequence, 'roomRewardPickup');
      expect(acquired.event, `acquisition ${sequence + 1}`).toBeDefined();
      before = acquired.history;
    }
    expect(before.events).toHaveLength(13);
    expect(before.elementCounts).toMatchObject({ Fire: 7, Air: 5 });
    const value = offer([
      { traitKey: 'PerfectDamageBonusBoon', rarity: 'Common' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Heroic' },
      { traitKey: 'ApolloSecondStageCastBoon', rarity: 'Duo' },
    ]);
    const trial = { ...value, selectedOptionKey: 'option3' as const };
    const reached = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      trial,
      traitFrontierState(before, { arcanaFear: createTestArcanaFearState() }),
      { devotionNoDuo: true },
      13,
    );
    expect(reached.generation?.legal).toBe(true);
    const acquired = recordReachedTraitOffer(catalog, reached, 13, 'roomRewardPickup');
    expect(acquired.history.equippedTraits.ApolloSecondStageCastBoon?.rarity).toBe('Duo');
    const short = offer([value.options[0], value.options[1]!]);
    expect(
      evaluateReachedTraitOffer(
        catalog,
        owner,
        'source',
        short,
        traitFrontierState(before, { arcanaFear: createTestArcanaFearState() }),
        { devotionNoDuo: true },
        13,
      ).generation?.legal,
    ).toBe(false);
    // This compares the final frontier's effective guard, not an alternate
    // Denial-active history with the same unbanned earlier screens.
    const denial = createTestArcanaFearState({ BanUnpickedBoonsShrineUpgrade: 1 });
    expect(
      evaluateReachedTraitOffer(
        catalog,
        owner,
        'source',
        trial,
        traitFrontierState(before, { arcanaFear: denial }),
        { devotionNoDuo: true },
        13,
      ).generation?.legal,
    ).toBe(false);
    expect(
      evaluateReachedTraitOffer(
        catalog,
        owner,
        'source',
        short,
        traitFrontierState(before, { arcanaFear: denial }),
        { devotionNoDuo: true },
        13,
      ).generation?.legal,
    ).toBe(true);

    const hera: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Hera',
      selectedOptionKey: 'option1',
      options: [
        { traitKey: 'HeraManaBoon', rarity: 'Rare' },
        { traitKey: 'DamageShareRetaliateBoon', rarity: 'Common' },
        { traitKey: 'SpawnCastDamageBoon', rarity: 'Common' },
      ],
    };
    const withHera = recordReachedTraitOffer(
      catalog,
      evaluateReachedTraitOffer(catalog, owner, 'source', hera, traitFrontierState(before), {}, 13),
      13,
      'roomRewardPickup',
    );
    expect(withHera.event).toBeDefined();
    expect(withHera.history.equippedTraits.ApolloManaBoon).toBeUndefined();
    expect(
      assessTraitOption(
        catalog,
        'RaiseDeadBoon',
        traitFrontierState(withHera.history),
        { resolvedProviderKey: 'Apollo' },
        'Duo',
      ).legal,
    ).toBe(true);
    expect(
      assessTraitOption(
        catalog,
        'RaiseDeadBoon',
        traitFrontierState(withHera.history),
        { resolvedProviderKey: 'Apollo', devotionNoDuo: true },
        'Duo',
      ).legal,
    ).toBe(false);
  });

  it('seeds three vacant cores, including Attack or Special when available', () => {
    expect(
      supports(
        offer([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Rare' },
          { traitKey: 'ApolloManaBoon', rarity: 'Epic' },
        ]),
      ),
    ).toBe(true);
    expect(
      supports(
        offer([
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
          { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
          { traitKey: 'ApolloManaBoon', rarity: 'Common' },
        ]),
      ),
    ).toBe(false);
    expect(
      supports(
        offer([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ]),
      ),
    ).toBe(false);
  });

  it('requires one vacant core later, without requiring Attack or Special', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Common']]);
    const value = offer([
      { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      { traitKey: 'PerfectDamageBonusBoon', rarity: 'Common' },
      { traitKey: 'DoubleStrikeChanceBoon', rarity: 'Common' },
    ]);
    expect(supports(value, before)).toBe(true);
    expect(
      supports(
        offer([
          { traitKey: 'ApolloRetaliateBoon', rarity: 'Common' },
          ...value.options.slice(1),
        ] as unknown as AuthoredTraitOfferTraits['options']),
        before,
      ),
    ).toBe(false);
    // A banned provider priority no longer establishes the occupied marker.
    expect(supports(value, { ...before, bannedTraitKeys: ['ApolloWeaponBoon'] })).toBe(false);
  });

  it('uses a successful replacement instead of an additional core seed', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Common']]);
    expect(
      supports(
        offer([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
          { traitKey: 'PerfectDamageBonusBoon', rarity: 'Common' },
          { traitKey: 'DoubleStrikeChanceBoon', rarity: 'Common' },
        ]),
        before,
        {},
        catalog,
        { stygianWell: { hymnUses: 1 } },
      ),
    ).toBe(true);
  });

  it('fills mandatory replacement vacancies from the full domain in any order', () => {
    const keys = ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'];
    const testCatalog = apolloPool(keys, keys);
    const before = history([
      ['Zeus', 'ZeusWeaponBoon', 'Common'],
      ['Zeus', 'ZeusSpecialBoon', 'Rare'],
      ['Zeus', 'ZeusCastBoon', 'Epic'],
    ]);
    const context = { freshRarityOverride: 'Common' as const, replacementRollChance: 0 };
    const value = offer([
      { traitKey: 'ApolloCastBoon', rarity: 'Heroic' },
      { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Epic' },
    ]);
    expect(supports(value, before, context, testCatalog)).toBe(true);
    expect(supports(offer([value.options[0]!]), before, context, testCatalog)).toBe(false);
    expect(supports(gold, before, context, testCatalog)).toBe(false);
  });

  it('uses present-zero final rescue, but not absent entries or active Denial', () => {
    const before = history([
      ['Apollo', 'ApolloWeaponBoon', 'Common'],
      ['Apollo', 'ApolloCastBoon', 'Common'],
      ['Apollo', 'DoubleStrikeChanceBoon', 'Common'],
    ]);
    const testCatalog = apolloPool(['DoubleExManaBoon']);
    const context: ResolvedTraitOfferSource = {
      boonRarityFacts: {
        providerBase: { Rare: 0, Epic: 0, Heroic: 0, Duo: 0, Legendary: 0 },
        rollOrder: catalog.boonRarityRollOrder,
        contributions: [],
      },
    };
    const value = offer([{ traitKey: 'DoubleExManaBoon', rarity: 'Legendary' }]);
    expect(supports(value, before, context, testCatalog)).toBe(true);
    expect(supports(gold, before, context, testCatalog)).toBe(false);
    expect(
      supports(gold, before, { ...context, finalRarityRescueDisabled: true }, testCatalog),
    ).toBe(true);
    expect(
      supports(value, before, { ...context, finalRarityRescueDisabled: true }, testCatalog),
    ).toBe(false);
    expect(supports(gold, before, { freshRarityOverride: 'Common' }, testCatalog)).toBe(true);
  });

  it('preserves failed draw attempts and repeated final rescue in native rarity order', () => {
    const before = history([
      ['Apollo', 'ApolloWeaponBoon', 'Common'],
      ['Apollo', 'ApolloCastBoon', 'Common'],
      ['Apollo', 'DoubleStrikeChanceBoon', 'Common'],
      ['Apollo', 'ApolloExCastBoon', 'Common'],
      ['Zeus', 'ZeusSpecialBoon', 'Common'],
    ]);
    const testCatalog = apolloPool(['DoubleExManaBoon', 'ApolloSecondStageCastBoon']);
    const value = offer([
      { traitKey: 'ApolloSecondStageCastBoon', rarity: 'Duo' },
      { traitKey: 'DoubleExManaBoon', rarity: 'Legendary' },
    ]);
    const context: ResolvedTraitOfferSource = {
      boonRarityFacts: {
        providerBase: { Rare: 0, Epic: 0, Heroic: 0, Duo: 0.12, Legendary: 0.1 },
        rollOrder: catalog.boonRarityRollOrder,
        contributions: [],
      },
    };
    expect(supports(value, before, context, testCatalog)).toBe(true);
    expect(supports(offer([value.options[0]!]), before, context, testCatalog)).toBe(false);
    expect(
      supports(
        offer([value.options[0]!]),
        before,
        { ...context, finalRarityRescueDisabled: true },
        testCatalog,
      ),
    ).toBe(true);
    expect(
      supports(gold, before, { ...context, finalRarityRescueDisabled: true }, testCatalog),
    ).toBe(true);
    expect(
      initialOfferStartingOptions(
        traitOfferGenerationInput(testCatalog, 'Apollo', traitFrontierState(before), {
          boonRarityFacts: {
            ...context.boonRarityFacts!,
            providerBase: {
              Rare: 0,
              Epic: 0,
              Heroic: 0,
              Duo: 0,
              Legendary: 0,
            },
          },
        }),
      ),
    ).toEqual([
      { traitKey: 'DoubleExManaBoon', rarity: 'Legendary' },
      { traitKey: 'ApolloSecondStageCastBoon', rarity: 'Duo' },
    ]);
  });

  it('admits the source-probed linked seed under guaranteed Duo pressure', () => {
    const before = history([
      ['Apollo', 'ApolloWeaponBoon', 'Common'],
      ['Apollo', 'ApolloCastBoon', 'Common'],
      ['Poseidon', 'PoseidonSprintBoon', 'Common'],
      ['Hera', 'HeraManaBoon', 'Common'],
    ]);
    const value = offer([
      { traitKey: 'ApolloSpecialBoon', rarity: 'Epic' },
      { traitKey: 'BlindChanceBoon', rarity: 'Epic' },
      { traitKey: 'PoseidonSplashSprintBoon', rarity: 'Duo' },
    ]);
    const context: ResolvedTraitOfferSource = {
      boonRarityFacts: {
        providerBase: catalog.boonRarityBases.olympian,
        rollOrder: catalog.boonRarityRollOrder,
        contributions: [
          { additive: { Duo: 0.12 } },
          ...Array.from({ length: 8 }, () => ({
            additive: { Rare: 1, Epic: 0.25, Duo: 0.1, Legendary: 0.1 },
          })),
        ],
      },
    };
    expect(supports(value, before, context)).toBe(true);
    expect(
      supports(
        offer([value.options[0]!, value.options[2]!, { traitKey: 'RaiseDeadBoon', rarity: 'Duo' }]),
        before,
        context,
      ),
    ).toBe(true);
    const input = traitOfferGenerationInput(catalog, 'Apollo', traitFrontierState(before), context);
    const declaration = catalog.traits.byKey.BlindChanceBoon!;
    const noPriorityCatalog = {
      ...catalog,
      traits: {
        ...catalog.traits,
        byKey: {
          ...catalog.traits.byKey,
          BlindChanceBoon: { ...declaration, optionalLinkedPriority: false },
        },
      },
    };
    expect(
      assessInitialOfferSupport({ ...input, catalog: noPriorityCatalog, offer: value }).legal,
    ).toBe(false);
    // Below guaranteed pressure the same linked identity can enter normal fill.
    expect(supports(value, before, {}, noPriorityCatalog)).toBe(true);
    expect(
      supports(offer([value.options[2]!, value.options[0]!, value.options[1]!]), before, context),
    ).toBe(true);
  });
});
