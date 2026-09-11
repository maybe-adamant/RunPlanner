import { catalog } from '@run-planner/hades2-catalog';
import {
  createIncomingRewardAddress,
  createTraitOfferAddress,
  createDefaultAuthoredHexTree,
  discoverAuthoredTraitCarrierChildren,
  discoverAuthoredEchoLastRunBoonDraftChildren,
  prepareEchoLastRunBoonDraft,
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
      const children = discoverAuthoredTraitCarrierChildren(catalog, address, value).filter(
        (child) => child.kind === 'traitAcquisitionTarget',
      );
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
      expect(
        discoverAuthoredTraitCarrierChildren(catalog, address, switched).some(
          (child) => child.kind === 'traitAcquisitionTarget',
        ),
      ).toBe(false);
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
    const children = discoverAuthoredTraitCarrierChildren(catalog, address, unresolved).filter(
      (child) => child.kind === 'allTogetherSet',
    );
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

  it('distinguishes missing Circe and Echo Pom outcomes from explicit empty outcomes', () => {
    const circe: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Circe',
      options: [{ traitKey: 'RandomArcanaTrait' }],
      selectedOptionKey: 'option1',
    };
    const child = discoverAuthoredTraitCarrierChildren(catalog, address, circe)[0];
    if (child?.kind !== 'circeResolution') throw new Error('Circe child missing');
    expect(child.authoredComplete).toBe(false);
    const empty = updateAuthoredTraitCarrierChild(circe, {
      kind: 'circeResolution',
      child,
      value: { kind: 'activateArcana', arcanaKeys: [] },
    });
    expect(discoverAuthoredTraitCarrierChildren(catalog, address, empty)[0]).toMatchObject({
      kind: 'circeResolution',
      authoredComplete: true,
      value: { kind: 'activateArcana', arcanaKeys: [] },
    });
    const echo: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Echo',
      options: [{ traitKey: 'EchoDoubleLevelBoon' }],
      selectedOptionKey: 'option1',
    };
    const pom = discoverAuthoredTraitCarrierChildren(catalog, address, echo)[0];
    if (pom?.kind !== 'echoPomTarget') throw new Error('Echo Pom child missing');
    expect(pom.authoredComplete).toBe(false);
    const noTarget = updateAuthoredTraitCarrierChild(echo, {
      kind: 'echoPomTarget',
      child: pom,
      value: null,
    });
    expect(discoverAuthoredTraitCarrierChildren(catalog, address, noTarget)[0]).toMatchObject({
      kind: 'echoPomTarget',
      authoredComplete: true,
      value: null,
    });
  });

  it('keeps selected Echo carrier detail while a sibling row is incomplete', () => {
    const value: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Echo',
      options: [
        { traitKey: 'EchoLastRunBoon' },
        { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
      ],
      selectedOptionKey: 'option1',
    };
    const child = discoverAuthoredTraitCarrierChildren(catalog, address, value)[0];
    if (child?.kind !== 'echoLastRunBoon') throw new Error('Echo Boon child missing');
    const row = {
      giverKey: 'Hera',
      traitKey: 'BoonDecayBoon',
      rarity: 'Common' as const,
      targetTraitKey: 'DiminishingDodgeBoon',
    };
    const partial = [row, {}];
    expect(prepareEchoLastRunBoonDraft(value, child, partial, 0).complete).toBe(false);
    expect(discoverAuthoredEchoLastRunBoonDraftChildren(catalog, partial, 0)).toEqual([
      expect.objectContaining({
        kind: 'traitAcquisitionTarget',
        selectedIndex: 0,
        targetTraitKey: row.targetTraitKey,
        authoredComplete: true,
      }),
    ]);
    const completed = prepareEchoLastRunBoonDraft(
      value,
      child,
      [
        row,
        {
          giverKey: 'Zeus',
          traitKey: 'ZeusWeaponBoon',
          rarity: 'Common',
        },
      ],
      0,
    );
    expect(completed.complete).toBe(true);
    expect(completed.value?.options[0]?.echoLastRunBoon?.options[0]).toEqual(row);
    expect(completed.value?.options[1]).toBe(value.options[1]);
    expect(value.options[0]).not.toHaveProperty('echoLastRunBoon');
  });

  it('retains offer-owned values when the selected trait no longer provides their context', () => {
    const hexTree = createDefaultAuthoredHexTree(catalog, 'SpellPolymorphTrait');
    const value: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Echo',
      options: [{ traitKey: 'DiminishingDodgeBoon' }],
      selectedOptionKey: 'option1',
      hexTree,
      concaveStoneResult: { kind: 'noProc' },
    };
    const children = discoverAuthoredTraitCarrierChildren(catalog, address, value);
    expect(children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'hexTree', address, value: hexTree }),
        expect.objectContaining({ kind: 'concaveStone', address, value: { kind: 'noProc' } }),
      ]),
    );
    const stone = children.find((child) => child.kind === 'concaveStone');
    if (stone?.kind !== 'concaveStone') throw new Error('retained Stone child missing');
    const cleared = updateAuthoredTraitCarrierChild(value, {
      kind: 'concaveStone',
      child: stone,
      value: null,
    });
    expect(cleared).not.toHaveProperty('concaveStoneResult');
    expect(cleared.hexTree).toBe(hexTree);
    expect(cleared.options).toEqual(value.options);
    expect(value.concaveStoneResult).toEqual({ kind: 'noProc' });
  });
});
