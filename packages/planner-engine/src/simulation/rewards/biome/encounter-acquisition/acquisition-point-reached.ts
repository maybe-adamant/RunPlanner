import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createRoomActionAddress,
  semanticAddressKey,
} from '../../../../authored-project/addresses';
import type { RouteLoadout } from '../../../../authored-project/model';
import { roomActionKey } from '../../../../authored-project/room-actions';
import {
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  parseArtificerReplacementEntryKey,
} from '../../../../authored-project/artificer';
import {
  defaultHermesShrineDeliveryReward,
  hermesShrineDeliveryEntryKey,
  parseHermesShrineDeliveryEntryKey,
} from '../../../../authored-project/hermes-shrine-delivery';
import { createUnresolvedPickupRewardState } from '../../../../authored-project/traits';
import type { ResolvedRewardOffer } from '../../../../reward-kernel';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { isPurgingPoolEligibleTrait, type PurgingPoolAssessment } from '../../../purging-pool';
import {
  assessHermesShrineTravelDealRefill,
  type HermesShrineTravelDealRefillAssessment,
} from '../../../hermes-shrine';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
} from '../../../traits';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import { canonicalArtificerSource } from '../reward-sources';
import {
  settleArtificerReplacementAcquisition,
  settleOwnedAcquisitionSite,
  settlePickupAcquisitionSite,
  withStoredArtificerReplacements,
  type AcquisitionRoleFrontier,
} from '../../acquisition-settlement';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { RewardBranchState } from '../../branch-primitives';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { createBiomeRewardFacts } from '../../facts';
import { addRewardFinding, rewardFinding } from '../../findings';
import type { AuthoredSiteSettlementResult } from '../generation/authored-site-settlement';
import { settleAuthoredAcquisitionSite } from '../generation/authored-site-settlement';
import type { ReachedTraitChildCheckpoint } from '../../trait-settlement';
import {
  createRewardProducerCandidateResult,
  type RewardProducerOwnerAddress,
  type RewardProducerFrontier,
} from '../../producer-frontiers';

export interface HermesShrineRefillState {
  readonly firstRushedInitialGeneration: boolean;
  readonly refillAssessments: readonly HermesShrineTravelDealRefillAssessment[] | undefined;
  readonly refillSupported: boolean | undefined;
}

export interface RuntimeOfferFallback {
  readonly address: import('../../../../authored-project/addresses').SemanticAddress;
  readonly preferredKey: string;
  readonly fallbackKey: string;
}

export interface AcquisitionPointReachedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
  readonly roleFrontiers: readonly AcquisitionRoleFrontier[];
  readonly traitChildSettlements: readonly ReachedTraitChildCheckpoint[];
  readonly authoredSiteSettlement: AuthoredSiteSettlementResult | undefined;
  readonly runtimeOfferFallbacks: readonly RuntimeOfferFallback[];
  /** Present only for Shrine purchase events; replaces the coordinator's room state. */
  readonly hermesShrineRefillState: HermesShrineRefillState | undefined;
}

export interface AcquisitionPointReachedInputs {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'acquisitionPointReached' }>;
  readonly room: CanonicalAuthoredRoom | undefined;
  readonly declaration: RoomDeclaration | undefined;
  readonly roomView: ProgressiveRoomHistoryViews | undefined;
  readonly sourceBranches: readonly RewardBranchState[];
  readonly enteredBiomeCount: number;
  readonly routeLoadout: RouteLoadout;
  readonly rewardLookups: Readonly<Record<string, ReadonlySet<string>>>;
  readonly authoredSeaStarDuplicateSiteKeys: readonly string[];
  readonly purgingPoolAssessment:
    { readonly assessments: readonly PurgingPoolAssessment[] } | undefined;
  readonly hermesShrineRefillState: HermesShrineRefillState | undefined;
}

