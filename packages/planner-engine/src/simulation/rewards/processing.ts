import type { Catalog, KeepsakeRank, RoomDeclaration } from '../../catalog-schema';
import { evaluateCallingCardOffer } from '../keepsakes';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createTraitOfferAddress,
  createAcquisitionRoleAddress,
  createKeepsakeEquipResultAddress,
  createRouteStartKeepsakeSelectionAddress,
  createCirceResolutionAddress,
  createTraitAcquisitionTargetAddress,
  createEchoPomTargetAddress,
  createEchoLastRunBoonAddress,
  createAllTogetherSetAddress,
  createLevelResolutionAddress,
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type AcquisitionSiteAddress,
  type AcquisitionSiteOwnerAddress,
  type EchoLastRunBoonAddress,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredKeepsakeEquipResults,
  AuthoredRewardState,
} from '../../authored-project/model';
import {
  createUnresolvedAcquisitionRewardState,
  createUnresolvedShopAcquisitionRewardState,
  traitGiverUsesOfferContext,
} from '../../authored-project/traits';
import {
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  parseArtificerReplacementEntryKey,
} from '../../authored-project/artificer';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  echoShopDuplicateOffer,
  echoShopDuplicateOfferMatches,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../../authored-project/shop';
import {
  applyConcreteAcquisition,
  applyOfferProjection,
  beginBiomeRewardHistory,
  beginCurrentRoomRewardHistory,
  consumeCountedOffer,
  createRewardBagState,
  createRewardHistoryState,
  evaluateShopGenerationSupport,
  evaluateShopPurchaseAtSlot,
  findShopIndexedGenerationWitnesses,
  purchaseInteractionName,
  isOfferSupportedAtResolutionPoint,
  isPayloadLocallyValid,
  locallyValidRewardOffers,
  resolveAcquisitionRole,
  recordLootTypeHistorySource,
  type AuthoredShopOffer,
  type RewardBagState,
  type RewardHistoryState,
  type RewardKernelFacts,
  type ResolvedRewardOffer,
  type ShopGenerationSupport,
  type ShopGenerationWitness,
  type ProducerLifecyclePointKey,
} from '../../reward-kernel';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type { HistoryEvent } from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalLocalVisitRoom,
  CanonicalResolvedIncomingReward,
  CanonicalShopOffer,
} from '../materialization';
import {
  isAcquisitionAuthorshipMissingFinding,
  type FindingEvidence,
  type RewardGenerationFindingCode,
  type SemanticFinding,
  type TraitFindingCode,
} from '../model';
import {
  findingRegion,
  findingIdentityKey,
  ownerRegion,
  type FindingChronology,
  type FindingRegionEntry,
} from '../finding-regions';
import type { RewardBranch, RewardEvent } from './model';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  isPomEligibleTrait,
  echoPomGreatestLevelTraitKeys,
  echoLastRunBoonOutcomes,
  evaluateReachedEchoLastRunBoonOffer,
  evaluateReachedTraitOffer,
  assessTraitOfferBeforeRarification,
  evaluateReachedLevelResolution,
  recordReachedLevelResolution,
  recordReachedTraitOffer,
  recordDirectTraitGrants,
  recordFixedAcquisitionTraitGrant,
  recordAspectStartingTrait,
  isAspectSpellDropDormant,
  directTraitSetOutcomes,
  type ReachedTraitOfferEvaluation,
  type ReachedLevelResolutionEvaluation,
  type TraitHistoryState,
  type EchoLastRunBoonOutcome,
  type TraitOfferContext,
} from '../traits';
import {
  optionIndex,
  traitGiverForAcquisitionRole,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
} from '../../authored-project/traits';
import { levelResolutionEffectFor } from '../../reward-kernel/level-effects';
import type { ArcanaFearState } from '../arcana-fear';
import {
  activateTemporaryArcana,
  artificerStatus,
  beginBiomeArcanaFearState,
  circeResolutionDomain,
  consumeOrdinaryRoomForfeit,
  consumeArtificerUse,
  manualArcanaGraspCost,
  promoteArcana,
  suppressFearVow,
} from '../arcana-fear';
import {
  advanceCurrentKeepsake,
  createKeepsakeState,
  assessExperimentalHammerEquipResult,
  equipExperimentalHammer,
  assessJeweledPomEquipResult,
  equipJeweledPom,
  jeweledPomEffectForKey,
  refreshKeepsakeFatedStatus,
  consumeTimePieceCharge,
  beginBiomeKeepsakeState,
  type KeepsakeState,
} from '../keepsakes';

export type CanonicalRewardRoom = CanonicalAuthoredRoom | CanonicalLocalVisitRoom;

interface PendingShopTravelRefill {
  readonly sourceOfferKey: string;
  readonly slotIndex: number;
  readonly rewardTypes: readonly string[];
  readonly excludedNames: ReadonlySet<string>;
  readonly generationFacts: RewardKernelFacts;
  readonly evaluateOffer: (
    offer: ResolvedRewardOffer,
  ) => import('./producer-frontiers').RewardProducerCandidateResult;
}

type PendingShopPaidOffer = Omit<CanonicalShopOffer, 'offerOrigin'> & {
  readonly offerOrigin: TraitOfferOwnerAddress;
};

interface PendingShopGoldMaterialization {
  readonly sourceOfferKey: string;
  readonly roleBindings: readonly {
    readonly role: string;
    readonly lifecyclePoint: ProducerLifecyclePointKey;
  }[];
  readonly sourceOffer: PendingShopPaidOffer;
  readonly sourceTraitHistory: TraitHistoryState;
  readonly sourcePomEligibleTraitKeys: readonly string[];
}

interface PendingShopState {
  readonly profileKey: string;
  readonly witness: ShopGenerationWitness;
  readonly remainingSlotIndexes?: readonly number[];
  readonly travelActiveAtEntry?: boolean;
  readonly goldActiveAtEntry?: import('../../authored-project/traits').EquippedTrait;
  readonly firstNormalPurchaseSeen?: boolean;
  readonly travelRefill?: PendingShopTravelRefill;
  readonly goldMaterialization?: PendingShopGoldMaterialization;
}

export interface RewardBranchState {
  readonly bags: Readonly<Record<string, RewardBagState>>;
  readonly history: RewardHistoryState;
  readonly events: readonly RewardEvent[];
  readonly pendingShops: Readonly<Record<string, PendingShopState>>;
  readonly processedThroughHistorySequence: number;
  readonly traitHistory?: TraitHistoryState;
  readonly traitEvaluations?: readonly ReachedTraitOfferEvaluation[];
  readonly levelResolutionEvaluations?: readonly ReachedLevelResolutionEvaluation[];
  readonly arcanaFear: ArcanaFearState;
  readonly keepsakes: KeepsakeState;
}

/**
 * The complete result of one reached mandatory producer acquisition site.
 * Participation and order are derived; optional entries can extend the same
 * history fold without changing its chronology authority.
 */
export interface AcquisitionSettlementProduct {
  readonly site: AcquisitionSiteAddress;
  readonly entries: readonly AcquisitionSettlementEntry[];
  readonly branches: readonly RewardBranchState[];
  /**
   * Exact pre-entry histories captured by one canonical ordered optional-pickup
   * settlement. Candidate artifacts consume these products; they never replay
   * the real settlement merely to rediscover an entry frontier.
   */
  readonly pickupEntryFrontiers?: readonly PickupAcquisitionEntryFrontier[];
  /** Exact pre-role branch products from the canonical settlement fold. */
  readonly roleFrontiers?: readonly AcquisitionRoleFrontier[];
  /** Reached derived entry whose authored child is not part of the site's order. */
  readonly derivedEntryFrontiers?: readonly DerivedAcquisitionEntryFrontier[];
  /** Exact post-outer checkpoints for reached trait children that block chronology. */
  readonly traitChildSettlements?: readonly ReachedTraitChildCheckpoint[];
}

export interface ReachedTraitChildCheckpoint {
  readonly address: SemanticAddress;
  readonly branch: RewardBranchState;
  readonly candidateContext?: import('../traits').TraitOfferCandidateContext;
}

export interface DerivedAcquisitionEntryFrontier {
  readonly address: AcquisitionEntryAddress;
  readonly kind:
    | 'echoDoubleShopPlaceholder'
    | 'echoDoubleShopReward'
    | 'echoLastReward'
    | 'infernalContractReward'
    | 'travelDealPlaceholder'
    | 'travelDealRefill';
  readonly branchCohortSize: number;
  readonly sourceOfferKey?: string;
  readonly slotIndex?: number;
  /** Exact declaration families with at least one supported resolved offer on this branch. */
  readonly rewardTypes?: readonly string[];
  /** Exact engine-derived state when the source offer is copied without fresh payload resolution. */
  readonly fixedReward?: AuthoredRewardState;
  /** The retained authored identity disagrees with this exact derived source. */
  readonly retainedSourceMismatch?: boolean;
  /** Candidate support for editing the exact derived reward before participation is selected. */
  readonly roleFrontiers?: readonly AcquisitionRoleFrontier[];
  /** Paid entries that can source a first-eligible derived child in this Shop. */
  readonly eligibleSourceOfferKeys?: readonly string[];
  readonly branchesBeforeEntry: readonly RewardBranchState[];
  readonly evaluateOffer?: (
    offer: ResolvedRewardOffer,
  ) => import('./producer-frontiers').RewardProducerCandidateResult;
}

export interface AcquisitionRoleFrontier {
  readonly address: import('../../authored-project/addresses').AcquisitionRoleAddress;
  readonly branchesBeforeRole: readonly RewardBranchState[];
  readonly source: AcquisitionSource;
  readonly lifecyclePoint: ProducerLifecyclePointKey;
  readonly historySequence: number;
  readonly settlement: {
    readonly site: AcquisitionSiteAddress;
    readonly entry: AcquisitionEntryAddress;
  };
  /** Exact generated child owner used by the ordinary trait/Pom candidate machinery. */
  readonly artificerReplacementAddress: AcquisitionEntryAddress;
  readonly artificerReplacementOptions?: readonly AuthoredRewardState[];
  readonly artificerReplacementCandidate?: {
    readonly rewardTypes: readonly string[];
    readonly evaluateOffer: (
      offer: ResolvedRewardOffer,
    ) => import('./producer-frontiers').RewardProducerCandidateResult;
  };
  readonly blocksArtificerConversion?: true;
}

export interface PickupAcquisitionEntryFrontier {
  readonly address: AcquisitionEntryAddress;
  readonly reward: AuthoredRewardState | null;
  readonly branchesBeforeEntry: readonly RewardBranchState[];
}

export interface AcquisitionSettlementEntry {
  readonly address: AcquisitionEntryAddress;
  readonly source: SemanticAddress;
  /** One atomic entry may apply several declaration-owned roles in sequence. */
  readonly acquisitionRoles: readonly AcquisitionSettlementRole[];
  readonly participation: 'mandatory' | 'optional' | 'dormant';
}

export interface AcquisitionSettlementRole {
  readonly role: string;
  readonly lifecyclePoint: ProducerLifecyclePointKey;
  readonly blocksArtificerConversion?: true;
}

