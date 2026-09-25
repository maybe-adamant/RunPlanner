import type { Catalog } from '../../catalog-schema';
import type { TraitOfferOwnerAddress } from '../../authored-project/addresses';
import type { EquippedTrait } from '../../authored-project/traits/state';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import type {
  ProducerLifecyclePointKey,
  RewardBagState,
  RewardHistoryState,
  RewardKernelFacts,
  ShopGenerationWitness,
} from '../../reward-kernel';
import type { CanonicalShopOffer } from '../materialization';
import type { ArcanaFearState } from '../arcana-fear';
import type { StygianWellRunState } from '../commerce/stygian-well';
import type { HistoryStateView } from '../history';
import type { HexProgressState } from '../hex-progress';
import type { KeepsakeState } from '../keepsakes/state';
import type { TraitHistoryState } from '../traits';

export interface SimulationEquipmentState {
  readonly weaponKey: string;
  readonly aspectKey: string;
}

export interface PendingShopTravelRefillState {
  readonly sourceOfferKey: string;
  readonly slotIndex: number;
  readonly rewardTypes: readonly string[];
  readonly excludedNames: ReadonlySet<string>;
  /** Frozen immediately after the triggering purchase; never recompute on resume. */
  readonly generationFacts: RewardKernelFacts;
}

export type PendingShopPaidOffer = Omit<CanonicalShopOffer, 'offerOrigin'> & {
  readonly offerOrigin: TraitOfferOwnerAddress;
};

export interface PendingShopGoldMaterialization {
  readonly sourceOfferKey: string;
  readonly roleBindings: readonly {
    readonly role: string;
    readonly lifecyclePoint: ProducerLifecyclePointKey;
  }[];
  readonly sourceOffer: PendingShopPaidOffer;
}

export interface PendingShopState {
  readonly profileKey: string;
  readonly witness: ShopGenerationWitness;
  readonly remainingSlotIndexes?: readonly number[];
  readonly travelActiveAtEntry?: boolean;
  readonly goldActiveAtEntry?: EquippedTrait;
  readonly firstNormalPurchaseSeen?: boolean;
  readonly travelRefill?: PendingShopTravelRefillState;
  readonly goldMaterialization?: PendingShopGoldMaterialization;
  readonly infernalContractOffer?: CanonicalShopOffer;
}

export interface PendingHermesShrineDelivery {
  readonly sourceKey: string;
  readonly sourceOrigin: import('../../authored-project/addresses').OccurrenceAddress;
  readonly generationKey: import('../../authored-project/model').HermesShrineGenerationKey;
  readonly rewardType: string;
  readonly remainingUses: number;
  readonly rushed?: boolean;
  readonly dueAt?: import('../../authored-project/addresses').OccurrenceAddress;
  readonly dueSequence?: number;
}

/** The state substates native trait-offer generation reads when a loot's options are built. */
export interface PendingTraitOfferContext {
  readonly traitHistory: TraitHistoryState;
  readonly arcanaFear: ArcanaFearState;
  readonly keepsakes: KeepsakeState;
  readonly equipment: SimulationEquipmentState;
  readonly stygianWell: StygianWellRunState;
  readonly rewardHistory: RewardHistoryState;
}

/** A spawned, unopened loot: its options' build context, or stale when they were cleared. */
export interface PendingTraitOfferRecord {
  readonly context: PendingTraitOfferContext;
  readonly stale: boolean;
}

export interface SimulationState {
  readonly equipment: SimulationEquipmentState;
  readonly reached: {
    readonly routePosition: ResolvedRoutePosition;
    readonly historyView: HistoryStateView;
  };
  readonly bags: Readonly<Record<string, RewardBagState>>;
  readonly rewardPriorities: readonly string[];
  readonly hexProgress: HexProgressState;
  readonly rewardHistory: RewardHistoryState;
  readonly traitHistory: TraitHistoryState;
  readonly arcanaFear: ArcanaFearState;
  readonly keepsakes: KeepsakeState;
  readonly pendingShops: Readonly<Record<string, PendingShopState>>;
  readonly pendingHermesShrineDeliveries: Readonly<Record<string, PendingHermesShrineDelivery>>;
  readonly stygianWell: StygianWellRunState;
  readonly rewardLookups: Readonly<Record<string, readonly string[]>>;
  /**
   * Transient per-map offered rewards from the transition that reached this
   * room; see `state/offered-rewards.ts`. Sorted and deduplicated so branch
   * equivalence compares the set rather than a generation order.
   */
  readonly offeredRewardTypes: readonly string[];
  /** Unopened trait-bearing loot by room, then by trait-offer or Pom address. */
  readonly pendingTraitOffers: Readonly<
    Record<string, Readonly<Record<string, PendingTraitOfferRecord>>>
  >;
}

export function createEmptyRewardLookups(
  catalog: Catalog,
): Readonly<Record<string, readonly string[]>> {
  return Object.freeze(
    Object.fromEntries(
      catalog.biomeLayouts.values.flatMap((layout) =>
        layout.progression.kind === 'hub'
          ? [[layout.progression.rewardLookup.key, Object.freeze([])] as const]
          : [],
      ),
    ),
  );
}
