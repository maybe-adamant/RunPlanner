import type { RequirementExpression } from '@run-planner/engine/requirements';
import { describe, expect, it } from 'vitest';

import { classifySameItemEntries } from '../../src/compiler/rewards/same-item-entries';
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

  it('accepts identical, exclusive, monotonic and declared-interchangeable same-item entries', () => {
    const accepted: readonly (readonly [readonly RawEntry[], (readonly string[])?])[] = [
      [[{ rewardType: 'TrialUpgrade' }]],
      [[{ rewardType: 'TrialUpgrade', requirement: lootAcquired }]],
      [
        [
          { rewardType: 'Boon', requirement: firstBiome },
          {
            rewardType: 'Boon',
            requirement: { kind: 'counterRange', axis: 'enteredBiomes', range: { min: 2 } },
          },
        ],
      ],
      [
        [
          { rewardType: 'Boon', routeKeys: ['FreshFile'] },
          { rewardType: 'Boon', requirement: firstBiome, routeKeys: ['Underworld'] },
        ],
      ],
      [[{ rewardType: 'TrialUpgrade', requirement: firstBiome }], ['TrialUpgrade']],
    ];
    for (const [entries, interchangeable] of accepted)
      expect(() =>
        createRewardKernelCatalog(withSecretsEntries(entries, interchangeable)),
      ).not.toThrow();
  });
});
