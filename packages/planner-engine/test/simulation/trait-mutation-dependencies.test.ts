import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  type AuthoredTraitOffer,
  type TraitOfferOwnerAddress,
} from '@run-planner/engine/authored-project';
import { attachTraitHistory, foldTraitHistoryEvents } from '../../src/simulation/traits';
import type { TraitOfferEvent } from '../../src/simulation/traits/history/model';
import { applyTraitOfferForAcquisition } from '../../src/simulation/rewards/trait-settlement/coordinator';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { echoGoldShop, shopBoonReward } from './shop-trait-purchase-support';

const occurrenceId = createOccurrenceId('mutation-room');
const hermes: AuthoredTraitOffer = Object.freeze({
  kind: 'traits',
  giverKey: 'Hermes',
  options: Object.freeze([
    { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
    { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
    { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
  ]),
  selectedOptionKey: 'option1',
}) as AuthoredTraitOffer;

/** A branch whose history holds one boon acquired from `boonOwner`. */
function afterBoonFrom(boonOwner: TraitOfferOwnerAddress): RewardBranchState {
  const base = initializeTestRewardBranches()[0]! as RewardBranchState;
  const history = foldTraitHistoryEvents(catalog, [
    Object.freeze({
      kind: 'traitOffer',
      owner: boonOwner,
      acquisitionRole: 'source',
      sequence: 1,
      giverKey: 'Apollo',
      options: Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as TraitOfferEvent['options'],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'roomRewardPickup',
    }) as TraitOfferEvent,
  ]);
  return Object.freeze({
    ...base,
    state: Object.freeze({
      ...base.state,
      traitHistory: history,
      rewardHistory: attachTraitHistory(base.state.rewardHistory, history),
    }),
  });
}

/** Prior same-room mutations a Hermes delivery screen in biome H would follow. */
function deliveryDependencies(branch: RewardBranchState) {
  const delivery = createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(
      createOccurrenceAddress(createBiomeAddress('Underworld', 'H'), occurrenceId),
      'hermesShrineDelivery',
    ),
    'delivery',
  );
  return applyTraitOfferForAcquisition(
    catalog,
    branch,
    { origin: delivery, traitOffersByAcquisitionRole: Object.freeze({ self: hermes }) },
    'self',
    'acquisitionEntry',
    2,
  ).priorTraitMutations;
}

describe('trait mutation timeline dependencies', () => {
  it('orders an entry pickup after the latest boon settled in its room', () => {
    const boon = createIncomingRewardAddress(createBiomeAddress('Underworld', 'H'), occurrenceId);
    expect(deliveryDependencies(afterBoonFrom(boon))).toEqual([
      { owner: boon, acquisitionRole: 'source' },
    ]);
  });

  it('adds no dependency when the room has no earlier mutation', () => {
    const elsewhere = createIncomingRewardAddress(
      createBiomeAddress('Underworld', 'H'),
      createOccurrenceId('other-room'),
    );
    expect(deliveryDependencies(afterBoonFrom(elsewhere))).toBeUndefined();
  });

  it('never matches a same-named occurrence in another biome', () => {
    const otherBiome = createIncomingRewardAddress(
      createBiomeAddress('Underworld', 'G'),
      occurrenceId,
    );
    expect(deliveryDependencies(afterBoonFrom(otherBiome))).toBeUndefined();
  });

  it('orders an Echo duplicate after its source screen in the same Shop', () => {
    const result = echoGoldShop(['Boon'], {
      includeDuplicate: true,
      rewardOverrides: { Boon: shopBoonReward('ZeusUpgrade', 'ZeusSpecialBoon') },
    });
    const duplicate = (result.settlement.roleFrontiers ?? []).find(
      (frontier) => frontier.settlement.entry.entryKey === 'echoDoubleShopReward',
    );
    expect(duplicate?.priorTraitMutations).toEqual([
      expect.objectContaining({
        owner: expect.objectContaining({ kind: 'shopOffer', offerKey: 'Boon' }),
      }),
    ]);
  });
});
