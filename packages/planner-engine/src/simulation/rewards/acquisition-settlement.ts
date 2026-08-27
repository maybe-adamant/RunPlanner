import type { Catalog } from '../../catalog-schema';

import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createAcquisitionRoleAddress,
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type AcquisitionSiteAddress,
  type AcquisitionSiteOwnerAddress,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
} from '../../authored-project/addresses';
import type { AuthoredRewardState } from '../../authored-project/model';
import { createUnresolvedAcquisitionRewardState, optionIndex } from '../../authored-project/traits';
import {
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  parseArtificerReplacementEntryKey,
} from '../../authored-project/artificer';
import { seaStarDuplicateSiteKey } from '../../authored-project/sea-star';

import {
  applyConcreteAcquisition,
  createRewardBagState,
  applyOfferProjection,
  consumeCountedOffer,
  isOfferSupportedAtResolutionPoint,
  locallyValidRewardOffers,
  resolveAcquisitionRole,
  type RewardBagState,
  type RewardHistoryState,
  type RewardKernelFacts,
  type ResolvedRewardOffer,
  type ConcreteAcquisitionEvent,
  type ProducerLifecyclePointKey,
} from '../../reward-kernel';

import type { HistoryEvent } from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalLocalVisitRoom,
  CanonicalResolvedIncomingReward,
} from '../materialization';

import { ownerRegion, type FindingChronology, type FindingRegionEntry } from '../finding-regions';
import type { FindingEvidence } from '../model';

import {
  attachTraitHistory,
  createTraitHistoryState,
  hasActiveChaosSemanticTag,
  foldTraitHistoryEvents,
  recordFixedAcquisitionTraitGrant,
  isAspectSpellDropDormant,
  type TraitHistoryState,
} from '../traits';

import { artificerStatus, consumeRoomRewardForfeit, consumeArtificerUse } from '../arcana-fear';
import { consumeOlympianProviderMaterialized, consumeTimePieceCharge } from '../keepsakes';
import { bankPathPoints, settlePathScreen } from '../hex-progress';
import {
  appendRewardEvent,
  freezeRecord,
  mergeEquivalentRewardBranches,
  offerEvidence,
  type RewardBranchState,
} from './branch-primitives';
import {
  applyTraitOfferForAcquisition,
  type ReachedTraitChildCheckpoint,
} from './trait-settlement';
import { addRewardFinding, rewardFinding } from './findings';

export type CanonicalRewardRoom = CanonicalAuthoredRoom | CanonicalLocalVisitRoom;