function shrineFallbackRewardType(
  catalog: Catalog,
  generationKey: import('../../../../authored-project/model').HermesShrineGenerationKey,
  rewardType: string,
  refill: HermesShrineTravelDealRefillAssessment | undefined,
): string | undefined {
  const sourceGenerationKey =
    generationKey === 'travelDealRefill' ? refill?.sourceGenerationKey : generationKey;
  const slotKey = sourceGenerationKey?.startsWith('initial:')
    ? sourceGenerationKey.slice('initial:'.length)
    : undefined;
  if (slotKey !== 'first' && slotKey !== 'secondLeft' && slotKey !== 'secondRight')
    return undefined;
  const profile = catalog.rewards.shops.byKey.SurfaceShop;
  const group = profile?.groups.byKey[profile.slots.byKey[slotKey]?.groupKey ?? ''];
  const option = group?.options.values.find((candidate) => candidate.rewardType === rewardType);
  const supported =
    generationKey === 'travelDealRefill' ? refill?.candidateRewardTypes : group?.rewardTypes;
  return option?.runtimeOfferFallbackRewardTypes?.find(
    (candidate) => supported?.includes(candidate) === true,
  );
}

function transitionResult(input: {
  readonly branches: readonly RewardBranchState[];
  readonly findings: ReadonlyMap<string, FindingRegionEntry>;
  readonly producerFrontiers?: readonly RewardProducerFrontier[] | undefined;
  readonly roleFrontiers?: readonly AcquisitionRoleFrontier[] | undefined;
  readonly traitChildSettlements?: readonly ReachedTraitChildCheckpoint[] | undefined;
  readonly authoredSiteSettlement?: AuthoredSiteSettlementResult | undefined;
  readonly runtimeOfferFallbacks?: readonly RuntimeOfferFallback[] | undefined;
  readonly hermesShrineRefillState?: HermesShrineRefillState | undefined;
}): AcquisitionPointReachedTransition {
  return Object.freeze({
    branches: Object.freeze(input.branches),
    findings: Object.freeze([...input.findings.values()]),
    producerFrontiers: Object.freeze(input.producerFrontiers ?? []),
    roleFrontiers: Object.freeze(input.roleFrontiers ?? []),
    traitChildSettlements: Object.freeze(input.traitChildSettlements ?? []),
    authoredSiteSettlement: input.authoredSiteSettlement,
    runtimeOfferFallbacks: Object.freeze(input.runtimeOfferFallbacks ?? []),
    hermesShrineRefillState: input.hermesShrineRefillState,
  });
}

