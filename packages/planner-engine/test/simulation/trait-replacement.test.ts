import { catalog } from '@run-planner/hades2-catalog';
import {
  assessTraitOption,
  assessTraitReplacementComposition,
  createTraitHistoryState,
  foldTraitOfferEvents,
  traitCandidates,
  recordReachedTraitOffer,
  evaluateReachedTraitOffer,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import type { AuthoredTraitOffer } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

const owner = { kind: 'project' } as const;

function history(entries: readonly [string, string, string][]) {
  return foldTraitOfferEvents(
    catalog,
    entries.map(([giverKey, traitKey, rarity], index) => {
      const giver = catalog.traitGivers.byKey[giverKey]!;
      return {
        owner,
        acquisitionRole: `seed${index}`,
        sequence: index,
        giverKey,
        options: Object.freeze([
          { traitKey, rarity },
          { traitKey: giver.traitKeys[1]! },
          { traitKey: giver.traitKeys[2]! },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'test',
      };
    }),
  );
}

function offer(giverKey: string, options: AuthoredTraitOffer['options']): AuthoredTraitOffer {
  return Object.freeze({ giverKey, options, selectedOptionKey: 'option1' });
}

function narrowApolloCatalog() {
  const giver = catalog.traitGivers.byKey.Apollo;
  if (giver === undefined) throw new Error('Apollo giver is missing');
  const traitKeys = ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'] as const;
  const narrowed = Object.freeze({
    ...giver,
    traitKeys: Object.freeze([...traitKeys]),
    priorityTraitKeys: Object.freeze([...traitKeys]),
  });
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

function historyFor(testCatalog: typeof catalog, entries: readonly [string, string, string][]) {
  return foldTraitOfferEvents(
    testCatalog,
    entries.map(([giverKey, traitKey, rarity], index) => {
      const giver = testCatalog.traitGivers.byKey[giverKey]!;
      return {
        owner,
        acquisitionRole: `seed${index}`,
        sequence: index,
        giverKey,
        options: Object.freeze([
          { traitKey, rarity },
          { traitKey: giver.traitKeys[1]! },
          { traitKey: giver.traitKeys[2]! },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'test',
      };
    }),
  );
}

describe('derived Olympian trait replacement', () => {
  it.each([
    ['Common', 'Rare'],
    ['Rare', 'Epic'],
    ['Epic', 'Heroic'],
  ] as const)('promotes %s occupants exactly to %s', (oldRarity, requiredRarity) => {
    const before = history([['Zeus', 'ZeusWeaponBoon', oldRarity]]);
    const assessment = assessTraitOption(
      catalog,
      'ApolloWeaponBoon',
      before,
      { resolvedProviderKey: 'Apollo' },
      requiredRarity,
    );
    expect(assessment.legal).toBe(true);
    expect(assessment.replacementTransition).toEqual({
      slot: 'Melee',
      replacedTraitKey: 'ZeusWeaponBoon',
      oldRarity,
      newTraitKey: 'ApolloWeaponBoon',
      requiredRarity,
    });
  });

  it('rejects Heroic occupants and wrong promoted rarity', () => {
    const heroic = assessTraitOption(
      catalog,
      'ApolloWeaponBoon',
      history([['Zeus', 'ZeusWeaponBoon', 'Heroic']]),
      { resolvedProviderKey: 'Apollo' },
      'Heroic',
    );
    expect(heroic.legal).toBe(false);
    expect(heroic.findings.map((finding) => finding.code)).toContain('replacementMaximumRarity');
    const wrong = assessTraitOption(
      catalog,
      'ApolloWeaponBoon',
      history([['Zeus', 'ZeusWeaponBoon', 'Common']]),
      { resolvedProviderKey: 'Apollo' },
      'Epic',
    );
    expect(wrong.legal).toBe(false);
    expect(wrong.findings).toContainEqual({
      code: 'replacementRarityMismatch',
      traitKey: 'ApolloWeaponBoon',
      detail: 'Rare:Epic',
    });
  });

  it('reports both fresh-domain and promotion errors for stale Heroic replacement rarity', () => {
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      offer(
        'Apollo',
        Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Heroic' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ]) as AuthoredTraitOffer['options'],
      ),
      history([['Zeus', 'ZeusWeaponBoon', 'Common']]),
      {},
      1,
    );
    const assessment = evaluation.assessments[0];
    expect(assessment).toBeDefined();
    if (assessment === undefined) throw new Error('Apollo replacement assessment is missing');
    expect(assessment.legal).toBe(false);
    expect(assessment.findings).toEqual([
      {
        code: 'replacementRarityMismatch',
        traitKey: 'ApolloWeaponBoon',
        detail: 'Rare:Heroic',
      },
      {
        code: 'freshRarityUnavailable',
        traitKey: 'ApolloWeaponBoon',
        detail: 'Heroic',
      },
    ]);
    expect(recordReachedTraitOffer(catalog, evaluation, 2, 'test').event).toBeUndefined();
  });

  it('folds only the selected replacement and recomputes the equipped ledger', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Common']]);
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as AuthoredTraitOffer['options'],
    );
    const evaluation = evaluateReachedTraitOffer(catalog, owner, 'source', value, before, {}, 1);
    const applied = recordReachedTraitOffer(catalog, evaluation, 2, 'test');
    expect(applied.event?.replacementTransition?.replacedTraitKey).toBe('ZeusWeaponBoon');
    expect(applied.history.equippedTraits.ZeusWeaponBoon).toBeUndefined();
    expect(applied.history.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Rare');
    expect(applied.history.ordinaryBoonSlots.Melee?.traitKey).toBe('ApolloWeaponBoon');
    expect(applied.history.events).toHaveLength(2);
  });

  it('rejects a stale Heroic fresh offer after its upstream occupant is replaced away', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Epic']]);
    const replacement = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      offer(
        'Apollo',
        Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Heroic' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ]) as AuthoredTraitOffer['options'],
      ),
      before,
      {},
      1,
    );
    const after = recordReachedTraitOffer(catalog, replacement, 2, 'test').history;
    expect(after.equippedTraits.ZeusWeaponBoon).toBeUndefined();
    expect(after.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Heroic');

    const stale = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      offer(
        'Zeus',
        Object.freeze([
          { traitKey: 'ZeusSpecialBoon', rarity: 'Heroic' },
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' },
        ]) as AuthoredTraitOffer['options'],
      ),
      after,
      {},
      2,
    );
    expect(stale.assessments[0]).toEqual({
      legal: false,
      findings: [
        {
          code: 'freshRarityUnavailable',
          traitKey: 'ZeusSpecialBoon',
          detail: 'Heroic',
        },
      ],
    });
    expect(recordReachedTraitOffer(catalog, stale, 3, 'test').event).toBeUndefined();
  });

  it('allows two replacements when one ordinary key remains', () => {
    const testCatalog = narrowApolloCatalog();
    const before = historyFor(testCatalog, [
      ['Zeus', 'ZeusWeaponBoon', 'Common'],
      ['Zeus', 'ZeusSpecialBoon', 'Common'],
    ]);
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as AuthoredTraitOffer['options'],
    );
    const composition = assessTraitReplacementComposition(testCatalog, value, before);
    expect(composition).toMatchObject({
      ordinaryCandidateCount: 1,
      maximumReplacementCount: 2,
      replacementCount: 2,
      legal: true,
    });
  });

  it('allows three replacements when no ordinary key remains', () => {
    const testCatalog = narrowApolloCatalog();
    const before = historyFor(testCatalog, [
      ['Zeus', 'ZeusWeaponBoon', 'Common'],
      ['Zeus', 'ZeusSpecialBoon', 'Common'],
      ['Zeus', 'ZeusCastBoon', 'Common'],
    ]);
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
        { traitKey: 'ApolloCastBoon', rarity: 'Rare' },
      ]) as AuthoredTraitOffer['options'],
    );
    const composition = assessTraitReplacementComposition(testCatalog, value, before);
    expect(composition).toMatchObject({
      ordinaryCandidateCount: 0,
      maximumReplacementCount: 3,
      replacementCount: 3,
      legal: true,
    });
  });

  it('does not mutate state for unselected replacement alternatives', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Common']]);
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      Object.freeze({
        giverKey: 'Apollo',
        options: Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ]) as AuthoredTraitOffer['options'],
        selectedOptionKey: 'option2' as const,
      }),
      before,
      {},
      1,
    );
    const applied = recordReachedTraitOffer(catalog, evaluation, 2, 'test');
    expect(applied.event?.selectedOptionKey).toBe('option2');
    expect(applied.history.equippedTraits.ZeusWeaponBoon).toBeDefined();
    expect(applied.history.equippedTraits.ApolloSpecialBoon).toBeDefined();
  });

  it('keeps failed offer requirements on replacement-shaped options', () => {
    const assessment = assessTraitOption(
      catalog,
      'ApolloWeaponBoon',
      history([['Zeus', 'ZeusWeaponBoon', 'Common']]),
      { resolvedProviderKey: 'Apollo', devotionNoDuo: true },
      'Duo',
    );
    expect(assessment.legal).toBe(false);
    expect(assessment.findings).toEqual([
      { code: 'offerContext', traitKey: 'ApolloWeaponBoon', detail: 'devotionNoDuo' },
      { code: 'occupiedBoonSlot', traitKey: 'ApolloWeaponBoon', detail: 'Melee' },
      { code: 'replacementRarityMismatch', traitKey: 'ApolloWeaponBoon', detail: 'Rare:Duo' },
      { code: 'freshRarityUnavailable', traitKey: 'ApolloWeaponBoon', detail: 'Duo' },
    ]);
  });

  it('recomputes derived facts after a selected replacement', () => {
    const before = history([['Zeus', 'ZeusCastBoon', 'Common']]);
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      offer(
        'Apollo',
        Object.freeze([
          { traitKey: 'ApolloCastBoon', rarity: 'Rare' },
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        ]) as AuthoredTraitOffer['options'],
      ),
      before,
      {},
      1,
    );
    const after = recordReachedTraitOffer(catalog, evaluation, 2, 'test').history;
    expect(after.elementCounts).toEqual({ Aether: 0, Earth: 0, Air: 0, Fire: 1, Water: 0 });
    expect(after.godBoonRarityCounts).toEqual({ Rare: 1 });
    expect(after.upgradableTraitCount).toBe(1);
    expect(after.ordinaryBoonSlots.Ranged?.traitKey).toBe('ApolloCastBoon');
  });

  it('limits replacements independently of ordinary option legality', () => {
    const before = history([
      ['Zeus', 'ZeusWeaponBoon', 'Common'],
      ['Zeus', 'ZeusSpecialBoon', 'Common'],
      ['Zeus', 'ZeusCastBoon', 'Common'],
    ]);
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
        { traitKey: 'ApolloCastBoon', rarity: 'Rare' },
      ]) as AuthoredTraitOffer['options'],
    );
    const composition = assessTraitReplacementComposition(catalog, value, before);
    expect(composition.ordinaryCandidateCount).toBeGreaterThanOrEqual(2);
    expect(composition.maximumReplacementCount).toBe(1);
    expect(composition.replacementCount).toBe(3);
    expect(composition.legal).toBe(false);
  });

  it('does not expose Heroic as a fresh candidate', () => {
    const candidates = traitCandidates(catalog, 'Apollo', createTraitHistoryState());
    expect(candidates.some((candidate) => candidate.rarity === 'Heroic')).toBe(false);
  });
});
