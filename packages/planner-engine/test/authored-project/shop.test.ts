import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { locallyValidRewardOffers } from '../../src/reward-kernel';
import { shopOfferOptionValues } from '../../src/authored-project/shop';

describe('Shop offer option values', () => {
  it("lists each option of the slot's group with its locally valid offers", () => {
    const values = shopOfferOptionValues(catalog, 'F_Shop01', 'WorldShop', 'Boon');
    expect([...new Set(values.map((value) => value.optionKey))]).toEqual([
      'RandomLoot',
      'BlindBoxLoot',
      'ShopHermesUpgrade',
    ]);
    expect(values.filter((value) => value.optionKey === 'RandomLoot').map((v) => v.offer)).toEqual(
      locallyValidRewardOffers(catalog.rewards, 'RandomLoot'),
    );
  });

  it('resolves the Infernal Contract entry through its own profile', () => {
    const values = shopOfferOptionValues(
      catalog,
      'F_PreBoss01',
      'RoomShop',
      'infernalContractReward',
    );
    expect(values.map((value) => value.optionKey)).toContain('TalentDrop');
  });

  it('has nothing for an undeclared slot', () => {
    expect(shopOfferOptionValues(catalog, 'F_Shop01', 'WorldShop', 'missing')).toEqual([]);
  });
});
