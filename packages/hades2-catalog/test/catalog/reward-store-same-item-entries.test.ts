import type { RequirementExpression } from '@run-planner/engine/requirements';
import { describe, expect, it } from 'vitest';

import {
  classifySameItemEntries,
  type SameItemEntryRelation,
} from '../../src/compiler/rewards/same-item-entries';
import {
  createRewardKernelCatalog,
  rawInput,
  rewardKernelCatalog,
  rewardKernelDeclarations,
} from './support/reward-kernel';

type RawEntry = {
  readonly rewardType: string;
  readonly allowDuplicates?: boolean;
  readonly requirement?: RequirementExpression;
  readonly routeKeys?: readonly string[];
};

function withSecretsEntries(entries: readonly RawEntry[], interchangeable?: readonly string[]) {
  return rawInput({
    ...rewardKernelDeclarations,
    stores: rewardKernelDeclarations.stores.map((store) =>
      store.key === 'Secrets'
        ? {
            ...store,
            entries: [...store.entries, ...entries],
            ...(interchangeable === undefined
              ? {}
              : { interchangeableRewardTypes: interchangeable }),
          }
        : store,
    ),
  });
}

const lootAcquired: RequirementExpression = {
  kind: 'recordCount',
  record: 'lootTypeHistory',
  keys: ['ZeusUpgrade'],
  range: { min: 1 },
};
const firstBiome: RequirementExpression = {
  kind: 'counterRange',
  axis: 'enteredBiomes',
  range: { max: 1 },
};

