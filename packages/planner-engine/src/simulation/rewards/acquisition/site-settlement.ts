import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  type AcquisitionEntryAddress,
  type AcquisitionSiteAddress,
  type AcquisitionSiteOwnerAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import {
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  parseArtificerReplacementEntryKey,
} from '../../../authored-project/acquisition/artificer';
import type { AuthoredRewardState } from '../../../authored-project/model';
import type { Catalog } from '../../../catalog-schema';
import {
  isOfferSupportedAtResolutionPoint,
  resolveAcquisitionRole,
  type ResolvedRewardOffer,
} from '../../../reward-kernel';
import {
  ownerRegion,
  type FindingChronology,
  type FindingRegionEntry,
} from '../../finding-regions';
import type { HistoryEvent } from '../../history';
import type { CanonicalResolvedIncomingReward } from '../../materialization';
import { mergeEquivalentRewardBranches, type RewardBranchState } from '../branch-primitives';
import {
  addRewardFinding,
  historyChronology,
  mergeRewardFindingEmissions,
  rewardFinding,
} from '../findings';
import type { ResolvedAcquisitionSource } from '../model';
import type { ReachedTraitChildCheckpoint } from '../trait-settlement';
import type {
  AcquisitionRoleFrontier,
  AcquisitionRoleResolution,
  AcquisitionSettlementEntry,
  AcquisitionSettlementProduct,
  AcquisitionSettlementRole,
  CanonicalRewardRoom,
  DerivedAcquisitionEntryFrontier,
  OwnedAcquisitionSettlementRequest,
  PickupAcquisitionEntryFrontier,
  RewardFactsFactory,
} from './contracts';
import { hasArtificerUse } from './conversions';
import { applyProducerRoleHistory } from './role-settlement';
import type { AcquisitionSource } from './source';

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

export function settleProducerAcquisitionSite(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  room: CanonicalRewardRoom,
  event: Extract<HistoryEvent, { readonly kind: 'producerRoleAdvanced' }>,
  facts: RewardFactsFactory,
  fail: (detail: string) => never,
  atomicRegion?: string,
  findingChronology?: FindingChronology,
  siteOwner?: AcquisitionSiteOwnerAddress,
  authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>,
  timelineOwner?: SemanticAddress,
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
    ...(timelineOwner === undefined ? {} : { timelineOwner }),
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
    atomicRegion,
    findingChronology,
    Object.freeze({ site, entry: entry.address }),
    undefined,
    true,
    false,
    authoredSeaStarDuplicateSiteKeys,
  );
  return Object.freeze({
    site,
    entries: Object.freeze([entry]),
    branches: settled.branches,
    findingEmissions: settled.findingEmissions,
    roleFrontiers: settled.roleFrontiers,
    traitChildSettlements: settled.traitChildSettlements,
  });
}

