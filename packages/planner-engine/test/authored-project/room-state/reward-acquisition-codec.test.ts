import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { createDefaultAuthoredHexTree } from '../../../src/authored-project';
import { decodeRewardState } from '../../../src/authored-project/room-state/decoding/reward-acquisition-codec';
import { decodeRoomState } from '../../../src/authored-project/room-state/codec';
import { createTestDefaultRoomState as createDefaultRoomState } from '../support/default-room-state';
import { mutable, room, roomStatePath as path } from '../support/room-state-codec';

const polymorphLung = createDefaultAuthoredHexTree(catalog, 'SpellPolymorphTrait').nodes;

type MutableHexTree = {
  layoutKey: string;
  nodes: Record<string, string>;
};

type MutableTraitOffer = {
  kind: string;
  giverKey: string;
  options: Record<string, unknown>[];
  selectedOptionKey: string;
  rarificationActions: unknown[];
  hexTree?: MutableHexTree;
};

type MutableRewardWithHexOffer = {
  offer: Record<string, unknown>;
  dispositionByAcquisitionRole: Record<string, unknown>;
  traitOffersByAcquisitionRole: Record<string, MutableTraitOffer | undefined>;
};

describe('reward acquisition decoder', () => {
  function boonRewardWithPersephoneBonus(bonus: unknown, include = true) {
    const option: Record<string, unknown> = {
      traitKey: 'ApolloWeaponBoon',
      rarity: 'Common',
    };
    if (include) option.persephoneLevelBonus = bonus;
    return {
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      dispositionByAcquisitionRole: { source: { kind: 'normal' } },
      traitOffersByAcquisitionRole: {
        source: {
          kind: 'traits',
          giverKey: 'Apollo',
          options: [
            option,
            { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
            { traitKey: 'ApolloCastBoon', rarity: 'Common' },
          ],
          selectedOptionKey: 'option1',
          rarificationActions: [],
        },
      },
    };
  }

  it('round-trips absent and explicit Persephone contributions in reward acquisition state', () => {
    for (const [bonus, include] of [
      [undefined, false],
      [0, true],
      [5, true],
      [8, true],
    ] as const) {
      const decoded = decodeRewardState(
        boonRewardWithPersephoneBonus(bonus, include),
        catalog,
        '$.reward',
        { kind: 'producerLifecycle', key: 'roomRewardPickup' },
        'Underworld',
      );
      const option =
        decoded.traitOffersByAcquisitionRole.source?.kind === 'traits'
          ? decoded.traitOffersByAcquisitionRole.source.options[0]
          : undefined;
      if (!include) expect(option).not.toHaveProperty('persephoneLevelBonus');
      else expect(option?.persephoneLevelBonus).toBe(bonus);
    }
  });

  it.each([-1, 1.5, 9, '5', null, true] as const)(
    'rejects malformed Persephone contribution %s in reward acquisition state',
    (bonus) => {
      expect(() =>
        decodeRewardState(
          boonRewardWithPersephoneBonus(bonus),
          catalog,
          '$.reward',
          {
            kind: 'producerLifecycle',
            key: 'roomRewardPickup',
          },
          'Underworld',
        ),
      ).toThrow(/persephoneLevelBonus/);
    },
  );

  it('owns one complete tree at the resolved SpellDrop offer and rejects option-local trees', () => {
    const spellOffer = {
      offer: { rewardType: 'SpellDrop' },
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
      traitOffersByAcquisitionRole: {
        self: {
          kind: 'traits',
          giverKey: 'SpellDrop',
          options: [
            { traitKey: 'SpellPolymorphTrait' },
            { traitKey: 'SpellMeteorTrait' },
            { traitKey: 'SpellTransformTrait' },
          ],
          selectedOptionKey: 'option1',
          rarificationActions: [],
          hexTree: {
            layoutKey: 'Lung',
            nodes: { ...polymorphLung },
          },
        },
      },
    };
    const decoded = decodeRewardState(
      spellOffer,
      catalog,
      '$.reward',
      {
        kind: 'producerLifecycle',
        key: 'roomRewardPickup',
      },
      'Underworld',
    );
    expect(decoded.traitOffersByAcquisitionRole.self).toMatchObject({
      kind: 'traits',
      hexTree: spellOffer.traitOffersByAcquisitionRole.self.hexTree,
    });

    const missing = JSON.parse(JSON.stringify(spellOffer)) as MutableRewardWithHexOffer;
    const missingSelf = missing.traitOffersByAcquisitionRole.self;
    if (missingSelf === undefined) throw new Error('missing SpellDrop test offer');
    delete missingSelf.hexTree;
    expect(() =>
      decodeRewardState(
        missing,
        catalog,
        '$.reward',
        {
          kind: 'producerLifecycle',
          key: 'roomRewardPickup',
        },
        'Underworld',
      ),
    ).toThrow(/hexTree.*required/);

    const dormant = JSON.parse(JSON.stringify(spellOffer)) as MutableRewardWithHexOffer;
    const dormantSelf = dormant.traitOffersByAcquisitionRole.self;
    const dormantOption = dormantSelf?.options[0];
    if (dormantSelf === undefined || dormantOption === undefined)
      throw new Error('missing SpellDrop test option');
    dormantOption.hexTree = spellOffer.traitOffersByAcquisitionRole.self.hexTree;
    expect(() =>
      decodeRewardState(
        dormant,
        catalog,
        '$.reward',
        {
          kind: 'producerLifecycle',
          key: 'roomRewardPickup',
        },
        'Underworld',
      ),
    ).toThrow(/options\.option1\.hexTree: is not a project document field/);
  });

  const invalidHexOfferMutations: readonly [string, (offer: MutableRewardWithHexOffer) => void][] =
    [
      [
        'a Rare talent from another Hex pool',
        (offer) => {
          offer.traitOffersByAcquisitionRole.self!.hexTree!.nodes['4:1'] =
            'MeteorVulnerabilityDecalTalent';
        },
      ],
      [
        'a pool talent its depth cannot draw',
        (offer) => {
          offer.traitOffersByAcquisitionRole.self!.hexTree!.nodes['3:1'] = 'ChargeRegenTalent';
        },
      ],
      [
        'an Epic talent on a Keystone node',
        (offer) => {
          offer.traitOffersByAcquisitionRole.self!.hexTree!.nodes['4:1'] = 'PolymorphCurseTalent';
        },
      ],
      [
        'a node the layout does not declare',
        (offer) => {
          offer.traitOffersByAcquisitionRole.self!.hexTree!.nodes['7:2'] = 'PolymorphCurseTalent';
        },
      ],
      [
        'a missing node',
        (offer) => {
          delete offer.traitOffersByAcquisitionRole.self!.hexTree!.nodes['1:2'];
        },
      ],
      [
        'an authored Olympian node',
        (offer) => {
          offer.traitOffersByAcquisitionRole.self!.hexTree!.nodes['5:3'] = 'PolymorphZeusTalent';
        },
      ],
      [
        'a tree for a different selected Spell',
        (offer) => {
          offer.traitOffersByAcquisitionRole.self!.options = [
            { traitKey: 'SpellMeteorTrait' },
            { traitKey: 'SpellTransformTrait' },
            { traitKey: 'SpellLeapTrait' },
          ];
        },
      ],
      [
        'a Hex tree leaked onto a non-spell offer',
        (offer) => {
          const spellTree = offer.traitOffersByAcquisitionRole.self!.hexTree;
          offer.offer = {
            rewardType: 'Boon',
            payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
          };
          offer.dispositionByAcquisitionRole = { source: { kind: 'normal' } };
          offer.traitOffersByAcquisitionRole = {
            source: {
              kind: 'traits',
              giverKey: 'Apollo',
              options: [
                { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
                { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
                { traitKey: 'ApolloCastBoon', rarity: 'Common' },
              ],
              selectedOptionKey: 'option1',
              rarificationActions: [],
              ...(spellTree === undefined ? {} : { hexTree: spellTree }),
            },
          };
          delete offer.traitOffersByAcquisitionRole.self;
        },
      ],
    ];

  it.each(invalidHexOfferMutations)('rejects %s', (_label, mutate) => {
    const offer = {
      offer: { rewardType: 'SpellDrop' },
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
      traitOffersByAcquisitionRole: {
        self: {
          kind: 'traits',
          giverKey: 'SpellDrop',
          options: [
            { traitKey: 'SpellPolymorphTrait' },
            { traitKey: 'SpellMeteorTrait' },
            { traitKey: 'SpellTransformTrait' },
          ],
          selectedOptionKey: 'option1',
          rarificationActions: [],
          hexTree: {
            layoutKey: 'Lung',
            nodes: { ...polymorphLung },
          },
        },
      },
    } satisfies MutableRewardWithHexOffer;
    mutate(offer);
    expect(() =>
      decodeRewardState(
        offer,
        catalog,
        '$.reward',
        {
          kind: 'producerLifecycle',
          key: 'roomRewardPickup',
        },
        'Underworld',
      ),
    ).toThrow(/hexTree|Hex/);
  });

  it('keeps tree-wide conflicts representable and orders nodes by layout', () => {
    const offer = {
      offer: { rewardType: 'SpellDrop' },
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
      traitOffersByAcquisitionRole: {
        self: {
          kind: 'traits',
          giverKey: 'SpellDrop',
          options: [
            { traitKey: 'SpellPolymorphTrait' },
            { traitKey: 'SpellMeteorTrait' },
            { traitKey: 'SpellTransformTrait' },
          ],
          selectedOptionKey: 'option1',
          rarificationActions: [],
          hexTree: {
            layoutKey: 'Lung',
            nodes: {
              ...Object.fromEntries(Object.entries(polymorphLung).reverse()),
              '4:5': polymorphLung['4:1']!,
            },
          },
        },
      },
    };
    const decoded = decodeRewardState(
      offer,
      catalog,
      '$.reward',
      {
        kind: 'producerLifecycle',
        key: 'roomRewardPickup',
      },
      'Underworld',
    );
    const tree = (decoded.traitOffersByAcquisitionRole.self as { hexTree?: MutableHexTree })
      .hexTree;
    expect(tree?.nodes).toEqual({ ...polymorphLung, '4:5': polymorphLung['4:1'] });
    expect(Object.keys(tree?.nodes ?? {})).toEqual(Object.keys(polymorphLung));
  });

  it('owns the exact Boon acquisition and payload shape', () => {
    const value = {
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      dispositionByAcquisitionRole: { source: { kind: 'normal' } },
      traitOffersByAcquisitionRole: { source: null },
    };

    expect(
      decodeRewardState(
        value,
        catalog,
        '$.reward',
        {
          kind: 'producerLifecycle',
          key: 'roomRewardPickup',
        },
        'Underworld',
      ),
    ).toMatchObject({ offer: { rewardType: 'Boon' } });
    expect(() =>
      decodeRewardState(
        { ...value, unknown: true },
        catalog,
        '$.reward',
        {
          kind: 'producerLifecycle',
          key: 'roomRewardPickup',
        },
        'Underworld',
      ),
    ).toThrow('$.reward: unexpected key unknown');
  });

  it('decodes the declaration-bounded Fields optional inventory', () => {
    const declaration = room('H_Combat02');
    const context = {
      routeKey: 'Underworld',
      role: 'ordinary' as const,
      entryActive: true,
      activeCageCount: 2,
    };
    const state = mutable(createDefaultRoomState(catalog, declaration, context));
    state.optionalRewardCount = 0;
    expect(decodeRoomState(state, catalog, declaration, context, path)).toMatchObject({
      kind: 'fieldsCombat',
      optionalRewardCount: 0,
      optionalRewards: {
        optional1: expect.any(Object),
        optional2: expect.any(Object),
        optional3: expect.any(Object),
      },
    });
    state.optionalRewardCount = 4;
    expect(() => decodeRoomState(state, catalog, declaration, context, path)).toThrow(
      'must be within 0..3',
    );
  });

  it('requires the Anvil result exactly at the role that declares it, for any reward owner', () => {
    const source = { kind: 'producerLifecycle', key: 'RoomReward' } as const;
    const decode = (value: unknown) =>
      decodeRewardState(value, catalog, '$.reward', source, 'Underworld');
    const anvil = (extra: Record<string, unknown>) => ({
      offer: { rewardType: 'ChaosWeaponUpgrade' },
      traitOffersByAcquisitionRole: {},
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
      ...extra,
    });
    const result = {
      kind: 'anvilOfFates',
      removedTraitKey: null,
      addedTraitKeys: ['StaffLongAttackTrait', 'StaffJumpSpecialTrait'],
    };
    expect(() => decode(anvil({}))).toThrow(
      'anvilResultsByAcquisitionRole: is required for this Anvil reward',
    );
    expect(decode(anvil({ anvilResultsByAcquisitionRole: { self: null } }))).toMatchObject({
      anvilResultsByAcquisitionRole: { self: null },
    });
    expect(decode(anvil({ anvilResultsByAcquisitionRole: { self: result } }))).toMatchObject({
      anvilResultsByAcquisitionRole: { self: result },
    });
    expect(() => decode(anvil({ anvilResultsByAcquisitionRole: { other: null } }))).toThrow(
      'anvilResultsByAcquisitionRole',
    );
    expect(() =>
      decode(
        anvil({
          anvilResultsByAcquisitionRole: {
            self: { ...result, addedTraitKeys: ['StaffLongAttackTrait', 'StaffLongAttackTrait'] },
          },
        }),
      ),
    ).toThrow('must contain distinct traits');
    expect(() =>
      decode({
        offer: { rewardType: 'MaxHealthDrop' },
        traitOffersByAcquisitionRole: {},
        dispositionByAcquisitionRole: { self: { kind: 'normal' } },
        anvilResultsByAcquisitionRole: { self: null },
      }),
    ).toThrow('Anvil results are not supported for this reward');
  });

  it('requires the exact closed Pom role map and rejects it on non-Pom rewards', () => {
    const declaration = room('F_Combat04');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, {
        routeKey: 'Underworld',
        role: 'ordinary',
        entryActive: true,
        resolvedStoreKey: 'RunProgress',
      }),
    );
    raw.reward = {
      offer: { rewardType: 'StackUpgrade' },
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
      traitOffersByAcquisitionRole: {},
    };
    const reward = raw.reward as Record<string, unknown>;
    expect(() =>
      decodeRoomState(
        raw,
        catalog,
        declaration,
        { routeKey: 'Underworld', role: 'ordinary', entryActive: true },
        path,
      ),
    ).toThrow('levelResolutionsByAcquisitionRole: is required for this Pom reward');
    reward.levelResolutionsByAcquisitionRole = { self: { kind: 'random', targetTraitKey: null } };
    expect(() =>
      decodeRoomState(
        raw,
        catalog,
        declaration,
        { routeKey: 'Underworld', role: 'ordinary', entryActive: true },
        path,
      ),
    ).toThrow(
      'levelResolutionsByAcquisitionRole.self.targetTraitKey: is not a project document field',
    );
    reward.levelResolutionsByAcquisitionRole = {
      self: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
      extra: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
    };
    expect(() =>
      decodeRoomState(
        raw,
        catalog,
        declaration,
        { routeKey: 'Underworld', role: 'ordinary', entryActive: true },
        path,
      ),
    ).toThrow('must contain exactly every Pom acquisition role');
    reward.offer = { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } };
    reward.traitOffersByAcquisitionRole = {
      source: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    };
    reward.levelResolutionsByAcquisitionRole = {};
    expect(() =>
      decodeRoomState(
        raw,
        catalog,
        declaration,
        { routeKey: 'Underworld', role: 'ordinary', entryActive: true },
        path,
      ),
    ).toThrow('levelResolutionsByAcquisitionRole: Pom resolutions are not supported');
  });
});