describe('counted store same-item entries', () => {
  it('classifies every current same-item group on its requirements alone', () => {
    const relations: Record<string, string[]> = {};
    for (const store of rewardKernelCatalog.stores.values) {
      store.entries.forEach((left, index) =>
        store.entries.slice(index + 1).forEach((right) => {
          if (right.rewardType !== left.rewardType) return;
          const key = `${store.key}.${left.rewardType}`;
          const relation = classifySameItemEntries(left, right, false);
          relations[key] = [...new Set([...(relations[key] ?? []), relation])].sort();
        }),
      );
    }
    expect(relations).toEqual({
      'RunProgress.MaxHealthDrop': ['monotonicDifference'],
      'RunProgress.MaxManaDrop': ['monotonicDifference'],
      'RunProgress.RoomMoneyDrop': ['monotonicDifference'],
      'RunProgress.StackUpgrade': ['monotonicDifference'],
      'RunProgress.WeaponUpgrade': ['mutuallyExclusive'],
      'RunProgress.Boon': ['identical'],
      'MetaProgress.MetaCurrencyDrop': ['identical', 'mutuallyExclusive'],
      'MetaProgress.MetaCardPointsCommonDrop': ['identical', 'mutuallyExclusive'],
      'MetaProgress.MetaCurrencyBigDrop': ['identical'],
      'MetaProgress.MetaCardPointsCommonBigDrop': ['identical'],
      'HubRewards.Boon': ['identical'],
      'SubRoomRewards.MetaCurrencyDrop': ['identical'],
      'SubRoomRewards.MetaCardPointsCommonDrop': ['identical'],
      'SubRoomRewards.MaxHealthDrop': ['identical'],
      'SubRoomRewards.MaxManaDrop': ['identical'],
      'SubRoomRewards.StackUpgrade': ['identical'],
      'SubRoomRewards.RoomMoneyDrop': ['identical'],
      'SubRoomRewards.MinorTalentDrop': ['identical'],
      'SubRoomRewardsHard.MaxHealthDrop': ['identical'],
      'SubRoomRewardsHard.MaxManaDrop': ['identical'],
      'SubRoomRewardsHard.StackUpgrade': ['identical'],
      'SubRoomRewardsHard.RoomMoneyDrop': ['identical'],
      'FieldsOptionalRewards.MaxManaDropSmall': ['identical'],
      'FieldsOptionalRewards.MaxHealthDropSmall': ['identical'],
      'FieldsOptionalRewards.RoomMoneyTinyDrop': ['identical'],
      'FieldsOptionalRewards.MetaCardPointsCommonDrop': ['identical'],
      'FieldsOptionalRewards.MinorTalentDrop': ['identical'],
      'TartarusRewards.WeaponUpgrade': ['mutuallyExclusive'],
      'TartarusRewards.Boon': ['identical'],
      'TyphonBossRewards.Boon': ['identical'],
      'TyphonBossRewards.WeaponUpgrade': ['mutuallyExclusive'],
    });
  });

  it('rejects same-item entries that can both be eligible and later diverge', () => {
    // A first-biome condition turns false later, so the entry left behind matters.
    expect(() =>
      createRewardKernelCatalog(
        withSecretsEntries([{ rewardType: 'TrialUpgrade', requirement: firstBiome }]),
      ),
    ).toThrow(
      /stores\[\d+\]\.entries: store Secrets declares TrialUpgrade entries 0 and 1 that can both be eligible and later diverge/,
    );
    // A current-room exclusion can turn either way, so it is never a monotonic difference.
    expect(() =>
      createRewardKernelCatalog(
        withSecretsEntries([
          {
            rewardType: 'TrialUpgrade',
            requirement: { kind: 'notInCurrentRoomShopOptions', rewardType: 'TrialUpgrade' },
          },
        ]),
      ),
    ).toThrow(/store Secrets declares TrialUpgrade entries 0 and 1/);
    // Duplicate permission decides peer eligibility per contact.
    expect(() =>
      createRewardKernelCatalog(
        withSecretsEntries([{ rewardType: 'TrialUpgrade', allowDuplicates: true }]),
      ),
    ).toThrow(/store Secrets declares TrialUpgrade entries 0 and 1/);
  });

  it.each<[string, RequirementExpression]>([
    [
      'a Biome-scoped use record, cleared at each Biome',
      { kind: 'recordCount', record: 'biomeUseRecord', keys: ['ZeusUpgrade'], range: { min: 1 } },
    ],
    [
      'a rooms-entered record, which is Biome-scoped',
      { kind: 'recordCount', record: 'roomsEntered', keys: ['P_MiniBoss02'], range: { min: 1 } },
    ],
    [
      'an upgradable trait count, which can fall',
      { kind: 'counterRange', axis: 'upgradableTraitCount', range: { min: 1 } },
    ],
    [
      'a Biome encounter depth, reset at each Biome',
      { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 2 } },
    ],
    ['a negated requirement that can turn true', { kind: 'not', requirement: lootAcquired }],
    [
      'a monotonic counter capped by a maximum',
      { kind: 'counterRange', axis: 'enteredBiomes', range: { min: 2, max: 3 } },
    ],
    [
      'a monotonic record capped by a maximum',
      { ...lootAcquired, range: { min: 1, max: 2 } } as RequirementExpression,
    ],
    [
      'a flag present in one entry only',
      { kind: 'flagEquals', flag: 'pendingSpellDrop', value: false },
    ],
  ])('rejects a same-item difference by %s', (_name, requirement) => {
    expect(() =>
      createRewardKernelCatalog(withSecretsEntries([{ rewardType: 'TrialUpgrade', requirement }])),
    ).toThrow(/store Secrets declares TrialUpgrade entries 0 and 1 that can both be eligible/);
  });

  it('accepts identical, exclusive, monotonic and declared-interchangeable same-item entries', () => {
    const accepted: readonly {
      readonly entries: readonly RawEntry[];
      readonly interchangeable?: readonly string[];
      readonly relation: SameItemEntryRelation;
    }[] = [
      { entries: [{ rewardType: 'TrialUpgrade' }], relation: 'identical' },
      {
        entries: [{ rewardType: 'TrialUpgrade', requirement: lootAcquired }],
        relation: 'monotonicDifference',
      },
      {
        entries: [
          { rewardType: 'Boon', requirement: firstBiome },
          {
            rewardType: 'Boon',
            requirement: { kind: 'counterRange', axis: 'enteredBiomes', range: { min: 2 } },
          },
        ],
        relation: 'mutuallyExclusive',
      },
      {
        entries: [
          { rewardType: 'Boon', routeKeys: ['FreshFile'] },
          { rewardType: 'Boon', requirement: firstBiome, routeKeys: ['Underworld'] },
        ],
        relation: 'mutuallyExclusive',
      },
      {
        entries: [
          {
            rewardType: 'Boon',
            requirement: { kind: 'flagEquals', flag: 'pendingSpellDrop', value: true },
          },
          {
            rewardType: 'Boon',
            requirement: { kind: 'flagEquals', flag: 'pendingSpellDrop', value: false },
          },
        ],
        relation: 'mutuallyExclusive',
      },
      {
        entries: [{ rewardType: 'TrialUpgrade', requirement: firstBiome }],
        interchangeable: ['TrialUpgrade'],
        relation: 'declaredInterchangeable',
      },
    ];
    for (const { entries, interchangeable, relation } of accepted) {
      const rewardType = entries[0]!.rewardType;
      const store = createRewardKernelCatalog(
        withSecretsEntries(entries, interchangeable),
      ).stores.values.find((candidate) => candidate.key === 'Secrets')!;
      const sameItem = store.entries.filter((entry) => entry.rewardType === rewardType);
      const relations = new Set(
        sameItem.flatMap((left, index) =>
          sameItem
            .slice(index + 1)
            .map((right) =>
              classifySameItemEntries(left, right, interchangeable?.includes(rewardType) ?? false),
            ),
        ),
      );
      expect([...relations]).toEqual([relation]);
    }
  });
});