export interface OwnedAcquisitionSettlementRequest {
  readonly siteOwner: AcquisitionSiteOwnerAddress;
  readonly pointKey: string;
  readonly entryKey: string;
  readonly source: AcquisitionSource;
  readonly historySequence: number;
  readonly roleBindings?: readonly AcquisitionSettlementRole[];
  /** Ordered sites publish a distinct dependent action instead of settling immediately. */
  readonly deferArtificerReplacement?: boolean;
}
export interface AcquisitionRoleResolution extends AcquisitionSettlementRole {
  readonly historySequence: number;
}
export interface AcquisitionSource {
  readonly origin: TraitOfferOwnerAddress;
  readonly offer: ResolvedRewardOffer;
  readonly producerLifecycleKey: string;
  readonly producerKind?: CanonicalResolvedIncomingReward['producerKind'];
  /** Instance fact supplied by the producer, never inferred from an owner label. */
  readonly instanceProvenance: 'free' | 'paid';
  readonly traitOffersByAcquisitionRole?: CanonicalResolvedIncomingReward['traitOffersByAcquisitionRole'];
  readonly levelResolutionsByAcquisitionRole?: CanonicalResolvedIncomingReward['levelResolutionsByAcquisitionRole'];
  /** Optional creation-time Pom frontier for an already-materialized loot object. */
  readonly levelResolutionGenerationHistory?: TraitHistoryState;
  readonly dispositionByAcquisitionRole?: AuthoredRewardState['dispositionByAcquisitionRole'];
  /** Exact source-produced payload stored at the occurrence acquisition site. */
  readonly artificerReplacementByAcquisitionRole?: Readonly<
    Record<string, AuthoredRewardState | null>
  >;
  readonly artificerReplacementSiteByAcquisitionRole?: Readonly<
    Record<string, AcquisitionSiteAddress>
  >;
  readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
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
  const status = artificerStatus(catalog, branch.arcanaFear);
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

function hasArtificerUse(
  branch: RewardBranchState,
  owner: SemanticAddress,
  acquisitionRole: string,
): boolean {
  return branch.arcanaFear.arcana.artificerUses.some(
    (use) =>
      semanticAddressKey(use.owner) === semanticAddressKey(owner) &&
      use.acquisitionRole === acquisitionRole,
  );
}

export type RewardFactsFactory = (
  history: RewardHistoryState,
  currentRoomShopOptionNames?: ReadonlySet<string>,
) => RewardKernelFacts;

type RewardEventData<Event extends RewardEvent = RewardEvent> = Event extends RewardEvent
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
    traitHistory: branch.traitHistory,
    arcanaFear: branch.arcanaFear,
    keepsakes: branch.keepsakes,
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

interface ApplyTraitOfferOptions {
  readonly directAcquisition?: boolean;
  readonly skipCallingCard?: boolean;
  readonly directTraitSetBranchHistories?: readonly TraitHistoryState[];
}

interface EchoLastRunBoonSettlement {
  readonly address: EchoLastRunBoonAddress;
  readonly outcome: EchoLastRunBoonOutcome;
}

function applyTraitOfferForAcquisitionInternal(
  catalog: Catalog,
  branch: RewardBranchState,
  reward: {
    readonly origin: SemanticAddress;
    readonly offer?: CanonicalResolvedIncomingReward['offer'];
    readonly producerLifecycleKey?: string;
    readonly producerKind?: CanonicalResolvedIncomingReward['producerKind'];
    readonly traitOffersByAcquisitionRole?: CanonicalResolvedIncomingReward['traitOffersByAcquisitionRole'];
    readonly levelResolutionsByAcquisitionRole?: CanonicalResolvedIncomingReward['levelResolutionsByAcquisitionRole'];
    readonly levelResolutionGenerationHistory?: TraitHistoryState;
    readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
  },
  role: string,
  lifecyclePoint: string,
  sequence: number,
  findings?: Map<string, FindingRegionEntry>,
  findingChronology?: FindingChronology,
  options: ApplyTraitOfferOptions = {},
  echoLastRunBoon?: EchoLastRunBoonSettlement,
): {
  readonly branch: RewardBranchState;
  readonly blockedChild?: ReachedTraitChildCheckpoint;
} {
  // Aspect of Selene routes a later Spell Drop into unsupported Path of Stars.
  // The concrete acquisition still settles in the reward ledger; its base-spell
  // child is deliberately dormant and must neither block nor change history.
  if (
    reward.offer?.rewardType === 'SpellDrop' &&
    isAspectSpellDropDormant(catalog, reward.traitContext?.aspectKey) &&
    role === 'self'
  )
    return Object.freeze({ branch });
  const authored = reward.traitOffersByAcquisitionRole?.[role];
  const authoredLevelResolution = reward.levelResolutionsByAcquisitionRole?.[role];
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (authored === null) {
    const owner = traitOwnerAddress(reward.origin);
    const giver =
      reward.traitContext?.resolvedProviderKey ??
      (reward.offer === undefined
        ? undefined
        : traitGiverForAcquisitionRole(catalog, reward.offer, role));
    if (findings !== undefined && owner !== undefined)
      addTraitFinding(
        findings,
        owner,
        role,
        lifecyclePoint,
        sequence,
        'traitOfferMissing',
        undefined,
        undefined,
        undefined,
        findingChronology,
      );
    return Object.freeze({
      branch,
      ...(owner === undefined
        ? {}
        : {
            blockedChild: Object.freeze({
              address: createTraitOfferAddress(owner, role),
              branch,
              ...(giver === undefined
                ? {}
                : {
                    candidateContext: Object.freeze({
                      before,
                      context: Object.freeze({
                        ...(reward.traitContext ?? {}),
                        devotionNoDuo:
                          reward.traitContext?.devotionNoDuo ??
                          reward.offer?.rewardType === 'Devotion',
                        resolvedProviderKey: giver,
                      }),
                      arcanaFear: branch.arcanaFear,
                      keepsakes: branch.keepsakes,
                    }),
                  }),
            }),
          }),
    });
  }
  const authoredContext =
    authored === undefined
      ? undefined
      : {
          ...(reward.traitContext ?? {}),
          devotionNoDuo:
            reward.traitContext?.devotionNoDuo ?? reward.offer?.rewardType === 'Devotion',
          ...(authored.kind === 'fallbackGold' || authored.deathDefianceConditionMet === undefined
            ? {}
            : { deathDefianceConditionMet: authored.deathDefianceConditionMet }),
          resolvedProviderKey: authored.giverKey,
        };
  const baseOffer =
    authored === undefined || authoredContext === undefined || options.directAcquisition === true
      ? undefined
      : assessTraitOfferBeforeRarification(catalog, authored, before, authoredContext);
  const callingCard =
    authored === undefined || options.skipCallingCard === true
      ? undefined
      : evaluateCallingCardOffer(catalog, branch.keepsakes, authored, baseOffer?.legal ?? false);
  const effectiveAuthored = callingCard?.offer ?? authored;
  const effectiveBranch =
    callingCard === undefined || callingCard.state === branch.keepsakes
      ? branch
      : Object.freeze({ ...branch, keepsakes: callingCard.state });
  {
    const effect =
      reward.offer === undefined || reward.producerLifecycleKey === undefined
        ? undefined
        : levelResolutionEffectFor(
            catalog.rewards,
            reward.offer,
            {
              kind: reward.producerKind === 'shop' ? 'shopProfile' : 'producerLifecycle',
              key: reward.producerLifecycleKey,
            },
            role,
          );
    if (effect !== undefined) {
      const owner = traitOwnerAddress(reward.origin);
      if (owner === undefined) return Object.freeze({ branch });
      const address = createLevelResolutionAddress(owner, role);
      // A missing child is still a reached, incomplete declaration-owned Pom.
      // Do not let malformed legacy/project state silently bypass the effect.
      const levelResolution =
        authoredLevelResolution ??
        (effect.kind === 'visibleChoice'
          ? { kind: 'choice' as const, offeredTraitKeys: Object.freeze([]), selectedTraitKey: null }
          : { kind: 'random' as const, targetTraitKey: null });
      const generationBefore = reward.levelResolutionGenerationHistory ?? before;
      const evaluation = evaluateReachedLevelResolution(
        catalog,
        address,
        levelResolution,
        effect.levelCount,
        generationBefore,
        branch.levelResolutionEvaluations?.length ?? 0,
        effect.kind === 'visibleChoice' ? 'choice' : 'random',
        effect.kind === 'randomTargetIfAvailable',
      );
      const generated = recordReachedLevelResolution(
        catalog,
        address,
        levelResolution,
        effect.levelCount,
        generationBefore,
        sequence,
        lifecyclePoint,
        effect.kind === 'visibleChoice' ? 'choice' : 'random',
        effect.kind === 'randomTargetIfAvailable',
      );
      const generatedEvent = generated.event;
      const currentTarget =
        levelResolution.kind === 'choice'
          ? levelResolution.selectedTraitKey
          : levelResolution.targetTraitKey;
      const currentEquipped =
        currentTarget === null ? undefined : before.equippedTraits[currentTarget];
      const appliedHistory =
        generatedEvent === undefined ||
        currentTarget === null ||
        currentEquipped?.level === undefined
          ? before
          : foldTraitHistoryEvents(catalog, [
              ...before.events,
              Object.freeze({
                ...generatedEvent,
                oldLevel: currentEquipped.level,
                newLevel: currentEquipped.level + effect.levelCount,
              }),
            ]);
      if (findings !== undefined && evaluation.findings.length > 0) {
        const codeByFinding = {
          missingTarget: 'missingPomTarget',
          wrongOfferCount: 'pomWrongOfferCount',
          duplicateTargets: 'pomWrongOfferCount',
          selectedTargetNotOffered: 'pomSelectedTargetNotOffered',
          targetUnavailable: 'pomTargetUnavailable',
          kindMismatch: 'pomTargetUnavailable',
        } as const;
        for (const finding of evaluation.findings) {
          addRewardFinding(
            findings,
            Object.freeze({
              code: codeByFinding[finding],
              severity: 'error',
              phase: 'rewardGeneration',
              origin: evaluation.address,
              evidence: Object.freeze({
                acquisitionRole: role,
                lifecyclePoint,
                levelCount: effect.levelCount,
              }),
            }),
            ownerRegion(evaluation.address),
            findingChronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
            evaluation,
          );
        }
      }
      return Object.freeze({
        branch: Object.freeze({
          ...branch,
          history: attachTraitHistory(branch.history, appliedHistory),
          traitHistory: appliedHistory,
          levelResolutionEvaluations: Object.freeze([
            ...(branch.levelResolutionEvaluations ?? []),
            evaluation,
          ]),
        }),
      });
    }
  }
  if (effectiveAuthored === undefined) return Object.freeze({ branch: effectiveBranch });
  const evaluationContext = Object.freeze({
    ...(reward.traitContext ?? {}),
    devotionNoDuo: reward.traitContext?.devotionNoDuo ?? reward.offer?.rewardType === 'Devotion',
    ...(effectiveAuthored.kind === 'fallbackGold' ||
    effectiveAuthored.deathDefianceConditionMet === undefined
      ? {}
      : { deathDefianceConditionMet: effectiveAuthored.deathDefianceConditionMet }),
    resolvedProviderKey: effectiveAuthored.giverKey,
  });
  const evaluation =
    echoLastRunBoon === undefined
      ? evaluateReachedTraitOffer(
          catalog,
          reward.origin,
          role,
          effectiveAuthored,
          before,
          evaluationContext,
          branch.traitEvaluations?.length ?? 0,
          branch.arcanaFear,
          options.directAcquisition === true,
          branch.keepsakes,
          callingCard === undefined ? undefined : authored,
        )
      : effectiveAuthored.kind !== 'traits'
        ? (() => {
            throw new Error('BBB settlement requires a trait offer');
          })()
        : evaluateReachedEchoLastRunBoonOffer(
            catalog,
            echoLastRunBoon.address,
            effectiveAuthored,
            echoLastRunBoon.outcome,
            before,
            evaluationContext,
            branch.traitEvaluations?.length ?? 0,
            branch.arcanaFear,
            branch.keepsakes,
          );
  const selectedForIdentity =
    effectiveAuthored.kind === 'traits'
      ? effectiveAuthored.options[optionIndex(effectiveAuthored.selectedOptionKey)]
      : undefined;
  const selectedForIdentityDisposition =
    selectedForIdentity === undefined
      ? undefined
      : catalog.traits.byKey[selectedForIdentity.traitKey]?.selectedDisposition;
  const acquisitionIdentityOwner = traitOwnerAddress(reward.origin);
  const acquisitionIdentity =
    selectedForIdentityDisposition?.kind === 'echo' &&
    (selectedForIdentityDisposition.effect === 'doubleShop' ||
      selectedForIdentityDisposition.effect === 'repeatKeepsake') &&
    acquisitionIdentityOwner !== undefined
      ? `${semanticAddressKey(createTraitOfferAddress(acquisitionIdentityOwner, role))}:${sequence}`
      : undefined;
  const applied = recordReachedTraitOffer(
    catalog,
    evaluation,
    sequence,
    lifecyclePoint,
    acquisitionIdentity,
    selectedForIdentityDisposition?.kind === 'echo' &&
      selectedForIdentityDisposition.effect === 'repeatKeepsake'
      ? reward.traitContext?.currentKeepsakeKey
      : undefined,
  );
  const traitEvaluations = Object.freeze([...(branch.traitEvaluations ?? []), evaluation]);
  if (
    findings !== undefined &&
    callingCard !== undefined &&
    callingCard.invalidActions.length > 0
  ) {
    const owner = traitOwnerAddress(reward.origin);
    if (owner !== undefined) {
      for (const actionIndex of callingCard.invalidActions) {
        addTraitFinding(
          findings,
          owner,
          role,
          lifecyclePoint,
          sequence,
          'callingCardRarificationUnavailable',
          undefined,
          `rarification action ${actionIndex + 1} is unavailable at this offer frontier`,
          undefined,
          findingChronology,
          actionIndex,
          callingCard.offer.kind === 'traits'
            ? callingCard.offer.rarificationActions?.[actionIndex]
            : undefined,
        );
      }
    }
  }
  if (
    findings !== undefined &&
    (evaluation.composition.findings.length > 0 ||
      evaluation.replacementComposition.findings.length > 0 ||
      evaluation.assessments.some((assessment) => !assessment.legal))
  ) {
    const owner = traitOwnerAddress(reward.origin);
    if (owner !== undefined) {
      evaluation.assessments.forEach((assessment) =>
        assessment.findings.forEach((finding) => {
          addTraitFinding(
            findings,
            owner,
            role,
            lifecyclePoint,
            sequence,
            finding.code,
            finding.traitKey,
            finding.detail,
            finding.requirementTraitKeys,
            findingChronology,
          );
        }),
      );
      evaluation.composition.findings.forEach((finding) => {
        addTraitFinding(
          findings,
          owner,
          role,
          lifecyclePoint,
          sequence,
          finding.code,
          finding.traitKey,
          undefined,
          undefined,
          findingChronology,
        );
      });
      evaluation.replacementComposition.findings.forEach((finding) => {
        addTraitFinding(
          findings,
          owner,
          role,
          lifecyclePoint,
          sequence,
          finding.code,
          undefined,
          finding.detail,
          undefined,
          findingChronology,
        );
      });
    }
  }
  // A reached offer remains in the evaluation trace even when one or more
  // alternatives are context-invalid. Only a valid offer folds its selected
  // trait into canonical equipped state; the reward/use ledger still records
  // the concrete acquisition.
  // A Calling Card row action settles at the offer frontier. A later
  // selected-only acquisition failure must not roll that already-valid spend
  // back, while an invalid base offer leaves `effectiveBranch` unchanged.
  if (applied.event === undefined)
    return Object.freeze({
      branch: Object.freeze({ ...effectiveBranch, traitEvaluations }),
    });
  const selected = applied.event.options[optionIndex(applied.event.selectedOptionKey)];
  const pomLevels =
    branch.keepsakes.jeweledPom?.active === true &&
    selected !== undefined &&
    isPomEligibleTrait(catalog, selected.traitKey)
      ? branch.keepsakes.jeweledPom.levels
      : undefined;
  let traitHistory =
    pomLevels === undefined || selected === undefined
      ? applied.history
      : foldTraitHistoryEvents(catalog, [
          ...applied.history.events,
          Object.freeze({
            kind: 'levelMutation' as const,
            owner: evaluation.address,
            acquisitionRole: role,
            sequence,
            acquisitionPoint: lifecyclePoint,
            ...(branch.keepsakes.jeweledPom?.grantedTraitKey === undefined
              ? {}
              : { sourceTraitKey: branch.keepsakes.jeweledPom.grantedTraitKey }),
            targetTraitKey: selected.traitKey,
            oldLevel: applied.history.equippedTraits[selected.traitKey]?.level ?? 1,
            newLevel: (applied.history.equippedTraits[selected.traitKey]?.level ?? 1) + pomLevels,
          }),
        ]);
  const selectedDisposition =
    selected === undefined
      ? undefined
      : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
  const keepsakes =
    selectedDisposition?.kind === 'advanceCurrentKeepsake'
      ? advanceCurrentKeepsake(catalog, effectiveBranch.keepsakes, selectedDisposition.rankBonus)
      : effectiveBranch.keepsakes;
  let blockedChildAddress: SemanticAddress | undefined;
  if (
    evaluation.targetedAcquisition.applies &&
    !evaluation.targetedAcquisition.legal &&
    selected !== undefined
  ) {
    const owner = traitOwnerAddress(reward.origin);
    if (owner !== undefined) {
      const traitAddress = createTraitOfferAddress(owner, role);
      const address = createTraitAcquisitionTargetAddress(
        traitAddress,
        applied.event.selectedOptionKey,
      );
      blockedChildAddress = address;
      if (findings !== undefined)
        evaluation.targetedAcquisition.findings.forEach((finding) =>
          addTraitChildFinding(
            findings,
            address,
            lifecyclePoint,
            sequence,
            finding.code,
            finding.traitKey,
            finding.detail,
            findingChronology,
            ownerRegion(traitAddress),
          ),
        );
    }
  }
  if (selectedDisposition?.kind === 'directTraitSets' && selected !== undefined) {
    const owner = traitOwnerAddress(reward.origin);
    const result = selected.allTogetherResult;
    const branchHistories = options.directTraitSetBranchHistories ?? [before];
    const grants: { readonly owner: SemanticAddress; readonly traitKey: string }[] = [];
    let invalid = owner === undefined;
    if (owner !== undefined) {
      const traitAddress = createTraitOfferAddress(owner, role);
      if (result === undefined) {
        const firstSet = selectedDisposition.sets[0];
        if (firstSet !== undefined) {
          const address = createAllTogetherSetAddress(
            traitAddress,
            applied.event.selectedOptionKey,
            firstSet.key,
          );
          invalid = true;
          blockedChildAddress = address;
          if (findings !== undefined)
            addTraitChildFinding(
              findings,
              address,
              lifecyclePoint,
              sequence,
              'allTogetherResultMissing',
              selected.traitKey,
              'unresolved',
              findingChronology,
              ownerRegion(traitAddress),
            );
        }
      }
      for (const set of selectedDisposition.sets) {
        if (result === undefined) break;
        const address = createAllTogetherSetAddress(
          traitAddress,
          applied.event.selectedOptionKey,
          set.key,
        );
        const domains = branchHistories.map((history) =>
          directTraitSetOutcomes(catalog, history, selected.traitKey, set.key),
        );
        const hasResult =
          result !== undefined && Object.prototype.hasOwnProperty.call(result, set.key);
        const value = result?.[set.key];
        const branchSupported = domains.map((domain) => domain.includes(value ?? null));
        const legal = hasResult && branchSupported.length > 0 && branchSupported.every(Boolean);
        if (!legal) {
          invalid = true;
          blockedChildAddress ??= address;
          if (findings !== undefined)
            addTraitChildFinding(
              findings,
              address,
              lifecyclePoint,
              sequence,
              hasResult ? 'allTogetherResultUnavailable' : 'allTogetherResultMissing',
              selected.traitKey,
              branchSupported.some(Boolean) ? 'branchDivergence' : String(value),
              findingChronology,
              ownerRegion(traitAddress),
            );
        } else if (value !== null && value !== undefined) {
          grants.push(Object.freeze({ owner: address, traitKey: value }));
        }
      }
    }
    if (!invalid)
      traitHistory = recordDirectTraitGrants(
        catalog,
        traitHistory,
        sequence,
        lifecyclePoint,
        selected.traitKey,
        grants,
      );
  }
  const settledBranch = Object.freeze({
    ...effectiveBranch,
    history: attachTraitHistory(branch.history, traitHistory),
    traitHistory,
    traitEvaluations,
    keepsakes,
  });
  return Object.freeze({
    branch: settledBranch,
    ...(blockedChildAddress === undefined
      ? {}
      : {
          blockedChild: Object.freeze({
            address: blockedChildAddress,
            branch: settledBranch,
          }),
        }),
  });
}

function applyTraitOfferForAcquisition(
  catalog: Catalog,
  branch: RewardBranchState,
  reward: Parameters<typeof applyTraitOfferForAcquisitionInternal>[2],
  role: string,
  lifecyclePoint: string,
  sequence: number,
  findings?: Map<string, FindingRegionEntry>,
  findingChronology?: FindingChronology,
  options: ApplyTraitOfferOptions = {},
): ReturnType<typeof applyTraitOfferForAcquisitionInternal> {
  return applyTraitOfferForAcquisitionInternal(
    catalog,
    branch,
    reward,
    role,
    lifecyclePoint,
    sequence,
    findings,
    findingChronology,
    options,
  );
}

function applyEchoLastRunBoonForAcquisition(
  catalog: Catalog,
  branch: RewardBranchState,
  address: EchoLastRunBoonAddress,
  offer: AuthoredTraitOfferTraits,
  outcome: EchoLastRunBoonOutcome,
  context: TraitOfferContext,
  lifecyclePoint: string,
  sequence: number,
): ReturnType<typeof applyTraitOfferForAcquisitionInternal> {
  return applyTraitOfferForAcquisitionInternal(
    catalog,
    branch,
    {
      origin: address,
      traitOffersByAcquisitionRole: Object.freeze({ echoLastRunSelection: offer }),
      traitContext: context,
    },
    'echoLastRunSelection',
    lifecyclePoint,
    sequence,
    undefined,
    undefined,
    Object.freeze({ directAcquisition: true, skipCallingCard: true }),
    Object.freeze({ address, outcome }),
  );
}

function traitOwnerAddress(origin: SemanticAddress): TraitOfferOwnerAddress | undefined {
  switch (origin.kind) {
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
      return origin;
    case 'encounterPhase':
    case 'gorgonPhase':
      return origin;
    case 'acquisitionEntry':
      return origin;
    default:
      return undefined;
  }
}

export interface EncounterTraitOfferSettlement {
  readonly branch: RewardBranchState;
  /** Exact post-outer/pre-effect branch retained when an authored child blocks settlement. */
  readonly blockedChild?: ReachedTraitChildCheckpoint;
}

function encounterPreOfferTraitContext(
  catalog: Catalog,
  branch: RewardBranchState,
  providerKey: string,
  loadout: { readonly weaponKey: string; readonly aspectKey: string } | undefined,
  deathDefianceConditionMet: boolean | undefined,
  freshRarityOverride: import('../../catalog-schema').TraitRarity | undefined,
): TraitOfferContext {
  const effectiveDeathDefianceCondition =
    deathDefianceConditionMet ??
    (traitGiverUsesOfferContext(catalog, providerKey, 'deathDefianceConditionMet')
      ? false
      : undefined);
  const recreation = branch.history.lastRewardRecreation;
  return Object.freeze({
    ...(loadout ?? {}),
    resolvedProviderKey: providerKey,
    manualArcanaGraspCost: manualArcanaGraspCost(catalog, branch.arcanaFear),
    circeRemovableFearVow: circeResolutionDomain(catalog, branch.arcanaFear, 'disableFear')
      .outerAvailable,
    echoLastRewardAvailable: recreation !== undefined,
    ...(recreation === undefined ? {} : { echoLastRewardRecreation: recreation }),
    ...(effectiveDeathDefianceCondition === undefined
      ? {}
      : { deathDefianceConditionMet: effectiveDeathDefianceCondition }),
    ...(freshRarityOverride === undefined ? {} : { freshRarityOverride }),
    currentKeepsakeKey: branch.keepsakes.currentKey,
  });
}

/** Settles one encounter-local trait offer and returns its exact child checkpoint when blocked. */
export function settleEncounterTraitOffer(
  catalog: Catalog,
  branch: RewardBranchState,
  origin: SemanticAddress,
  offer: AuthoredTraitOffer | null,
  sequence: number,
  lifecyclePoint: string,
  findings?: Map<string, FindingRegionEntry>,
  findingChronology?: FindingChronology,
  deathDefianceConditionMet?: boolean,
  acquisitionRole = 'selection',
  freshRarityOverride?: import('../../catalog-schema').TraitRarity,
  loadout?: { readonly weaponKey: string; readonly aspectKey: string },
  directTraitSetBranchHistories?: readonly TraitHistoryState[],
  unresolvedProviderKey?: string,
): EncounterTraitOfferSettlement {
  const providerKey = offer?.giverKey ?? unresolvedProviderKey;
  if (providerKey === undefined)
    throw new Error('encounter trait offer settlement requires its known provider');
  const traitContext = encounterPreOfferTraitContext(
    catalog,
    branch,
    providerKey,
    loadout,
    offer?.kind === 'traits'
      ? (offer.deathDefianceConditionMet ?? deathDefianceConditionMet)
      : deathDefianceConditionMet,
    freshRarityOverride,
  );
  if (offer === null) {
    return applyTraitOfferForAcquisition(
      catalog,
      branch,
      {
        origin,
        traitOffersByAcquisitionRole: Object.freeze({ [acquisitionRole]: null }),
        traitContext,
      },
      acquisitionRole,
      lifecyclePoint,
      sequence,
      findings,
      findingChronology,
    );
  }
  let blockedChild: EncounterTraitOfferSettlement['blockedChild'];
  const settledBranch = ((): RewardBranchState => {
    if (offer.kind === 'fallbackGold') {
      return applyTraitOfferForAcquisition(
        catalog,
        branch,
        {
          origin,
          traitOffersByAcquisitionRole: Object.freeze({ [acquisitionRole]: offer }),
          traitContext,
        },
        acquisitionRole,
        lifecyclePoint,
        sequence,
        findings,
        findingChronology,
      ).branch;
    }
    const selected = offer.options[optionIndex(offer.selectedOptionKey)];
    const disposition =
      selected === undefined
        ? undefined
        : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
    const resolution = selected?.circeResolution;
    const preChoiceTraitHistory = branch.traitHistory ?? createTraitHistoryState();
    const owner = createTraitOfferAddress(origin as TraitOfferOwnerAddress, acquisitionRole);
    const circeDomain =
      disposition?.kind === 'circe'
        ? circeResolutionDomain(catalog, branch.arcanaFear, disposition.effect)
        : undefined;
    const source = {
      origin,
      traitOffersByAcquisitionRole: Object.freeze({ [acquisitionRole]: offer }),
      traitContext,
    } as const;
    // Record the exact pre-effect frontier before validating Circe's authored
    // child. Circe's ordinary offer findings stay provisional until that child
    // is valid, so the child remains the first blocking repair owner.
    const provisionalFindings =
      disposition?.kind === 'circe' && findings !== undefined
        ? new Map<string, FindingRegionEntry>()
        : findings;
    const appliedSettlement = applyTraitOfferForAcquisition(
      catalog,
      branch,
      source,
      acquisitionRole,
      lifecyclePoint,
      sequence,
      provisionalFindings,
      findingChronology,
      directTraitSetBranchHistories === undefined ? {} : { directTraitSetBranchHistories },
    );
    const applied = appliedSettlement.branch;
    blockedChild ??= appliedSettlement.blockedChild;
    const rejectCirce = (code: TraitFindingCode, detail?: string): RewardBranchState => {
      const address = createCirceResolutionAddress(owner, offer.selectedOptionKey);
      blockedChild = Object.freeze({ address, branch: applied });
      if (findings !== undefined)
        addTraitChildFinding(
          findings,
          address,
          lifecyclePoint,
          sequence,
          code,
          selected?.traitKey,
          detail,
          findingChronology,
        );
      return applied;
    };
    if (disposition?.kind === 'circe') {
      if (applied.traitHistory === branch.traitHistory) {
        if (
          findings !== undefined &&
          provisionalFindings !== undefined &&
          provisionalFindings !== findings
        )
          for (const [key, entry] of provisionalFindings) findings.set(key, entry);
        return applied;
      }
      if (disposition.effect === 'activateArcana') {
        if (resolution?.kind !== 'activateArcana') return rejectCirce('circeResolutionMissing');
        if (resolution.arcanaKeys.length !== circeDomain!.requiredCount)
          return rejectCirce(
            'circeResolutionWrongCardinality',
            `${circeDomain!.requiredCount}:${resolution.arcanaKeys.length}`,
          );
        if (resolution.arcanaKeys.some((key) => !circeDomain!.arcanaKeys.includes(key)))
          return rejectCirce('circeResolutionTargetUnavailable');
      } else if (disposition.effect === 'promoteArcana') {
        if (resolution?.kind !== 'promoteArcana') return rejectCirce('circeResolutionMissing');
        if (resolution.arcanaKeys.length !== circeDomain!.requiredCount)
          return rejectCirce(
            'circeResolutionWrongCardinality',
            `${circeDomain!.requiredCount}:${resolution.arcanaKeys.length}`,
          );
        if (resolution.arcanaKeys.some((key) => !circeDomain!.arcanaKeys.includes(key)))
          return rejectCirce('circeResolutionTargetUnavailable');
      } else {
        if (!circeDomain!.outerAvailable) return rejectCirce('circeOptionUnavailable');
        if (resolution?.kind !== 'disableFear' || resolution.vowKey === null)
          return rejectCirce('circeResolutionMissing');
        if (!circeDomain!.vowKeys.includes(resolution.vowKey))
          return rejectCirce('circeResolutionTargetUnavailable');
      }
    }
    if (
      findings !== undefined &&
      provisionalFindings !== undefined &&
      provisionalFindings !== findings
    )
      for (const [key, entry] of provisionalFindings) findings.set(key, entry);
    if (
      disposition?.kind === 'echo' &&
      disposition.effect === 'lastRunBoon' &&
      selected !== undefined &&
      applied.traitHistory !== undefined &&
      applied.traitHistory !== branch.traitHistory
    ) {
      const address = createEchoLastRunBoonAddress(owner, offer.selectedOptionKey);
      const child = selected.echoLastRunBoon;
      const reject = (code: TraitFindingCode, detail?: string): RewardBranchState => {
        blockedChild = Object.freeze({ address, branch: applied });
        if (findings !== undefined)
          addTraitChildFinding(
            findings,
            address,
            lifecyclePoint,
            sequence,
            code,
            selected.traitKey,
            detail,
            findingChronology,
          );
        return applied;
      };
      if (child === undefined) return reject('echoLastRunBoonMissing');
      const selectedChildIndex = optionIndex(child.selectedOptionKey);
      const selectedChild = child.options[selectedChildIndex];
      if (selectedChild === undefined) return reject('echoLastRunBoonMissing');
      const outcomes = echoLastRunBoonOutcomes(catalog, preChoiceTraitHistory, source.traitContext);
      let outcome: (typeof outcomes)[number] | undefined;
      for (const [index, childOption] of child.options.entries()) {
        const rowOutcome = outcomes.find(
          (candidate) =>
            candidate.option.giverKey === childOption.giverKey &&
            candidate.option.traitKey === childOption.traitKey &&
            candidate.option.rarity === childOption.rarity,
        );
        if (rowOutcome === undefined || !rowOutcome.assessment.legal)
          return reject(
            'echoLastRunBoonOptionUnavailable',
            `${childOption.giverKey}:${childOption.traitKey}:${childOption.rarity}`,
          );
        if (index === selectedChildIndex) {
          const targetedAcquisition =
            catalog.traits.byKey[childOption.traitKey]?.targetedAcquisition;
          if (targetedAcquisition !== undefined) {
            if (childOption.targetTraitKey === undefined)
              return reject('targetedAcquisitionTargetMissing', childOption.traitKey);
            if (!rowOutcome.targetTraitKeys.includes(childOption.targetTraitKey))
              return reject('targetedAcquisitionTargetUnavailable', childOption.targetTraitKey);
          } else if (childOption.targetTraitKey !== undefined) {
            return reject('targetedAcquisitionTargetUnavailable', childOption.targetTraitKey);
          }
          outcome = rowOutcome;
        }
      }
      if (outcome === undefined) return reject('echoLastRunBoonMissing');
      const nestedOffer: AuthoredTraitOfferTraits = Object.freeze({
        kind: 'traits',
        giverKey: selectedChild.giverKey,
        options: Object.freeze([
          Object.freeze({
            traitKey: selectedChild.traitKey,
            rarity: outcome.effectiveRarity,
            ...(selectedChild.targetTraitKey === undefined
              ? {}
              : { targetTraitKey: selectedChild.targetTraitKey }),
          }),
        ]) as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1',
        rarificationActions: Object.freeze([]),
      });
      const variant =
        catalog.echoLastRunBoon.variants.byKey[
          `${selectedChild.giverKey}:${selectedChild.traitKey}`
        ];
      const rewardHistory =
        variant?.lootHistorySource === undefined
          ? applied.history
          : recordLootTypeHistorySource(applied.history, variant.lootHistorySource);
      const sourceApplied = Object.freeze({
        ...applied,
        history: rewardHistory,
      });
      const nestedSettlement = applyEchoLastRunBoonForAcquisition(
        catalog,
        sourceApplied,
        address,
        nestedOffer,
        outcome,
        Object.freeze({
          freshRarityOverride: outcome.effectiveRarity,
          ordinarySlotReplacement: 'forbidden',
          ...(traitContext.deathDefianceConditionMet === undefined
            ? {}
            : { deathDefianceConditionMet: traitContext.deathDefianceConditionMet }),
        }),
        lifecyclePoint,
        sequence,
      );
      const nested = nestedSettlement.branch;
      blockedChild ??= nestedSettlement.blockedChild;
      if (nested.traitHistory === applied.traitHistory)
        return reject('echoLastRunBoonOptionUnavailable');
      return nested;
    }
    if (
      disposition?.kind === 'echo' &&
      disposition.effect === 'doubleLevel' &&
      selected !== undefined &&
      applied.traitHistory !== undefined &&
      applied.traitHistory !== branch.traitHistory
    ) {
      const appliedTraitHistory = applied.traitHistory;
      const domain = echoPomGreatestLevelTraitKeys(catalog, preChoiceTraitHistory);
      const hasTarget = 'echoPomTarget' in selected;
      const target = selected.echoPomTarget;
      const reject = (code: TraitFindingCode, detail?: string): RewardBranchState => {
        const address = createEchoPomTargetAddress(owner, offer.selectedOptionKey);
        blockedChild = Object.freeze({ address, branch: applied });
        if (findings !== undefined)
          addTraitChildFinding(
            findings,
            address,
            lifecyclePoint,
            sequence,
            code,
            selected.traitKey,
            detail,
            findingChronology,
          );
        return applied;
      };
      if (!hasTarget) return reject('echoPomTargetMissing');
      if (target === null) {
        return domain.length === 0
          ? applied
          : reject('echoPomNoTargetUnavailable', domain.join(','));
      }
      if (target === undefined || !domain.includes(target))
        return reject('echoPomTargetUnavailable', target);
      const equipped = preChoiceTraitHistory.equippedTraits[target];
      if (equipped?.level === undefined) return reject('echoPomTargetUnavailable', target);
      const event = Object.freeze({
        kind: 'levelMutation' as const,
        owner: createEchoPomTargetAddress(owner, offer.selectedOptionKey),
        acquisitionRole,
        sequence,
        acquisitionPoint: lifecyclePoint,
        sourceTraitKey: selected.traitKey,
        targetTraitKey: target,
        oldLevel: equipped.level,
        newLevel: equipped.level * 2,
      });
      const traitHistory = foldTraitHistoryEvents(catalog, [...appliedTraitHistory.events, event]);
      return Object.freeze({
        ...applied,
        history: attachTraitHistory(applied.history, traitHistory),
        traitHistory,
      });
    }
    if (
      applied.traitHistory === branch.traitHistory ||
      disposition?.kind !== 'circe' ||
      selected === undefined
    )
      return applied;
    const evidence = {
      owner,
      sequence,
    };
    if (disposition.effect === 'activateArcana') {
      const domain = circeResolutionDomain(
        catalog,
        applied.arcanaFear,
        disposition.effect,
        applied.keepsakes.fatedStatus,
      );
      if (
        resolution?.kind !== 'activateArcana' ||
        resolution.arcanaKeys.length !== domain.requiredCount
      )
        return applied;
      if (resolution.arcanaKeys.length === 0) return applied;
      const outcome = activateTemporaryArcana(
        catalog,
        applied.arcanaFear,
        resolution.arcanaKeys,
        evidence,
      );
      return outcome.legal
        ? Object.freeze({
            ...applied,
            arcanaFear: outcome.state,
            keepsakes: refreshKeepsakeFatedStatus(catalog, applied.keepsakes, outcome.state),
          })
        : applied;
    }
    if (disposition.effect === 'promoteArcana') {
      const domain = circeResolutionDomain(
        catalog,
        applied.arcanaFear,
        disposition.effect,
        applied.keepsakes.fatedStatus,
      );
      if (
        resolution?.kind !== 'promoteArcana' ||
        resolution.arcanaKeys.length !== domain.requiredCount
      )
        return applied;
      const outcome = promoteArcana(catalog, applied.arcanaFear, resolution.arcanaKeys, evidence);
      return outcome.legal
        ? Object.freeze({
            ...applied,
            arcanaFear: outcome.state,
            keepsakes: refreshKeepsakeFatedStatus(catalog, applied.keepsakes, outcome.state),
          })
        : applied;
    }
    if (resolution?.kind !== 'disableFear' || resolution.vowKey === null) return applied;
    const outcome = suppressFearVow(catalog, applied.arcanaFear, resolution.vowKey, evidence);
    return outcome.legal ? Object.freeze({ ...applied, arcanaFear: outcome.state }) : applied;
  })();
  return Object.freeze({
    branch: settledBranch,
    ...(blockedChild === undefined ? {} : { blockedChild }),
  });
}

/** Evaluates one selected encounter-local trait offer at its completion point. */
export function processEncounterTraitOffer(
  catalog: Catalog,
  branch: RewardBranchState,
  origin: SemanticAddress,
  offer: AuthoredTraitOffer,
  sequence: number,
  lifecyclePoint: string,
  findings?: Map<string, FindingRegionEntry>,
  findingChronology?: FindingChronology,
  deathDefianceConditionMet?: boolean,
  acquisitionRole = 'selection',
  freshRarityOverride?: import('../../catalog-schema').TraitRarity,
  loadout?: { readonly weaponKey: string; readonly aspectKey: string },
): RewardBranchState {
  return settleEncounterTraitOffer(
    catalog,
    branch,
    origin,
    offer,
    sequence,
    lifecyclePoint,
    findings,
    findingChronology,
    deathDefianceConditionMet,
    acquisitionRole,
    freshRarityOverride,
    loadout,
    undefined,
  ).branch;
}

function addTraitChildFinding(
  findings: Map<string, FindingRegionEntry>,
  origin: SemanticAddress,
  lifecyclePoint: string,
  sequence: number,
  code: TraitFindingCode,
  traitKey: string | undefined,
  detail?: string,
  findingChronology?: FindingChronology,
  atomicRegion?: string,
): void {
  const value: SemanticFinding = Object.freeze({
    code,
    severity: 'error',
    phase: 'rewardGeneration',
    origin,
    evidence: Object.freeze({
      lifecyclePoint,
      ...(traitKey === undefined ? {} : { traitKey }),
      ...(detail === undefined ? {} : { detail }),
    }),
  });
  addRewardFinding(
    findings,
    value,
    atomicRegion ?? ownerRegion(origin),
    findingChronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
  );
}

function addTraitFinding(
  findings: Map<string, FindingRegionEntry>,
  owner: TraitOfferOwnerAddress,
  acquisitionRole: string,
  lifecyclePoint: string,
  sequence: number,
  code: TraitFindingCode,
  traitKey: string | undefined,
  detail?: string,
  requirementTraitKeys?: readonly string[],
  findingChronology?: FindingChronology,
  actionIndex?: number,
  optionKey?: string,
): void {
  const origin = createTraitOfferAddress(owner, acquisitionRole);
  const value: SemanticFinding = Object.freeze({
    code,
    severity: 'error',
    phase: 'rewardGeneration',
    origin,
    evidence: Object.freeze({
      acquisitionRole,
      lifecyclePoint,
      ...(traitKey === undefined ? {} : { traitKey }),
      ...(detail === undefined ? {} : { detail }),
      ...(requirementTraitKeys === undefined ? {} : { requirementTraitKeys }),
      ...(actionIndex === undefined ? {} : { actionIndex }),
      ...(optionKey === undefined ? {} : { optionKey }),
    }),
  });
  addRewardFinding(
    findings,
    value,
    ownerRegion(origin),
    findingChronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
  );
}

export function advanceRewardBranch(
  branch: RewardBranchState,
  historySequence: number,
): RewardBranchState {
  return branch.processedThroughHistorySequence >= historySequence
    ? branch
    : Object.freeze({ ...branch, processedThroughHistorySequence: historySequence });
}

export function advanceRewardBranches(
  branches: readonly RewardBranchState[],
  historySequence: number,
): readonly RewardBranchState[] {
  return Object.freeze(branches.map((branch) => advanceRewardBranch(branch, historySequence)));
}

export function beginRewardRoom(
  branches: readonly RewardBranchState[],
  historySequence: number,
): readonly RewardBranchState[] {
  return Object.freeze(
    branches.map((branch) =>
      advanceRewardBranch(
        Object.freeze({ ...branch, history: beginCurrentRoomRewardHistory(branch.history) }),
        historySequence,
      ),
    ),
  );
}

export function initializeRewardBranches(
  initialBranches?: readonly RewardBranch[],
  initialArcanaFear?: ArcanaFearState,
  catalog?: Catalog,
  startingKeepsakeKey?: string,
  startingKeepsakeEquipResults?: AuthoredKeepsakeEquipResults,
  routeKey?: string,
  loadout?: { readonly weaponKey: string; readonly aspectKey: string },
): readonly RewardBranchState[] {
  if (initialBranches === undefined) {
    if (
      initialArcanaFear === undefined ||
      catalog === undefined ||
      startingKeepsakeKey === undefined
    )
      throw new Error('initial branch state is required');
    const branch = Object.freeze({
      bags: Object.freeze({}),
      history: createRewardHistoryState(),
      events: Object.freeze([]),
      pendingShops: Object.freeze({}),
      processedThroughHistorySequence: 0,
      traitHistory: createTraitHistoryState(),
      traitEvaluations: Object.freeze([]),
      arcanaFear: initialArcanaFear,
      keepsakes: createKeepsakeState(catalog, startingKeepsakeKey, initialArcanaFear),
    });
    const pomApplied = applyJeweledPomEquipResult(
      catalog,
      branch,
      startingKeepsakeKey,
      startingKeepsakeEquipResults,
      createKeepsakeEquipResultAddress(
        createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
        'jeweledPom',
      ),
      0,
    );
    const initialized = applyExperimentalHammerEquipResult(
      catalog,
      pomApplied,
      startingKeepsakeKey,
      startingKeepsakeEquipResults,
      createKeepsakeEquipResultAddress(
        createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
        'experimentalHammer',
      ),
      0,
      loadout ?? { weaponKey: '', aspectKey: '' },
    );
    const traitHistory = recordAspectStartingTrait(
      catalog,
      initialized.traitHistory ?? createTraitHistoryState(),
      createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
      loadout ?? { aspectKey: '' },
    );
    return Object.freeze([
      traitHistory === initialized.traitHistory
        ? initialized
        : Object.freeze({
            ...initialized,
            history: attachTraitHistory(initialized.history, traitHistory),
            traitHistory,
          }),
    ]);
  }
  return Object.freeze(
    initialBranches.map((branch) =>
      Object.freeze({
        bags: branch.bags,
        history: beginBiomeRewardHistory(branch.history),
        events: Object.freeze([]),
        pendingShops: Object.freeze({}),
        processedThroughHistorySequence: 0,
        traitHistory: branch.traitHistory ?? createTraitHistoryState(),
        traitEvaluations: Object.freeze([]),
        arcanaFear: beginBiomeArcanaFearState(branch.arcanaFear),
        keepsakes: beginBiomeKeepsakeState(branch.keepsakes),
      }),
    ),
  );
}

/** Applies the closed immediate Jeweled Pom result through ordinary trait history. */
export function applyJeweledPomEquipResult(
  catalog: Catalog,
  branch: RewardBranchState,
  equippedKeepsakeKey: string,
  results: AuthoredKeepsakeEquipResults | undefined,
  owner: SemanticAddress,
  sequence: number,
  equippedRank?: KeepsakeRank,
): RewardBranchState {
  const result = results?.jeweledPom;
  const keepsake = catalog.keepsakes.byKey[equippedKeepsakeKey];
  const effect = jeweledPomEffectForKey(catalog, equippedKeepsakeKey);
  if (keepsake === undefined || effect === undefined || result === undefined) return branch;
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (!assessJeweledPomEquipResult(catalog, result, before, branch.keepsakes.fatedStatus).legal)
    return branch;
  const offer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: effect.giverKey,
    options: Object.freeze([
      {
        traitKey: result.traitKey,
        ...(result.rarity === undefined ? {} : { rarity: result.rarity }),
      },
    ]) as import('../../authored-project/traits').OneToThree<
      import('../../authored-project/traits').AuthoredTraitOption
    >,
    selectedOptionKey: 'option1',
    ...(result.deathDefianceConditionMet === undefined
      ? {}
      : { deathDefianceConditionMet: result.deathDefianceConditionMet }),
  });
  const evaluation = evaluateReachedTraitOffer(
    catalog,
    owner,
    'jeweledPomEquip',
    offer,
    before,
    {
      ...(result.deathDefianceConditionMet === undefined
        ? {}
        : { deathDefianceConditionMet: result.deathDefianceConditionMet }),
      resolvedProviderKey: effect.giverKey,
    },
    branch.traitEvaluations?.length ?? 0,
    branch.arcanaFear,
    true,
    branch.keepsakes,
  );
  const acquisitionIdentity = `${semanticAddressKey(owner)}:${sequence}`;
  const applied = recordReachedTraitOffer(
    catalog,
    evaluation,
    sequence,
    'keepsakeEquip',
    acquisitionIdentity,
  );
  if (applied.history === before) return branch;
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, applied.history),
    traitHistory: applied.history,
    keepsakes: equipJeweledPom(
      branch.keepsakes,
      result.traitKey,
      effect.subsequentEligibleTraitLevelsByRank[equippedRank ?? keepsake.rank],
      acquisitionIdentity,
    ),
    traitEvaluations: Object.freeze([...(branch.traitEvaluations ?? []), evaluation]),
  });
}

