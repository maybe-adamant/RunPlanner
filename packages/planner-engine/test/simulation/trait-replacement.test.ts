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
