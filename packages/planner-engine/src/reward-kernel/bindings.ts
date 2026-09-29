import type { RequirementExpression } from '../requirements/model';
import type { ResolvedRewardOffer } from './model';

/** Source `ForcedRewards` entry: the first whose requirement holds replaces the bag draw. */
export interface ForcedCountedReward {
  readonly offer: ResolvedRewardOffer;
  readonly requirement?: RequirementExpression;
}

export interface CountedRewardBinding {
  readonly kind: 'countedChoice';
  readonly storeKeys: readonly string[];
  readonly eligibleRewardTypes: readonly string[];
  readonly ineligibleRewardTypes: readonly string[];
  readonly allowedRewardTypes: readonly string[];
  readonly producerLifecycleKey: string;
  readonly forcedRewards?: readonly ForcedCountedReward[];
}

export interface FixedRewardBinding {
  readonly kind: 'fixed';
  readonly rewardType: string;
  readonly producerLifecycleKey: string;
}

export interface NoneRewardBinding {
  readonly kind: 'none';
}

export interface ShopRewardBinding {
  readonly kind: 'shop';
  readonly rewardType: string;
  readonly shopProfileKey: string;
  readonly producerLifecycleKey: string;
  readonly additionalOptionRequirements?: Readonly<Record<string, RequirementExpression>>;
}

export type RewardProducerBinding =
  CountedRewardBinding | FixedRewardBinding | NoneRewardBinding | ShopRewardBinding;

export type EnteredRewardStoreHistoryPolicy =
  | { readonly kind: 'resolvedOffer' }
  | { readonly kind: 'fixed'; readonly storeKey: string }
  | { readonly kind: 'none' };
