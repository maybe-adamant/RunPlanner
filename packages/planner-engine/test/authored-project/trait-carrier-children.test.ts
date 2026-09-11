import { catalog } from '@run-planner/hades2-catalog';
import {
  createIncomingRewardAddress,
  createTraitOfferAddress,
  discoverAuthoredTraitCarrierChildren,
  updateAuthoredTraitCarrierChild,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { goldenFBiome, goldenFStartId } from '@run-planner/test-fixtures/underworld';

const address = createTraitOfferAddress(
  createIncomingRewardAddress(goldenFBiome, goldenFStartId),
  'source',
);

function offer(traitKey: string): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: traitKey === 'AllElementalBoon' ? 'Hera' : 'Demeter',
    options: Object.freeze([
      Object.freeze({ traitKey, rarity: traitKey === 'GoodStuffBoon' ? 'Duo' : 'Legendary' }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    rarificationActions: Object.freeze([]),
  });
}

describe('trait carrier children', () => {
  it.each([
    ['Hera', 'BoonDecayBoon', 'HeraWeaponBoon'],
    ['Icarus', 'UpgradeHammerBoon', 'StaffDoubleAttackTrait'],
  ])(
    'retains and repairs the owned target for %s without changing sibling or offer data',
    (giverKey, traitKey, targetTraitKey) => {
      const value: AuthoredTraitOfferTraits = {
        kind: 'traits',
        giverKey,
        options: [
          { traitKey, ...(giverKey === 'Hera' ? { rarity: 'Common' as const } : {}) },
          { traitKey, targetTraitKey: 'retained-invalid-target' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      };
      const children = discoverAuthoredTraitCarrierChildren(catalog, address, value);
      expect(children).toHaveLength(1);
      const child = children[0];
      if (child?.kind !== 'traitAcquisitionTarget') throw new Error('target child missing');
      expect(child).toMatchObject({ traitKey, optionKey: 'option1', authoredComplete: false });
      const repaired = updateAuthoredTraitCarrierChild(value, {
        kind: 'traitAcquisitionTarget',
        child,
        targetTraitKey,
      });
      expect(repaired).toEqual({
        ...value,
        options: [{ ...value.options[0], targetTraitKey }, value.options[1]],
      });
      expect(repaired.options[1]).toBe(value.options[1]);
      expect(value.options[0]).not.toHaveProperty('targetTraitKey');
      const switched: AuthoredTraitOfferTraits = {
        ...value,
        options: [{ traitKey: 'HeraWeaponBoon', rarity: 'Common' }],
      };
      expect(discoverAuthoredTraitCarrierChildren(catalog, address, switched)).toEqual([]);
      expect(() =>
        updateAuthoredTraitCarrierChild(switched, {
          kind: 'traitAcquisitionTarget',
          child,
          targetTraitKey,
        }),
      ).toThrow('current selected trait');
    },
  );

  it('discovers All Together per-set children and preserves legal null as authored data', () => {
    const unresolved = offer('AllElementalBoon');
    const children = discoverAuthoredTraitCarrierChildren(catalog, address, unresolved);
    expect(children).toHaveLength(4);
    expect(
      children.every((child) => child.kind === 'allTogetherSet' && !child.authoredComplete),
    ).toBe(true);
    const earth = children[0];
    if (earth?.kind !== 'allTogetherSet') throw new Error('earth child missing');
    const complete = updateAuthoredTraitCarrierChild(unresolved, {
      kind: 'allTogetherSet',
      child: earth,
      allTogetherResult: Object.freeze({ earth: null, fire: null, air: null, water: null }),
    });
    expect(complete.options[0]?.allTogetherResult?.earth).toBeNull();
  });

  it('retains Natural Selection’s authored prefix structurally without treating it as contextual completion', () => {
    const unresolved = offer('GoodStuffBoon');
    const child = discoverAuthoredTraitCarrierChildren(catalog, address, unresolved)[0];
    if (child?.kind !== 'naturalSelectionResult')
      throw new Error('Natural Selection child missing');
    const prefix = updateAuthoredTraitCarrierChild(unresolved, {
      kind: 'naturalSelectionResult',
      child,
      targets: ['ApolloWeaponBoon'],
    });
    const discovered = discoverAuthoredTraitCarrierChildren(catalog, address, prefix)[0];
    expect(discovered).toMatchObject({
      kind: 'naturalSelectionResult',
      authoredComplete: true,
      targets: ['ApolloWeaponBoon'],
    });
  });
});
