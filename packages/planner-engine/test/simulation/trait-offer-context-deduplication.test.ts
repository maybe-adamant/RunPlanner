import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';

import { selectedTraitOfferProducts } from '../../src/simulation/rewards/biome/selected-trait-products';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';
import { traitOfferContextIdentity } from '../../src/simulation/traits';
import { initializeTestRewardBranch } from '../support/arcana-fear';
import {
  arcanaFearWithActive,
  traitFrontierState,
  withInvestedHexOlympianTalent,
  openTimeTraitOfferContext,
} from '../support/simulation-state';

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
  it('leaves an earlier candidate context untouched by a later acquisition', () => {
    const initial = initializeTestRewardBranch();
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
    const products = selectedTraitOfferProducts(second.branch, [], catalog);
    const firstContext = products.candidateContexts.get(
      semanticAddressKey(createTraitOfferAddress(owner, 'first')),
    );
    const secondContext = products.candidateContexts.get(
      semanticAddressKey(createTraitOfferAddress(owner, 'second')),
    );
    if (firstContext === undefined || secondContext === undefined)
      throw new Error('both offers must retain a candidate context');
    expect(firstContext.state.traitHistory.equippedTraits.ApolloWeaponBoon).toBeUndefined();
    expect(firstContext.state.traitHistory.equippedTraits.HeraSpecialBoon).toBeUndefined();
    expect(secondContext.state.traitHistory.equippedTraits.ApolloWeaponBoon).toBeDefined();
    expect(secondContext.state.traitHistory.equippedTraits.HeraSpecialBoon).toBeUndefined();
  });

  it('keeps every deduplication identity input faithful under JSON serialization', () => {
    // The identity is compared through JSON.stringify, which silently corrupts
    // Sets, Maps and functions. A rich frontier exercising every identity
    // substate must survive a serialization round trip unchanged, so an
    // unfaithful member added to the identity fails here instead of silently
    // merging or splitting candidate contexts.
    const state = withInvestedHexOlympianTalent(
      traitFrontierState(undefined, {
        startingKeepsakeKey: 'LowHealthCritKeepsake',
        arcanaFear: arcanaFearWithActive(['ChanceRerollArcana']),
        stygianWell: { yarnUses: 1, hymnUses: 1 },
      }),
    );
    const source = Object.freeze({
      resolvedProviderKey: 'Apollo',
      devotionNoDuo: true,
      freshRarityOverride: 'Epic' as const,
    });
    const identity = traitOfferContextIdentity(openTimeTraitOfferContext({ state, source }));
    expect(JSON.parse(JSON.stringify(identity))).toEqual(identity);
  });
});
