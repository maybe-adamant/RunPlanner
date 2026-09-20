import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';

import { mergeEquivalentRewardBranches } from '../../src/simulation/rewards/branch-primitives';
import { selectedTraitOfferProducts } from '../../src/simulation/rewards/biome/selected-trait-products';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';
import { evaluateReachedTraitOffer } from '../../src/simulation/traits';
import { createRewardBagState } from '../../src/reward-kernel';
import { initializeTestRewardBranches } from '../support/arcana-fear';

const owner = createIncomingRewardAddress(
  { kind: 'biome', routeKey: 'Underworld', biomeKey: 'F' },
  createOccurrenceId('context-dedup'),
);

function apolloOffer(): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Apollo',
    options: Object.freeze([
      Object.freeze({ traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const }),
      Object.freeze({ traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const }),
      Object.freeze({ traitKey: 'ApolloCastBoon', rarity: 'Common' as const }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    rarificationActions: Object.freeze([]),
  });
}

function heraOffer(): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Hera',
    options: Object.freeze([
      Object.freeze({ traitKey: 'HeraSpecialBoon', rarity: 'Common' as const }),
      Object.freeze({ traitKey: 'HeraCastBoon', rarity: 'Common' as const }),
      Object.freeze({ traitKey: 'HeraSprintBoon', rarity: 'Common' as const }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    rarificationActions: Object.freeze([]),
  });
}

describe('trait offer context deduplication', () => {
  it('merges retained evaluations whose snapshots differ only outside trait assessment', () => {
    const branch = initializeTestRewardBranches()[0]!;
    const source = Object.freeze({ resolvedProviderKey: 'Apollo' });
    const store = catalog.rewards.stores.byKey.RunProgress;
    if (store === undefined) throw new Error('missing RunProgress store');
    // Counted bags and pending Shop work are branch state, but no trait
    // eligibility, rarity or level rule consults them.
    const unrelated = Object.freeze({
      ...branch.state,
      bags: Object.freeze({ RunProgress: createRewardBagState(store) }),
      rewardPriorities: Object.freeze(['Boon']),
    });
    const left = Object.freeze({
      ...branch,
      traitEvaluations: Object.freeze([
        evaluateReachedTraitOffer(catalog, owner, 'self', apolloOffer(), branch.state, source, 0),
      ]),
    });
    const right = Object.freeze({
      ...branch,
      traitEvaluations: Object.freeze([
        evaluateReachedTraitOffer(catalog, owner, 'self', apolloOffer(), unrelated, source, 0),
      ]),
    });
    const merged = mergeEquivalentRewardBranches([left, right]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.traitEvaluations).toHaveLength(1);
  });

  it('retains divergent evaluations whose snapshots change the assessment they consume', () => {
    const branch = initializeTestRewardBranches()[0]!;
    const source = Object.freeze({ resolvedProviderKey: 'Apollo' });
    const yarned = Object.freeze({
      ...branch.state,
      stygianWell: Object.freeze({ ...branch.state.stygianWell, yarnUses: 1 }),
    });
    const plain = evaluateReachedTraitOffer(
      catalog,
      owner,
      'self',
      apolloOffer(),
      branch.state,
      source,
      0,
    );
    const boosted = evaluateReachedTraitOffer(
      catalog,
      owner,
      'self',
      apolloOffer(),
      yarned,
      source,
      0,
    );
    expect(plain.source.boonRarityFacts?.contributions).not.toEqual(
      boosted.source.boonRarityFacts?.contributions,
    );
    const merged = mergeEquivalentRewardBranches([
      Object.freeze({ ...branch, traitEvaluations: Object.freeze([plain]) }),
      Object.freeze({ ...branch, traitEvaluations: Object.freeze([boosted]) }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.traitEvaluations).toHaveLength(2);
  });

  it('leaves an earlier candidate context untouched by a later acquisition', () => {
    const initial = initializeTestRewardBranches()[0]!;
    const first = settleEncounterTraitOffer(
      catalog,
      initial,
      owner,
      apolloOffer(),
      1,
      'encounterCompleted',
      undefined,
      'first',
      undefined,
      {},
    );
    const second = settleEncounterTraitOffer(
      catalog,
      first.branch,
      owner,
      heraOffer(),
      2,
      'encounterCompleted',
      undefined,
      'second',
      undefined,
      {},
    );
    expect(second.branch.state.traitHistory.equippedTraits.ApolloWeaponBoon).toBeDefined();
    expect(second.branch.state.traitHistory.equippedTraits.HeraSpecialBoon).toBeDefined();
    const products = selectedTraitOfferProducts([second.branch], [], catalog);
    const firstContext = products.candidateContexts.get(
      semanticAddressKey(createTraitOfferAddress(owner, 'first')),
    )?.[0];
    const secondContext = products.candidateContexts.get(
      semanticAddressKey(createTraitOfferAddress(owner, 'second')),
    )?.[0];
    if (firstContext === undefined || secondContext === undefined)
      throw new Error('both offers must retain a candidate context');
    expect(firstContext.state.traitHistory.equippedTraits.ApolloWeaponBoon).toBeUndefined();
    expect(firstContext.state.traitHistory.equippedTraits.HeraSpecialBoon).toBeUndefined();
    expect(secondContext.state.traitHistory.equippedTraits.ApolloWeaponBoon).toBeDefined();
    expect(secondContext.state.traitHistory.equippedTraits.HeraSpecialBoon).toBeUndefined();
  });
});
