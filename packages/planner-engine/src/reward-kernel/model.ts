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
export type SourceSupportPolicyKey =
  'devotionAcquiredPair' | 'ordinaryBoonPeer' | 'ordinaryInteracted' | 'ordinaryNoPeer';

/**
 * God history on the save file before this run. A mature file has used and
 * picked up every ordinary god; a closed first file has done neither.
 */
export type SaveFileGodHistory = 'closed' | 'mature';

export type LevelResolutionEffect =
  | { readonly kind: 'visibleChoice'; readonly levelCount: 1 | 2 | 3 }
  | { readonly kind: 'randomTarget'; readonly levelCount: 1 }
  | {
      readonly kind: 'randomTargetIfAvailable';
      readonly levelCount: 1;
      /** Routes whose save profile lacks the upgrade that grants this level. */
      readonly excludedRouteKeys?: readonly string[];
    };

/** Source-backed effect applied when a concrete pickup is consumed. */
export type ConcreteAcquisitionPickupEffect = { readonly kind: 'anvilOfFates' };

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
  /** Exact source CanDuplicate fact.  This is intentionally independent of kind and conversions. */
  readonly canDuplicate: boolean;
  /** Native pickup effect; the carrier is intentionally irrelevant to this declaration. */
  readonly pickupEffect?: ConcreteAcquisitionPickupEffect;
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
  /** Full semantic Path selections awarded by this concrete acquisition. */
  readonly pathPointGrant?: 1 | 3 | 5;
  /** Source LootData `GameStateRequirements` gating this god as an ordinary source. */
  readonly lootRequirement?: RequirementExpression;
  /** Source `AddResources`: base quantities this pickup grants, by resource key. */
  readonly resourceGrant?: ResourceAmounts;
  /** Source `AddMaxHealth`/`AddMaxMana`. */
  readonly maxStatGrant?: MaxStatGrant;
  /**
   * Source `RunProgress.PropertyChanges`: replaces `maxStatGrant` when a
   * run-progress-eligible producer spawns it on a route with the unlock.
   */
  readonly runProgressMaxStatGrant?: MaxStatGrant & {
    readonly excludedRouteKeys: readonly string[];
  };
}

/** One flat max-health or max-Magick amount. */
export interface MaxStatGrant {
  readonly stat: 'maxHealth' | 'maxMana';
  readonly amount: number;
}

export type MaxStatTotals = Readonly<Record<MaxStatGrant['stat'], number>>;

/** Whole resource quantities by source resource key (for example `MetaCardPointsCommon`). */
export type ResourceAmounts = Readonly<Record<string, number>>;

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
  /** Explicit normalized provider binding; avoids game-name discovery in the engine. */
  readonly traitGiverKey?: string;
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
  /** Routes whose bag holds this entry; absent means every route. */
  readonly routeKeys?: readonly string[];
}

export interface RewardStoreDeclaration {
  readonly key: string;
  readonly entries: readonly RewardStoreEntry[];
  /** Same-name entries whose exact identity has no distinct future once both are eligible. */
  readonly interchangeableRewardTypes?: readonly string[];
}

export interface ShopOptionEntry {
  readonly key: string;
  readonly label: string;
  readonly rewardType: string;
  readonly requirement?: RequirementExpression;
  readonly purchaseRequirement?: RequirementExpression;
  readonly acquisitionLifecycle: readonly AcquisitionLifecycleBinding[];
  /** Exact world interaction identity passed to the physical restock exclusion. */
  readonly purchaseInteraction:
    | { readonly kind: 'fixed'; readonly gameName: string }
    | { readonly kind: 'resolvedOfferSource' };
  /** Exact generated Shop item override, retained only by the generation witness. */
  readonly boonRarityOverride?: import('../catalog-schema/traits').BoonRarityOverride;
  readonly stygianWell?: {
    readonly grant: StygianWellGrant;
    readonly offerRequirements?: readonly ('inactive' | 'emptyAttackOrSpecial')[];
    readonly excludedRouteKeys?: readonly string[];
  };
}

/** Native use counter of a Well trait: `UsesAsEncounters`, `UsesAsRooms` or `UsesAsBosses`. */
export type StygianWellClock = 'encounters' | 'rooms' | 'bosses';

/**
 * What one Well item grants. `publishedEffect` names the Well item effect the
 * purchase publishes; a grant without one publishes as neutral.
 */
