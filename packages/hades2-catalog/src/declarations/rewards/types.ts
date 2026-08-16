import type { RequirementExpression } from '@run-planner/engine/requirements';
import type {
  AcquisitionRoleResolution,
  AcquisitionKind,
  AcquisitionLifecycleBinding,
  HistoryProjectionKey,
  LevelResolutionEffect,
  OfferProjectionKey,
  PayloadDomainDeclaration,
  ProducerLifecyclePointKey,
  SourceResolutionPoint,
  SourceSupportPolicyKey,
} from '@run-planner/engine/reward-kernel';

export type RawPayloadDomainDeclaration = PayloadDomainDeclaration;

export interface RawConcreteAcquisitionDeclaration {
  readonly gameName: string;
  readonly kind: AcquisitionKind;
  readonly historyProjection: HistoryProjectionKey;
  readonly goldConversionEligible?: boolean;
  readonly artificerConversionEligible?: boolean;
  readonly lastRewardRecreation?: {
    readonly rewardType: string;
    readonly producerLifecycleKey: 'EchoLastReward';
  };
  readonly levelResolutionEffect?: LevelResolutionEffect;
  readonly elementContributions?: Readonly<
    Partial<Record<'Earth' | 'Air' | 'Fire' | 'Water', number>>
  >;
  readonly grantedTraitKey?: string;
}

export interface RawAcquisitionRoleDeclaration {
  readonly key: string;
  readonly resolution: AcquisitionRoleResolution;
  readonly blocksGoldConversion?: boolean;
}

export interface RawRewardTypeDeclaration {
  readonly gameName: string;
  readonly label: string;
  readonly payloadDomain?: string;
  readonly sourceSupport?: SourceSupportPolicyKey;
  readonly sourceResolution?: SourceResolutionPoint;
  readonly offerProjection?: OfferProjectionKey;
  readonly acquisitionRoles: readonly RawAcquisitionRoleDeclaration[];
}

export interface RawRewardStoreEntryDeclaration {
  readonly rewardType: string;
  readonly allowDuplicates?: boolean;
  readonly requirement?: RequirementExpression;
}

export interface RawRewardStoreDeclaration {
  readonly key: string;
  readonly entries: readonly RawRewardStoreEntryDeclaration[];
}

export interface RawShopOptionEntryDeclaration {
  readonly key: string;
  readonly rewardType: string;
  readonly requirement?: RequirementExpression;
  readonly purchaseRequirement?: RequirementExpression;
  readonly acquisitionLifecycle?: readonly AcquisitionLifecycleBinding[];
  readonly purchaseInteraction?:
    | { readonly kind: 'fixed'; readonly gameName: string }
    | { readonly kind: 'resolvedOfferSource' };
}

export interface RawShopGroupDeclaration {
  readonly key: string;
  readonly offerCount: number;
  readonly options: readonly RawShopOptionEntryDeclaration[];
}

export interface RawShopSlotDeclaration {
  readonly key: string;
  readonly label: string;
  readonly groupKey: string;
}

export interface RawShopProfileDeclaration {
  readonly key: string;
  readonly groups: readonly RawShopGroupDeclaration[];
  readonly slots: readonly RawShopSlotDeclaration[];
}

export interface RawProducerLifecycleOverrideDeclaration {
  readonly rewardType: string;
  readonly acquisitionLifecycle: readonly AcquisitionLifecycleBinding[];
}

export interface RawProducerLifecycleProfileDeclaration {
  readonly key: string;
  readonly rewardTypes: readonly string[];
  readonly defaultLifecyclePoint: ProducerLifecyclePointKey;
  readonly overrides?: readonly RawProducerLifecycleOverrideDeclaration[];
}

export interface RawRewardKernelInput {
  readonly payloadDomains: readonly RawPayloadDomainDeclaration[];
  readonly rewardTypes: readonly RawRewardTypeDeclaration[];
  readonly acquisitions: readonly RawConcreteAcquisitionDeclaration[];
  readonly stores: readonly RawRewardStoreDeclaration[];
  readonly shops: readonly RawShopProfileDeclaration[];
  readonly producerLifecycles: readonly RawProducerLifecycleProfileDeclaration[];
}