/** Applies the one direct, rarityless Experimental Hammer acquisition. */
export function applyExperimentalHammerEquipResult(
  catalog: Catalog,
  branch: RewardBranchState,
  equippedKeepsakeKey: string,
  results: AuthoredKeepsakeEquipResults | undefined,
  owner: SemanticAddress,
  sequence: number,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
  equippedRank?: KeepsakeRank,
): RewardBranchState {
  const keepsake = catalog.keepsakes.byKey[equippedKeepsakeKey];
  const effect = keepsake?.effect;
  const result = results?.experimentalHammer;
  if (keepsake === undefined || effect?.kind !== 'experimentalHammer' || result === undefined)
    return branch;
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (!assessExperimentalHammerEquipResult(catalog, result, before, loadout).legal) return branch;
  if (result.kind === 'exhausted') return branch;
  const offer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: effect.giverKey,
    options: Object.freeze([
      { traitKey: result.traitKey },
    ]) as import('../../authored-project/traits').OneToThree<
      import('../../authored-project/traits').AuthoredTraitOption
    >,
    selectedOptionKey: 'option1',
  });
  const evaluation = evaluateReachedTraitOffer(
    catalog,
    owner,
    'experimentalHammerEquip',
    offer,
    before,
    loadout,
    branch.traitEvaluations?.length ?? 0,
    branch.arcanaFear,
    true,
    branch.keepsakes,
  );
  const acquisitionIdentity = `${semanticAddressKey(owner)}:${sequence}`;
  const applied = recordReachedTraitOffer(
    catalog,
    evaluation,
    sequence,
    'keepsakeEquip',
    acquisitionIdentity,
  );
  if (applied.history === before) return branch;
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, applied.history),
    traitHistory: applied.history,
    keepsakes: equipExperimentalHammer(
      branch.keepsakes,
      result.traitKey,
      effect.qualifyingEncounterUsesByRank[equippedRank ?? keepsake.rank],
      acquisitionIdentity,
    ),
    traitEvaluations: Object.freeze([...(branch.traitEvaluations ?? []), evaluation]),
  });
}