export type StygianWellGrant =
  | {
      readonly kind: 'timedTrait';
      readonly traitKey: string;
      readonly initialUses: number;
      readonly clock: StygianWellClock;
      readonly publishedEffect?: 'discount' | 'emptySlot';
    }
  | { readonly kind: 'charge'; readonly charge: 'spark' | 'yarn' | 'hymn' }
  | {
      readonly kind: 'charge';
      readonly charge: 'extended';
      /** Native `ValidPermanentItemsLookup`. */
      readonly eligibleItemKeys: readonly string[];
      /** Boss uses granted to the converted purchase. */
      readonly bossExtension: number;
    }
  | {
      readonly kind: 'consumable';
      readonly acquisitionGameName: string;
      readonly publishedEffect?: 'lastStand';
    }
  /** A holding spent by play; only the purchase ledger records it. */
  | { readonly kind: 'ledger' }
  /** Applied at purchase with nothing retained. */
  | { readonly kind: 'immediate' }
  | { readonly kind: 'twist'; readonly pool: readonly string[] };

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
  /** Source `NPCDrop` objects: `RoomRewardBonus` never scales their resources. */
  readonly resourceBonusExempt?: true;
  /** Source `CanDuplicate = false` override: Sea Star never duplicates its objects. */
  readonly duplicationExempt?: true;
  /** Producer-owned `AddResources` overrides, by concrete acquisition game name. */
  readonly resourceGrantOverrides?: Readonly<Record<string, ResourceAmounts>>;
  /** Source `RunProgressUpgradeEligible`: its objects take their `RunProgress` overrides. */
  readonly runProgressUpgradeEligible?: true;
}

export interface RewardKernelCatalog {
  readonly payloadDomains: CatalogCollection<PayloadDomainDeclaration>;
  readonly rewardTypes: CatalogCollection<RewardTypeDeclaration>;
  readonly acquisitions: CatalogCollection<ConcreteAcquisitionDeclaration>;
  readonly stores: CatalogCollection<RewardStoreDeclaration>;
  readonly shops: CatalogCollection<ShopProfileDeclaration>;
  readonly producerLifecycles: CatalogCollection<ProducerLifecycleProfileDeclaration>;
  /** Native `ChooseRoomReward` final fallback once two appended store copies stay ineligible. */
  readonly countedStoreFallbackRewardType: string;
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
  /** Ordinary gods used on this save file (`GameState.UseRecord`); removal never erases it. */
  readonly lifetimeGodUseRecord: Readonly<Record<string, number>>;
  /** Ordinary gods whose screen selection completed on this file (`GameState.LootPickups`). */
  readonly lifetimeGodPickupRecord: Readonly<Record<string, number>>;
  /**
   * Resources credited by settled acquisitions since the project start (each
   * `AddResource` also adds to `LifetimeResourcesGained`). Spending never reduces it.
   */
  readonly resourceGains: ResourceAmounts;
  /** Flat maxima from collected pickups, including run-progress overrides; never debited. */
  readonly maxStatGains: MaxStatTotals;
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
  /** Null/omitted retains an existential legacy identity; persisted plans provide an exact key. */
  readonly optionKey?: string | null;
  readonly offer: ResolvedRewardOffer;
}

export interface ShopOptionSelection {
  readonly optionKey: string;
  readonly offer: ResolvedRewardOffer;
}

/** One generated option key per declared slot; null where the slot's group has no eligible option. */
export interface ShopGenerationWitness {
  readonly optionKeys: readonly (string | null)[];
}

/**
 * A declared slot's standing in one generation context. `validEmpty` means its
 * group has zero eligible options, so native generation emits no item for it.
 */
export type ShopSlotAssessment = 'complete' | 'validEmpty' | 'incomplete' | 'selectedInvalid';

export interface ShopInventoryAssessment {
  /** Declared profile slot order. */
  readonly slots: readonly ShopSlotAssessment[];
  readonly witnesses: readonly ShopGenerationWitness[];
  /** Every slot is locally complete or validly empty, yet no joint generation exists. */
  readonly jointlyUnavailable: boolean;
  /** Slots whose offer can only repeat an earlier slot's option in the same draw. */
  readonly repeatedSlots: readonly ShopRepeatedSlot[];
}

export interface ShopRepeatedSlot {
  readonly slotIndex: number;
  readonly repeatsSlotIndex: number;
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

/** The physical purchase frontier before any reward acquisition is resolved. */
export interface ShopPurchaseGateResult {
  readonly acquisitionLifecycle: readonly AcquisitionLifecycleBinding[];
  readonly remainingSlotIndexes: readonly number[];
}
