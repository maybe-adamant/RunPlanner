import type { ResolvedRewardOffer } from './model';
import type { RequirementExpression } from '../requirements/model';

export interface CountedRewardBinding {
  readonly kind: 'countedChoice';
  readonly storeKeys: readonly string[];
  readonly eligibleRewardTypes: readonly string[];
  readonly ineligibleRewardTypes: readonly string[];
  readonly allowedRewardTypes: readonly string[];
  readonly defaultOffersByStore: Readonly<Record<string, ResolvedRewardOffer>>;
  readonly producerLifecycleKey: string;
}

export interface FixedRewardBinding {
  readonly kind: 'fixed';
  readonly offer: ResolvedRewardOffer;
  readonly producerLifecycleKey: string;
}

export interface NoneRewardBinding {
  readonly kind: 'none';
}

export interface ShopRewardBinding {
  readonly kind: 'shop';
  readonly offer: ResolvedRewardOffer;
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
