import type { CatalogCollection } from './catalog';
import type { RequirementExpression } from './requirements';

export type RewardPayload =
  { readonly source: string } | { readonly sources: readonly [string, string] };

export type RewardPayloadDomain =
  | {
      readonly key: string;
      readonly kind: 'oneOf';
      readonly values: readonly string[];
    }
  | {
      readonly key: string;
      readonly kind: 'distinctPair';
      readonly valueDomain: string;
    };

export interface RewardPrimitive {
  readonly gameName: string;
  readonly label: string;
  readonly acquiredAs: string;
  readonly payloadDomain?: string;
  readonly defaultPayload?: RewardPayload;
}

export interface RewardStoreEntry {
  readonly rewardType: string;
  readonly requirement?: RequirementExpression;
}

export interface RewardStore {
  readonly key: string;
  readonly defaultRewardType: string;
  readonly refill: 'appendWhenNoEligibleEntry';
  readonly entries: readonly RewardStoreEntry[];
  readonly rewardTypes: readonly string[];
}

export interface ConcreteReward {
  readonly rewardType: string;
  readonly payload?: RewardPayload;
}

export interface CountedRewardBinding {
  readonly kind: 'countedChoice';
  readonly storeKeys: readonly string[];
  readonly defaultStoreKey: string;
  readonly eligibleRewardTypes: readonly string[];
  readonly ineligibleRewardTypes: readonly string[];
  readonly allowedRewardTypes: readonly string[];
  readonly defaultReward: ConcreteReward;
}

export interface FixedRewardBinding {
  readonly kind: 'fixed';
  readonly reward: ConcreteReward;
}

export interface ShopRewardBinding {
  readonly kind: 'shop';
  readonly shopProfileKey: string;
}

export type RewardProducerBinding = CountedRewardBinding | FixedRewardBinding | ShopRewardBinding;

export interface ShopOptionSet {
  readonly key: string;
  readonly rewardTypes: readonly string[];
}

export interface ShopSlot {
  readonly key: string;
  readonly label: string;
  readonly optionSetKey: string;
  readonly defaultReward: ConcreteReward;
}

export interface ShopProfile {
  readonly key: string;
  readonly slots: CatalogCollection<ShopSlot>;
}