/** Settles one reached acquisition action and returns all chronology publications explicitly. */
export function applyAcquisitionPointReachedTransition(
  inputs: AcquisitionPointReachedInputs,
): AcquisitionPointReachedTransition {
  const { catalog, snapshot, event, room, declaration, roomView } = inputs;
  if (room === undefined || declaration === undefined || roomView === undefined) {
    throw new BiomeRewardSimulationContractError('shop purchases have no authored room');
  }
  const findings = new Map<string, FindingRegionEntry>();
  // These are lower-level settlement inputs. The transition boundary itself
  // exposes only frozen arrays, so chronology cannot share a mutable collector.
  const authoredSeaStarDuplicateSiteKeys = new Set(inputs.authoredSeaStarDuplicateSiteKeys);
  const rewardLookups = inputs.rewardLookups;
  const chronology = rewardFindingChronologyForRoom(
    snapshot,
    room.origin,
    event.sequence,
    'localRoomLifecycle',
  );
  const addFinding = (
    kind: Parameters<typeof rewardFinding>[0],
    origin: Parameters<typeof rewardFinding>[1],
    detail?: Parameters<typeof rewardFinding>[2],
  ) =>
    addRewardFinding(
      findings,
      rewardFinding(kind, origin, detail ?? {}),
      ownerRegion(origin),
      chronology,
    );
  const factsAt = (
    view: NonNullable<ProgressiveRoomHistoryViews['entry']>,
    branchHistory: import('../../../../reward-kernel').RewardHistoryState,
    branch?: RewardBranchState,
  ) =>
    createBiomeRewardFacts(
      catalog,
      room,
      room,
      declaration,
      view,
      branchHistory,
      inputs.enteredBiomeCount,
      undefined,
      undefined,
      undefined,
      undefined,
      branch,
    );
  const hermesDeliveryProducerFrontier = (input: {
    readonly address: import('../../../../authored-project/addresses').AcquisitionEntryAddress;
    readonly rewardType: string;
    readonly branchesBeforeEntry: readonly RewardBranchState[];
    readonly acquisitionView: NonNullable<ProgressiveRoomHistoryViews['entry']>;
    readonly atomicRegion: string;
  }): RewardProducerFrontier => {
    const addressKey = semanticAddressKey(input.address);
    return Object.freeze({
      generationPolicy: 'sequential' as const,
      generationHistorySequence: event.sequence,
      reachableBranchCount: input.branchesBeforeEntry.length,
      acquisitionHorizon: 'ownEnteredLifecycle' as const,
      owners: Object.freeze([input.address]),
      evaluateOffer: (owner: RewardProducerOwnerAddress, offer: ResolvedRewardOffer) => {
        if (semanticAddressKey(owner) !== addressKey)
          throw new BiomeRewardSimulationContractError(
            'Hermes delivery frontier received a foreign owner',
          );
        if (offer.rewardType !== input.rewardType)
          return Object.freeze({ findings: Object.freeze([]), supported: false });
        const candidateFindings = new Map<string, FindingRegionEntry>();
        const candidateSettlement = settlePickupAcquisitionSite(
          catalog,
          input.branchesBeforeEntry,
          {
            siteOwner: room.origin,
            site: input.address.site,
            entries: Object.freeze({
              [input.address.entryKey]: createUnresolvedPickupRewardState(
                catalog,
                offer,
                'HermesShrineDelivery',
              ),
            }),
            order: Object.freeze([input.address.entryKey]),
            requiredEntryKeys: new Set([input.address.entryKey]),
            producerLifecycleKey: 'HermesShrineDelivery',
            historySequence: event.sequence,
            atomicRegion: input.atomicRegion,
            facts: (history, _names, branch) => factsAt(input.acquisitionView, history, branch),
            findingChronology: chronology,
            authoredSeaStarDuplicateSiteKeys,
            artificerReplacementFor(source, role) {
              const site = artificerAcquisitionSite(room.origin, source);
              return (
                room.acquisitionSites[acquisitionSiteStorageKey(site)]?.entries[
                  artificerReplacementEntryKey(source, role)
                ] ?? null
              );
            },
            artificerReplacementSiteFor(source) {
              return artificerAcquisitionSite(room.origin, source);
            },
          },
          candidateFindings,
        );
        return createRewardProducerCandidateResult(
          candidateFindings,
          Object.freeze([
            ...candidateSettlement.branches,
            ...(candidateSettlement.traitChildSettlements ?? []).map(
              (checkpoint) => checkpoint.branch,
            ),
          ]),
        );
      },
    });
  };

  if (event.point.startsWith('hermesShrinePurchase:')) {
    const generationKey = event.point.slice(
      'hermesShrinePurchase:'.length,
    ) as import('../../../../authored-project/model').HermesShrineGenerationKey;
    const slotKey = generationKey.startsWith('initial:')
      ? (generationKey.slice(
          'initial:'.length,
        ) as import('../../../../authored-project/model').HermesShrineSlotKey)
      : undefined;
    const purchase =
      generationKey === 'travelDealRefill'
        ? room.hermesShrine?.travelDealRefill?.purchase
        : room.hermesShrine?.purchaseBySlot?.[slotKey!];
    const offer =
      generationKey === 'travelDealRefill'
        ? room.hermesShrine?.travelDealRefill?.offer
        : room.hermesShrine?.offerBySlot[slotKey!];
    if (purchase === undefined || offer === undefined || offer === null) {
      addFinding('rewardSourceUnavailable', room.origin, { generationKey });
      return transitionResult({ branches: inputs.sourceBranches, findings });
    }
    const sourceKey = hermesShrineDeliveryEntryKey(room.origin, generationKey);
    const deliverySite = createAcquisitionSiteAddress(room.origin, 'hermesShrineDelivery');
    const retainedDelivery = room.acquisitionSites.hermesShrineDelivery?.entries[sourceKey];
    const deliveryReward =
      retainedDelivery ?? defaultHermesShrineDeliveryReward(catalog, offer.rewardType);
    const prior = inputs.hermesShrineRefillState;
    const fallbackRewardType = shrineFallbackRewardType(
      catalog,
      generationKey,
      offer.rewardType,
      prior?.refillAssessments?.[0],
    );
    const runtimeOfferFallbacks =
      fallbackRewardType === undefined ||
      (generationKey === 'travelDealRefill' && prior?.refillSupported !== true)
        ? []
        : [
            Object.freeze({
              address: createAcquisitionEntryAddress(
                createAcquisitionSiteAddress(room.origin, 'hermesShrineDelivery'),
                sourceKey,
              ),
              preferredKey: offer.rewardType,
              fallbackKey: fallbackRewardType,
            }),
          ];
    if (generationKey === 'travelDealRefill' && prior?.refillSupported !== true) {
      addFinding('hermesShrineTravelDealRefillUnavailable', room.origin, {
        reason: 'noQualifyingFirstRushedPurchase',
      });
      return transitionResult({ branches: inputs.sourceBranches, findings, runtimeOfferFallbacks });
    }
    let refillState = prior;
    if (
      purchase.rushed &&
      generationKey.startsWith('initial:') &&
      prior?.firstRushedInitialGeneration !== true
    ) {
      const preRushView =
        roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
        roomView.preOutgoing ??
        roomView.entry;
      const qualifies = inputs.sourceBranches.every(
        (branch) => branch.traitHistory?.equippedTraits.RestockBoon !== undefined,
      );
      refillState = Object.freeze({
        firstRushedInitialGeneration: true,
        refillAssessments: undefined,
        refillSupported: undefined,
      });
      if (qualifies) {
        const refillAssessments = Object.freeze(
          inputs.sourceBranches.flatMap((branch) => {
            const assessment = assessHermesShrineTravelDealRefill(
              catalog,
              room.hermesShrine!,
              generationKey,
              [factsAt(preRushView, branch.history, branch).requirements],
            );
            return assessment === undefined ? [] : [assessment];
          }),
        );
        const refill = room.hermesShrine?.travelDealRefill?.offer;
        const supported =
          refill !== undefined &&
          refill !== null &&
          refillAssessments.length === inputs.sourceBranches.length &&
          refillAssessments.every((assessment) =>
            assessment.candidateRewardTypes.includes(refill.rewardType),
          );
        refillState = Object.freeze({
          firstRushedInitialGeneration: true,
          refillAssessments,
          refillSupported: supported,
        });
        if (refill === undefined || refill === null)
          addFinding('hermesShrineTravelDealRefillMissing', room.origin, { generationKey });
        else if (!supported)
          addFinding('hermesShrineTravelDealRefillUnavailable', room.origin, {
            generationKey,
            rewardType: refill.rewardType,
          });
      }
    }
    if (!purchase.rushed) {
      return transitionResult({
        branches: inputs.sourceBranches.map((branch) =>
          Object.freeze({
            ...branch,
            pendingHermesShrineDeliveries: Object.freeze({
              ...branch.pendingHermesShrineDeliveries,
              [sourceKey]: Object.freeze({
                sourceKey,
                sourceOrigin: room.origin,
                generationKey,
                rewardType: offer.rewardType,
                remainingUses: purchase.delay,
              }),
            }),
          }),
        ),
        findings,
        runtimeOfferFallbacks,
        hermesShrineRefillState: refillState,
      });
    }
    const acquisitionView =
      roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
      roomView.preOutgoing ??
      roomView.entry;
    const purchaseAction = Object.freeze({
      kind: 'purchaseHermesShrineOffer' as const,
      generationKey,
    });
    const purchaseAddress = createRoomActionAddress(
      createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
      room.origin.occurrenceId,
      roomActionKey(purchaseAction),
    );
    const settled = settlePickupAcquisitionSite(
      catalog,
      inputs.sourceBranches,
      {
        siteOwner: room.origin,
        site: deliverySite,
        entries: Object.freeze({ [sourceKey]: deliveryReward }),
        order: Object.freeze([sourceKey]),
        requiredEntryKeys: new Set([sourceKey]),
        producerLifecycleKey: 'HermesShrineDelivery',
        historySequence: event.sequence,
        atomicRegion: ownerRegion(purchaseAddress),
        facts: (history, _names, branch) => factsAt(acquisitionView, history, branch),
        findingChronology: chronology,
        authoredSeaStarDuplicateSiteKeys,
        artificerReplacementFor(source, role) {
          const site = artificerAcquisitionSite(room.origin, source);
          return (
            room.acquisitionSites[acquisitionSiteStorageKey(site)]?.entries[
              artificerReplacementEntryKey(source, role)
            ] ?? null
          );
        },
        artificerReplacementSiteFor(source) {
          return artificerAcquisitionSite(room.origin, source);
        },
      },
      findings,
    );
    return transitionResult({
      branches: settled.branches,
      findings,
      producerFrontiers: Object.freeze([
        hermesDeliveryProducerFrontier({
          address: createAcquisitionEntryAddress(deliverySite, sourceKey),
          rewardType: offer.rewardType,
          branchesBeforeEntry: inputs.sourceBranches,
          acquisitionView,
          atomicRegion: ownerRegion(purchaseAddress),
        }),
      ]),
      roleFrontiers: settled.roleFrontiers,
      traitChildSettlements: settled.traitChildSettlements,
      runtimeOfferFallbacks,
      hermesShrineRefillState: refillState,
    });
  }

  const poolSlot = event.point.startsWith('purgingPool:')
    ? event.point.slice('purgingPool:'.length)
    : undefined;
  if (poolSlot === 'left' || poolSlot === 'middle' || poolSlot === 'right') {
    const traitKey = room.purgingPool?.traitKeyBySlot[poolSlot];
    const row = room.roomActionRoster.rows.find(
      (candidate) =>
        candidate.rank !== null &&
        candidate.reference.kind === 'sellPurgingPoolTrait' &&
        candidate.reference.slotKey === poolSlot,
    );
    if (row === undefined)
      throw new BiomeRewardSimulationContractError(
        `${room.gameName} has no ranked Pool sale row for ${poolSlot}`,
      );
    const owner = createRoomActionAddress(
      createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
      room.occurrenceId,
      row.key,
    );
    const available =
      inputs.purgingPoolAssessment?.assessments.every((assessment) => assessment.complete) ===
        true &&
      traitKey !== null &&
      traitKey !== undefined &&
      inputs.sourceBranches.every((branch) => {
        const equipped = (branch.traitHistory ?? createTraitHistoryState()).equippedTraits[
          traitKey
        ];
        return equipped !== undefined && isPurgingPoolEligibleTrait(catalog, equipped);
      });
    if (!available) {
      addRewardFinding(
        findings,
        rewardFinding('purgingPoolSaleUnavailable', owner, {
          slotKey: poolSlot,
          ...(traitKey === null || traitKey === undefined ? {} : { traitKey }),
        }),
        // A stale sale no longer contributes an active action region. Keep
        // the finding at the exact action while the occurrence owns its
        // progressive visibility envelope.
        ownerRegion(room.origin),
        chronology,
      );
      return transitionResult({ branches: inputs.sourceBranches, findings });
    }
    return transitionResult({
      branches: inputs.sourceBranches.map((branch) => {
        const before = branch.traitHistory ?? createTraitHistoryState();
        const traitHistory = foldTraitHistoryEvents(catalog, [
          ...before.events,
          Object.freeze({
            kind: 'traitRemoval' as const,
            owner,
            acquisitionRole: 'purgingPoolSale',
            sequence: event.sequence,
            acquisitionPoint: event.point,
            traitKey,
            match: 'currentTraitKey' as const,
          }),
        ]);
        return Object.freeze({
          ...branch,
          history: attachTraitHistory(branch.history, traitHistory),
          traitHistory,
        });
      }),
      findings,
    });
  }

  const localParts = event.point.startsWith('localReward:')
    ? event.point.slice('localReward:'.length).split(':')
    : undefined;
  if (room.lifecycleProfileKey === 'FieldsCombatRoom' && localParts !== undefined) {
    const [groupKey, slotKey] = localParts;
    const localReward =
      groupKey === 'cages'
        ? room.localRewards?.find((reward) => reward.slotKey === slotKey)
        : groupKey === 'optionalRewards'
          ? room.fieldsOptionalRewards?.find((reward) => reward.slotKey === slotKey)
          : undefined;
    const acquisitionView = roomView.acquisitionPoints?.find(
      (point) => point.point === event.point,
    )?.before;
    if (localReward === undefined || acquisitionView === undefined)
      throw new BiomeRewardSimulationContractError(
        `${room.gameName} has no Fields acquisition ${event.point}`,
      );
    const settled = settleOwnedAcquisitionSite(
      catalog,
      inputs.sourceBranches,
      {
        siteOwner: localReward.origin,
        pointKey: event.point,
        entryKey: localReward.slotKey,
        source: withStoredArtificerReplacements(
          room,
          Object.freeze({ ...localReward, instanceProvenance: 'free' }),
        ),
        historySequence: event.sequence,
        deferArtificerReplacement: true,
        authoredSeaStarDuplicateSiteKeys,
      },
      (history) => factsAt(acquisitionView, history),
      findings,
      undefined,
      chronology,
    );
    return transitionResult({
      branches: settled.branches,
      findings,
      roleFrontiers: settled.roleFrontiers,
      traitChildSettlements: settled.traitChildSettlements,
    });
  }

  if (event.siteKey !== undefined && event.entryKey !== undefined) {
    const site = room.acquisitionSites[event.siteKey];
    const shrineDelivery =
      event.siteKey === 'hermesShrineDelivery'
        ? parseHermesShrineDeliveryEntryKey(event.entryKey)
        : undefined;
    if (site !== undefined && shrineDelivery !== undefined) {
      const sourceOrigin = {
        kind: 'occurrence' as const,
        routeKey: shrineDelivery.routeKey,
        biomeKey: shrineDelivery.biomeKey,
        occurrenceId: shrineDelivery.sourceOccurrenceId,
      };
      const sourceKey = hermesShrineDeliveryEntryKey(sourceOrigin, shrineDelivery.generationKey);
      const due = inputs.sourceBranches.map(
        (branch) => branch.pendingHermesShrineDeliveries[sourceKey],
      );
      const firstDue = due[0];
      const agreedDue =
        firstDue !== undefined &&
        due.length === inputs.sourceBranches.length &&
        due.every(
          (delivery) =>
            delivery !== undefined &&
            semanticAddressKey(delivery.dueAt ?? room.origin) === semanticAddressKey(room.origin),
        )
          ? firstDue
          : undefined;
      const retained = site.entries[event.entryKey];
      const entry = createAcquisitionEntryAddress(site.address, event.entryKey);
      if (
        agreedDue === undefined ||
        retained === undefined ||
        retained === null ||
        retained.offer.rewardType !== agreedDue.rewardType
      ) {
        addFinding('rewardSourceUnavailable', entry, {
          reason: agreedDue === undefined ? 'staleHermesShrineDelivery' : 'retainedSourceMismatch',
        });
        return transitionResult({ branches: inputs.sourceBranches, findings });
      }
      const acquisitionView =
        roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
        roomView.preOutgoing ??
        roomView.entry;
      const settled = settlePickupAcquisitionSite(
        catalog,
        inputs.sourceBranches,
        {
          siteOwner: room.origin,
          site: site.address,
          entries: Object.freeze({ [event.entryKey]: retained }),
          order: Object.freeze([event.entryKey]),
          requiredEntryKeys: new Set([event.entryKey]),
          producerLifecycleKey: 'HermesShrineDelivery',
          historySequence: event.sequence,
          facts: (history, _names, branch) => factsAt(acquisitionView, history, branch),
          findingChronology: chronology,
          authoredSeaStarDuplicateSiteKeys,
        },
        findings,
      );
      const settledEntryKey = semanticAddressKey(entry);
      const branches = settled.branches.map((branch) => {
        const settledThisEntry = branch.events.some(
          (candidate) =>
            (candidate.kind === 'concreteAcquisition' ||
              candidate.kind === 'conversionToGold' ||
              candidate.kind === 'artificerConversion') &&
            candidate.settlement !== undefined &&
            semanticAddressKey(candidate.settlement.entry) === settledEntryKey,
        );
        if (!settledThisEntry) return branch;
        const { [sourceKey]: delivered, ...remaining } = branch.pendingHermesShrineDeliveries;
        void delivered;
        return Object.freeze({
          ...branch,
          pendingHermesShrineDeliveries: Object.freeze(remaining),
        });
      });
      return transitionResult({
        branches,
        findings,
        roleFrontiers: settled.roleFrontiers,
        traitChildSettlements: settled.traitChildSettlements,
      });
    }
    const parsed = parseArtificerReplacementEntryKey(event.entryKey);
    if (site !== undefined && parsed !== undefined) {
      const source = canonicalArtificerSource(room, parsed.sourceKey);
      const replacement = site.entries[event.entryKey];
      if (source === undefined || replacement === undefined)
        throw new BiomeRewardSimulationContractError(
          `${room.gameName} lost Artificer source for ${event.entryKey}`,
        );
      const acquisitionView =
        roomView.acquisitionPoints?.find((point) => point.point === event.point)?.before ??
        roomView.preOutgoing ??
        roomView.entry;
      const row = room.roomActionRoster.rows.find(
        (candidate) =>
          candidate.reference.kind === 'interactAcquisitionEntry' &&
          candidate.reference.siteKey === event.siteKey &&
          candidate.reference.entryKey === event.entryKey,
      );
      const settled = settleArtificerReplacementAcquisition(
        catalog,
        inputs.sourceBranches,
        {
          siteOwner: site.address.owner,
          pointKey: site.address.pointKey,
          sourceEntryKey: parsed.sourceKey,
          sourceOrigin: source.owner,
          sourceReward: source.reward,
          replacement,
          acquisitionRole: parsed.acquisitionRole,
          participation: row?.participation === 'required' ? 'mandatory' : 'optional',
          historySequence: event.sequence,
          facts: (history, _names, branch) => factsAt(acquisitionView, history, branch),
          findingChronology: chronology,
          authoredSeaStarDuplicateSiteKeys,
        },
        findings,
      );
      return transitionResult({
        branches: settled.branches,
        findings,
        roleFrontiers: settled.roleFrontiers,
        traitChildSettlements: settled.traitChildSettlements,
      });
    }
  }
  const currentRow = room.roomActionRoster.rows.find(
    (row) =>
      row.rank !== null &&
      event.point ===
        (row.reference.kind === 'interactShopOffer'
          ? `shopOffer:${row.reference.offerKey}`
          : row.reference.kind === 'interactAcquisitionEntry'
            ? `acquisitionEntry:${row.reference.siteKey}:${row.reference.entryKey}`
            : ''),
  );
  const onlyEntry =
    currentRow?.reference.kind === 'interactAcquisitionEntry'
      ? { siteKey: currentRow.reference.siteKey, entryKey: currentRow.reference.entryKey }
      : currentRow?.reference.kind === 'interactShopOffer'
        ? { siteKey: 'roomExit', entryKey: currentRow.reference.offerKey }
        : undefined;
  const currentRank = currentRow?.rank ?? undefined;
  const completeShopAfterOrder =
    room.entryState?.kind !== 'shop' ||
    currentRank === undefined ||
    !room.roomActionRoster.rows.some(
      (row) =>
        row.rank !== null &&
        row.rank > currentRank &&
        (row.reference.kind === 'interactShopOffer' ||
          (row.reference.kind === 'interactAcquisitionEntry' &&
            row.reference.siteKey === 'roomExit')),
    );
  const authoredSiteSettlement = settleAuthoredAcquisitionSite({
    catalog,
    snapshot,
    room,
    declaration,
    roomView,
    sourceBranches: inputs.sourceBranches,
    historySequence: event.sequence,
    enteredBiomeCount: inputs.enteredBiomeCount,
    routeLoadout: inputs.routeLoadout,
    rewardLookups,
    authoredSeaStarDuplicateSiteKeys,
    ...(onlyEntry === undefined ? {} : { onlyEntry }),
    completeShopAfterOrder,
  });
  return transitionResult({
    branches: authoredSiteSettlement.branches,
    findings,
    authoredSiteSettlement,
  });
}
