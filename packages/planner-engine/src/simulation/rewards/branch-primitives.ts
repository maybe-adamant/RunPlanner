import { semanticAddressKey, type TraitOfferOwnerAddress } from '../../authored-project/addresses';
import {
  type ResolvedRewardOffer,
  type RewardBagState,
  type RewardHistoryState,
  type RewardKernelFacts,
  type ShopGenerationWitness,
  type ProducerLifecyclePointKey,
} from '../../reward-kernel';
import type { CanonicalShopOffer } from '../materialization';
import type { FindingEvidence } from '../model';
import type { RewardEvent } from './model';
import {
  type ReachedLevelResolutionEvaluation,
  type ReachedTraitOfferEvaluation,
  type TraitHistoryState,
} from '../traits';
import type { ArcanaFearState } from '../arcana-fear';
import type { KeepsakeState } from '../keepsakes';
import type { HexProgressState } from '../hex-progress';

export interface PendingShopTravelRefill {
  readonly sourceOfferKey: string;
  readonly slotIndex: number;
  readonly rewardTypes: readonly string[];
  readonly excludedNames: ReadonlySet<string>;
  readonly generationFacts: RewardKernelFacts;
  readonly evaluateOffer: (
    offer: ResolvedRewardOffer,
  ) => import('./producer-frontiers').RewardProducerCandidateResult;
}

export type PendingShopPaidOffer = Omit<CanonicalShopOffer, 'offerOrigin'> & {
  readonly offerOrigin: TraitOfferOwnerAddress;
  /** Ephemeral evaluated result; it never enters canonical materialization. */
  readonly runtimeOfferFallbackRewardType?: string;
};

export interface PendingShopGoldMaterialization {
  readonly sourceOfferKey: string;
  readonly roleBindings: readonly {
    readonly role: string;
    readonly lifecyclePoint: ProducerLifecyclePointKey;
  }[];
  readonly sourceOffer: PendingShopPaidOffer;
  readonly sourceTraitHistory: TraitHistoryState;
  readonly sourcePomEligibleTraitKeys: readonly string[];
}

export interface PendingShopState {
  readonly profileKey: string;
  readonly witness: ShopGenerationWitness;
  readonly remainingSlotIndexes?: readonly number[];
  readonly travelActiveAtEntry?: boolean;
  readonly goldActiveAtEntry?: import('../../authored-project/traits').EquippedTrait;
  readonly firstNormalPurchaseSeen?: boolean;
  readonly travelRefill?: PendingShopTravelRefill;
  readonly goldMaterialization?: PendingShopGoldMaterialization;
}

/** Cross-biome run state derived from one Shrine purchase action. */
export interface PendingHermesShrineDelivery {
  readonly sourceKey: string;
  readonly sourceOrigin: import('../../authored-project/addresses').OccurrenceAddress;
  readonly generationKey: import('../../authored-project/model').HermesShrineGenerationKey;
  readonly rewardType: string;
  readonly remainingUses: number;
  /** Set at the exact qualifying lifecycle point; pickup settlement owns its host detail. */
  readonly dueAt?: import('../../authored-project/addresses').OccurrenceAddress;
  readonly dueSequence?: number;
}

export interface RewardBranchState {
  readonly bags: Readonly<Record<string, RewardBagState>>;
  /** Ordered global exact reward-type priorities, consumed only by counted selection. */
  readonly rewardPriorities: readonly string[];
  /** Semantic Path selections: banked until a writable screen, then aggregate invested. */
  readonly hexProgress: HexProgressState;
  readonly history: RewardHistoryState;
  readonly events: readonly RewardEvent[];
  readonly pendingShops: Readonly<Record<string, PendingShopState>>;
  /** Delayed Shrine purchases survive biome boundaries until delivery or pickup. */
  readonly pendingHermesShrineDeliveries: Readonly<Record<string, PendingHermesShrineDelivery>>;
  /** Consequential RoomShop state only; neutral paid items deliberately add no ledger. */
  readonly stygianWell: import('../stygian-well').StygianWellRunState;
  readonly processedThroughHistorySequence: number;
  readonly traitHistory?: TraitHistoryState;
  readonly traitEvaluations?: readonly ReachedTraitOfferEvaluation[];
  readonly levelResolutionEvaluations?: readonly ReachedLevelResolutionEvaluation[];
  readonly arcanaFear: ArcanaFearState;
  readonly keepsakes: KeepsakeState;
  /**
   * Sea Star eligibility is decided at a source role's pre-acquisition
   * frontier, then carried until its separately authored duplicate action.
   * This deliberately survives later room actions which can change traits.
   */
  readonly seaStarDuplicateEligibilityBySource?: Readonly<
    Record<string, { readonly supported: boolean; readonly evidence: FindingEvidence }>
  >;
}

export type RewardEventData<Event extends RewardEvent = RewardEvent> = Event extends RewardEvent
  ? Omit<Event, 'historySequence' | 'rewardSequence'>
  : never;

export function freezeRecord<T>(value: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  return Object.freeze({ ...value });
}

