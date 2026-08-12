import { catalog } from '@run-planner/hades2-catalog';
import type { AuthoredTraitOffer } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import {
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  recordReachedTraitOffer,
  traitCandidates,
  traitOfferCompositionDomains,
} from '../../src/simulation/traits';
import { suppressFearVow } from '../../src/simulation/arcana-fear';

const owner = { kind: 'project' } as const;

function denialState() {
  return createArcanaFearState(catalog, {
    ...createDefaultRouteLoadout(catalog),
    fearRanks: { BanUnpickedBoonsShrineUpgrade: 1 },
  });
}

function narrowedApolloCatalog(traitKeys: readonly string[]) {
  const giver = catalog.traitGivers.byKey.Apollo;
  if (giver === undefined) throw new Error('Apollo giver is missing');
  const narrowed = Object.freeze({ ...giver, traitKeys: Object.freeze(traitKeys) });
  return Object.freeze({
    ...catalog,
    traitGivers: Object.freeze({
      ...catalog.traitGivers,
      values: Object.freeze(
        catalog.traitGivers.values.map((candidate) =>
          candidate.key === 'Apollo' ? narrowed : candidate,
        ),
      ),
      byKey: Object.freeze({ ...catalog.traitGivers.byKey, Apollo: narrowed }),
    }),
  });
}

function reached(
  catalogForTest: typeof catalog,
  traitKeys: readonly string[],
  before = createTraitHistoryState(),
  selectedOptionKey: 'option1' | 'option2' | 'option3' = 'option1',
) {
  return evaluateReachedTraitOffer(
    catalogForTest,
    owner,
    'test',
    {
      kind: 'traits',
      giverKey: 'Apollo',
      options: traitKeys.map((traitKey) => ({ traitKey, rarity: 'Common' })) as unknown as Extract<
        AuthoredTraitOffer,
        { readonly kind: 'traits' }
      >['options'],
      selectedOptionKey,
    },
    before,
    {},
    1,
    denialState(),
  );
}

