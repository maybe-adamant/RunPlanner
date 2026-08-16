import type { CatalogCollection } from '../normalized/collection';
import type { RequirementEvaluationContext } from '../requirements/evaluator';
import type { RequirementExpression } from '../requirements/model';

export type AcquisitionKind = 'consumable' | 'loot' | 'resource';
export type HistoryProjectionKey = 'consumableAndUse' | 'lootAndUse';
export type OfferProjectionKey = 'devotionSpacing' | 'none';
export type ProducerLifecyclePointKey =
  | 'afterCombat'
  | 'afterUnwrap'
  | 'beforeCombat'
  | 'echoReplay'
  | 'purchase'
  | 'roomRewardPickup'
  | 'roomExit';
export type SourceSupportPolicyKey = 'devotionAcquiredPair' | 'ordinaryBoonPeer' | 'ordinaryNoPeer';

export type LevelResolutionEffect =
  | { readonly kind: 'visibleChoice'; readonly levelCount: 1 | 2 | 3 }
  | { readonly kind: 'randomTarget'; readonly levelCount: 1 }
  | { readonly kind: 'randomTargetIfAvailable'; readonly levelCount: 1 };

export interface BoonSourcePayload {
  readonly kind: 'BoonSource';
  readonly source: string;
}

export interface DevotionPairPayload {
  readonly kind: 'DevotionPair';
  readonly chosenSource: string;
  readonly spurnedSource: string;
}

export type RewardPayload = BoonSourcePayload | DevotionPairPayload;

export interface ResolvedRewardOffer {
  readonly rewardType: string;
  readonly payload?: RewardPayload;
}

export type PayloadDomainDeclaration =
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

export interface ConcreteAcquisitionAddress {
  readonly kind: AcquisitionKind;
  readonly gameName: string;
}

export interface ConcreteAcquisitionDeclaration extends ConcreteAcquisitionAddress {
  readonly historyProjection: HistoryProjectionKey;
  /** Source GoldConversionEligible capability, independent of the reward category. */
  readonly goldConversionEligible: boolean;
  /** Source MetaConversionEligible capability, before producer/cost overrides. */
  readonly artificerConversionEligible: boolean;
  /** Exact source-backed reconstruction used when this settled pickup becomes Echo's LastReward. */
  readonly lastRewardRecreation?: {
    readonly offer: ResolvedRewardOffer;
    readonly producerLifecycleKey: 'EchoLastReward';
  };
  readonly levelResolutionEffect?: LevelResolutionEffect;
  /** A concrete pickup can contribute base elements without becoming a trait. */
  readonly elementContributions?: Readonly<
    Partial<Record<'Earth' | 'Air' | 'Fire' | 'Water', number>>
  >;
  /** One source-fixed rarityless equipped trait installed by this acquisition. */
  readonly grantedTraitKey?: string;
}

export type AcquisitionRoleResolution =
  | {
      readonly kind: 'self';
      readonly acquisitionKind: AcquisitionKind;
    }
  | {
      readonly kind: 'fixed';
      readonly acquisition: ConcreteAcquisitionAddress;
    }
  | {
      readonly kind: 'payloadSource';
      readonly acquisitionKind: AcquisitionKind;
      readonly field: 'chosenSource' | 'source' | 'spurnedSource';
    };

export interface AcquisitionRoleDeclaration {
  readonly key: string;
  readonly resolution: AcquisitionRoleResolution;
  /** Source lifecycle exposes no independent special-interact window for this role. */
  readonly blocksGoldConversion?: true;
}

export interface AcquisitionLifecycleBinding {
  readonly role: string;
  readonly lifecyclePoint: ProducerLifecyclePointKey;
  /** A narrow producer-local override; acquisition declarations retain universal effects. */
  readonly levelResolutionEffect?: LevelResolutionEffect;
  /** Producer-local instance override, used by Echo's recreated Last Reward. */
  readonly blocksArtificerConversion?: true;
}

export type SourceResolutionPoint =
  { readonly kind: 'offer' } | { readonly kind: 'acquisitionRole'; readonly role: string };

export interface RewardTypeDeclaration {
  readonly gameName: string;
  readonly label: string;
  readonly payloadDomain?: string;
  readonly sourceSupport?: SourceSupportPolicyKey;
  readonly sourceResolution?: SourceResolutionPoint;
  readonly offerProjection: OfferProjectionKey;
  readonly acquisitionRoles: CatalogCollection<AcquisitionRoleDeclaration>;
}

export interface RewardStoreEntry {
  readonly index: number;
  readonly rewardType: string;
  readonly allowDuplicates: boolean;
  readonly requirement?: RequirementExpression;
}

export interface RewardStoreDeclaration {
  readonly key: string;
  readonly entries: readonly RewardStoreEntry[];
}

