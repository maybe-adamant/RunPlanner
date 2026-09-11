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
  ConcreteAcquisitionPickupEffect,
} from '@run-planner/engine/reward-kernel';

export type RawPayloadDomainDeclaration = PayloadDomainDeclaration;

export interface RawCountedRewardBinding {
  readonly kind: 'countedChoice';
  readonly storeKeys: readonly string[];
  readonly eligibleRewardTypes: readonly string[];
  readonly ineligibleRewardTypes: readonly string[];
  readonly producerLifecycleKey: string;
}

export interface RawFixedRewardBinding {
  readonly kind: 'fixed';
  readonly rewardType: string;
  readonly producerLifecycleKey: string;
}

export interface RawNoneRewardBinding {
  readonly kind: 'none';
}

export interface RawShopRewardBinding {
  readonly kind: 'shop';
  readonly rewardType: 'Shop';
  readonly shopProfileKey: string;
  readonly producerLifecycleKey: string;
  readonly additionalOptionRequirements?: Readonly<Record<string, RequirementExpression>>;
}

export type RawRewardProducerBinding =
  RawCountedRewardBinding | RawFixedRewardBinding | RawNoneRewardBinding | RawShopRewardBinding;

export interface RawConcreteAcquisitionDeclaration {
  readonly gameName: string;
  readonly kind: AcquisitionKind;
  readonly historyProjection: HistoryProjectionKey;
  readonly goldConversionEligible?: boolean;
  readonly artificerConversionEligible?: boolean;
  /** Source CanDuplicate; every supported concrete acquisition declares it explicitly. */
  readonly canDuplicate: boolean;
  readonly pickupEffect?: ConcreteAcquisitionPickupEffect;
  readonly lastRewardRecreation?: {
    readonly rewardType: string;
    readonly producerLifecycleKey: 'EchoLastReward';
  };
  readonly levelResolutionEffect?: LevelResolutionEffect;
  readonly elementContributions?: Readonly<
    Partial<Record<'Earth' | 'Air' | 'Fire' | 'Water', number>>
  >;
  readonly grantedTraitKey?: string;
  readonly pathPointGrant?: 1 | 3 | 5;
}

export interface RawAcquisitionRoleDeclaration {
  readonly key: string;
  readonly resolution: AcquisitionRoleResolution;
  readonly traitGiverKey?: string;
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
  /** Same-name entries whose exact identity has no distinct future once both are eligible. */
  readonly interchangeableRewardTypes?: readonly string[];
}

export interface RawShopOptionEntryDeclaration {
  readonly key: string;
  /** Player-facing item name. Defaults to the reward type label when omitted. */
  readonly label?: string;
  readonly rewardType: string;
  readonly requirement?: RequirementExpression;
  readonly purchaseRequirement?: RequirementExpression;
  readonly acquisitionLifecycle?: readonly AcquisitionLifecycleBinding[];
  readonly purchaseInteraction?:
    | { readonly kind: 'fixed'; readonly gameName: string }
    | { readonly kind: 'resolvedOfferSource' };
  readonly boonRarityOverride?: import('@run-planner/engine/catalog-schema').BoonRarityOverride;
  /** RoomShop-only exact identity/effect metadata. */
  readonly stygianWell?: {
    readonly effect:
      | 'neutral'
      | 'spark'
      | 'yarn'
      | 'hymn'
      | 'discount'
      | 'emptySlot'
      | 'extended'
      | 'twist'
      | 'lastStand';
    readonly offerRequirements?: readonly ('inactive' | 'emptyAttackOrSpecial')[];
    readonly nestedResultItemKeys?: readonly string[];
    readonly extendedDirectPurchaseItemKeys?: readonly string[];
  };
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