export function rewardFinding(
  code: RewardGenerationFindingCode,
  origin: SemanticFinding['origin'],
  evidence: FindingEvidence,
): SemanticFinding {
  return Object.freeze({
    code,
    severity: 'error',
    phase: 'rewardGeneration',
    origin,
    evidence: Object.freeze(evidence),
  });
}

function findingKey(value: SemanticFinding): string {
  return findingIdentityKey(value);
}

export function addRewardFinding(
  findings: Map<string, FindingRegionEntry>,
  value: SemanticFinding,
  atomicRegion = ownerRegion(value.origin),
  chronology?: FindingChronology,
  levelResolutionEvaluation?: ReachedLevelResolutionEvaluation,
): void {
  const key = findingKey(value);
  const existing = findings.get(key);
  const region = findingRegion(value, atomicRegion, chronology, 'reward');
  const evaluations = [
    ...(existing?.levelResolutionEvaluations ?? []),
    ...(levelResolutionEvaluation === undefined ? [] : [levelResolutionEvaluation]),
  ].filter(
    (evaluation, index, all) =>
      all.findIndex(
        (candidate) =>
          semanticAddressKey(candidate.address) === semanticAddressKey(evaluation.address) &&
          JSON.stringify([
            candidate.before,
            candidate.value,
            candidate.effectKind,
            candidate.levelCount,
          ]) ===
            JSON.stringify([
              evaluation.before,
              evaluation.value,
              evaluation.effectKind,
              evaluation.levelCount,
            ]),
      ) === index,
  );
  findings.set(
    key,
    evaluations.length === 0
      ? region
      : Object.freeze({ ...region, levelResolutionEvaluations: Object.freeze(evaluations) }),
  );
}

function historyChronology(sequence: number): FindingChronology {
  return Object.freeze({ kind: 'history', sequence, boundary: 'at' });
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

function semanticAddressEvidence(origin: SemanticAddress): FindingEvidence {
  return Object.freeze({ ...origin }) as FindingEvidence;
}

function resolvedOfferEvidence(offer: ResolvedRewardOffer): FindingEvidence {
  return Object.freeze({
    rewardType: offer.rewardType,
    ...(offer.payload === undefined
      ? {}
      : { payload: Object.freeze({ ...offer.payload }) as FindingEvidence }),
  });
}

function sourceConflictingPeers(
  offer: ResolvedRewardOffer,
  peers: readonly OfferProcessingPeer[],
): readonly OfferProcessingPeer[] {
  const source = offer.payload?.kind === 'BoonSource' ? offer.payload.source : undefined;
  const conflicts = peers.filter(
    (peer) =>
      source !== undefined &&
      peer.offer.payload?.kind === 'BoonSource' &&
      peer.offer.payload.source === source,
  );
  return conflicts.length === 0 ? peers : conflicts;
}

export function countedBinding(
  declaration: RoomDeclaration,
  incoming: CanonicalResolvedIncomingReward,
): CountedRewardBinding | undefined {
  if (incoming.producerKind === 'freeReward') {
    const policy = declaration.prebossBatchPolicy;
    const remaining = policy?.kind === 'takeOverNormalDoors' ? policy.remainingOffers : undefined;
    return remaining?.kind === 'counted' ? remaining.reward : undefined;
  }
  return declaration.incomingReward.kind === 'countedChoice'
    ? declaration.incomingReward
    : undefined;
}

function withBag(
  catalog: Catalog,
  branch: RewardBranchState,
  storeKey: string,
): { readonly branch: RewardBranchState; readonly bag: RewardBagState } | undefined {
  const store = catalog.rewards.stores.byKey[storeKey];
  if (store === undefined) {
    return undefined;
  }
  const current = branch.bags[storeKey];
  if (current !== undefined) {
    return { branch, bag: current };
  }
  const bag = createRewardBagState(store);
  return {
    branch: Object.freeze({ ...branch, bags: freezeRecord({ ...branch.bags, [storeKey]: bag }) }),
    bag,
  };
}

export interface OfferProcessingContext {
  readonly catalog: Catalog;
  readonly reward: {
    readonly origin: SemanticAddress;
    readonly offer: ResolvedRewardOffer;
    readonly producerLifecycleKey: string;
    readonly requiredEntryKeys?: ReadonlySet<string>;
    readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
    readonly resolvedStoreKey?: string;
  };
  readonly binding?: CountedRewardBinding;
  readonly historySequence: number;
  /** Exact producer checkpoint used for first-blocking ordering. */
  readonly findingChronology?: FindingChronology;
  readonly peers: readonly OfferProcessingPeer[];
  readonly facts: RewardFactsFactory;
}

export interface OfferProcessingPeer {
  readonly origin: SemanticAddress;
  readonly offer: ResolvedRewardOffer;
}

function permutations<T>(values: readonly T[]): readonly (readonly T[])[] {
  if (values.length <= 1) {
    return [values];
  }
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((tail) => [
      value,
      ...tail,
    ]),
  );
}

interface SourceOrderingFailure {
  readonly blocked: OfferProcessingContext;
  readonly prior: readonly OfferProcessingContext[];
}

function isSourceOrderingFailure(
  value: readonly OfferProcessingContext[] | SourceOrderingFailure,
): value is SourceOrderingFailure {
  return 'blocked' in value;
}

function sourceOrdering(
  branch: RewardBranchState,
  contexts: readonly OfferProcessingContext[],
): readonly OfferProcessingContext[] | SourceOrderingFailure {
  const sourceContexts = contexts.filter((context) => {
    const type = context.catalog.rewards.rewardTypes.byKey[context.reward.offer.rewardType];
    return type?.sourceSupport !== undefined && type.sourceResolution?.kind === 'offer';
  });
  const completeMask = (1 << sourceContexts.length) - 1;
  const failedMasks = new Set<number>();
  let failure: SourceOrderingFailure = Object.freeze({
    blocked: sourceContexts[0]!,
    prior: Object.freeze([]),
  });
  const visit = (mask: number): readonly OfferProcessingContext[] | undefined => {
    if (mask === completeMask) return Object.freeze([]);
    if (failedMasks.has(mask)) return undefined;
    const prior = sourceContexts.filter((_, offset) => (mask & (1 << offset)) !== 0);
    for (const [offset, context] of sourceContexts.entries()) {
      if ((mask & (1 << offset)) !== 0) continue;
      if (
        !isOfferSupportedAtResolutionPoint(
          context.catalog.rewards,
          context.reward.offer,
          context.facts(branch.history),
          'offer',
          { priorOffers: prior.map((entry) => entry.reward.offer) },
        )
      ) {
        if (prior.length >= failure.prior.length) {
          failure = Object.freeze({ blocked: context, prior: Object.freeze(prior) });
        }
        continue;
      }
      const tail = visit(mask | (1 << offset));
      if (tail !== undefined) return Object.freeze([context, ...tail]);
    }
    failedMasks.add(mask);
    return undefined;
  };
  const orderedSources = visit(0);
  if (orderedSources === undefined) return failure;
  let sourceOffset = 0;
  return contexts.map((context) =>
    sourceContexts.includes(context) ? orderedSources[sourceOffset++]! : context,
  );
}

export function processRewardOffer(
  branches: readonly RewardBranchState[],
  context: OfferProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): readonly RewardBranchState[] {
  const { catalog, reward, historySequence, findingChronology } = context;
  const rewardType = catalog.rewards.rewardTypes.byKey[reward.offer.rewardType];
  if (
    rewardType === undefined ||
    !isPayloadLocallyValid(catalog.rewards, rewardType, reward.offer.payload)
  ) {
    addRewardFinding(
      findings,
      rewardFinding('rewardPayloadInvalid', reward.origin, offerEvidence(reward.offer)),
      ownerRegion(reward.origin),
      findingChronology ?? historyChronology(historySequence),
    );
    return Object.freeze([]);
  }

  const next: RewardBranchState[] = [];
  let sawSourceFailure = false;
  let sawBagInvariantFailure = false;
  let sawSiblingFailure = false;
  const siblingConflicts = new Map<string, OfferProcessingPeer>();
  const recordSiblingConflict = (peer: OfferProcessingPeer) => {
    siblingConflicts.set(semanticAddressKey(peer.origin), peer);
  };
  for (const originalBranch of branches) {
    const facts = context.facts(originalBranch.history);
    const peers = { priorOffers: context.peers.map((peer) => peer.offer) };
    if (!isOfferSupportedAtResolutionPoint(catalog.rewards, reward.offer, facts, 'offer', peers)) {
      sawSourceFailure = true;
      if (
        context.peers.length > 0 &&
        isOfferSupportedAtResolutionPoint(catalog.rewards, reward.offer, facts, 'offer', {
          priorOffers: [],
        })
      ) {
        sawSiblingFailure = true;
        sourceConflictingPeers(reward.offer, context.peers).forEach(recordSiblingConflict);
      }
      continue;
    }

    if (context.binding === undefined) {
      const history = applyOfferProjection(
        catalog.rewards,
        originalBranch.history,
        reward.offer,
        facts,
      );
      next.push(
        appendRewardEvent(Object.freeze({ ...originalBranch, history }), historySequence, {
          kind: 'rewardOffered',
          origin: reward.origin,
          offer: reward.offer,
          ...(reward.resolvedStoreKey === undefined ? {} : { storeKey: reward.resolvedStoreKey }),
        }),
      );
      continue;
    }

    const storeKey = reward.resolvedStoreKey;
    if (storeKey === undefined || !context.binding.storeKeys.includes(storeKey)) {
      sawBagInvariantFailure = true;
      continue;
    }
    const prepared = withBag(catalog, originalBranch, storeKey);
    const store = catalog.rewards.stores.byKey[storeKey];
    if (prepared === undefined || store === undefined) {
      sawBagInvariantFailure = true;
      continue;
    }
    if (
      context.peers.some((peer) => peer.offer.rewardType === reward.offer.rewardType) &&
      store.entries.some(
        (entry) => entry.rewardType === reward.offer.rewardType && !entry.allowDuplicates,
      )
    ) {
      sawSiblingFailure = true;
      context.peers
        .filter((peer) => peer.offer.rewardType === reward.offer.rewardType)
        .forEach(recordSiblingConflict);
    }
    let transitions: readonly RewardBagState[];
    try {
      transitions = consumeCountedOffer(catalog.rewards, store, prepared.bag, reward.offer, facts, {
        ...(context.binding.eligibleRewardTypes.length === 0
          ? {}
          : { eligibleRewardTypes: new Set(context.binding.eligibleRewardTypes) }),
        ...(context.binding.ineligibleRewardTypes.length === 0
          ? {}
          : { ineligibleRewardTypes: new Set(context.binding.ineligibleRewardTypes) }),
        peers,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('one-refill eligibility invariant')) {
        sawBagInvariantFailure = true;
        continue;
      }
      throw error;
    }
    for (const bag of transitions) {
      const history = applyOfferProjection(
        catalog.rewards,
        prepared.branch.history,
        reward.offer,
        facts,
      );
      next.push(
        appendRewardEvent(
          Object.freeze({
            ...prepared.branch,
            bags: freezeRecord({ ...prepared.branch.bags, [storeKey]: bag }),
            history,
          }),
          historySequence,
          { kind: 'rewardOffered', origin: reward.origin, offer: reward.offer, storeKey },
        ),
      );
    }
  }

  if (next.length === 0) {
    const code: RewardGenerationFindingCode = sawSourceFailure
      ? 'rewardSourceUnavailable'
      : sawBagInvariantFailure
        ? 'rewardBagSupportEmpty'
        : 'rewardBagEntryUnavailable';
    addRewardFinding(
      findings,
      rewardFinding(code, reward.origin, {
        ...offerEvidence(reward.offer),
        storeKey: reward.resolvedStoreKey ?? null,
        ...(sawSiblingFailure
          ? {
              priorOffers: [...siblingConflicts.values()].map((peer) => ({
                origin: semanticAddressEvidence(peer.origin),
                offer: resolvedOfferEvidence(peer.offer),
              })),
            }
          : {}),
      }),
      ownerRegion(reward.origin),
      findingChronology ?? historyChronology(historySequence),
    );
  }
  return Object.freeze(next);
}

function recordCanonicalOffer(
  branch: RewardBranchState,
  context: OfferProcessingContext,
): RewardBranchState {
  const facts = context.facts(branch.history);
  const history = applyOfferProjection(
    context.catalog.rewards,
    branch.history,
    context.reward.offer,
    facts,
  );
  return appendRewardEvent(Object.freeze({ ...branch, history }), context.historySequence, {
    kind: 'rewardOffered',
    origin: context.reward.origin,
    offer: context.reward.offer,
    ...(context.reward.resolvedStoreKey === undefined
      ? {}
      : { storeKey: context.reward.resolvedStoreKey }),
  });
}

export function processOfferGenerationCohort(
  branches: readonly RewardBranchState[],
  contexts: readonly OfferProcessingContext[],
  findings: Map<string, FindingRegionEntry>,
  policy: {
    readonly ordering: 'allOffers' | 'sourceOffers';
    readonly atomicRegion?: string;
  },
): readonly RewardBranchState[] {
  if (contexts.length <= 1) {
    const context = contexts[0];
    return context === undefined ? branches : processRewardOffer(branches, context, findings);
  }
  const supported: RewardBranchState[] = [];
  let representativeFailures: readonly FindingRegionEntry[] = Object.freeze([]);
  for (const branch of branches) {
    const sourceResult =
      policy.ordering === 'sourceOffers' ? sourceOrdering(branch, contexts) : undefined;
    if (sourceResult !== undefined && isSourceOrderingFailure(sourceResult)) {
      const localFindings = new Map<string, FindingRegionEntry>();
      processRewardOffer(
        Object.freeze([branch]),
        {
          ...sourceResult.blocked,
          peers: Object.freeze(
            sourceResult.prior.map((context) => ({
              origin: context.reward.origin,
              offer: context.reward.offer,
            })),
          ),
        },
        localFindings,
      );
      if (representativeFailures.length === 0) {
        representativeFailures = Object.freeze([...localFindings.values()]);
      }
      continue;
    }
    const orderings =
      policy.ordering === 'allOffers'
        ? permutations(contexts)
        : Object.freeze([sourceResult ?? contexts]);
    for (const ordering of orderings) {
      let candidates: readonly RewardBranchState[] = Object.freeze([branch]);
      const localFindings = new Map<string, FindingRegionEntry>();
      const priorOffers: OfferProcessingPeer[] = [];
      for (const context of ordering) {
        candidates = processRewardOffer(
          candidates,
          { ...context, peers: Object.freeze([...priorOffers]) },
          localFindings,
        );
        if (candidates.length === 0) {
          break;
        }
        priorOffers.push({ origin: context.reward.origin, offer: context.reward.offer });
      }
      if (candidates.length === 0) {
        if (representativeFailures.length === 0) {
          representativeFailures = Object.freeze([...localFindings.values()]);
        }
        continue;
      }
      for (const candidate of candidates) {
        let canonical: RewardBranchState = Object.freeze({
          // Offer-order permutations may only contribute the candidate bag
          // state. The rest of the branch has already progressed through the
          // same history, traits, keepsakes, and evaluations; carrying the
          // whole candidate would replay that permutation-local evolution a
          // second time when canonical offers are recorded below.
          ...branch,
          bags: candidate.bags,
        });
        for (const context of contexts) {
          canonical = recordCanonicalOffer(canonical, context);
        }
        supported.push(canonical);
      }
    }
  }
  if (supported.length === 0) {
    for (const value of representativeFailures) {
      addRewardFinding(
        findings,
        value.finding,
        policy.atomicRegion ?? value.atomicRegion,
        value.chronology,
      );
    }
  }
  return mergeEquivalentRewardBranches(supported);
}

/**
 * Assess one new/edited participant after the board identities that are
 * already authored. Each supported peer contributes once to the generation
 * frontier and remains in the focused offer's unordered peer context; an
 * independently invalid peer is omitted so it cannot suppress an unrelated
 * repair. This is deliberately linear. Complete unordered-cohort validation
 * remains owned by `processOfferGenerationCohort`.
 */
export function processFocusedOfferAfterAuthoredPeers(
  branches: readonly RewardBranchState[],
  peerContexts: readonly OfferProcessingContext[],
  focusedContext: OfferProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): readonly RewardBranchState[] {
  let reached = branches;
  const acceptedPeers: OfferProcessingPeer[] = [];
  for (const context of peerContexts) {
    const peerFindings = new Map<string, FindingRegionEntry>();
    const next = processRewardOffer(
      reached,
      { ...context, peers: Object.freeze([]) },
      peerFindings,
    );
    if (next.length === 0) continue;
    reached = mergeEquivalentRewardBranches(next);
    acceptedPeers.push(
      Object.freeze({ origin: context.reward.origin, offer: context.reward.offer }),
    );
  }

  const focusedFindings = new Map<string, FindingRegionEntry>();
  const supported = processRewardOffer(
    reached,
    { ...focusedContext, peers: Object.freeze(acceptedPeers) },
    focusedFindings,
  );
  if (supported.length > 0) return supported;
  for (const value of focusedFindings.values()) {
    addRewardFinding(findings, value.finding, value.atomicRegion, value.chronology);
  }
  return Object.freeze([]);
}

function shopRequirements(
  declaration: RoomDeclaration,
  profileKey: string,
  fail: (detail: string) => never,
) {
  const binding = declaration.incomingReward;
  if (binding.kind !== 'shop' || binding.shopProfileKey !== profileKey) {
    return fail(`${declaration.gameName} has no ${profileKey} shop binding`);
  }
  return binding.additionalOptionRequirements ?? Object.freeze({});
}

interface ShopProcessingContext {
  readonly catalog: Catalog;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly historySequence: number;
  readonly findingChronology?: FindingChronology;
  readonly facts: RewardFactsFactory;
  readonly fail: (detail: string) => never;
  /** Exact participating Shop actions for this settlement invocation. */
  readonly order?: readonly string[];
  /** The current action is the final Shop-owned chronology row in this room. */
  readonly completeAfterOrder?: boolean;
}

export function processShopInventory(
  branches: readonly RewardBranchState[],
  context: ShopProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): readonly RewardBranchState[] {
  const { catalog, room, declaration, historySequence, fail } = context;
  const entry = room.entryState;
  if (entry?.kind !== 'shop') {
    return fail(`${room.gameName} materialized a missing shop state`);
  }
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) {
    return fail(`unknown shop profile ${entry.profileKey}`);
  }
  const requirements = shopRequirements(declaration, entry.profileKey, fail);
  const authored: readonly AuthoredShopOffer[] = entry.offers.map((offer) => ({
    offer: offer.offer,
  }));
  const next: RewardBranchState[] = [];
  const supportResults: ShopGenerationSupport[] = [];
  for (const branch of branches) {
    const support = evaluateShopGenerationSupport(
      catalog.rewards,
      profile,
      authored,
      context.facts(branch.history, new Set()),
      requirements,
    );
    supportResults.push(support);
    for (const witness of support.witnesses) {
      let candidate = branch;
      for (const offer of entry.offers) {
        const offerFacts = context.facts(candidate.history, new Set());
        const history = applyOfferProjection(
          catalog.rewards,
          candidate.history,
          offer.offer,
          offerFacts,
        );
        candidate = appendRewardEvent(Object.freeze({ ...candidate, history }), historySequence, {
          kind: 'rewardOffered',
          origin: offer.offerOrigin,
          offer: offer.offer,
        });
      }
      candidate = appendRewardEvent(candidate, historySequence, {
        kind: 'shopInventorySupported',
        origin: room.origin,
        profileKey: profile.key,
        optionKeys: witness.optionKeys,
      });
      next.push(
        Object.freeze({
          ...candidate,
          pendingShops: freezeRecord({
            ...candidate.pendingShops,
            [semanticAddressKey(room.origin)]: Object.freeze({
              profileKey: profile.key,
              witness,
            }),
          }),
        }),
      );
    }
  }
  if (next.length === 0) {
    const unsupportedIndexes = entry.offers.flatMap((_, index) =>
      supportResults.every((support) => support.unsupportedSlotIndexes.includes(index))
        ? [index]
        : [],
    );
    for (const index of unsupportedIndexes) {
      const offer = entry.offers[index]!;
      const rewardType = catalog.rewards.rewardTypes.byKey[offer.offer.rewardType];
      const code: RewardGenerationFindingCode =
        rewardType === undefined ||
        !isPayloadLocallyValid(catalog.rewards, rewardType, offer.offer.payload)
          ? 'rewardPayloadInvalid'
          : 'shopOfferUnavailable';
      addRewardFinding(
        findings,
        rewardFinding(code, offer.offerOrigin, offerEvidence(offer.offer)),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(historySequence),
      );
    }
    if (unsupportedIndexes.length === 0) {
      addRewardFinding(
        findings,
        rewardFinding('shopOfferUnavailable', room.origin, {
          offerKeys: entry.offers.map((offer) => offer.offerKey),
          kind: 'jointOfferSet',
        }),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(historySequence),
      );
    }
  }
  return Object.freeze(next);
}

