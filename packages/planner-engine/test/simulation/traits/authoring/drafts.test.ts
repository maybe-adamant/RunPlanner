import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import {
  optionIndex,
  type AuthoredTraitOfferTraits,
} from '../../../../src/authored-project/traits/state';
import {
  appendTraitOfferDraft,
  removeTraitOfferDraft,
  traitOfferStartingOutcome,
} from '../../../../src/simulation/traits/authoring/drafts';
import { createTraitHistoryState } from '../../../../src/simulation/traits/history/fold';
import { evaluateReachedTraitOffer } from '../../../../src/simulation/traits/offers';
import { traitFrontierState } from '../../../support/simulation-state';

const before = createTraitHistoryState();
const owner = { kind: 'project' } as const;
const full: AuthoredTraitOfferTraits = {
  kind: 'traits',
  giverKey: 'Apollo',
  selectedOptionKey: 'option3',
  options: [
    { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
    { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
    { traitKey: 'ApolloCastBoon', rarity: 'Common' },
  ],
};

describe('ordinary trait draft structure', () => {
  it('allows sparse and Gold repair without requiring a valid full-screen completion', () => {
    const short = removeTraitOfferDraft(catalog, full);
    if (short?.kind !== 'traits') throw new Error('expected two rows');
    expect(short.options).toEqual(full.options.slice(0, 2));
    expect(short.selectedOptionKey).toBe('option2');
    expect(
      evaluateReachedTraitOffer(catalog, owner, 'source', short, traitFrontierState(before), {}, 1)
        .generation?.legal,
    ).toBe(false);
    expect(
      appendTraitOfferDraft(catalog, short, traitFrontierState(before), {})?.options,
    ).toHaveLength(3);
    expect(appendTraitOfferDraft(catalog, full, traitFrontierState(before), {})).toBeUndefined();
    const one = removeTraitOfferDraft(catalog, short);
    if (one?.kind !== 'traits') throw new Error('expected one row');
    const gold = removeTraitOfferDraft(catalog, { ...one, rarificationActions: ['option1'] });
    expect(gold).toEqual({ kind: 'fallbackGold', giverKey: 'Apollo' });
    if (gold === undefined) throw new Error('expected Gold');
    expect(
      evaluateReachedTraitOffer(catalog, owner, 'source', gold, traitFrontierState(before), {}, 1)
        .generation?.legal,
    ).toBe(false);
    expect(
      appendTraitOfferDraft(catalog, gold, traitFrontierState(before), {})?.options,
    ).toHaveLength(1);
  });

  it('returns a valid empty terminal for exhausted initial authoring and Start over', () => {
    const giver = { ...catalog.traitGivers.byKey.Hermes!, traitKeys: [], priorityTraitKeys: [] };
    const exhausted = {
      ...catalog,
      traitGivers: {
        ...catalog.traitGivers,
        byKey: { ...catalog.traitGivers.byKey, Hermes: giver },
        values: catalog.traitGivers.values.map((entry) => (entry.key === 'Hermes' ? giver : entry)),
      },
    };
    const outcome = traitOfferStartingOutcome(exhausted, 'Hermes', traitFrontierState(before), {});
    expect(outcome).toEqual({ kind: 'fallbackGold', giverKey: 'Hermes' });
    if (outcome === undefined) throw new Error('expected empty terminal');
    expect(
      evaluateReachedTraitOffer(
        exhausted,
        owner,
        'source',
        outcome,
        traitFrontierState(before),
        {},
        1,
      ).generation?.legal,
    ).toBe(true);
    expect(
      appendTraitOfferDraft(exhausted, outcome, traitFrontierState(before), {}),
    ).toBeUndefined();
    expect(traitOfferStartingOutcome(exhausted, 'Hermes', traitFrontierState(before), {})).toEqual(
      outcome,
    );
  });

  it('retains surviving rows and repair references but clears an invalidated Stone residual', () => {
    const value: AuthoredTraitOfferTraits = {
      ...full,
      selectedOptionKey: 'option1',
      rarificationActions: ['option2', 'option3'],
      rejectedOptionKey: 'option3',
      concaveStoneResult: { kind: 'proc', optionKey: 'option3' },
    };
    const short = removeTraitOfferDraft(catalog, value);
    if (short?.kind !== 'traits') throw new Error('expected traits');
    expect(short.options[0]).toBe(value.options[0]);
    expect(short.options[1]).toBe(value.options[1]);
    expect(short.rarificationActions).toBe(value.rarificationActions);
    expect(short.rejectedOptionKey).toBe('option3');
    expect(short.concaveStoneResult).toBeUndefined();
    expect(short.options[optionIndex(short.selectedOptionKey)]).toBeDefined();
    const retained = removeTraitOfferDraft(catalog, {
      ...value,
      concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
    });
    expect(retained?.kind === 'traits' && retained.concaveStoneResult).toEqual({
      kind: 'proc',
      optionKey: 'option2',
    });
  });

  it('disables Add when a short draft already contains every individually eligible identity', () => {
    const giver = {
      ...catalog.traitGivers.byKey.Hermes!,
      traitKeys: ['HermesWeaponBoon'],
      priorityTraitKeys: [],
    };
    const oneChoice = {
      ...catalog,
      traitGivers: {
        ...catalog.traitGivers,
        byKey: { ...catalog.traitGivers.byKey, Hermes: giver },
        values: catalog.traitGivers.values.map((entry) => (entry.key === 'Hermes' ? giver : entry)),
      },
    };
    const value = traitOfferStartingOutcome(oneChoice, 'Hermes', traitFrontierState(before), {});
    if (value?.kind !== 'traits') throw new Error('expected the remaining Hermes trait');
    expect(value.options).toHaveLength(1);
    expect(appendTraitOfferDraft(oneChoice, value, traitFrontierState(before), {})).toBeUndefined();
  });

  it.each(['WeaponUpgrade', 'SpellDrop', 'Athena', 'Icarus', 'Echo', 'Chaos'])(
    'keeps %s outside ordinary shape editing at the engine boundary',
    (giverKey) => {
      const value = { ...full, giverKey };
      expect(removeTraitOfferDraft(catalog, value)).toBeUndefined();
      expect(appendTraitOfferDraft(catalog, value, traitFrontierState(before), {})).toBeUndefined();
    },
  );
});