describe('Vow of Denial trait history', () => {
  it('preserves prior bans but stops new ones after Circe suppresses Denial', () => {
    const first = recordReachedTraitOffer(
      catalog,
      reached(catalog, ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon']),
      1,
      'test',
    );
    const suppressed = suppressFearVow(catalog, denialState(), 'BanUnpickedBoonsShrineUpgrade', {
      owner,
      sequence: 2,
    });
    if (!suppressed.legal) throw new Error('Denial must be Circe-removable');
    const second = evaluateReachedTraitOffer(
      catalog,
      owner,
      'test',
      {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
          { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
          { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
      first.history,
      {},
      2,
      suppressed.state,
    );
    expect(recordReachedTraitOffer(catalog, second, 2, 'test')).toMatchObject({
      history: expect.objectContaining({
        bannedTraitKeys: ['ApolloSpecialBoon', 'ApolloCastBoon'],
      }),
      event: expect.not.objectContaining({ bannedTraitKeys: expect.anything() }),
    });
  });

  it('does not derive bans from invalid selections or an NPC provider', () => {
    const invalid = evaluateReachedTraitOffer(
      catalog,
      owner,
      'test',
      {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Duo' },
        ],
        selectedOptionKey: 'option3',
      },
      createTraitHistoryState(),
      { devotionNoDuo: true },
      1,
      denialState(),
    );
    expect(recordReachedTraitOffer(catalog, invalid, 1, 'test').event).toBeUndefined();
    const npc = evaluateReachedTraitOffer(
      catalog,
      owner,
      'test',
      {
        kind: 'traits',
        giverKey: 'Medea',
        options: [
          { traitKey: 'HealingOnDeathCurse', rarity: 'Common' },
          { traitKey: 'MoneyOnDeathCurse', rarity: 'Common' },
          { traitKey: 'ManaOverTimeCurse', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
      createTraitHistoryState(),
      {},
      1,
      denialState(),
    );
    expect(recordReachedTraitOffer(catalog, npc, 1, 'test').event?.bannedTraitKeys).toBeUndefined();
  });
  it('keeps the catalog participant boundary exact and applies the same valid transition to Hermes', () => {
    expect(
      catalog.traitGivers.values
        .filter((giver) => giver.denialParticipates)
        .map((giver) => giver.key),
    ).toEqual([
      'Aphrodite',
      'Apollo',
      'Ares',
      'Demeter',
      'Hephaestus',
      'Hera',
      'Hestia',
      'Poseidon',
      'Zeus',
      'Hermes',
    ]);
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'test',
      {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
          { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
          { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
      createTraitHistoryState(),
      {},
      1,
      denialState(),
    );
    expect(recordReachedTraitOffer(catalog, evaluation, 1, 'test').event?.bannedTraitKeys).toEqual([
      'HermesSpecialBoon',
      'HermesCastDiscountBoon',
    ]);
  });

  it.each([
    [
      ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'],
      ['ApolloSpecialBoon', 'ApolloCastBoon'],
    ],
    [['ApolloWeaponBoon', 'ApolloSpecialBoon'], ['ApolloSpecialBoon']],
    [['ApolloWeaponBoon'], []],
  ] as const)('derives exactly the unselected bans from a valid %o outcome', (keys, expected) => {
    const testCatalog = narrowedApolloCatalog(keys);
    const evaluation = reached(testCatalog, keys);
    expect(evaluation.composition.legal).toBe(true);
    expect(evaluation.assessments.every((assessment) => assessment.legal)).toBe(true);
    expect(
      recordReachedTraitOffer(testCatalog, evaluation, 1, 'test').event?.bannedTraitKeys,
    ).toEqual(expected);
  });

  it('records neither event nor bans for a valid exhausted Fallback Gold outcome', () => {
    const testCatalog = narrowedApolloCatalog([]);
    const evaluation = evaluateReachedTraitOffer(
      testCatalog,
      owner,
      'test',
      { kind: 'fallbackGold', giverKey: 'Apollo' },
      createTraitHistoryState(),
      {},
      1,
      denialState(),
    );
    const applied = recordReachedTraitOffer(testCatalog, evaluation, 1, 'test');
    expect(evaluation.composition.legal).toBe(true);
    expect(applied).toEqual({ history: createTraitHistoryState() });
  });

  it('folds a real Denial selection into later candidates and reaches ordinary exhaustion without a Denial composition branch', () => {
    const keys = ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'];
    const testCatalog = narrowedApolloCatalog(keys);
    const applied = recordReachedTraitOffer(testCatalog, reached(testCatalog, keys), 1, 'test');
    expect(applied.history.bannedTraitKeys).toEqual(['ApolloSpecialBoon', 'ApolloCastBoon']);
    const laterCandidates = traitCandidates(testCatalog, 'Apollo', applied.history);
    expect(laterCandidates.filter((candidate) => candidate.available)).toEqual([]);
    expect(
      laterCandidates.filter((candidate) => candidate.traitKey === 'ApolloSpecialBoon'),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ available: false })]));
    expect(laterCandidates.filter((candidate) => candidate.traitKey === 'ApolloCastBoon')).toEqual(
      expect.arrayContaining([expect.objectContaining({ available: false })]),
    );
    const exhausted = evaluateReachedTraitOffer(
      testCatalog,
      owner,
      'test',
      { kind: 'fallbackGold', giverKey: 'Apollo' },
      applied.history,
      {},
      2,
      denialState(),
    );
    expect(exhausted.composition.legal).toBe(true);
    expect(exhausted.replacementComposition.legal).toBe(true);
    expect(recordReachedTraitOffer(testCatalog, exhausted, 2, 'test')).toEqual({
      history: applied.history,
    });
  });

  it('turns Denial-reduced ordinary availability into the existing replacement domain', () => {
    const testCatalog = narrowedApolloCatalog([
      'ApolloWeaponBoon',
      'ApolloSpecialBoon',
      'ApolloCastBoon',
      'ApolloSprintBoon',
    ]);
    const zeus = evaluateReachedTraitOffer(
      testCatalog,
      owner,
      'seed',
      {
        kind: 'traits',
        giverKey: 'Zeus',
        options: [
          { traitKey: 'ZeusSprintBoon', rarity: 'Common' },
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
          { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
      createTraitHistoryState(),
      {},
      1,
    );
    const occupied = recordReachedTraitOffer(testCatalog, zeus, 1, 'seed').history;
    const denial = recordReachedTraitOffer(
      testCatalog,
      reached(
        testCatalog,
        ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'],
        occupied,
        'option3',
      ),
      2,
      'test',
    );
    const domains = traitOfferCompositionDomains(testCatalog, 'Apollo', denial.history);
    expect(denial.history.bannedTraitKeys).toEqual(['ApolloWeaponBoon', 'ApolloSpecialBoon']);
    expect(domains.ordinary).toEqual([]);
    expect(domains.replacements).toEqual([
      expect.objectContaining({ traitKey: 'ApolloSprintBoon', rarity: 'Rare', available: true }),
    ]);
  });
});