/** Settles one exact composite-owned acquisition entry at its structural site. */
export function settleOwnedAcquisitionSite(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  request: OwnedAcquisitionSettlementRequest,
  facts: RewardFactsFactory,
  atomicRegion?: string,
  findingChronology?: FindingChronology,
): AcquisitionSettlementProduct {
  const site = createAcquisitionSiteAddress(request.siteOwner, request.pointKey);
  const source = Object.freeze({
    ...request.source,
    ...(request.timelineOwner === undefined ? {} : { timelineOwner: request.timelineOwner }),
  });
  const producer = catalog.rewards.producerLifecycles.byKey[source.producerLifecycleKey];
  const lifecycle = producer?.rewardTypes.byKey[source.offer.rewardType];
  if (lifecycle === undefined && request.roleBindings === undefined) {
    throw new Error(`${source.producerLifecycleKey} does not support ${source.offer.rewardType}`);
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
    source: source.origin,
    acquisitionRoles: Object.freeze(
      roleBindings.map((binding) =>
        Object.freeze({ role: binding.role, lifecyclePoint: binding.lifecyclePoint }),
      ),
    ),
    participation: 'mandatory' as const,
  });
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const traitChildSettlements: ReachedTraitChildCheckpoint[] = [];
  const findingEmissions = new Map<string, FindingRegionEntry>();
  const sourceReward: AuthoredRewardState = Object.freeze({
    offer: source.offer,
    traitOffersByAcquisitionRole: source.traitOffersByAcquisitionRole ?? Object.freeze({}),
    ...(source.levelResolutionsByAcquisitionRole === undefined
      ? {}
      : {
          levelResolutionsByAcquisitionRole: source.levelResolutionsByAcquisitionRole,
        }),
    dispositionByAcquisitionRole: source.dispositionByAcquisitionRole ?? Object.freeze({}),
  });
  let current: readonly RewardBranchState[] = branches;
  for (const binding of roleBindings) {
    const settled = applyProducerRoleHistory(
      catalog,
      current,
      source,
      binding,
      facts,
      atomicRegion,
      findingChronology,
      Object.freeze({ site, entry: entry.address }),
      request.directTraitAgreementBranches,
      true,
      false,
      request.authoredSeaStarDuplicateSiteKeys,
    );
    current = settled.branches;
    mergeRewardFindingEmissions(findingEmissions, settled.findingEmissions);
    roleFrontiers.push(...settled.roleFrontiers);
    traitChildSettlements.push(...settled.traitChildSettlements);
  }
  const entries: AcquisitionSettlementEntry[] = [entry];
  if (request.deferArtificerReplacement !== true) {
    for (const binding of roleBindings) {
      if (sourceReward.dispositionByAcquisitionRole[binding.role]?.kind !== 'artificer') continue;
      const untouched = current.filter(
        (branch) => !hasArtificerUse(branch, source.origin, binding.role),
      );
      const replacement = settleArtificerReplacementAcquisition(catalog, current, {
        siteOwner: request.siteOwner,
        pointKey: request.pointKey,
        sourceEntryKey: request.entryKey,
        sourceOrigin: source.origin,
        sourceReward,
        replacement: source.artificerReplacementByAcquisitionRole?.[binding.role] ?? null,
        acquisitionRole: binding.role,
        participation: 'mandatory',
        historySequence: binding.historySequence,
        facts,
        ...(source.traitContext === undefined ? {} : { traitContext: source.traitContext }),
        ...(atomicRegion === undefined ? {} : { atomicRegion }),
        ...(findingChronology === undefined ? {} : { findingChronology }),
        ...(request.authoredSeaStarDuplicateSiteKeys === undefined
          ? {}
          : {
              authoredSeaStarDuplicateSiteKeys: request.authoredSeaStarDuplicateSiteKeys,
            }),
      });
      mergeRewardFindingEmissions(findingEmissions, replacement.findingEmissions);
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
    findingEmissions: Object.freeze([...findingEmissions.values()]),
    roleFrontiers: Object.freeze(roleFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
  });
}

/**
 * Resolves a payload that belongs to acquisition rather than to its carrier.
 * The caller proves that the carrier reached this point; this operation owns
 * the eventual reward source, its candidate frontier, and ordinary role fold.
 */