export interface ShopOptionEntry {
  readonly key: string;
  readonly rewardType: string;
  readonly requirement?: RequirementExpression;
  readonly purchaseRequirement?: RequirementExpression;
  readonly acquisitionLifecycle: readonly AcquisitionLifecycleBinding[];
  /** Exact world interaction identity passed to the physical restock exclusion. */
  readonly purchaseInteraction:
    | { readonly kind: 'fixed'; readonly gameName: string }
    | { readonly kind: 'resolvedOfferSource' };
}

export interface ShopGroupDeclaration {
  readonly key: string;
  readonly offerCount: number;
  readonly options: CatalogCollection<ShopOptionEntry>;
  readonly rewardTypes: readonly string[];
}

export interface ShopSlotDeclaration {
  readonly key: string;
  readonly label: string;
  readonly groupKey: string;
}

export interface ShopProfileDeclaration {
  readonly key: string;
  readonly groups: CatalogCollection<ShopGroupDeclaration>;
  readonly slots: CatalogCollection<ShopSlotDeclaration>;
  readonly slotCount: number;
}

export interface ProducerRewardLifecycleDeclaration {
  readonly rewardType: string;
  readonly acquisitionLifecycle: readonly AcquisitionLifecycleBinding[];
}

export interface ProducerLifecycleProfileDeclaration {
  readonly key: string;
  readonly rewardTypes: CatalogCollection<ProducerRewardLifecycleDeclaration>;
}

export interface RewardKernelCatalog {
  readonly payloadDomains: CatalogCollection<PayloadDomainDeclaration>;
  readonly rewardTypes: CatalogCollection<RewardTypeDeclaration>;
  readonly acquisitions: CatalogCollection<ConcreteAcquisitionDeclaration>;
  readonly stores: CatalogCollection<RewardStoreDeclaration>;
  readonly shops: CatalogCollection<ShopProfileDeclaration>;
  readonly producerLifecycles: CatalogCollection<ProducerLifecycleProfileDeclaration>;
}

export interface RewardKernelFacts {
  readonly requirements: RequirementEvaluationContext;
}

export interface RewardPeerContext {
  readonly priorOffers: readonly ResolvedRewardOffer[];
}

export interface RewardBagState {
  readonly remainingEntryCounts: readonly number[];
}

export interface CountedOfferTransitionOptions {
  readonly eligibleRewardTypes?: ReadonlySet<string>;
  readonly ineligibleRewardTypes?: ReadonlySet<string>;
  readonly peers?: RewardPeerContext;
}

export interface RewardHistoryState {
  readonly offerHistory: readonly ResolvedRewardOffer[];
  readonly useRecord: Readonly<Record<string, number>>;
  readonly biomeUseRecord: Readonly<Record<string, number>>;
  readonly currentRoomUseRecord: Readonly<Record<string, number>>;
  readonly lootTypeHistory: Readonly<Record<string, number>>;
  readonly lootBiomeRecord: Readonly<Record<string, number>>;
  readonly consumableRecord: Readonly<Record<string, number>>;
  /** Latest actually-settled source whose effective LastRewardEligible value is true. */
  readonly lastRewardRecreation?: ConcreteAcquisitionDeclaration['lastRewardRecreation'];
  /** Canonical fold of the equipped-trait ledger; never incremented by loot projection. */
  readonly traitFacts: TraitDerivedFacts;
  readonly lastDevotionDepth?: number;
}

export interface TraitDerivedFacts {
  readonly upgradableTraitCount: number;
  readonly elementCounts: Readonly<Record<string, number>>;
  readonly highestBaseElementCount: number;
  readonly godBoonRarityCounts: Readonly<Record<string, number>>;
}

export interface ConcreteAcquisitionEvent {
  readonly role: string;
  readonly lifecyclePoint: ProducerLifecyclePointKey;
  readonly acquisition: ConcreteAcquisitionAddress;
}

export interface AuthoredShopOffer {
  readonly offer: ResolvedRewardOffer;
}

export interface ShopGenerationWitness {
  readonly optionKeys: readonly string[];
}

export interface ShopGenerationSupport {
  readonly witnesses: readonly ShopGenerationWitness[];
  readonly unsupportedSlotIndexes: readonly number[];
  readonly jointlyUnavailable: boolean;
}

export interface ShopGenerationConstraints {
  readonly excludedPurchaseInteractionNames?: ReadonlySet<string>;
}

export interface ShopPurchaseResult {
  readonly history: RewardHistoryState;
  readonly entryOrder: readonly number[];
  readonly acquisitions: readonly ShopPurchaseAcquisition[];
}

export interface ShopPurchaseAcquisition {
  readonly slotIndex: number;
  readonly optionKey: string;
  readonly event: ConcreteAcquisitionEvent;
}

export interface ShopPurchaseFailure {
  readonly entryOrder: readonly number[];
  readonly failedSlotIndex?: number;
}

export interface ShopPurchaseSimulation {
  readonly results: readonly ShopPurchaseResult[];
  readonly failures: readonly ShopPurchaseFailure[];
}

export interface ShopSinglePurchaseResult {
  readonly history: RewardHistoryState;
  readonly acquisitions: readonly ShopPurchaseAcquisition[];
  readonly remainingSlotIndexes: readonly number[];
}
