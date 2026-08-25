import type { Catalog } from '../../catalog-schema';
import { semanticAddressKey, type TraitOfferOwnerAddress } from '../../authored-project/addresses';
import type { AuthoredRewardState } from '../../authored-project/model';
import {
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
} from '../../authored-project/artificer';
import {
  resolveAcquisitionRole,
  type ProducerLifecyclePointKey,
  type ResolvedRewardOffer,
  type RewardBagState,
  type RewardHistoryState,
  type RewardKernelFacts,
  type ShopGenerationWitness,
} from '../../reward-kernel';
import type { CanonicalShopOffer } from '../materialization';
import type { FindingEvidence } from '../model';
import type { RewardEvent } from './model';
import {
  createTraitHistoryState,
  hasActiveChaosSemanticTag,
  type ReachedLevelResolutionEvaluation,
  type ReachedTraitOfferEvaluation,
  type TraitHistoryState,
} from '../traits';
import { artificerStatus, type ArcanaFearState } from '../arcana-fear';
import type { KeepsakeState } from '../keepsakes';
import type {
  AcquisitionSettlementRole,
  AcquisitionSource,
  CanonicalRewardRoom,
} from './processing';

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
  readonly reward: AuthoredRewardState;
  readonly remainingUses: number;
  /** Set at the exact qualifying lifecycle point; pickup settlement owns its host detail. */
  readonly dueAt?: import('../../authored-project/addresses').OccurrenceAddress;
  readonly dueSequence?: number;
}

export interface RewardBranchState {
  readonly bags: Readonly<Record<string, RewardBagState>>;
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

/** Exact Sea Star question at the captured pre-acquisition role frontier. */
export function assessSeaStarDuplication(
  catalog: Catalog,
  branch: RewardBranchState,
  source: AcquisitionSource,
  resolution: AcquisitionSettlementRole,
): { readonly supported: boolean; readonly evidence: FindingEvidence } {
  const resolved = resolveAcquisitionRole(
    catalog.rewards,
    source.offer,
    resolution.role,
    resolution.lifecyclePoint,
  );
  const acquisition = catalog.rewards.acquisitions.byKey[resolved.acquisition.gameName];
  const seaStarActive =
    (branch.traitHistory ?? createTraitHistoryState()).equippedTraits.DoubleRewardBoon !==
    undefined;
  const evidence = Object.freeze({
    ...offerEvidence(source.offer),
    role: resolution.role,
    lifecyclePoint: resolution.lifecyclePoint,
    canDuplicate: acquisition?.canDuplicate === true,
    seaStarActive,
    instanceProvenance: source.instanceProvenance,
    normalDisposition:
      source.dispositionByAcquisitionRole?.[resolution.role]?.kind !== 'timePiece' &&
      source.dispositionByAcquisitionRole?.[resolution.role]?.kind !== 'artificer',
    blocksSeaStarDuplication: source.blocksSeaStarDuplication === true,
  });
  return Object.freeze({
    supported:
      seaStarActive &&
      acquisition?.canDuplicate === true &&
      source.instanceProvenance === 'free' &&
      source.blocksSeaStarDuplication !== true &&
      source.dispositionByAcquisitionRole?.[resolution.role]?.kind !== 'timePiece' &&
      source.dispositionByAcquisitionRole?.[resolution.role]?.kind !== 'artificer',
    evidence,
  });
}

export function withStoredArtificerReplacements(
  room: CanonicalRewardRoom,
  source: AcquisitionSource,
): AcquisitionSource {
  const dispositions = source.dispositionByAcquisitionRole ?? {};
  const site = artificerAcquisitionSite(room.origin, source.origin);
  const entries = room.acquisitionSites[acquisitionSiteStorageKey(site)]?.entries ?? {};
  const replacements = Object.freeze(
    Object.fromEntries(
      Object.entries(dispositions).flatMap(([role, disposition]) =>
        disposition.kind !== 'artificer'
          ? []
          : [[role, entries[artificerReplacementEntryKey(source.origin, role)] ?? null]],
      ),
    ),
  );
  return Object.freeze({
    ...source,
    artificerReplacementByAcquisitionRole: replacements,
    artificerReplacementSiteByAcquisitionRole: Object.freeze(
      Object.fromEntries(Object.keys(replacements).map((role) => [role, site])),
    ),
  });
}

/**
 * Shared Time Piece legality.  Settlement, progressive candidates, and the
 * persisted-value finding all ask this exact question at the frozen role
 * frontier; no consumer replays reward settlement to rediscover it.
 */
export function assessTimePieceConversion(
  catalog: Catalog,
  branch: RewardBranchState,
  source: AcquisitionSource,
  role: string,
  lifecyclePoint: ProducerLifecyclePointKey,
): { readonly supported: boolean; readonly evidence: FindingEvidence } {
  const acquisition = resolveAcquisitionRole(catalog.rewards, source.offer, role, lifecyclePoint);
  const blocksGoldConversion =
    catalog.rewards.rewardTypes.byKey[source.offer.rewardType]?.acquisitionRoles.byKey[role]
      ?.blocksGoldConversion === true;
  const goldConversionEligible =
    catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.goldConversionEligible ===
    true;
  const remainingCharges = branch.keepsakes.timePiece?.remainingCharges ?? 0;
  const evidence = Object.freeze({
    ...offerEvidence(source.offer),
    role,
    lifecyclePoint,
    goldConversionEligible,
    blocksGoldConversion,
    instanceProvenance: source.instanceProvenance,
    fatedStatus: branch.keepsakes.fatedStatus,
    remainingCharges,
  });
  return Object.freeze({
    supported:
      goldConversionEligible &&
      !blocksGoldConversion &&
      source.instanceProvenance === 'free' &&
      branch.keepsakes.fatedStatus === 'Fated' &&
      remainingCharges > 0,
    evidence,
  });
}

export function assessArtificerConversion(
  catalog: Catalog,
  branch: RewardBranchState,
  source: AcquisitionSource,
  resolution: AcquisitionSettlementRole,
): { readonly supported: boolean; readonly evidence: FindingEvidence } {
  const acquisition = resolveAcquisitionRole(
    catalog.rewards,
    source.offer,
    resolution.role,
    resolution.lifecyclePoint,
  );
  const artificerConversionEligible =
    catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]
      ?.artificerConversionEligible === true;
  const status = hasActiveChaosSemanticTag(
    branch.traitHistory ?? createTraitHistoryState(),
    'Barren',
  )
    ? undefined
    : artificerStatus(catalog, branch.arcanaFear);
  const evidence = Object.freeze({
    ...offerEvidence(source.offer),
    role: resolution.role,
    lifecyclePoint: resolution.lifecyclePoint,
    artificerConversionEligible,
    blocksArtificerConversion: resolution.blocksArtificerConversion === true,
    instanceProvenance: source.instanceProvenance,
    ...(status === undefined ? {} : { artificerRarity: status.rarity }),
    artificerCapacity: status?.capacity ?? 0,
    artificerSpent: status?.spent ?? 0,
    artificerRemaining: status?.remaining ?? 0,
  });
  return Object.freeze({
    supported:
      artificerConversionEligible &&
      resolution.blocksArtificerConversion !== true &&
      source.instanceProvenance === 'free' &&
      status !== undefined &&
      status.remaining > 0,
    evidence,
  });
}

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
