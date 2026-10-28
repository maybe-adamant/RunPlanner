import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { locallyValidRewardOffers } from '../../src/reward-kernel';
import { shopOfferOptionValues } from '../../src/authored-project/shop';
import { infernalContractPedestalOptionValues } from '../../src/authored-project/infernal-contract-pedestal';

describe('Shop offer option values', () => {
  it("lists each option of the slot's group with its locally valid offers", () => {
    const values = shopOfferOptionValues(catalog, 'WorldShop', 'Boon');
    expect([...new Set(values.map((value) => value.optionKey))]).toEqual([
      'RandomLoot',
      'BlindBoxLoot',
      'ShopHermesUpgrade',
    ]);
    expect(values.filter((value) => value.optionKey === 'RandomLoot').map((v) => v.offer)).toEqual(
      locallyValidRewardOffers(catalog.rewards, 'RandomLoot'),
    );
  });

  it('resolves the Contract pedestal through its own profile, apart from the Shop', () => {
    const values = infernalContractPedestalOptionValues(catalog, 'G_PreBoss01');
    expect([...new Set(values.map((value) => value.optionKey))]).toEqual([
      'BlindBoxLoot',
      'StackUpgradeBig',
      'StackUpgrade',
      'TalentBigDrop',
      'TalentDrop',
    ]);
    expect(shopOfferOptionValues(catalog, 'WorldShop', 'infernalContractReward')).toEqual([]);
  });

  it('has nothing for an undeclared slot', () => {
    expect(shopOfferOptionValues(catalog, 'WorldShop', 'missing')).toEqual([]);
  });
});
