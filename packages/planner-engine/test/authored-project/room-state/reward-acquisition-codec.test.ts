import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { decodeRewardState } from '../../../src/authored-project/room-state/reward-acquisition-codec';
import { decodeRoomState } from '../../../src/authored-project/room-state/codec';
import { createTestDefaultRoomState as createDefaultRoomState } from '../support/default-room-state';
import { mutable, room, roomStatePath as path } from '../support/room-state-codec';

type MutableHexTree = {
  layoutKey: string;
  rareTalentKeys: string[];
  epicTalentKeys: string[];
};

type MutableTraitOffer = {
  kind: string;
  giverKey: string;
  options: unknown[];
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
        decodeRewardState(boonRewardWithPersephoneBonus(bonus), catalog, '$.reward', {
          kind: 'producerLifecycle',
          key: 'roomRewardPickup',
        }),
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
            rareTalentKeys: ['PolymorphBossDamageTalent', 'PolymorphDeathExplodeTalent'],
            epicTalentKeys: ['PolymorphSandwichTalent'],
          },
        },
      },
    };
    const decoded = decodeRewardState(spellOffer, catalog, '$.reward', {
      kind: 'producerLifecycle',
      key: 'roomRewardPickup',
    });
    expect(decoded.traitOffersByAcquisitionRole.self).toMatchObject({
      kind: 'traits',
      hexTree: spellOffer.traitOffersByAcquisitionRole.self.hexTree,
    });

    const missing = JSON.parse(JSON.stringify(spellOffer)) as any;
    delete missing.traitOffersByAcquisitionRole.self.hexTree;
    expect(() =>
      decodeRewardState(missing, catalog, '$.reward', {
        kind: 'producerLifecycle',
        key: 'roomRewardPickup',
      }),
    ).toThrow(/hexTree.*required/);

    const dormant = JSON.parse(JSON.stringify(spellOffer)) as any;
    dormant.traitOffersByAcquisitionRole.self.options[0].hexTree =
      spellOffer.traitOffersByAcquisitionRole.self.hexTree;
    expect(() =>
      decodeRewardState(dormant, catalog, '$.reward', {
        kind: 'producerLifecycle',
        key: 'roomRewardPickup',
      }),
    ).toThrow(/options\.option1\.hexTree: is not a project document field/);
  });

  const invalidHexOfferMutations: readonly [string, (offer: MutableRewardWithHexOffer) => void][] =
    [
      [
        'a Rare identity from another Hex pool',
        (offer) => {
          offer.traitOffersByAcquisitionRole.self!.hexTree!.rareTalentKeys = [
            'MeteorVulnerabilityDecalTalent',
            'PolymorphDeathExplodeTalent',
          ];
        },
      ],
      [
        'a duplicate node identity',
        (offer) => {
          offer.traitOffersByAcquisitionRole.self!.hexTree!.rareTalentKeys = [
            'PolymorphBossDamageTalent',
            'PolymorphBossDamageTalent',
          ];
        },
      ],
      [
        'the wrong Rare cardinality',
        (offer) => {
          offer.traitOffersByAcquisitionRole.self!.hexTree!.rareTalentKeys = [
            'PolymorphBossDamageTalent',
          ];
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
              hexTree: spellTree,
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
            rareTalentKeys: ['PolymorphBossDamageTalent', 'PolymorphDeathExplodeTalent'],
            epicTalentKeys: ['PolymorphSandwichTalent'],
          },
        },
      },
    } satisfies MutableRewardWithHexOffer;
    mutate(offer);
    expect(() =>
      decodeRewardState(offer, catalog, '$.reward', {
        kind: 'producerLifecycle',
        key: 'roomRewardPickup',
      }),
    ).toThrow(/hexTree|Hex/);
  });

  it('canonicalizes valid unordered Hex node selections to declaration order', () => {
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
            rareTalentKeys: ['PolymorphDeathExplodeTalent', 'PolymorphBossDamageTalent'],
            epicTalentKeys: ['PolymorphSandwichTalent'],
          },
        },
      },
    };
    const decoded = decodeRewardState(offer, catalog, '$.reward', {
      kind: 'producerLifecycle',
      key: 'roomRewardPickup',
    });
    expect(decoded.traitOffersByAcquisitionRole.self).toMatchObject({
      hexTree: {
        rareTalentKeys: ['PolymorphBossDamageTalent', 'PolymorphDeathExplodeTalent'],
        epicTalentKeys: ['PolymorphSandwichTalent'],
      },
    });
  });

  it('owns the exact Boon acquisition and payload shape', () => {
    const value = {
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      dispositionByAcquisitionRole: { source: { kind: 'normal' } },
      traitOffersByAcquisitionRole: { source: null },
    };

    expect(
      decodeRewardState(value, catalog, '$.reward', {
        kind: 'producerLifecycle',
        key: 'roomRewardPickup',
      }),
    ).toMatchObject({ offer: { rewardType: 'Boon' } });
    expect(() =>
      decodeRewardState({ ...value, unknown: true }, catalog, '$.reward', {
        kind: 'producerLifecycle',
        key: 'roomRewardPickup',
      }),
    ).toThrow('$.reward: unexpected key unknown');
  });

  it('decodes the declaration-bounded Fields optional inventory', () => {
    const declaration = room('H_Combat02');
    const context = { role: 'ordinary' as const, entryActive: true, activeCageCount: 2 };
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

  it('requires the exact closed Pom role map and rejects it on non-Pom rewards', () => {
    const declaration = room('F_Combat04');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, {
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
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('levelResolutionsByAcquisitionRole: is required for this Pom reward');
    reward.levelResolutionsByAcquisitionRole = { self: { kind: 'random', targetTraitKey: null } };
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow(
      'levelResolutionsByAcquisitionRole.self.targetTraitKey: is not a project document field',
    );
    reward.levelResolutionsByAcquisitionRole = {
      self: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
      extra: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
    };
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
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
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('levelResolutionsByAcquisitionRole: Pom resolutions are not supported');
  });
});