/** Settles optional Shop offer entries at the exact post-outgoing roomExit site. */
export function settleShopAcquisitionSite(
  branches: readonly RewardBranchState[],
  context: ShopProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): AcquisitionSettlementProduct {
  const { catalog, room, declaration, historySequence, fail } = context;
  const entry = room.entryState;
  if (entry?.kind !== 'shop') return fail(`${room.gameName} applied missing shop purchases`);
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) return fail(`unknown shop profile ${entry.profileKey}`);
  const requirements = shopRequirements(declaration, entry.profileKey, fail);
  const authored: readonly AuthoredShopOffer[] = entry.offers.map((offer) => ({
    offer: offer.offer,
  }));
  const order =
    context.order ??
    Object.freeze(
      room.roomActions.order.flatMap((reference) => {
        if (reference.kind === 'interactShopOffer') return [reference.offerKey];
        if (reference.kind === 'interactAcquisitionEntry' && reference.siteKey === 'roomExit')
          return [reference.entryKey];
        return [];
      }),
    );
  if (new Set(order).size !== order.length)
    return fail(`${room.gameName} acquisition order contains a duplicate entry`);
  const findingKeysBeforeSettlement = new Set(findings.keys());
  const site = createAcquisitionSiteAddress(room.origin, 'roomExit');
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const derivedEntryFrontiers: DerivedAcquisitionEntryFrontier[] = [];
  let entryPurchaseFailureRecorded = false;
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  const rolesByOfferKey = new Map<
    string,
    readonly { readonly role: string; readonly lifecyclePoint: ProducerLifecyclePointKey }[]
  >();
  const recordRoles = (
    offerKey: string,
    roles: readonly { readonly role: string; readonly lifecyclePoint: ProducerLifecyclePointKey }[],
  ) => {
    const existing = rolesByOfferKey.get(offerKey) ?? [];
    const seen = new Set(existing.map((role) => `${role.role}:${role.lifecyclePoint}`));
    rolesByOfferKey.set(
      offerKey,
      Object.freeze([
        ...existing,
        ...roles.filter((role) => {
          const key = `${role.role}:${role.lifecyclePoint}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      ]),
    );
  };
  type TravelRefill = PendingShopTravelRefill;
  type PaidOffer = PendingShopPaidOffer;
  type ShopExecution = {
    candidate: RewardBranchState;
    readonly witness: ShopGenerationWitness;
    remainingSlotIndexes: readonly number[];
    readonly travelActiveAtEntry: boolean;
    readonly goldActiveAtEntry?: import('../../authored-project/traits').EquippedTrait;
    firstNormalPurchaseSeen: boolean;
    travelRefill?: TravelRefill;
    goldMaterialization?: GoldMaterialization;
  };
  type GoldMaterialization = PendingShopGoldMaterialization;
  const executions: ShopExecution[] = [];
  for (const branch of branches) {
    const pending = branch.pendingShops[semanticAddressKey(room.origin)];
    if (pending?.profileKey !== profile.key) {
      return fail(
        `${room.gameName} lost its shop witness for ${JSON.stringify(order)}; pending=${JSON.stringify(Object.keys(branch.pendingShops))}`,
      );
    }
    executions.push({
      candidate: branch,
      witness: pending.witness,
      remainingSlotIndexes:
        pending.remainingSlotIndexes ?? Object.freeze(entry.offers.map((_, index) => index)),
      travelActiveAtEntry:
        pending.travelActiveAtEntry ??
        branch.traitHistory?.equippedTraits.RestockBoon !== undefined,
      ...(() => {
        if (pending.goldActiveAtEntry !== undefined) {
          return { goldActiveAtEntry: pending.goldActiveAtEntry };
        }
        const goldActiveAtEntry = Object.values(branch.traitHistory?.equippedTraits ?? {}).find(
          (equipped) => {
            const disposition = catalog.traits.byKey[equipped.traitKey]?.selectedDisposition;
            return disposition?.kind === 'echo' && disposition.effect === 'doubleShop';
          },
        );
        return goldActiveAtEntry === undefined ? {} : { goldActiveAtEntry };
      })(),
      firstNormalPurchaseSeen: pending.firstNormalPurchaseSeen ?? false,
      ...(pending.travelRefill === undefined ? {} : { travelRefill: pending.travelRefill }),
      ...(pending.goldMaterialization === undefined
        ? {}
        : { goldMaterialization: pending.goldMaterialization }),
    });
  }
  const branchCohortSize = executions.length;
  const contractDescriptor = declaration.infernalContractReward;
  const contractChild = room.pickupSite?.entries[INFERNAL_CONTRACT_ENTRY_KEY];
  if (contractDescriptor !== undefined && contractChild !== undefined) {
    for (const execution of executions) {
      if (execution.candidate.traitHistory?.equippedTraits.InfernalContractBoon !== undefined) {
        const contractAddress = createAcquisitionEntryAddress(site, INFERNAL_CONTRACT_ENTRY_KEY);
        const routeContext = entry.offers.find(
          (offer) =>
            offer.traitContext?.weaponKey !== undefined &&
            offer.traitContext.aspectKey !== undefined,
        )?.traitContext;
        if (routeContext?.weaponKey === undefined || routeContext.aspectKey === undefined)
          return fail(`${room.gameName} Contract candidate frontier has no route loadout`);
        const branchesBeforeEntry = Object.freeze([execution.candidate]);
        derivedEntryFrontiers.push(
          Object.freeze({
            address: contractAddress,
            kind: 'infernalContractReward' as const,
            branchCohortSize,
            rewardTypes: contractDescriptor.rewardTypes,
            branchesBeforeEntry,
            evaluateOffer: (offer: ResolvedRewardOffer) => {
              if (!contractDescriptor.rewardTypes.includes(offer.rewardType))
                return Object.freeze({ findings: Object.freeze([]), supported: false });
              const candidate = createUnresolvedAcquisitionRewardState(catalog, offer, {
                kind: 'producerLifecycle',
                key: contractDescriptor.producerLifecycleKey,
              });
              const candidateFindings = new Map<string, FindingRegionEntry>();
              const settled = settleOwnedAcquisitionSite(
                catalog,
                branchesBeforeEntry,
                {
                  siteOwner: room.origin,
                  pointKey: 'roomExit',
                  entryKey: INFERNAL_CONTRACT_ENTRY_KEY,
                  source: Object.freeze({
                    origin: contractAddress,
                    offer: candidate.offer,
                    producerLifecycleKey: contractDescriptor.producerLifecycleKey,
                    producerKind: 'freeReward',
                    instanceProvenance: 'free',
                    traitOffersByAcquisitionRole: candidate.traitOffersByAcquisitionRole,
                    ...(candidate.levelResolutionsByAcquisitionRole === undefined
                      ? {}
                      : {
                          levelResolutionsByAcquisitionRole:
                            candidate.levelResolutionsByAcquisitionRole,
                        }),
                    dispositionByAcquisitionRole: candidate.dispositionByAcquisitionRole,
                    traitContext: Object.freeze({}),
                  }),
                  historySequence,
                },
                context.facts,
                candidateFindings,
                ownerRegion(room.origin),
                context.findingChronology,
              );
              return Object.freeze({
                findings: Object.freeze(
                  [...candidateFindings.values()].map((entry) => entry.finding),
                ),
                supported: settled.branches.length === branchesBeforeEntry.length,
              });
            },
          }),
        );
      }
    }
  }
  const deriveTravelRefill = (
    execution: ShopExecution,
    sourceOffer: PaidOffer,
    slotIndex: number,
    excludedNames: ReadonlySet<string>,
  ): TravelRefill | undefined => {
    const slot = profile.slots.values[slotIndex];
    const group = slot === undefined ? undefined : profile.groups.byKey[slot.groupKey];
    if (slot === undefined || group === undefined) return undefined;
    const generationFacts = context.facts(execution.candidate.history, new Set());
    const candidateOffers = group.options.values.flatMap((option) =>
      locallyValidRewardOffers(catalog.rewards, option.rewardType),
    );
    const uniqueOffers = Object.freeze([
      ...new Map(candidateOffers.map((offer) => [JSON.stringify(offer), offer] as const)).values(),
    ]);
    const supportedOffers = (excludedPurchaseInteractionNames: ReadonlySet<string>) =>
      Object.freeze(
        uniqueOffers.filter(
          (offer) =>
            findShopIndexedGenerationWitnesses(
              catalog.rewards,
              profile,
              slotIndex,
              offer,
              generationFacts,
              requirements,
              excludedPurchaseInteractionNames.size === 0
                ? {}
                : { excludedPurchaseInteractionNames },
            ).length > 0,
        ),
      );
    const excludedDomain = supportedOffers(excludedNames);
    const effectiveExcludedNames = excludedDomain.length > 0 ? excludedNames : new Set<string>();
    const domain = excludedDomain.length > 0 ? excludedDomain : supportedOffers(new Set());
    if (domain.length === 0) return undefined;
    const evaluateOffer = (offer: ResolvedRewardOffer) =>
      Object.freeze({
        findings: Object.freeze([]),
        supported:
          findShopIndexedGenerationWitnesses(
            catalog.rewards,
            profile,
            slotIndex,
            offer,
            generationFacts,
            requirements,
            effectiveExcludedNames.size === 0
              ? {}
              : { excludedPurchaseInteractionNames: effectiveExcludedNames },
          ).length > 0,
      });
    return Object.freeze({
      sourceOfferKey: sourceOffer.offerKey,
      slotIndex,
      rewardTypes: Object.freeze([...new Set(domain.map((offer) => offer.rewardType))]),
      excludedNames: effectiveExcludedNames,
      generationFacts,
      evaluateOffer,
    });
  };
  const goldDisposition = Object.values(catalog.traits.byKey).find(
    (trait) =>
      trait.selectedDisposition?.kind === 'echo' &&
      trait.selectedDisposition.effect === 'doubleShop',
  )?.selectedDisposition;
  const goldSourceEligible = (offer: ResolvedRewardOffer): boolean =>
    goldDisposition?.kind === 'echo' &&
    goldDisposition.effect === 'doubleShop' &&
    !goldDisposition.excludedRewardTypes.includes(offer.rewardType);
  const eligibleGoldSourceOfferKeys = (): readonly string[] => {
    const travel = room.pickupSite?.entries[TRAVEL_DEAL_REFILL_ENTRY_KEY];
    return Object.freeze([
      ...entry.offers.flatMap((offer) => (goldSourceEligible(offer.offer) ? [offer.offerKey] : [])),
      ...(travel !== undefined && travel !== null && goldSourceEligible(travel.offer)
        ? [TRAVEL_DEAL_REFILL_ENTRY_KEY]
        : []),
    ]);
  };
  const materializeGold = (
    execution: ShopExecution,
    offer: PaidOffer,
    roleBindings: GoldMaterialization['roleBindings'],
  ): void => {
    if (execution.goldMaterialization !== undefined) return;
    const pending = execution.goldActiveAtEntry;
    const disposition =
      pending === undefined
        ? undefined
        : catalog.traits.byKey[pending.traitKey]?.selectedDisposition;
    if (
      pending === undefined ||
      pending.acquisitionIdentity === undefined ||
      disposition?.kind !== 'echo' ||
      disposition.effect !== 'doubleShop' ||
      disposition.excludedRewardTypes.includes(offer.offer.rewardType)
    )
      return;
    const address = createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY);
    const before = execution.candidate;
    const beforeTraits = before.traitHistory ?? createTraitHistoryState();
    const traitHistory = foldTraitHistoryEvents(catalog, [
      ...beforeTraits.events,
      Object.freeze({
        kind: 'traitRemoval' as const,
        owner: address,
        acquisitionRole: 'echoShopDuplicateConsumed',
        sequence: historySequence,
        acquisitionPoint: 'shopDuplicateMaterialized',
        traitKey: pending.traitKey,
        acquisitionIdentity: pending.acquisitionIdentity,
      }),
    ]);
    execution.candidate = Object.freeze({
      ...before,
      history: attachTraitHistory(before.history, traitHistory),
      traitHistory,
    });
    execution.goldMaterialization = Object.freeze({
      sourceOfferKey: offer.offerKey,
      roleBindings,
      sourceOffer: offer,
      sourceTraitHistory: beforeTraits,
      sourcePomEligibleTraitKeys: Object.freeze(
        Object.keys(beforeTraits.equippedTraits).filter((traitKey) =>
          isPomEligibleTrait(catalog, traitKey),
        ),
      ),
    });
    const branchesBeforeEntry = Object.freeze([execution.candidate]);
    const duplicateOffer = echoShopDuplicateOffer(catalog, offer.offer);
    const fixedReward =
      duplicateOffer === null
        ? undefined
        : createUnresolvedShopAcquisitionRewardState(catalog, duplicateOffer, profile.key);
    const derivedRoleFrontiers: AcquisitionRoleFrontier[] = [];
    if (fixedReward !== undefined) {
      const source = Object.freeze({
        origin: address,
        offer: fixedReward.offer,
        producerLifecycleKey: profile.key,
        producerKind: 'shop' as const,
        instanceProvenance: 'free' as const,
        traitOffersByAcquisitionRole: fixedReward.traitOffersByAcquisitionRole,
        ...(fixedReward.levelResolutionsByAcquisitionRole === undefined
          ? {}
          : { levelResolutionsByAcquisitionRole: fixedReward.levelResolutionsByAcquisitionRole }),
        dispositionByAcquisitionRole: fixedReward.dispositionByAcquisitionRole,
        ...(offer.traitContext === undefined ? {} : { traitContext: offer.traitContext }),
      });
      const settlement = Object.freeze({ site, entry: address });
      let candidateBranches: readonly RewardBranchState[] = branchesBeforeEntry;
      for (const binding of roleBindings) {
        candidateBranches = applyProducerRoleHistory(
          catalog,
          candidateBranches,
          source,
          Object.freeze({ ...binding, historySequence }),
          context.facts,
          new Map(),
          ownerRegion(room.origin),
          context.findingChronology,
          settlement,
          derivedRoleFrontiers,
          undefined,
          branchesBeforeEntry,
          true,
        );
      }
    }
    derivedEntryFrontiers.push(
      Object.freeze({
        address,
        kind: 'echoDoubleShopReward' as const,
        branchCohortSize,
        sourceOfferKey: offer.offerKey,
        rewardTypes: Object.freeze([offer.offer.rewardType]),
        ...(fixedReward === undefined ? {} : { fixedReward }),
        ...(derivedRoleFrontiers.length === 0
          ? {}
          : { roleFrontiers: Object.freeze(derivedRoleFrontiers) }),
        eligibleSourceOfferKeys: eligibleGoldSourceOfferKeys(),
        branchesBeforeEntry,
        evaluateOffer: (candidateOffer: ResolvedRewardOffer) =>
          Object.freeze({
            findings: Object.freeze([]),
            supported: echoShopDuplicateOfferMatches(catalog, offer.offer, candidateOffer),
          }),
      }),
    );
  };

  const settlePaid = (
    execution: ShopExecution,
    offer: PaidOffer,
    roleBindings: readonly {
      readonly role: string;
      readonly lifecyclePoint: ProducerLifecyclePointKey;
    }[],
    agreementBranches: readonly RewardBranchState[],
  ): boolean => {
    let current = Object.freeze([execution.candidate]);
    const source: AcquisitionSource = withStoredArtificerReplacements(
      room,
      Object.freeze({
        origin: offer.offerOrigin,
        offer: offer.offer,
        producerLifecycleKey: profile.key,
        producerKind: 'shop',
        instanceProvenance: 'paid',
        ...(offer.traitOffersByAcquisitionRole === undefined
          ? {}
          : { traitOffersByAcquisitionRole: offer.traitOffersByAcquisitionRole }),
        ...(offer.levelResolutionsByAcquisitionRole === undefined
          ? {}
          : { levelResolutionsByAcquisitionRole: offer.levelResolutionsByAcquisitionRole }),
        ...(offer.dispositionByAcquisitionRole === undefined
          ? {}
          : { dispositionByAcquisitionRole: offer.dispositionByAcquisitionRole }),
        ...(offer.traitContext === undefined ? {} : { traitContext: offer.traitContext }),
      }),
    );
    const settlement = Object.freeze({
      site,
      entry: createAcquisitionEntryAddress(site, offer.offerKey),
    });
    for (const binding of roleBindings) {
      recordRoles(offer.offerKey, [binding]);
      current = applyProducerRoleHistory(
        catalog,
        current,
        source,
        Object.freeze({ ...binding, historySequence }),
        context.facts,
        findings,
        ownerRegion(room.origin),
        context.findingChronology,
        settlement,
        roleFrontiers,
        traitChildSettlements,
        agreementBranches,
        true,
      );
    }
    if (current.length !== 1) return false;
    execution.candidate = current[0]!;
    return true;
  };

  for (const entryKey of order) {
    const agreementBranches = Object.freeze(executions.map(({ candidate }) => candidate));
    const survivors: ShopExecution[] = [];
    for (const execution of executions) {
      if (entryKey === INFERNAL_CONTRACT_ENTRY_KEY) {
        const descriptor = declaration.infernalContractReward;
        const child = room.pickupSite?.entries[entryKey];
        if (
          descriptor === undefined ||
          child === undefined ||
          execution.candidate.traitHistory?.equippedTraits.InfernalContractBoon === undefined
        ) {
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              { kind: 'infernalContractUnavailable' },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        if (child === null) {
          addRewardFinding(
            findings,
            rewardFinding('rewardMissing', createAcquisitionEntryAddress(site, entryKey), {}),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        const settled = settleOwnedAcquisitionSite(
          catalog,
          Object.freeze([execution.candidate]),
          {
            siteOwner: room.origin,
            pointKey: 'roomExit',
            entryKey,
            source: withStoredArtificerReplacements(
              room,
              Object.freeze({
                origin: createAcquisitionEntryAddress(site, entryKey),
                offer: child.offer,
                producerLifecycleKey: descriptor.producerLifecycleKey,
                producerKind: 'freeReward',
                instanceProvenance: 'free',
                traitOffersByAcquisitionRole: child.traitOffersByAcquisitionRole,
                ...(child.levelResolutionsByAcquisitionRole === undefined
                  ? {}
                  : { levelResolutionsByAcquisitionRole: child.levelResolutionsByAcquisitionRole }),
                dispositionByAcquisitionRole: child.dispositionByAcquisitionRole,
                traitContext: Object.freeze({}),
              }),
            ),
            historySequence,
          },
          context.facts,
          findings,
          ownerRegion(room.origin),
          context.findingChronology,
        );
        roleFrontiers.push(...(settled.roleFrontiers ?? []));
        traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
        if (settled.branches.length === 1) {
          execution.candidate = settled.branches[0]!;
          survivors.push(execution);
        }
        continue;
      }

      if (entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY) {
        const refill = execution.travelRefill;
        const authoredChild = room.pickupSite?.entries[entryKey];
        const child = authoredChild;
        if (refill === undefined || child === undefined) {
          entryPurchaseFailureRecorded = true;
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              { kind: 'travelDealRefillUnavailable' },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        if (child === null) {
          addRewardFinding(
            findings,
            rewardFinding('rewardMissing', createAcquisitionEntryAddress(site, entryKey), {}),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        const support = findShopIndexedGenerationWitnesses(
          catalog.rewards,
          profile,
          refill.slotIndex,
          child.offer,
          refill.generationFacts,
          requirements,
          refill.excludedNames.size === 0
            ? {}
            : { excludedPurchaseInteractionNames: refill.excludedNames },
        );
        const witness = support[0];
        if (witness === undefined) {
          entryPurchaseFailureRecorded = true;
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              { kind: 'travelDealRefillUnavailable' },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        const slot = profile.slots.values[refill.slotIndex]!;
        const group = profile.groups.byKey[slot.groupKey]!;
        const optionKey = witness.optionKeys[refill.slotIndex];
        const option = optionKey === undefined ? undefined : group.options.byKey[optionKey];
        if (option === undefined) {
          entryPurchaseFailureRecorded = true;
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              { kind: 'travelDealRefillUnavailable' },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        const refillOffer = Object.freeze({
          offerKey: entryKey,
          offerOrigin: createAcquisitionEntryAddress(site, entryKey),
          offer: child.offer,
          traitOffersByAcquisitionRole: child.traitOffersByAcquisitionRole,
          ...(child.levelResolutionsByAcquisitionRole === undefined
            ? {}
            : { levelResolutionsByAcquisitionRole: child.levelResolutionsByAcquisitionRole }),
          dispositionByAcquisitionRole: child.dispositionByAcquisitionRole,
          ...(entry.offers[refill.slotIndex]?.traitContext === undefined
            ? {}
            : { traitContext: entry.offers[refill.slotIndex]!.traitContext }),
        });
        const bindings = option.acquisitionLifecycle.map((binding) =>
          Object.freeze({ role: binding.role, lifecyclePoint: binding.lifecyclePoint }),
        );
        materializeGold(execution, refillOffer, bindings);
        if (settlePaid(execution, refillOffer, bindings, agreementBranches)) {
          survivors.push(execution);
        }
        continue;
      }

      if (entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY) {
        const materialization = execution.goldMaterialization;
        const authoredChild = room.pickupSite?.entries[entryKey];
        const child = authoredChild;
        if (materialization === undefined || child === undefined) {
          entryPurchaseFailureRecorded = true;
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              { kind: 'echoShopDuplicateUnavailable' },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        if (child === null) {
          addRewardFinding(
            findings,
            rewardFinding('rewardMissing', createAcquisitionEntryAddress(site, entryKey), {}),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        if (
          !echoShopDuplicateOfferMatches(catalog, materialization.sourceOffer.offer, child.offer)
        ) {
          entryPurchaseFailureRecorded = true;
          addRewardFinding(
            findings,
            rewardFinding(
              'shopPurchaseUnavailable',
              createAcquisitionEntryAddress(site, entryKey),
              {
                kind: 'echoShopDuplicatePayload',
                sourceOfferKey: materialization.sourceOfferKey,
              },
            ),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
          continue;
        }
        const source = materialization.sourceOffer;
        const currentTraits = execution.candidate.traitHistory ?? createTraitHistoryState();
        const sourceTargetDisappeared = materialization.sourcePomEligibleTraitKeys.some(
          (traitKey) => currentTraits.equippedTraits[traitKey] === undefined,
        );
        const settled = settleOwnedAcquisitionSite(
          catalog,
          Object.freeze([execution.candidate]),
          {
            siteOwner: room.origin,
            pointKey: 'roomExit',
            entryKey,
            source: withStoredArtificerReplacements(
              room,
              Object.freeze({
                origin: createAcquisitionEntryAddress(site, entryKey),
                offer: child.offer,
                producerLifecycleKey: profile.key,
                producerKind: 'shop',
                instanceProvenance: 'free',
                traitOffersByAcquisitionRole: child.traitOffersByAcquisitionRole,
                ...(child.levelResolutionsByAcquisitionRole === undefined
                  ? {}
                  : { levelResolutionsByAcquisitionRole: child.levelResolutionsByAcquisitionRole }),
                levelResolutionGenerationHistory: sourceTargetDisappeared
                  ? currentTraits
                  : materialization.sourceTraitHistory,
                dispositionByAcquisitionRole: child.dispositionByAcquisitionRole,
                ...(source.traitContext === undefined ? {} : { traitContext: source.traitContext }),
              }),
            ),
            historySequence,
            roleBindings: materialization.roleBindings,
            deferArtificerReplacement: true,
          },
          context.facts,
          findings,
          ownerRegion(room.origin),
          context.findingChronology,
        );
        roleFrontiers.push(...(settled.roleFrontiers ?? []));
        traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
        if (settled.branches.length === 1) {
          execution.candidate = settled.branches[0]!;
          survivors.push(execution);
        }
        continue;
      }

      const slotIndex = entry.offers.findIndex((offer) => offer.offerKey === entryKey);
      const offer = slotIndex < 0 ? undefined : entry.offers[slotIndex];
      if (offer === undefined)
        return fail(`${room.gameName} acquisition order has unknown entry ${entryKey}`);
      const purchase = evaluateShopPurchaseAtSlot(
        catalog.rewards,
        profile,
        authored,
        execution.witness,
        slotIndex,
        execution.remainingSlotIndexes,
        execution.candidate.history,
        context.facts(execution.candidate.history, new Set()),
        requirements,
      );
      if (purchase === undefined) {
        entryPurchaseFailureRecorded = true;
        addRewardFinding(
          findings,
          rewardFinding('shopPurchaseUnavailable', createAcquisitionEntryAddress(site, entryKey), {
            kind: 'shopOfferPurchase',
            offerKey: entryKey,
          }),
          ownerRegion(room.origin),
          context.findingChronology ?? historyChronology(historySequence),
        );
        continue;
      }
      const bindings = purchase.acquisitions.map(({ event }) =>
        Object.freeze({ role: event.role, lifecyclePoint: event.lifecyclePoint }),
      );
      const prePurchaseTraits = execution.candidate.traitHistory;
      materializeGold(execution, offer, bindings);
      if (!settlePaid(execution, offer, bindings, agreementBranches)) continue;
      execution.remainingSlotIndexes = purchase.remainingSlotIndexes;
      if (!execution.firstNormalPurchaseSeen) {
        execution.firstNormalPurchaseSeen = true;
        if (
          execution.travelActiveAtEntry &&
          prePurchaseTraits?.equippedTraits.RestockBoon !== undefined
        ) {
          const slot = profile.slots.values[slotIndex]!;
          const optionKey = execution.witness.optionKeys[slotIndex];
          const option = profile.groups.byKey[slot.groupKey]?.options.byKey[optionKey ?? ''];
          const interaction =
            option === undefined ? undefined : purchaseInteractionName(option, offer.offer);
          const excludedNames = new Set<string>();
          if (interaction !== undefined) {
            excludedNames.add(interaction);
            excludedNames.add(`${interaction}Drop`);
          }
          const travelRefill = deriveTravelRefill(execution, offer, slotIndex, excludedNames);
          if (travelRefill !== undefined) {
            execution.travelRefill = travelRefill;
            const address = createAcquisitionEntryAddress(site, TRAVEL_DEAL_REFILL_ENTRY_KEY);
            const branchesBeforeEntry = Object.freeze([execution.candidate]);
            derivedEntryFrontiers.push(
              Object.freeze({
                address,
                kind: 'travelDealRefill' as const,
                branchCohortSize,
                sourceOfferKey: offer.offerKey,
                slotIndex,
                rewardTypes: travelRefill.rewardTypes,
                branchesBeforeEntry,
                evaluateOffer: travelRefill.evaluateOffer,
              }),
            );
          }
        }
      }
      survivors.push(execution);
    }
    executions.splice(0, executions.length, ...survivors);
  }

  for (const execution of executions) {
    if (execution.travelActiveAtEntry && execution.travelRefill === undefined) {
      derivedEntryFrontiers.push(
        Object.freeze({
          address: createAcquisitionEntryAddress(site, TRAVEL_DEAL_REFILL_ENTRY_KEY),
          kind: 'travelDealPlaceholder' as const,
          branchCohortSize,
          branchesBeforeEntry: Object.freeze([execution.candidate]),
        }),
      );
    }
    if (execution.goldActiveAtEntry !== undefined && execution.goldMaterialization === undefined) {
      derivedEntryFrontiers.push(
        Object.freeze({
          address: createAcquisitionEntryAddress(site, ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY),
          kind: 'echoDoubleShopPlaceholder' as const,
          branchCohortSize,
          eligibleSourceOfferKeys: eligibleGoldSourceOfferKeys(),
          branchesBeforeEntry: Object.freeze([execution.candidate]),
        }),
      );
    }
  }

  const next: RewardBranchState[] = [];
  for (const execution of executions) {
    const { candidate } = execution;
    const shopKey = semanticAddressKey(room.origin);
    if (context.completeAfterOrder === true || context.order === undefined) {
      const { [shopKey]: completed, ...remainingShops } = candidate.pendingShops;
      void completed;
      next.push(Object.freeze({ ...candidate, pendingShops: freezeRecord(remainingShops) }));
      continue;
    }
    next.push(
      Object.freeze({
        ...candidate,
        pendingShops: freezeRecord({
          ...candidate.pendingShops,
          [shopKey]: Object.freeze({
            profileKey: profile.key,
            witness: execution.witness,
            remainingSlotIndexes: execution.remainingSlotIndexes,
            travelActiveAtEntry: execution.travelActiveAtEntry,
            ...(execution.goldActiveAtEntry === undefined
              ? {}
              : { goldActiveAtEntry: execution.goldActiveAtEntry }),
            firstNormalPurchaseSeen: execution.firstNormalPurchaseSeen,
            ...(execution.travelRefill === undefined
              ? {}
              : { travelRefill: execution.travelRefill }),
            ...(execution.goldMaterialization === undefined
              ? {}
              : { goldMaterialization: execution.goldMaterialization }),
          }),
        }),
      }),
    );
  }
  const settlementFindings = [...findings].flatMap(([key, finding]) =>
    findingKeysBeforeSettlement.has(key) ? [] : [finding.finding],
  );
  const stoppedOnlyForMissingAuthorship =
    settlementFindings.length > 0 &&
    settlementFindings.every(isAcquisitionAuthorshipMissingFinding);
  if (next.length === 0 && !entryPurchaseFailureRecorded && !stoppedOnlyForMissingAuthorship) {
    addRewardFinding(
      findings,
      rewardFinding('shopPurchaseUnavailable', site, {
        kind: 'jointPurchaseOrder',
        offerKeys: context.order ?? [],
      }),
      ownerRegion(room.origin),
      context.findingChronology ?? historyChronology(historySequence),
    );
  }
  return Object.freeze({
    site,
    entries: Object.freeze(
      (context.order ?? []).map((offerKey) => {
        const offer = entry.offers.find((candidate) => candidate.offerKey === offerKey);
        if (offer === undefined) {
          const supplemental = room.pickupSite?.entries[offerKey];
          const artificerReplacement = parseArtificerReplacementEntryKey(offerKey);
          if (
            supplemental === undefined &&
            offerKey !== TRAVEL_DEAL_REFILL_ENTRY_KEY &&
            offerKey !== ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY &&
            artificerReplacement === undefined
          )
            return fail(`${room.gameName} acquisition order has unknown entry ${offerKey}`);
          return Object.freeze({
            address: createAcquisitionEntryAddress(site, offerKey),
            source: createAcquisitionEntryAddress(
              site,
              artificerReplacement?.sourceKey ?? offerKey,
            ),
            acquisitionRoles: rolesByOfferKey.get(offerKey) ?? Object.freeze([]),
            participation: 'optional' as const,
          });
        }
        const acquisitionRoles = rolesByOfferKey.get(offer.offerKey) ?? [];
        return Object.freeze({
          address: createAcquisitionEntryAddress(site, offer.offerKey),
          source: offer.offerOrigin,
          acquisitionRoles,
          participation: 'optional' as const,
        });
      }),
    ),
    branches: mergeEquivalentRewardBranches(next),
    roleFrontiers: Object.freeze(roleFrontiers),
    derivedEntryFrontiers: Object.freeze(derivedEntryFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
  });
}

/** Closes a generated Shop witness after the room's final chronology action. */
export function completePendingShopAcquisitionSite(
  branches: readonly RewardBranchState[],
  owner: SemanticAddress,
  fail: (detail: string) => never,
): readonly RewardBranchState[] {
  const shopKey = semanticAddressKey(owner);
  const pendingCount = branches.filter(
    (branch) => branch.pendingShops[shopKey] !== undefined,
  ).length;
  if (pendingCount === 0) return branches;
  if (pendingCount !== branches.length) {
    return fail(`${semanticAddressKey(owner)} has a divergent pending Shop frontier`);
  }
  return Object.freeze(
    branches.map((branch) => {
      const { [shopKey]: completed, ...remainingShops } = branch.pendingShops;
      void completed;
      return Object.freeze({ ...branch, pendingShops: freezeRecord(remainingShops) });
    }),
  );
}

export function settleProducerAcquisitionSite(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  room: CanonicalRewardRoom,
  event: Extract<HistoryEvent, { readonly kind: 'producerRoleAdvanced' }>,
  facts: RewardFactsFactory,
  findings: Map<string, FindingRegionEntry>,
  fail: (detail: string) => never,
  atomicRegion?: string,
  findingChronology?: FindingChronology,
  siteOwner?: AcquisitionSiteOwnerAddress,
): AcquisitionSettlementProduct {
  const incoming = room.incomingReward;
  if (
    incoming === undefined ||
    incoming.offer.rewardType !== event.rewardType ||
    incoming.producerLifecycleKey !== event.producerLifecycleKey
  ) {
    return fail(`${room.gameName} producer event does not match its offer`);
  }
  const incomingSource = withStoredArtificerReplacements(room, incoming);
  if (event.origin.kind === 'hubRoom') {
    return fail('Hub room cannot own an ordinary producer acquisition site');
  }
  const site = createAcquisitionSiteAddress(siteOwner ?? event.origin, event.lifecyclePoint);
  const lifecycleBinding = catalog.rewards.producerLifecycles.byKey[
    incoming.producerLifecycleKey
  ]?.rewardTypes.byKey[incoming.offer.rewardType]?.acquisitionLifecycle.find(
    (binding) => binding.role === event.role,
  );
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  const entry = Object.freeze({
    address: createAcquisitionEntryAddress(site, event.role),
    source: incoming.origin,
    acquisitionRoles: Object.freeze([
      Object.freeze({
        role: event.role,
        lifecyclePoint: event.lifecyclePoint,
        ...(lifecycleBinding?.blocksArtificerConversion === true
          ? { blocksArtificerConversion: true as const }
          : {}),
      }),
    ]),
    participation: 'mandatory' as const,
  });
  // Forfeit is deliberately decided by the enclosing ordinary Room Occurrence,
  // before this shared role fold turns the room's authored Boon/Hermes reward
  // into a concrete acquisition. Local children, Shops, pickups, and all
  // other owners never enter this branch.
  const qualifyingRewardType =
    incoming.offer.rewardType === 'Boon' || incoming.offer.rewardType === 'HermesUpgrade'
      ? incoming.offer.rewardType
      : undefined;
  if (room.kind === 'authored' && qualifyingRewardType !== undefined) {
    const vetoed: RewardBranchState[] = [];
    const remaining: RewardBranchState[] = [];
    for (const branch of branches) {
      const supported = isOfferSupportedAtResolutionPoint(
        catalog.rewards,
        incoming.offer,
        facts(branch.history),
        { acquisitionRole: event.role },
      );
      if (!supported) {
        remaining.push(branch);
        continue;
      }
      const forfeit = consumeOrdinaryRoomForfeit(catalog, branch.arcanaFear, qualifyingRewardType, {
        owner: incoming.origin,
        sequence: event.sequence,
      });
      if (!forfeit.consumed) {
        remaining.push(branch);
        continue;
      }
      vetoed.push(
        appendRewardEvent(
          Object.freeze({
            ...branch,
            arcanaFear: forfeit.state,
          }),
          event.sequence,
          Object.freeze({
            kind: 'rewardForfeited' as const,
            origin: incoming.origin,
            rewardType: qualifyingRewardType,
          }),
        ),
      );
    }
    if (vetoed.length > 0) {
      const settled =
        remaining.length === 0
          ? Object.freeze([])
          : applyProducerRoleHistory(
              catalog,
              Object.freeze(remaining),
              incomingSource,
              {
                role: event.role,
                lifecyclePoint: event.lifecyclePoint,
                historySequence: event.sequence,
                ...(lifecycleBinding?.blocksArtificerConversion === true
                  ? { blocksArtificerConversion: true as const }
                  : {}),
              },
              facts,
              findings,
              atomicRegion,
              findingChronology,
              Object.freeze({ site, entry: entry.address }),
              roleFrontiers,
              traitChildSettlements,
              undefined,
              true,
            );
      return Object.freeze({
        site,
        entries: Object.freeze([entry]),
        branches: mergeEquivalentRewardBranches(Object.freeze([...vetoed, ...settled])),
        ...(roleFrontiers.length === 0 ? {} : { roleFrontiers: Object.freeze(roleFrontiers) }),
        ...(traitChildSettlements.length === 0
          ? {}
          : { traitChildSettlements: Object.freeze(traitChildSettlements) }),
      });
    }
  }
  const settled = applyProducerRoleHistory(
    catalog,
    branches,
    incomingSource,
    {
      role: event.role,
      lifecyclePoint: event.lifecyclePoint,
      historySequence: event.sequence,
      ...(lifecycleBinding?.blocksArtificerConversion === true
        ? { blocksArtificerConversion: true as const }
        : {}),
    },
    facts,
    findings,
    atomicRegion,
    findingChronology,
    Object.freeze({ site, entry: entry.address }),
    roleFrontiers,
    traitChildSettlements,
    undefined,
    true,
  );
  return Object.freeze({
    site,
    entries: Object.freeze([entry]),
    branches: settled,
    roleFrontiers: Object.freeze(roleFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
  });
}

/** Settles one exact composite-owned acquisition entry at its structural site. */
export function settleOwnedAcquisitionSite(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  request: OwnedAcquisitionSettlementRequest,
  facts: RewardFactsFactory,
  findings: Map<string, FindingRegionEntry>,
  atomicRegion?: string,
  findingChronology?: FindingChronology,
): AcquisitionSettlementProduct {
  const site = createAcquisitionSiteAddress(request.siteOwner, request.pointKey);
  const producer = catalog.rewards.producerLifecycles.byKey[request.source.producerLifecycleKey];
  const lifecycle = producer?.rewardTypes.byKey[request.source.offer.rewardType];
  if (lifecycle === undefined && request.roleBindings === undefined) {
    throw new Error(
      `${request.source.producerLifecycleKey} does not support ${request.source.offer.rewardType}`,
    );
  }
  const roleBindings: readonly AcquisitionRoleResolution[] = Object.freeze(
    (request.roleBindings ?? lifecycle!.acquisitionLifecycle).map((binding) =>
      Object.freeze({ ...binding, historySequence: request.historySequence }),
    ),
  );
  if (roleBindings.length === 0)
    throw new Error('owned acquisition settlement has no lifecycle roles');
  const entry = Object.freeze({
    address: createAcquisitionEntryAddress(site, request.entryKey),
    source: request.source.origin,
    acquisitionRoles: Object.freeze(
      roleBindings.map((binding) =>
        Object.freeze({ role: binding.role, lifecyclePoint: binding.lifecyclePoint }),
      ),
    ),
    participation: 'mandatory' as const,
  });
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  const sourceReward: AuthoredRewardState = Object.freeze({
    offer: request.source.offer,
    traitOffersByAcquisitionRole: request.source.traitOffersByAcquisitionRole ?? Object.freeze({}),
    ...(request.source.levelResolutionsByAcquisitionRole === undefined
      ? {}
      : {
          levelResolutionsByAcquisitionRole: request.source.levelResolutionsByAcquisitionRole,
        }),
    dispositionByAcquisitionRole: request.source.dispositionByAcquisitionRole ?? Object.freeze({}),
  });
  let current = roleBindings.reduce(
    (next, binding) =>
      applyProducerRoleHistory(
        catalog,
        next,
        request.source,
        binding,
        facts,
        findings,
        atomicRegion,
        findingChronology,
        Object.freeze({ site, entry: entry.address }),
        roleFrontiers,
        traitChildSettlements,
        undefined,
        true,
      ),
    branches,
  );
  const entries: AcquisitionSettlementEntry[] = [entry];
  if (request.deferArtificerReplacement !== true) {
    for (const binding of roleBindings) {
      if (sourceReward.dispositionByAcquisitionRole[binding.role]?.kind !== 'artificer') continue;
      const untouched = current.filter(
        (branch) => !hasArtificerUse(branch, request.source.origin, binding.role),
      );
      const replacement = settleArtificerReplacementAcquisition(
        catalog,
        current,
        {
          siteOwner: request.siteOwner,
          pointKey: request.pointKey,
          sourceEntryKey: request.entryKey,
          sourceOrigin: request.source.origin,
          sourceReward,
          replacement: request.source.artificerReplacementByAcquisitionRole?.[binding.role] ?? null,
          acquisitionRole: binding.role,
          participation: 'mandatory',
          historySequence: binding.historySequence,
          facts,
          ...(request.source.traitContext === undefined
            ? {}
            : { traitContext: request.source.traitContext }),
          ...(atomicRegion === undefined ? {} : { atomicRegion }),
          ...(findingChronology === undefined ? {} : { findingChronology }),
        },
        findings,
      );
      current = mergeEquivalentRewardBranches(
        Object.freeze([...untouched, ...replacement.branches]),
      );
      entries.push(...replacement.entries);
      roleFrontiers.push(...(replacement.roleFrontiers ?? []));
      traitChildSettlements.push(...(replacement.traitChildSettlements ?? []));
    }
  }
  return Object.freeze({
    site,
    entries: Object.freeze(entries),
    branches: current,
    roleFrontiers: Object.freeze(roleFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
  });
}

/** Settles a previously generated Artificer child at an ordered dependent checkpoint. */
export function settleArtificerReplacementAcquisition(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  request: {
    readonly siteOwner: AcquisitionSiteOwnerAddress;
    readonly pointKey: string;
    readonly sourceEntryKey: string;
    readonly sourceOrigin: SemanticAddress;
    readonly sourceReward: AuthoredRewardState;
    readonly replacement?: AuthoredRewardState | null;
    readonly acquisitionRole: string;
    readonly participation: 'mandatory' | 'optional';
    readonly historySequence: number;
    readonly facts: RewardFactsFactory;
    readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
    readonly atomicRegion?: string;
    readonly findingChronology?: FindingChronology;
  },
  findings: Map<string, FindingRegionEntry>,
): AcquisitionSettlementProduct {
  const disposition = request.sourceReward.dispositionByAcquisitionRole[request.acquisitionRole];
  if (disposition?.kind !== 'artificer')
    throw new Error('Artificer replacement action has no authored replacement');
  const site = createAcquisitionSiteAddress(request.siteOwner, request.pointKey);
  const address = createAcquisitionEntryAddress(
    site,
    artificerReplacementEntryKey(request.sourceEntryKey, request.acquisitionRole),
  );
  const reached = branches.filter((branch) =>
    hasArtificerUse(branch, request.sourceOrigin, request.acquisitionRole),
  );
  const untouched = branches.filter(
    (branch) => !hasArtificerUse(branch, request.sourceOrigin, request.acquisitionRole),
  );
  const replacement = request.replacement ?? null;
  if (replacement === null) {
    addRewardFinding(
      findings,
      rewardFinding('rewardMissing', address, { acquisitionRole: request.acquisitionRole }),
      request.atomicRegion ?? ownerRegion(address),
      request.findingChronology ?? historyChronology(request.historySequence),
    );
    return Object.freeze({
      site,
      entries: Object.freeze([
        Object.freeze({
          address,
          source: request.sourceOrigin,
          acquisitionRoles: Object.freeze([]),
          participation: request.participation,
        }),
      ]),
      branches: mergeEquivalentRewardBranches(untouched),
      roleFrontiers: Object.freeze([]),
      traitChildSettlements: Object.freeze([]),
    });
  }
  const lifecycle =
    catalog.rewards.producerLifecycles.byKey.RoomReward?.rewardTypes.byKey[
      replacement.offer.rewardType
    ];
  if (lifecycle === undefined)
    throw new Error(`${replacement.offer.rewardType} has no RoomReward lifecycle`);
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  let current: readonly RewardBranchState[] = reached;
  for (const binding of lifecycle.acquisitionLifecycle) {
    current = applyProducerRoleHistory(
      catalog,
      current,
      Object.freeze({
        origin: address,
        offer: replacement.offer,
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        traitOffersByAcquisitionRole: replacement.traitOffersByAcquisitionRole,
        ...(replacement.levelResolutionsByAcquisitionRole === undefined
          ? {}
          : {
              levelResolutionsByAcquisitionRole: replacement.levelResolutionsByAcquisitionRole,
            }),
        dispositionByAcquisitionRole: replacement.dispositionByAcquisitionRole,
        traitContext: request.traitContext ?? Object.freeze({}),
      }),
      Object.freeze({ ...binding, historySequence: request.historySequence }),
      request.facts,
      findings,
      request.atomicRegion,
      request.findingChronology,
      Object.freeze({ site, entry: address }),
      roleFrontiers,
      traitChildSettlements,
      undefined,
      false,
      true,
    );
  }
  return Object.freeze({
    site,
    entries: Object.freeze([
      Object.freeze({
        address,
        source: request.sourceOrigin,
        acquisitionRoles: lifecycle.acquisitionLifecycle,
        participation: request.participation,
      }),
    ]),
    branches: mergeEquivalentRewardBranches(Object.freeze([...untouched, ...current])),
    roleFrontiers: Object.freeze(roleFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
  });
}

/** Settles optional site-materialized pickups through the same role fold used
 * by every other acquisition. The producer only supplies entries; it never
 * gets a private outcome processor. */
export function settlePickupAcquisitionSite(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  request: {
    readonly siteOwner: AcquisitionSiteOwnerAddress;
    readonly entries: Readonly<Record<string, AuthoredRewardState | null>>;
    readonly order: readonly string[];
    readonly producerLifecycleKey: string;
    readonly requiredEntryKeys?: ReadonlySet<string>;
    readonly historySequence: number;
    readonly facts: RewardFactsFactory;
    readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
    readonly findingChronology?: FindingChronology;
    readonly artificerReplacementFor?: (
      source: AcquisitionEntryAddress,
      role: string,
    ) => AuthoredRewardState | null;
    readonly artificerReplacementSiteFor?: (
      source: AcquisitionEntryAddress,
      role: string,
    ) => AcquisitionSiteAddress;
    /** Candidate-only outer reward probes do not publish the child's own frontier. */
    readonly publishUnpickedChildFrontiers?: boolean;
  },
  findings: Map<string, FindingRegionEntry>,
): AcquisitionSettlementProduct {
  const site = createAcquisitionSiteAddress(request.siteOwner, 'roomExit');
  const definitions = new Map<
    string,
    {
      readonly reward: AuthoredRewardState;
      readonly roles: readonly AcquisitionSettlementRole[];
      readonly address: AcquisitionEntryAddress;
    }
  >();
  const entries: AcquisitionSettlementEntry[] = Object.keys(request.entries).map((key) => {
    const reward = request.entries[key]!;
    const entry = createAcquisitionEntryAddress(site, key);
    if (reward === null) {
      return Object.freeze({
        address: entry,
        source: entry,
        acquisitionRoles: Object.freeze([]),
        participation: request.order.includes(key)
          ? request.requiredEntryKeys?.has(key) === true
            ? ('mandatory' as const)
            : ('optional' as const)
          : ('dormant' as const),
      });
    }
    const lifecycle =
      catalog.rewards.producerLifecycles.byKey[request.producerLifecycleKey]?.rewardTypes.byKey[
        reward.offer.rewardType
      ];
    if (lifecycle === undefined)
      throw new Error(`pickup ${reward.offer.rewardType} has no declared lifecycle`);
    const roles = Object.freeze(
      lifecycle.acquisitionLifecycle.map((binding) =>
        Object.freeze({ role: binding.role, lifecyclePoint: binding.lifecyclePoint }),
      ),
    );
    definitions.set(key, Object.freeze({ reward, roles, address: entry }));
    return Object.freeze({
      address: entry,
      source: entry,
      acquisitionRoles: roles,
      participation: request.order.includes(key)
        ? request.requiredEntryKeys?.has(key) === true
          ? 'mandatory'
          : 'optional'
        : 'dormant',
    });
  });
  if (new Set(request.order).size !== request.order.length)
    throw new Error('pickup acquisition order contains a duplicate entry');
  let current = branches;
  const pickupEntryFrontiers: PickupAcquisitionEntryFrontier[] = [];
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  const interactedSources = new Set<string>();
  // Active inventory authorship is independent of pickup order. An unpicked
  // unresolved entry still owns an editable leaf and a missing-authorship
  // finding at the reached site; order controls only whether acquisition
  // settlement is attempted.
  for (const [key, reward] of Object.entries(request.entries)) {
    if (reward !== null || request.order.includes(key)) continue;
    const address = createAcquisitionEntryAddress(site, key);
    pickupEntryFrontiers.push(
      Object.freeze({ address, reward: null, branchesBeforeEntry: current }),
    );
    addRewardFinding(
      findings,
      rewardFinding('rewardMissing', address, {}),
      ownerRegion(address),
      request.findingChronology ?? historyChronology(request.historySequence),
    );
  }
  if (request.publishUnpickedChildFrontiers !== false) {
    for (const [key, definition] of definitions) {
      if (request.order.includes(key)) continue;
      const { reward, address: entry } = definition;
      pickupEntryFrontiers.push(
        Object.freeze({ address: entry, reward, branchesBeforeEntry: current }),
      );
      const lifecycle =
        catalog.rewards.producerLifecycles.byKey[request.producerLifecycleKey]!.rewardTypes.byKey[
          reward.offer.rewardType
        ]!;
      let candidateOnly = current;
      for (const binding of lifecycle.acquisitionLifecycle) {
        candidateOnly = applyProducerRoleHistory(
          catalog,
          candidateOnly,
          Object.freeze({
            origin: entry,
            offer: reward.offer,
            producerLifecycleKey: request.producerLifecycleKey,
            instanceProvenance: 'free',
            traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole,
            ...(reward.levelResolutionsByAcquisitionRole === undefined
              ? {}
              : { levelResolutionsByAcquisitionRole: reward.levelResolutionsByAcquisitionRole }),
            traitContext: request.traitContext ?? Object.freeze({}),
            dispositionByAcquisitionRole: reward.dispositionByAcquisitionRole,
            artificerReplacementByAcquisitionRole: Object.freeze(
              Object.fromEntries(
                Object.entries(reward.dispositionByAcquisitionRole).flatMap(
                  ([role, disposition]) =>
                    disposition.kind === 'artificer'
                      ? [[role, request.artificerReplacementFor?.(entry, role) ?? null]]
                      : [],
                ),
              ),
            ),
            artificerReplacementSiteByAcquisitionRole: Object.freeze(
              Object.fromEntries(
                Object.entries(reward.dispositionByAcquisitionRole).flatMap(
                  ([role, disposition]) =>
                    disposition.kind === 'artificer' &&
                    request.artificerReplacementSiteFor !== undefined
                      ? [[role, request.artificerReplacementSiteFor(entry, role)]]
                      : [],
                ),
              ),
            ),
          }),
          Object.freeze({ ...binding, historySequence: request.historySequence }),
          request.facts,
          findings,
          undefined,
          request.findingChronology,
          Object.freeze({ site, entry }),
          roleFrontiers,
          traitChildSettlements,
          undefined,
          true,
        );
      }
    }
  }
  for (const key of request.order) {
    const definition = definitions.get(key);
    if (definition === undefined) {
      if (request.entries[key] === null) {
        const address = createAcquisitionEntryAddress(site, key);
        pickupEntryFrontiers.push(
          Object.freeze({ address, reward: null, branchesBeforeEntry: current }),
        );
        addRewardFinding(
          findings,
          rewardFinding('rewardMissing', address, {}),
          ownerRegion(address),
          request.findingChronology ?? historyChronology(request.historySequence),
        );
        current = Object.freeze([]);
        continue;
      }
      const parsed = parseArtificerReplacementEntryKey(key);
      const source = parsed === undefined ? undefined : definitions.get(parsed.sourceKey);
      if (
        parsed === undefined ||
        source === undefined ||
        !interactedSources.has(parsed.sourceKey) ||
        source.reward.dispositionByAcquisitionRole[parsed.acquisitionRole]?.kind !== 'artificer'
      )
        throw new Error(`pickup acquisition order has unknown or premature entry ${key}`);
      const settlement = settleArtificerReplacementAcquisition(
        catalog,
        current,
        {
          siteOwner: request.siteOwner,
          pointKey: 'roomExit',
          sourceEntryKey: parsed.sourceKey,
          sourceOrigin: source.address,
          sourceReward: source.reward,
          acquisitionRole: parsed.acquisitionRole,
          participation: 'optional',
          historySequence: request.historySequence,
          facts: request.facts,
          ...(request.findingChronology === undefined
            ? {}
            : { findingChronology: request.findingChronology }),
        },
        findings,
      );
      current = settlement.branches;
      roleFrontiers.push(...(settlement.roleFrontiers ?? []));
      traitChildSettlements.push(...(settlement.traitChildSettlements ?? []));
      continue;
    }
    interactedSources.add(key);
    const { reward, address: entry } = definition;
    pickupEntryFrontiers.push(
      Object.freeze({ address: entry, reward, branchesBeforeEntry: current }),
    );
    const lifecycle =
      catalog.rewards.producerLifecycles.byKey[request.producerLifecycleKey]!.rewardTypes.byKey[
        reward.offer.rewardType
      ]!;
    for (const binding of lifecycle.acquisitionLifecycle) {
      current = applyProducerRoleHistory(
        catalog,
        current,
        Object.freeze({
          origin: entry,
          offer: reward.offer,
          producerLifecycleKey: request.producerLifecycleKey,
          instanceProvenance: 'free',
          traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole,
          ...(reward.levelResolutionsByAcquisitionRole === undefined
            ? {}
            : { levelResolutionsByAcquisitionRole: reward.levelResolutionsByAcquisitionRole }),
          traitContext: request.traitContext ?? Object.freeze({}),
          dispositionByAcquisitionRole: reward.dispositionByAcquisitionRole,
          artificerReplacementByAcquisitionRole: Object.freeze(
            Object.fromEntries(
              Object.entries(reward.dispositionByAcquisitionRole).flatMap(([role, disposition]) =>
                disposition.kind === 'artificer'
                  ? [[role, request.artificerReplacementFor?.(entry, role) ?? null]]
                  : [],
              ),
            ),
          ),
          artificerReplacementSiteByAcquisitionRole: Object.freeze(
            Object.fromEntries(
              Object.entries(reward.dispositionByAcquisitionRole).flatMap(([role, disposition]) =>
                disposition.kind === 'artificer' &&
                request.artificerReplacementSiteFor !== undefined
                  ? [[role, request.artificerReplacementSiteFor(entry, role)]]
                  : [],
              ),
            ),
          ),
        }),
        Object.freeze({ ...binding, historySequence: request.historySequence }),
        request.facts,
        findings,
        undefined,
        request.findingChronology,
        Object.freeze({ site, entry }),
        roleFrontiers,
        traitChildSettlements,
        undefined,
        true,
      );
    }
  }
  return Object.freeze({
    site,
    entries: Object.freeze(entries),
    branches: current,
    pickupEntryFrontiers: Object.freeze(pickupEntryFrontiers),
    roleFrontiers: Object.freeze(roleFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
  });
}

function applyProducerRoleHistory(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  incoming: AcquisitionSource,
  resolution: AcquisitionRoleResolution,
  facts: RewardFactsFactory,
  findings: Map<string, FindingRegionEntry>,
  atomicRegion: string | undefined,
  findingChronology: FindingChronology | undefined,
  settlement: { readonly site: AcquisitionSiteAddress; readonly entry: AcquisitionEntryAddress },
  roleFrontiers?: AcquisitionRoleFrontier[],
  traitChildSettlements?: ReachedTraitChildCheckpoint[],
  directTraitAgreementBranches?: readonly RewardBranchState[],
  deferArtificerReplacement = false,
  offerAlreadyGenerated = false,
): readonly RewardBranchState[] {
  const artificerReplacementRewardTypes = Object.freeze(
    [
      ...new Set(
        (catalog.rewards.stores.byKey.RunProgress?.entries ?? []).map((entry) => entry.rewardType),
      ),
    ].filter((rewardType) => rewardType !== 'Devotion' && rewardType !== 'SpellDrop'),
  );
  const weaponKey = incoming.traitContext?.weaponKey;
  const aspectKey = incoming.traitContext?.aspectKey;
  const artificerReplacementOptions =
    weaponKey === undefined || aspectKey === undefined
      ? undefined
      : Object.freeze(
          artificerReplacementRewardTypes.flatMap((rewardType) =>
            locallyValidRewardOffers(catalog.rewards, rewardType).map((offer) =>
              createUnresolvedAcquisitionRewardState(catalog, offer, {
                kind: 'producerLifecycle',
                key: 'RoomReward',
              }),
            ),
          ),
        );
  const exactArtificerSite = incoming.artificerReplacementSiteByAcquisitionRole?.[resolution.role];
  const artificerReplacementAddress = createAcquisitionEntryAddress(
    exactArtificerSite ?? settlement.site,
    exactArtificerSite === undefined
      ? artificerReplacementEntryKey(settlement.entry.entryKey, resolution.role)
      : artificerReplacementEntryKey(incoming.origin, resolution.role),
  );
  const next: RewardBranchState[] = [];
  let unresolvedArtificerReplacement = false;
  let unresolvedTraitOffer = false;
  for (const branch of branches) {
    const branchFacts = facts(branch.history);
    if (
      !offerAlreadyGenerated &&
      !isOfferSupportedAtResolutionPoint(catalog.rewards, incoming.offer, branchFacts, {
        acquisitionRole: resolution.role,
      })
    ) {
      continue;
    }
    const acquisition = resolveAcquisitionRole(
      catalog.rewards,
      incoming.offer,
      resolution.role,
      resolution.lifecyclePoint,
    );
    // Time Piece is assessed at the exact concrete role, after offer/bag
    // evidence exists but before any acquisition, trait, Pom, level, or
    // element effects can be folded. Shop purchases take their separate paid
    // settlement path and consequently never enter this free producer path.
    const disposition =
      incoming.dispositionByAcquisitionRole?.[resolution.role] ??
      Object.freeze({ kind: 'normal' as const });
    const conversion = assessTimePieceConversion(
      catalog,
      branch,
      incoming,
      resolution.role,
      resolution.lifecyclePoint,
    );
    if (disposition.kind === 'timePiece' && conversion.supported) {
      next.push(
        appendRewardEvent(
          Object.freeze({ ...branch, keepsakes: consumeTimePieceCharge(branch.keepsakes) }),
          resolution.historySequence,
          {
            kind: 'conversionToGold',
            origin: incoming.origin,
            acquisition,
            settlement,
          },
        ),
      );
      continue;
    }
    if (disposition.kind === 'timePiece') {
      addRewardFinding(
        findings,
        rewardFinding(
          'timePieceConversionUnavailable',
          createAcquisitionRoleAddress(incoming.origin, resolution.role),
          {
            ...conversion.evidence,
          },
        ),
        atomicRegion,
        findingChronology ?? historyChronology(resolution.historySequence),
      );
    }
    if (disposition.kind === 'artificer') {
      const artificerReplacement =
        incoming.artificerReplacementByAcquisitionRole?.[resolution.role] ?? null;
      if (artificerReplacement === null) {
        unresolvedArtificerReplacement = true;
        addRewardFinding(
          findings,
          rewardFinding('rewardMissing', artificerReplacementAddress, {
            acquisitionRole: resolution.role,
            lifecyclePoint: resolution.lifecyclePoint,
          }),
          ownerRegion(artificerReplacementAddress),
          findingChronology ?? historyChronology(resolution.historySequence),
        );
        continue;
      }
      const artificer = assessArtificerConversion(catalog, branch, incoming, resolution);
      const replacementAddress = artificerReplacementAddress;
      const replacementLifecycle =
        catalog.rewards.producerLifecycles.byKey.RoomReward?.rewardTypes.byKey[
          artificerReplacement.offer.rewardType
        ];
      const runProgress = catalog.rewards.stores.byKey.RunProgress;
      const prepared = withBag(catalog, branch, 'RunProgress');
      if (
        artificer.supported &&
        replacementLifecycle !== undefined &&
        runProgress !== undefined &&
        prepared !== undefined
      ) {
        let bags: readonly RewardBagState[] = Object.freeze([]);
        try {
          bags = consumeCountedOffer(
            catalog.rewards,
            runProgress,
            prepared.bag,
            artificerReplacement.offer,
            facts(prepared.branch.history),
            { ineligibleRewardTypes: new Set(['Devotion', 'SpellDrop']) },
          );
        } catch (error) {
          if (!(
            error instanceof Error && error.message.includes('one-refill eligibility invariant')
          ))
            throw error;
        }
        const replacementAcquisitionNames = new Set(
          replacementLifecycle.acquisitionLifecycle.map(
            (binding) =>
              resolveAcquisitionRole(
                catalog.rewards,
                artificerReplacement.offer,
                binding.role,
                binding.lifecyclePoint,
              ).acquisition.gameName,
          ),
        );
        const latestSiblingSequence = branch.events.reduce<number | undefined>(
          (latest, event) =>
            event.kind === 'artificerConversion' &&
            JSON.stringify(event.replacement) === JSON.stringify(artificerReplacement.offer)
              ? Math.max(latest ?? Number.NEGATIVE_INFINITY, event.historySequence)
              : latest,
          undefined,
        );
        const hasPendingSibling =
          latestSiblingSequence !== undefined &&
          !branch.events.some(
            (event) =>
              event.kind === 'concreteAcquisition' &&
              event.historySequence > latestSiblingSequence &&
              replacementAcquisitionNames.has(event.acquisition.acquisition.gameName),
          );
        // Fields rewards coexist on the map. Once one Artificer conversion
        // consumes the counted offer, sibling conversions may materialize the
        // same reward until any such reward is actually acquired.
        const generationBags =
          bags.length > 0
            ? bags
            : hasPendingSibling
              ? Object.freeze([prepared.bag])
              : Object.freeze([]);
        for (const bag of generationBags) {
          const arcanaFear = consumeArtificerUse(catalog, branch.arcanaFear, {
            owner: incoming.origin,
            acquisitionRole: resolution.role,
            sequence: resolution.historySequence,
            roleOrdinal:
              catalog.rewards.rewardTypes.byKey[
                incoming.offer.rewardType
              ]?.acquisitionRoles.values.findIndex((role) => role.key === resolution.role) ?? 0,
          });
          if (arcanaFear === undefined) {
            addRewardFinding(
              findings,
              rewardFinding(
                'artificerConversionUnavailable',
                createAcquisitionRoleAddress(incoming.origin, resolution.role),
                { ...artificer.evidence, replacement: offerEvidence(artificerReplacement.offer) },
              ),
              atomicRegion,
              findingChronology ?? historyChronology(resolution.historySequence),
            );
            continue;
          }
          const generatedHistory = applyOfferProjection(
            catalog.rewards,
            prepared.branch.history,
            artificerReplacement.offer,
            facts(prepared.branch.history),
          );
          const withBagAndUse = Object.freeze({
            ...prepared.branch,
            bags: freezeRecord({ ...prepared.branch.bags, RunProgress: bag }),
            history: generatedHistory,
            arcanaFear,
          });
          const generated = appendRewardEvent(
            appendRewardEvent(withBagAndUse, resolution.historySequence, {
              kind: 'rewardOffered',
              origin: replacementAddress,
              offer: artificerReplacement.offer,
              storeKey: 'RunProgress',
            }),
            resolution.historySequence,
            {
              kind: 'artificerConversion',
              origin: incoming.origin,
              acquisition,
              replacement: artificerReplacement.offer,
              settlement,
            },
          );
          if (deferArtificerReplacement) {
            next.push(generated);
            continue;
          }
          let replacementBranches: readonly RewardBranchState[] = Object.freeze([generated]);
          for (const binding of replacementLifecycle.acquisitionLifecycle) {
            replacementBranches = applyProducerRoleHistory(
              catalog,
              replacementBranches,
              Object.freeze({
                origin: replacementAddress,
                offer: artificerReplacement.offer,
                producerLifecycleKey: 'RoomReward',
                instanceProvenance: 'free',
                traitOffersByAcquisitionRole: artificerReplacement.traitOffersByAcquisitionRole,
                ...(artificerReplacement.levelResolutionsByAcquisitionRole === undefined
                  ? {}
                  : {
                      levelResolutionsByAcquisitionRole:
                        artificerReplacement.levelResolutionsByAcquisitionRole,
                    }),
                dispositionByAcquisitionRole: artificerReplacement.dispositionByAcquisitionRole,
                traitContext: incoming.traitContext,
              }),
              Object.freeze({ ...binding, historySequence: resolution.historySequence }),
              facts,
              findings,
              atomicRegion,
              findingChronology,
              Object.freeze({ site: replacementAddress.site, entry: replacementAddress }),
              roleFrontiers,
              traitChildSettlements,
              undefined,
              false,
              true,
            );
          }
          next.push(...replacementBranches);
          continue;
        }
        if (generationBags.length > 0) continue;
      }
      addRewardFinding(
        findings,
        rewardFinding(
          artificer.supported
            ? 'artificerReplacementUnavailable'
            : 'artificerConversionUnavailable',
          createAcquisitionRoleAddress(incoming.origin, resolution.role),
          { ...artificer.evidence, replacement: offerEvidence(artificerReplacement.offer) },
        ),
        atomicRegion,
        findingChronology ?? historyChronology(resolution.historySequence),
      );
    }
    let history = applyConcreteAcquisition(
      catalog.rewards,
      branch.history,
      acquisition.acquisition,
    );
    const fixedTraitKey =
      catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.grantedTraitKey;
    const contributions =
      catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.elementContributions;
    let acquisitionBranch: RewardBranchState = Object.freeze({ ...branch, history });
    if (fixedTraitKey !== undefined) {
      const traitHistory = recordFixedAcquisitionTraitGrant(
        catalog,
        branch.traitHistory ?? createTraitHistoryState(),
        incoming.origin,
        resolution.historySequence,
        resolution.lifecyclePoint,
        fixedTraitKey,
      );
      history = attachTraitHistory(history, traitHistory);
      acquisitionBranch = Object.freeze({ ...acquisitionBranch, history, traitHistory });
    }
    if (contributions !== undefined) {
      const priorTraits = branch.traitHistory ?? createTraitHistoryState();
      const traitHistory = foldTraitHistoryEvents(
        catalog,
        Object.freeze([
          ...priorTraits.events,
          Object.freeze({
            kind: 'elementContribution' as const,
            owner: incoming.origin,
            acquisitionRole: resolution.role,
            sequence: resolution.historySequence,
            acquisitionPoint: resolution.lifecyclePoint,
            contributions,
          }),
        ]),
      );
      history = attachTraitHistory(history, traitHistory);
      acquisitionBranch = Object.freeze({ ...acquisitionBranch, history, traitHistory });
    }
    const traitSettlement = applyTraitOfferForAcquisition(
      catalog,
      acquisitionBranch,
      incoming,
      resolution.role,
      resolution.lifecyclePoint,
      resolution.historySequence,
      findings,
      findingChronology,
      {
        directTraitSetBranchHistories: (directTraitAgreementBranches ?? branches).map(
          (candidate) => candidate.traitHistory ?? createTraitHistoryState(),
        ),
      },
    );
    const withEvent = appendRewardEvent(traitSettlement.branch, resolution.historySequence, {
      kind: 'concreteAcquisition',
      origin: incoming.origin,
      acquisition,
      settlement,
    });
    if (traitSettlement.blockedChild !== undefined) {
      unresolvedTraitOffer = true;
      traitChildSettlements?.push(
        Object.freeze({ ...traitSettlement.blockedChild, branch: withEvent }),
      );
    } else next.push(withEvent);
  }
  if (next.length === 0 && !unresolvedArtificerReplacement && !unresolvedTraitOffer) {
    addRewardFinding(
      findings,
      rewardFinding('rewardAcquisitionUnavailable', incoming.origin, {
        ...offerEvidence(incoming.offer),
        role: resolution.role,
        lifecyclePoint: resolution.lifecyclePoint,
      }),
      atomicRegion,
      findingChronology ?? historyChronology(resolution.historySequence),
    );
  }
  roleFrontiers?.push(
    Object.freeze({
      address: createAcquisitionRoleAddress(incoming.origin, resolution.role),
      branchesBeforeRole: branches,
      source: incoming,
      lifecyclePoint: resolution.lifecyclePoint,
      historySequence: resolution.historySequence,
      settlement,
      artificerReplacementAddress,
      ...(artificerReplacementOptions === undefined ? {} : { artificerReplacementOptions }),
      ...(artificerReplacementRewardTypes.length === 0
        ? {}
        : {
            artificerReplacementCandidate: Object.freeze({
              rewardTypes: artificerReplacementRewardTypes,
              evaluateOffer: (offer: ResolvedRewardOffer) => {
                const supported = branches.every((branch) => {
                  const artificer = assessArtificerConversion(
                    catalog,
                    branch,
                    incoming,
                    resolution,
                  );
                  if (!artificer.supported) return false;
                  const prepared = withBag(catalog, branch, 'RunProgress');
                  if (prepared === undefined) return false;
                  try {
                    return (
                      consumeCountedOffer(
                        catalog.rewards,
                        catalog.rewards.stores.byKey.RunProgress!,
                        prepared.bag,
                        offer,
                        facts(prepared.branch.history),
                        { ineligibleRewardTypes: new Set(['Devotion', 'SpellDrop']) },
                      ).length > 0
                    );
                  } catch {
                    return false;
                  }
                });
                return Object.freeze({ findings: Object.freeze([]), supported });
              },
            }),
          }),
      ...(resolution.blocksArtificerConversion === true
        ? { blocksArtificerConversion: true as const }
        : {}),
    }),
  );
  return Object.freeze(next);
}

export function publicRewardBranch(branch: RewardBranchState): RewardBranch {
  return Object.freeze({
    bags: branch.bags,
    history: branch.history,
    events: branch.events,
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
    ...(branch.traitHistory === undefined ? {} : { traitHistory: branch.traitHistory }),
    arcanaFear: branch.arcanaFear,
    keepsakes: branch.keepsakes,
  });
}