export function historyChronology(sequence: number): FindingChronology {
  return Object.freeze({ kind: 'history', sequence, boundary: 'at' });
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

function withBag(
  catalog: Catalog,
  branch: RewardBranchState,
  storeKey: string,
): { readonly branch: RewardBranchState; readonly bag: RewardBagState } | undefined {
  const store = catalog.rewards.stores.byKey[storeKey];
  if (store === undefined) return undefined;
  const current = branch.bags[storeKey];
  if (current !== undefined) return { branch, bag: current };
  const bag = createRewardBagState(store);
  return {
    branch: Object.freeze({ ...branch, bags: freezeRecord({ ...branch.bags, [storeKey]: bag }) }),
    bag,
  };
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
  /** Exact runtime fallback resolved at a selected paid item action. */
  readonly runtimeOfferFallbacks?: readonly {
    readonly address: SemanticAddress;
    readonly preferredRewardType: string;
    readonly fallbackRewardType: string;
  }[];
}

export interface DerivedAcquisitionEntryFrontier {
  readonly address: AcquisitionEntryAddress;
  readonly kind:
    | 'echoDoubleShopPlaceholder'
    | 'echoDoubleShopReward'
    | 'echoLastReward'
    | 'infernalContractReward'
    | 'hermesShrineDelivery'
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
  /**
   * Concrete materialization produced by this role when its outer RoomReward
   * was forfeited. The array follows branchesBeforeRole and is absent for
   * roles with no realized substitution.
   */
  readonly realizedAcquisitionByBranch?: readonly (ConcreteAcquisitionEvent | undefined)[];
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
  /** Exact authored Sea Star result sites whose source frontier must be retained. */
  readonly authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>;
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
  /** Set only by the two paths that enter the game's RoomReward spawn lane. */
  readonly roomRewardForfeitEligible?: true;
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
  /** A Sea Star second interaction is never eligible to produce a third. */
  readonly blocksSeaStarDuplication?: true;
}

export type RewardFactsFactory = (
  history: RewardHistoryState,
  currentRoomShopOptionNames?: ReadonlySet<string>,
  branch?: RewardBranchState,
) => RewardKernelFacts;
/** Exact Sea Star question at the captured pre-acquisition role frontier. */
export function assessSeaStarDuplication(
  catalog: Catalog,
  branch: RewardBranchState,
  source: AcquisitionSource,
  resolution: AcquisitionSettlementRole,
  resolvedAcquisition?: ConcreteAcquisitionEvent,
): { readonly supported: boolean; readonly evidence: FindingEvidence } {
  const resolved =
    resolvedAcquisition ??
    resolveAcquisitionRole(
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
  resolvedAcquisition?: ConcreteAcquisitionEvent,
): { readonly supported: boolean; readonly evidence: FindingEvidence } {
  const acquisition =
    resolvedAcquisition ??
    resolveAcquisitionRole(catalog.rewards, source.offer, role, lifecyclePoint);
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
  authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>,
): AcquisitionSettlementProduct {
  const incoming = room.incomingReward;
  if (
    incoming === undefined ||
    incoming.offer.rewardType !== event.rewardType ||
    incoming.producerLifecycleKey !== event.producerLifecycleKey
  ) {
    return fail(`${room.gameName} producer event does not match its offer`);
  }
  const incomingSource = Object.freeze({
    ...withStoredArtificerReplacements(room, incoming),
    ...(incoming.producerLifecycleKey === 'RoomReward'
      ? { roomRewardForfeitEligible: true as const }
      : {}),
  });
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
    false,
    authoredSeaStarDuplicateSiteKeys,
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
        false,
        request.authoredSeaStarDuplicateSiteKeys,
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
          ...(request.authoredSeaStarDuplicateSiteKeys === undefined
            ? {}
            : {
                authoredSeaStarDuplicateSiteKeys: request.authoredSeaStarDuplicateSiteKeys,
              }),
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
    readonly authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>;
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
  const sourceAcquisition = resolveAcquisitionRole(
    catalog.rewards,
    request.sourceReward.offer,
    request.acquisitionRole,
    'roomRewardPickup',
  );
  const sourceCanDuplicate =
    catalog.rewards.acquisitions.byKey[sourceAcquisition.acquisition.gameName]?.canDuplicate ===
    true;
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
        roomRewardForfeitEligible: true as const,
        traitOffersByAcquisitionRole: replacement.traitOffersByAcquisitionRole,
        ...(replacement.levelResolutionsByAcquisitionRole === undefined
          ? {}
          : {
              levelResolutionsByAcquisitionRole: replacement.levelResolutionsByAcquisitionRole,
            }),
        dispositionByAcquisitionRole: replacement.dispositionByAcquisitionRole,
        traitContext: request.traitContext ?? Object.freeze({}),
        ...(!sourceCanDuplicate ? { blocksSeaStarDuplication: true as const } : {}),
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
      request.authoredSeaStarDuplicateSiteKeys,
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
    readonly site: AcquisitionSiteAddress;
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
    /** Closed entry identities that represent Sea Star's already-retained object. */
    readonly seaStarDuplicateEntryKeys?: ReadonlySet<string>;
    /** Exact authored Sea Star result sites whose source frontier must be retained. */
    readonly authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>;
    /** Candidate-only outer reward probes do not publish the child's own frontier. */
    readonly publishUnpickedChildFrontiers?: boolean;
  },
  findings: Map<string, FindingRegionEntry>,
): AcquisitionSettlementProduct {
  const site = request.site;
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
            ...(request.seaStarDuplicateEntryKeys?.has(key) === true
              ? { blocksSeaStarDuplication: true as const }
              : {}),
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
          false,
          request.authoredSeaStarDuplicateSiteKeys,
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
          pointKey: site.pointKey,
          sourceEntryKey: parsed.sourceKey,
          sourceOrigin: source.address,
          sourceReward: source.reward,
          acquisitionRole: parsed.acquisitionRole,
          participation: 'mandatory',
          historySequence: request.historySequence,
          facts: request.facts,
          ...(request.findingChronology === undefined
            ? {}
            : { findingChronology: request.findingChronology }),
          ...(request.authoredSeaStarDuplicateSiteKeys === undefined
            ? {}
            : {
                authoredSeaStarDuplicateSiteKeys: request.authoredSeaStarDuplicateSiteKeys,
              }),
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
          ...(request.seaStarDuplicateEntryKeys?.has(key) === true
            ? { blocksSeaStarDuplication: true as const }
            : {}),
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
        false,
        request.authoredSeaStarDuplicateSiteKeys,
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

export function applyProducerRoleHistory(
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
  authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>,
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
  const realizedAcquisitionByBranch: (ConcreteAcquisitionEvent | undefined)[] = [];
  let unresolvedArtificerReplacement = false;
  let unresolvedTraitOffer = false;
  const seaStarSourceKey = semanticAddressKey(
    createAcquisitionRoleAddress(incoming.origin, resolution.role),
  );
  const retainSeaStarEligibility =
    authoredSeaStarDuplicateSiteKeys?.has(
      seaStarDuplicateSiteKey(createAcquisitionRoleAddress(incoming.origin, resolution.role)),
    ) === true;
  for (const branch of branches) {
    const branchFacts = facts(branch.history, undefined, branch);
    if (
      !offerAlreadyGenerated &&
      !isOfferSupportedAtResolutionPoint(catalog.rewards, incoming.offer, branchFacts, {
        acquisitionRole: resolution.role,
      })
    ) {
      realizedAcquisitionByBranch.push(undefined);
      continue;
    }
    const acquisition = resolveAcquisitionRole(
      catalog.rewards,
      incoming.offer,
      resolution.role,
      resolution.lifecyclePoint,
    );
    const qualifyingRewardType =
      incoming.offer.rewardType === 'Boon' || incoming.offer.rewardType === 'HermesUpgrade'
        ? incoming.offer.rewardType
        : undefined;
    const forfeit =
      incoming.roomRewardForfeitEligible === true && qualifyingRewardType !== undefined
        ? consumeRoomRewardForfeit(catalog, branch.arcanaFear, qualifyingRewardType, {
            owner: incoming.origin,
            sequence: resolution.historySequence,
          })
        : Object.freeze({ consumed: false as const, state: branch.arcanaFear });
    const realizedAcquisition = forfeit.consumed
      ? Object.freeze({
          ...acquisition,
          acquisition: Object.freeze({
            kind: 'consumable' as const,
            gameName: forfeit.replacementRewardType,
          }),
        })
      : acquisition;
    realizedAcquisitionByBranch.push(forfeit.consumed ? realizedAcquisition : undefined);
    const forfeitBranch =
      forfeit.consumed && qualifyingRewardType !== undefined
        ? appendRewardEvent(
            Object.freeze({ ...branch, arcanaFear: forfeit.state }),
            resolution.historySequence,
            Object.freeze({
              kind: 'rewardForfeited' as const,
              origin: incoming.origin,
              rewardType: qualifyingRewardType,
              replacementRewardType: forfeit.replacementRewardType,
            }),
          )
        : branch;
    const attestedBranch = retainSeaStarEligibility
      ? Object.freeze({
          ...forfeitBranch,
          seaStarDuplicateEligibilityBySource: freezeRecord({
            ...(forfeitBranch.seaStarDuplicateEligibilityBySource ?? {}),
            [seaStarSourceKey]: assessSeaStarDuplication(
              catalog,
              branch,
              incoming,
              resolution,
              realizedAcquisition,
            ),
          }),
        })
      : forfeitBranch;
    // A concrete god-loot acquisition is a materialization contact when the
    // producer marks it free. Blind Box hidden loot is also free even when its
    // containing Shop box was paid; the box itself is not god loot.
    const materializedProvider =
      incoming.instanceProvenance === 'free' || resolution.lifecyclePoint === 'afterUnwrap'
        ? catalog.traitGiverByAcquisitionGameName[realizedAcquisition.acquisition.gameName]
        : undefined;
    const materializedBranch =
      materializedProvider === undefined
        ? attestedBranch
        : Object.freeze({
            ...attestedBranch,
            keepsakes: consumeOlympianProviderMaterialized(
              attestedBranch.keepsakes,
              materializedProvider,
              'free',
            ),
          });
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
      realizedAcquisition,
    );
    if (disposition.kind === 'timePiece' && conversion.supported) {
      next.push(
        appendRewardEvent(
          Object.freeze({
            ...materializedBranch,
            keepsakes: consumeTimePieceCharge(materializedBranch.keepsakes),
          }),
          resolution.historySequence,
          {
            kind: 'conversionToGold',
            origin: incoming.origin,
            acquisition: realizedAcquisition,
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
    if (forfeit.consumed) {
      const history = applyConcreteAcquisition(
        catalog.rewards,
        materializedBranch.history,
        realizedAcquisition.acquisition,
      );
      next.push(
        appendRewardEvent(
          Object.freeze({ ...materializedBranch, history }),
          resolution.historySequence,
          {
            kind: 'concreteAcquisition',
            origin: incoming.origin,
            acquisition: realizedAcquisition,
            settlement,
          },
        ),
      );
      continue;
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
            facts(prepared.branch.history, undefined, prepared.branch),
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
            facts(prepared.branch.history, undefined, prepared.branch),
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
          const sourceCanDuplicate =
            catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.canDuplicate ===
            true;
          for (const binding of replacementLifecycle.acquisitionLifecycle) {
            replacementBranches = applyProducerRoleHistory(
              catalog,
              replacementBranches,
              Object.freeze({
                origin: replacementAddress,
                offer: artificerReplacement.offer,
                producerLifecycleKey: 'RoomReward',
                instanceProvenance: 'free',
                roomRewardForfeitEligible: true as const,
                traitOffersByAcquisitionRole: artificerReplacement.traitOffersByAcquisitionRole,
                ...(artificerReplacement.levelResolutionsByAcquisitionRole === undefined
                  ? {}
                  : {
                      levelResolutionsByAcquisitionRole:
                        artificerReplacement.levelResolutionsByAcquisitionRole,
                    }),
                dispositionByAcquisitionRole: artificerReplacement.dispositionByAcquisitionRole,
                traitContext: incoming.traitContext,
                ...(incoming.blocksSeaStarDuplication === true || !sourceCanDuplicate
                  ? { blocksSeaStarDuplication: true as const }
                  : {}),
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
              authoredSeaStarDuplicateSiteKeys,
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
    let acquisitionBranch: RewardBranchState = Object.freeze({ ...materializedBranch, history });
    const pathPointGrant: 1 | 3 | 5 | undefined =
      catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.pathPointGrant ??
      (acquisition.acquisition.gameName === 'SpellDrop' &&
      isAspectSpellDropDormant(catalog, incoming.traitContext?.aspectKey)
        ? (3 as const)
        : undefined);
    if (pathPointGrant !== undefined)
      acquisitionBranch = settlePathScreen(catalog, acquisitionBranch, pathPointGrant);
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
    const traitEventCountBeforeSettlement = acquisitionBranch.traitHistory?.events.length ?? 0;
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
    const installedSpellEvent =
      acquisition.acquisition.gameName === 'SpellDrop' && pathPointGrant === undefined
        ? traitSettlement.branch.traitHistory?.events
            .slice(traitEventCountBeforeSettlement)
            .findLast(
              (event) =>
                event.kind === 'traitOffer' &&
                event.sequence === resolution.historySequence &&
                event.acquisitionRole === resolution.role &&
                event.giverKey === 'SpellDrop',
            )
        : undefined;
    const spellBonus =
      installedSpellEvent?.kind === 'traitOffer'
        ? catalog.traitGivers.byKey.SpellDrop?.selectedOptionPathPointBonuses?.[
            optionIndex(installedSpellEvent.selectedOptionKey)
          ]
        : undefined;
    const settledTraitBranch =
      spellBonus === undefined
        ? traitSettlement.branch
        : bankPathPoints(traitSettlement.branch, spellBonus);
    const withEvent = appendRewardEvent(settledTraitBranch, resolution.historySequence, {
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
      ...(realizedAcquisitionByBranch.some((acquisition) => acquisition !== undefined)
        ? { realizedAcquisitionByBranch: Object.freeze(realizedAcquisitionByBranch) }
        : {}),
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
                        facts(prepared.branch.history, undefined, prepared.branch),
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