function orderedRecord<T>(value: Readonly<Record<string, T>>): readonly (readonly [string, T])[] {
  return Object.freeze(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => Object.freeze([key, entry] as const)),
  );
}

function equivalentBranchStateKey(branch: RewardBranchState): string {
  const history = branch.history;
  return JSON.stringify({
    bags: orderedRecord(branch.bags),
    rewardPriorities: branch.rewardPriorities,
    hexProgress: branch.hexProgress,
    history: {
      offerHistory: history.offerHistory,
      useRecord: orderedRecord(history.useRecord),
      biomeUseRecord: orderedRecord(history.biomeUseRecord),
      currentRoomUseRecord: orderedRecord(history.currentRoomUseRecord),
      lootTypeHistory: orderedRecord(history.lootTypeHistory),
      lootBiomeRecord: orderedRecord(history.lootBiomeRecord),
      consumableRecord: orderedRecord(history.consumableRecord),
      lastRewardRecreation: history.lastRewardRecreation,
      traitFacts: history.traitFacts,
      lastDevotionDepth: history.lastDevotionDepth,
    },
    pendingShops: orderedRecord(branch.pendingShops),
    pendingHermesShrineDeliveries: orderedRecord(branch.pendingHermesShrineDeliveries),
    stygianWell: branch.stygianWell,
    traitHistory: branch.traitHistory,
    arcanaFear: branch.arcanaFear,
    keepsakes: branch.keepsakes,
    ...(branch.seaStarDuplicateEligibilityBySource === undefined
      ? {}
      : {
          seaStarDuplicateEligibilityBySource: orderedRecord(
            branch.seaStarDuplicateEligibilityBySource,
          ),
        }),
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
  });
}

function mergeTraitEvaluations(
  left: readonly ReachedTraitOfferEvaluation[] | undefined,
  right: readonly ReachedTraitOfferEvaluation[] | undefined,
): readonly ReachedTraitOfferEvaluation[] | undefined {
  const values = [...(left ?? []), ...(right ?? [])];
  if (values.length === 0) return undefined;
  const unique = new Map<string, ReachedTraitOfferEvaluation>();
  for (const value of values) {
    const key = JSON.stringify([
      semanticAddressKey(value.address),
      value.acquisitionRole,
      value.chronologicalIndex,
      value.before,
      value.context,
      value.offer,
      value.arcanaFear,
    ]);
    unique.set(key, value);
  }
  return Object.freeze([...unique.values()]);
}

function mergeLevelResolutionEvaluations(
  left: readonly ReachedLevelResolutionEvaluation[] | undefined,
  right: readonly ReachedLevelResolutionEvaluation[] | undefined,
): readonly ReachedLevelResolutionEvaluation[] | undefined {
  const values = [...(left ?? []), ...(right ?? [])];
  if (values.length === 0) return undefined;
  const unique = new Map<string, ReachedLevelResolutionEvaluation>();
  for (const value of values) {
    unique.set(
      JSON.stringify([
        semanticAddressKey(value.address),
        value.chronologicalIndex,
        value.before,
        value.value,
      ]),
      value,
    );
  }
  return Object.freeze([...unique.values()]);
}

export function mergeEquivalentRewardBranches(
  branches: readonly RewardBranchState[],
): readonly RewardBranchState[] {
  const merged = new Map<string, RewardBranchState>();
  for (const branch of branches) {
    const key = equivalentBranchStateKey(branch);
    const previous = merged.get(key);
    if (previous === undefined) {
      merged.set(key, branch);
    } else {
      const traitEvaluations = mergeTraitEvaluations(
        previous.traitEvaluations,
        branch.traitEvaluations,
      );
      const levelResolutionEvaluations = mergeLevelResolutionEvaluations(
        previous.levelResolutionEvaluations,
        branch.levelResolutionEvaluations,
      );
      merged.set(
        key,
        traitEvaluations === undefined && levelResolutionEvaluations === undefined
          ? previous
          : Object.freeze({
              ...previous,
              ...(traitEvaluations === undefined ? {} : { traitEvaluations }),
              ...(levelResolutionEvaluations === undefined ? {} : { levelResolutionEvaluations }),
            }),
      );
    }
  }
  return Object.freeze([...merged.values()]);
}

export function appendRewardEvent(
  branch: RewardBranchState,
  historySequence: number,
  event: RewardEventData,
): RewardBranchState {
  const next = Object.freeze({
    ...event,
    rewardSequence: branch.events.length + 1,
    historySequence,
  }) as RewardEvent;
  return Object.freeze({
    ...branch,
    events: Object.freeze([...branch.events, next]),
    processedThroughHistorySequence: historySequence,
  });
}

export function offerEvidence(offer: ResolvedRewardOffer): FindingEvidence {
  const payload = offer.payload;
  return {
    rewardType: offer.rewardType,
    ...(payload?.kind === 'BoonSource' ? { source: payload.source } : {}),
    ...(payload?.kind === 'DevotionPair'
      ? { chosenSource: payload.chosenSource, spurnedSource: payload.spurnedSource }
      : {}),
  };
}
