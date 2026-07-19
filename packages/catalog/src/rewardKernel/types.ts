import type { RequirementExpression } from '@run-planner/core';
import type {
  AcquisitionRoleResolution,
  AcquisitionKind,
  AcquisitionLifecycleBinding,
  HistoryProjectionKey,
  OfferProjectionKey,
  PayloadDomainDeclaration,
  RewardPayload,
  SourceResolutionPoint,
  SourceSupportPolicyKey,
} from '@run-planner/core/reward-kernel';

export type RawPayloadDomainDeclaration = PayloadDomainDeclaration;

export interface RawConcreteAcquisitionDeclaration {
  readonly gameName: string;
  readonly kind: AcquisitionKind;
  readonly historyProjection: HistoryProjectionKey;
}

export interface RawAcquisitionRoleDeclaration {
  readonly key: string;
  readonly resolution: AcquisitionRoleResolution;
}

export interface RawRewardTypeDeclaration {
  readonly gameName: string;
  readonly label: string;
  readonly payloadDomain?: string;
  readonly defaultPayload?: RewardPayload;
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
  readonly defaultRewardType: string;
  readonly entries: readonly RawRewardStoreEntryDeclaration[];
}

export interface RawShopOptionEntryDeclaration {
  readonly key: string;
  readonly rewardType: string;
  readonly requirement?: RequirementExpression;
  readonly purchaseRequirement?: RequirementExpression;
  readonly acquisitionLifecycle?: readonly AcquisitionLifecycleBinding[];
}

export interface RawShopGroupDeclaration {
  readonly key: string;
  readonly offerCount: number;
  readonly options: readonly RawShopOptionEntryDeclaration[];
}

export interface RawShopProfileDeclaration {
  readonly key: string;
  readonly groups: readonly RawShopGroupDeclaration[];
}

export interface RawRewardKernelInput {
  readonly payloadDomains: readonly RawPayloadDomainDeclaration[];
  readonly rewardTypes: readonly RawRewardTypeDeclaration[];
  readonly acquisitions: readonly RawConcreteAcquisitionDeclaration[];
  readonly stores: readonly RawRewardStoreDeclaration[];
  readonly shops: readonly RawShopProfileDeclaration[];
}