export function settleAcquisitionResolvedReward(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  request: {
    readonly siteOwner: AcquisitionSiteOwnerAddress;
    readonly pointKey: string;
    readonly entryKey: string;
    readonly visibleOffer: ResolvedRewardOffer;
    readonly reward: AuthoredRewardState | null | undefined;
    readonly producerLifecycleKey: string;
    readonly producerKind?: CanonicalResolvedIncomingReward['producerKind'];
    readonly instanceProvenance: 'free' | 'paid';
    readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
    readonly timelineOwner?: SemanticAddress;
    readonly historySequence: number;
    readonly branchCohortSize: number;
    readonly directTraitAgreementBranches?: readonly RewardBranchState[];
    readonly roleBindings?: readonly AcquisitionSettlementRole[];
    readonly authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>;
  },
  facts: RewardFactsFactory,
  atomicRegion?: string,
  findingChronology?: FindingChronology,
): AcquisitionSettlementProduct {
  const site = createAcquisitionSiteAddress(request.siteOwner, request.pointKey);
  const address = createAcquisitionEntryAddress(site, request.entryKey);
  const findingEmissions = new Map<string, FindingRegionEntry>();
  const declaration = catalog.rewards.rewardTypes.byKey[request.visibleOffer.rewardType];
  const resolution = declaration?.sourceResolution;
  if (resolution?.kind !== 'acquisitionRole') {
    throw new Error(`${request.visibleOffer.rewardType} does not resolve at acquisition`);
  }
  const frontier: DerivedAcquisitionEntryFrontier = Object.freeze({
    address,
    kind: 'acquisitionResolvedReward',
    branchCohortSize: request.branchCohortSize,
    rewardTypes: Object.freeze([request.visibleOffer.rewardType]),
    branchesBeforeEntry: branches,
    evaluateOffer: (offer: ResolvedRewardOffer) =>
      Object.freeze({
        findings: Object.freeze([]),
        supported:
          offer.rewardType === request.visibleOffer.rewardType &&
          branches.every((branch) =>
            isOfferSupportedAtResolutionPoint(
              catalog.rewards,
              offer,
              facts(branch.history, undefined, branch),
              { acquisitionRole: resolution.role },
            ),
          ),
      }),
  });
  if (request.reward === undefined || request.reward === null) {
    addRewardFinding(
      findingEmissions,
      rewardFinding('rewardMissing', address, {}),
      atomicRegion ?? ownerRegion(address),
      findingChronology ?? historyChronology(request.historySequence),
    );
    return Object.freeze({
      site,
      entries: Object.freeze([
        Object.freeze({
          address,
          source: address,
          acquisitionRoles: Object.freeze([]),
          participation: 'optional' as const,
        }),
      ]),
      branches: Object.freeze([]),
      findingEmissions: Object.freeze([...findingEmissions.values()]),
      derivedEntryFrontiers: Object.freeze([frontier]),
    });
  }
  if (request.reward.offer.rewardType !== request.visibleOffer.rewardType) {
    addRewardFinding(
      findingEmissions,
      rewardFinding('rewardSourceUnavailable', address, {
        reason: 'retainedSourceMismatch',
        rewardType: request.visibleOffer.rewardType,
      }),
      atomicRegion ?? ownerRegion(address),
      findingChronology ?? historyChronology(request.historySequence),
    );
    return Object.freeze({
      site,
      entries: Object.freeze([]),
      branches: Object.freeze([]),
      findingEmissions: Object.freeze([...findingEmissions.values()]),
      derivedEntryFrontiers: Object.freeze([frontier]),
    });
  }
  const settled = settleOwnedAcquisitionSite(
    catalog,
    branches,
    {
      siteOwner: request.siteOwner,
      pointKey: request.pointKey,
      entryKey: request.entryKey,
      source: Object.freeze({
        origin: address,
        offer: request.reward.offer,
        producerLifecycleKey: request.producerLifecycleKey,
        ...(request.producerKind === undefined ? {} : { producerKind: request.producerKind }),
        instanceProvenance: request.instanceProvenance,
        traitOffersByAcquisitionRole: request.reward.traitOffersByAcquisitionRole,
        ...(request.reward.levelResolutionsByAcquisitionRole === undefined
          ? {}
          : {
              levelResolutionsByAcquisitionRole: request.reward.levelResolutionsByAcquisitionRole,
            }),
        dispositionByAcquisitionRole: request.reward.dispositionByAcquisitionRole,
        ...(request.traitContext === undefined ? {} : { traitContext: request.traitContext }),
      }),
      ...(request.timelineOwner === undefined ? {} : { timelineOwner: request.timelineOwner }),
      historySequence: request.historySequence,
      ...(request.roleBindings === undefined ? {} : { roleBindings: request.roleBindings }),
      ...(request.directTraitAgreementBranches === undefined
        ? {}
        : { directTraitAgreementBranches: request.directTraitAgreementBranches }),
      ...(request.authoredSeaStarDuplicateSiteKeys === undefined
        ? {}
        : { authoredSeaStarDuplicateSiteKeys: request.authoredSeaStarDuplicateSiteKeys }),
    },
    facts,
    atomicRegion,
    findingChronology,
  );
  return Object.freeze({
    ...settled,
    derivedEntryFrontiers: Object.freeze([frontier]),
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
    readonly timelineOwner?: SemanticAddress;
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
  const findingEmissions = new Map<string, FindingRegionEntry>();
  const replacement = request.replacement ?? null;
  if (replacement === null) {
    addRewardFinding(
      findingEmissions,
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
      findingEmissions: Object.freeze([...findingEmissions.values()]),
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
    const settled = applyProducerRoleHistory(
      catalog,
      current,
      Object.freeze({
        origin: address,
        offer: replacement.offer,
        producerLifecycleKey: 'RoomReward',
        producer: Object.freeze({
          kind: 'artificerReplacement' as const,
          sourceOwner: request.sourceOrigin,
          ...(request.timelineOwner === undefined
            ? {}
            : { sourceTimelineOwner: request.timelineOwner }),
          sourceRole: request.acquisitionRole,
        }),
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
        ...(request.timelineOwner === undefined ? {} : { timelineOwner: request.timelineOwner }),
        ...(!sourceCanDuplicate ? { blocksSeaStarDuplication: true as const } : {}),
      }),
      Object.freeze({ ...binding, historySequence: request.historySequence }),
      request.facts,
      request.atomicRegion,
      request.findingChronology,
      Object.freeze({ site, entry: address }),
      undefined,
      false,
      true,
      request.authoredSeaStarDuplicateSiteKeys,
    );
    current = settled.branches;
    mergeRewardFindingEmissions(findingEmissions, settled.findingEmissions);
    roleFrontiers.push(...settled.roleFrontiers);
    traitChildSettlements.push(...settled.traitChildSettlements);
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
    findingEmissions: Object.freeze([...findingEmissions.values()]),
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
    /** Exact active action owner for a single-entry settlement. */
    readonly timelineOwner?: SemanticAddress;
    /** Exact active action owner for each reached entry in a composite site. */
    readonly timelineOwnerByEntryKey?: Readonly<Record<string, SemanticAddress>>;
    readonly entries: Readonly<Record<string, AuthoredRewardState | null>>;
    readonly order: readonly string[];
    readonly producerLifecycleKey: string;
    readonly requiredEntryKeys?: ReadonlySet<string>;
    readonly historySequence: number;
    readonly facts: RewardFactsFactory;
    readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
    /**
     * Atomic chronology owner when a materialized pickup is reached through a
     * different authored action, such as a rushed Hermes Shrine purchase.
     */
    readonly atomicRegion?: string;
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
    /** Engine-owned generated-parent provenance keyed by the concrete entry. */
    readonly producerByEntryKey?: Readonly<
      Record<string, NonNullable<ResolvedAcquisitionSource['producer']>>
    >;
    /** Exact authored Sea Star result sites whose source frontier must be retained. */
    readonly authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>;
    /** Candidate-only outer reward probes do not publish the child's own frontier. */
    readonly publishUnpickedChildFrontiers?: boolean;
  },
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
  const findingEmissions = new Map<string, FindingRegionEntry>();
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
      findingEmissions,
      rewardFinding('rewardMissing', address, {}),
      request.atomicRegion ?? ownerRegion(address),
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
      const candidateTimelineOwner =
        request.timelineOwnerByEntryKey?.[key] ?? request.timelineOwner;
      let candidateOnly = current;
      for (const binding of lifecycle.acquisitionLifecycle) {
        const settled = applyProducerRoleHistory(
          catalog,
          candidateOnly,
          Object.freeze({
            origin: entry,
            offer: reward.offer,
            producerLifecycleKey: request.producerLifecycleKey,
            ...(request.producerByEntryKey?.[key] === undefined
              ? {}
              : { producer: request.producerByEntryKey[key] }),
            instanceProvenance: 'free',
            traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole,
            ...(reward.levelResolutionsByAcquisitionRole === undefined
              ? {}
              : { levelResolutionsByAcquisitionRole: reward.levelResolutionsByAcquisitionRole }),
            traitContext: request.traitContext ?? Object.freeze({}),
            ...(candidateTimelineOwner === undefined
              ? {}
              : { timelineOwner: candidateTimelineOwner }),
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
          request.atomicRegion,
          request.findingChronology,
          Object.freeze({ site, entry }),
          undefined,
          true,
          false,
          request.authoredSeaStarDuplicateSiteKeys,
        );
        candidateOnly = settled.branches;
        mergeRewardFindingEmissions(findingEmissions, settled.findingEmissions);
        roleFrontiers.push(...settled.roleFrontiers);
        traitChildSettlements.push(...settled.traitChildSettlements);
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
          findingEmissions,
          rewardFinding('rewardMissing', address, {}),
          request.atomicRegion ?? ownerRegion(address),
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
      const settlement = settleArtificerReplacementAcquisition(catalog, current, {
        siteOwner: request.siteOwner,
        pointKey: site.pointKey,
        sourceEntryKey: parsed.sourceKey,
        sourceOrigin: source.address,
        sourceReward: source.reward,
        ...((request.timelineOwnerByEntryKey?.[key] ??
          request.timelineOwnerByEntryKey?.[parsed.sourceKey] ??
          request.timelineOwner) === undefined
          ? {}
          : {
              timelineOwner:
                request.timelineOwnerByEntryKey?.[key] ??
                request.timelineOwnerByEntryKey?.[parsed.sourceKey] ??
                request.timelineOwner,
            }),
        acquisitionRole: parsed.acquisitionRole,
        participation: 'mandatory',
        historySequence: request.historySequence,
        facts: request.facts,
        ...(request.atomicRegion === undefined ? {} : { atomicRegion: request.atomicRegion }),
        ...(request.findingChronology === undefined
          ? {}
          : { findingChronology: request.findingChronology }),
        ...(request.authoredSeaStarDuplicateSiteKeys === undefined
          ? {}
          : {
              authoredSeaStarDuplicateSiteKeys: request.authoredSeaStarDuplicateSiteKeys,
            }),
      });
      mergeRewardFindingEmissions(findingEmissions, settlement.findingEmissions);
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
    const entryTimelineOwner = request.timelineOwnerByEntryKey?.[key] ?? request.timelineOwner;
    for (const binding of lifecycle.acquisitionLifecycle) {
      const settled = applyProducerRoleHistory(
        catalog,
        current,
        Object.freeze({
          origin: entry,
          offer: reward.offer,
          producerLifecycleKey: request.producerLifecycleKey,
          ...(request.producerByEntryKey?.[key] === undefined
            ? {}
            : { producer: request.producerByEntryKey[key] }),
          instanceProvenance: 'free',
          traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole,
          ...(reward.levelResolutionsByAcquisitionRole === undefined
            ? {}
            : { levelResolutionsByAcquisitionRole: reward.levelResolutionsByAcquisitionRole }),
          traitContext: request.traitContext ?? Object.freeze({}),
          ...(entryTimelineOwner === undefined ? {} : { timelineOwner: entryTimelineOwner }),
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
        request.atomicRegion,
        request.findingChronology,
        Object.freeze({ site, entry }),
        undefined,
        true,
        false,
        request.authoredSeaStarDuplicateSiteKeys,
      );
      current = settled.branches;
      mergeRewardFindingEmissions(findingEmissions, settled.findingEmissions);
      roleFrontiers.push(...settled.roleFrontiers);
      traitChildSettlements.push(...settled.traitChildSettlements);
    }
  }
  return Object.freeze({
    site,
    entries: Object.freeze(entries),
    branches: current,
    findingEmissions: Object.freeze([...findingEmissions.values()]),
    pickupEntryFrontiers: Object.freeze(pickupEntryFrontiers),
    roleFrontiers: Object.freeze(roleFrontiers),
    traitChildSettlements: Object.freeze(traitChildSettlements),
  });
}
