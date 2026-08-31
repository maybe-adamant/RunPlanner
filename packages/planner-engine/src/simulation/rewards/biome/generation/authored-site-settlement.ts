import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import type { RouteLoadout } from '../../../../authored-project/model';
import {
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
} from '../../../../authored-project/artificer';
import {
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  parseSeaStarDuplicateSiteKey,
  seaStarDuplicateUsesFreshObject,
} from '../../../../authored-project/sea-star';
import {
  createUnresolvedAcquisitionRewardState,
  createUnresolvedPickupRewardState,
} from '../../../../authored-project/traits';
import type { ResolvedRewardOffer, RewardHistoryState } from '../../../../reward-kernel';
import type { ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import {
  assessSeaStarDuplication,
  settlePickupAcquisitionSite,
} from '../../acquisition-settlement';
import { settleShopAcquisitionSite } from '../../shop-settlement';
import { addRewardFinding, rewardFinding } from '../../findings';
import type { RewardBranchState } from '../../branch-primitives';
import {
  createRewardProducerCandidateResult,
  type RewardProducerFrontier,
} from '../../producer-frontiers';
import { createBiomeRewardFacts } from '../../facts';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import { canonicalArtificerSource } from '../reward-sources';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import {
  createAuthoredSiteSettlementEmissions,
  type AuthoredSiteSettlementEmissions,
} from './emissions';

export interface AuthoredSiteSettlementResult {
  readonly branches: readonly RewardBranchState[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
  readonly emissions: AuthoredSiteSettlementEmissions;
}

export interface AuthoredSiteSettlementInputs {
  readonly catalog: Catalog;
  readonly snapshot: import('../evaluation-contract').BiomeRewardSnapshot;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly roomView: ProgressiveRoomHistoryViews;
  readonly sourceBranches: readonly RewardBranchState[];
  readonly historySequence: number;
  readonly enteredBiomeCount: number;
  readonly routeLoadout: RouteLoadout;
  readonly rewardLookups: Readonly<Record<string, ReadonlySet<string>>>;
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
  readonly onlyEntry?: { readonly siteKey: string; readonly entryKey: string };
  readonly completeShopAfterOrder?: boolean;
  readonly activationOnly?: boolean;
}

function contractFail(detail: string): never {
  throw new BiomeRewardSimulationContractError(detail);
}

export function settleAuthoredAcquisitionSite(
  inputs: AuthoredSiteSettlementInputs,
): AuthoredSiteSettlementResult {
  const {
    catalog,
    snapshot,
    room,
    declaration,
    roomView,
    sourceBranches,
    historySequence,
    enteredBiomeCount,
    routeLoadout,
    rewardLookups,
    authoredSeaStarDuplicateSiteKeys,
    onlyEntry,
    completeShopAfterOrder = true,
    activationOnly = false,
  } = inputs;
  const targetFindings = new Map<string, FindingRegionEntry>();
  const acquisitionRoleFrontiers: import('../../acquisition-settlement').AcquisitionRoleFrontier[] =
    [];
  const derivedEntryFrontiers: import('../../acquisition-settlement').DerivedAcquisitionEntryFrontier[] =
    [];
  const traitChildSettlements: import('../../trait-settlement').ReachedTraitChildCheckpoint[] = [];
  const runtimeOfferFallbacks: import('./emissions').RuntimeOfferFallbackEmission[] = [];
  const producerFrontiers: RewardProducerFrontier[] = [];

  function settle(): readonly RewardBranchState[] {
    if (Object.keys(room.acquisitionSites).length === 0 && room.entryState?.kind !== 'shop') {
      return sourceBranches;
    }
    const selectedSiteKey = onlyEntry?.siteKey ?? Object.keys(room.acquisitionSites)[0];
    const selectedSite =
      selectedSiteKey === undefined ? undefined : room.acquisitionSites[selectedSiteKey];
    const producer = room.pickupProducers?.find(
      (candidate) => candidate.siteKey === selectedSiteKey,
    );
    const seaStarDuplicate =
      selectedSiteKey === undefined ? undefined : parseSeaStarDuplicateSiteKey(selectedSiteKey);
    if (selectedSite !== undefined && seaStarDuplicate !== undefined) {
      const duplicateEntry = selectedSite.entries[SEA_STAR_DUPLICATE_ENTRY_KEY];
      if (duplicateEntry === undefined || duplicateEntry === null) return sourceBranches;
      const source = canonicalArtificerSource(room, seaStarDuplicate.sourceKey);
      if (source === undefined)
        throw new BiomeRewardSimulationContractError(
          `${room.gameName} lost Sea Star source for ${selectedSiteKey}`,
        );
      const sourceAddress = createAcquisitionRoleAddress(
        source.owner,
        seaStarDuplicate.acquisitionRole,
      );
      const sourceAddressKey = semanticAddressKey(sourceAddress);
      // A direct Shop offer is paid and therefore remains a repair-only
      // authored result. A free acquisition entry generated in a Shop uses
      // its own lifecycle and settles like any other free source.
      if (source.owner.kind === 'shopOffer') return sourceBranches;
      const duplicateUsesFreshObject = seaStarDuplicateUsesFreshObject(
        catalog,
        source.reward,
        seaStarDuplicate.acquisitionRole,
      );
      const producerLifecycleKey = duplicateUsesFreshObject
        ? 'RoomReward'
        : source.producerLifecycleKey;
      if (producerLifecycleKey === undefined)
        throw new BiomeRewardSimulationContractError(
          `${room.gameName} lost Sea Star producer lifecycle for ${selectedSiteKey}`,
        );
      const forfeitApplied = sourceBranches.every((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'rewardForfeited' &&
            semanticAddressKey(event.origin) === semanticAddressKey(source.owner) &&
            event.replacementRewardType === 'RoomRewardConsolationPrize',
        ),
      );
      const effectiveDuplicateEntry = forfeitApplied
        ? createUnresolvedPickupRewardState(
            catalog,
            { rewardType: 'RoomRewardConsolationPrize' },
            producerLifecycleKey,
          )
        : duplicateEntry;
      // The duplicate can be placed after other room actions. Its eligibility
      // is nevertheless the source's own pre-acquisition attestation, not
      // whatever traits happen to be equipped at this later action.
      const supportedBranches = sourceBranches.filter(
        (branch) => branch.seaStarDuplicateEligibilityBySource?.[sourceAddressKey]?.supported,
      );
      if (supportedBranches.length !== sourceBranches.length) {
        const unsupported = sourceBranches.find(
          (branch) => !branch.seaStarDuplicateEligibilityBySource?.[sourceAddressKey]?.supported,
        );
        if (unsupported !== undefined) {
          addRewardFinding(
            targetFindings,
            rewardFinding(
              'seaStarDuplicationUnavailable',
              sourceAddress,
              unsupported.seaStarDuplicateEligibilityBySource?.[sourceAddressKey]?.evidence ??
                Object.freeze({ reason: 'sourceFrontierNotReached' }),
            ),
            ownerRegion(sourceAddress),
            rewardFindingChronologyForRoom(
              snapshot,
              room.origin,
              historySequence,
              'localRoomLifecycle',
            ),
          );
        }
      }
      if (supportedBranches.length === 0) return sourceBranches;
      const pickupFacts = (branchHistory: RewardHistoryState) =>
        createBiomeRewardFacts(
          catalog,
          room,
          room,
          declaration,
          roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
          branchHistory,
          enteredBiomeCount,
        );
      const settled = settlePickupAcquisitionSite(
        catalog,
        supportedBranches,
        {
          siteOwner: room.origin,
          site: selectedSite.address,
          entries: Object.freeze({ [SEA_STAR_DUPLICATE_ENTRY_KEY]: effectiveDuplicateEntry }),
          order: activationOnly ? Object.freeze([]) : Object.freeze([SEA_STAR_DUPLICATE_ENTRY_KEY]),
          producerLifecycleKey,
          producerByEntryKey: Object.freeze({
            [SEA_STAR_DUPLICATE_ENTRY_KEY]: Object.freeze({
              kind: 'seaStarDuplicate' as const,
              sourceOwner: source.owner,
              sourceRole: seaStarDuplicate.acquisitionRole,
            }),
          }),
          requiredEntryKeys: new Set(
            forfeitApplied || duplicateUsesFreshObject ? [SEA_STAR_DUPLICATE_ENTRY_KEY] : [],
          ),
          seaStarDuplicateEntryKeys: new Set([SEA_STAR_DUPLICATE_ENTRY_KEY]),
          authoredSeaStarDuplicateSiteKeys,
          historySequence,
          findingChronology: rewardFindingChronologyForRoom(
            snapshot,
            room.origin,
            historySequence,
            'localRoomLifecycle',
          ),
          facts: pickupFacts,
          traitContext: routeLoadout,
        },
        targetFindings,
      );
      acquisitionRoleFrontiers.push(...(settled.roleFrontiers ?? []));
      traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
      return Object.freeze([
        ...sourceBranches.filter((branch) => !supportedBranches.includes(branch)),
        ...settled.branches,
      ]);
    }
    if (room.entryState?.kind !== 'shop') {
      if (selectedSite === undefined || selectedSiteKey === undefined) return sourceBranches;
      if (producer === undefined) return sourceBranches;
      const sourceWasNormallyAcquired = producer.sourceNormal;
      // A selected producer is structural authoring detail. Its pickup site
      // becomes live only for that exact normal participating acquisition;
      // Time Piece, Artificer, and an unpicked optional source do not create it.
      if (!sourceWasNormallyAcquired) return sourceBranches;
      const requiredEntryKeys = new Set(
        producer.pickups.filter((pickup) => pickup.required).map((pickup) => pickup.key),
      );
      const echoReplay = producer.traitKey === 'EchoLastReward';
      const replayEntryKey = echoReplay ? producer.pickups[0]?.key : undefined;
      const replayEntry =
        replayEntryKey === undefined ? undefined : selectedSite.entries[replayEntryKey];
      const replaySources = echoReplay
        ? sourceBranches.map((branch) => branch.history.lastRewardRecreation)
        : Object.freeze([]);
      const firstReplay = replaySources[0];
      const agreedReplay =
        firstReplay !== undefined &&
        replaySources.length === sourceBranches.length &&
        replaySources.every(
          (candidate) => JSON.stringify(candidate) === JSON.stringify(firstReplay),
        )
          ? firstReplay
          : undefined;
      const replaySourceMismatch =
        echoReplay &&
        (agreedReplay === undefined ||
          (replayEntry !== undefined &&
            replayEntry !== null &&
            JSON.stringify(replayEntry.offer) !== JSON.stringify(agreedReplay.offer)));
      const pickupFacts = (branchHistory: RewardHistoryState) =>
        createBiomeRewardFacts(
          catalog,
          room,
          room,
          declaration,
          roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
          branchHistory,
          enteredBiomeCount,
        );
      const findingChronology = rewardFindingChronologyForRoom(
        snapshot,
        room.origin,
        historySequence,
        'localRoomLifecycle',
      );
      if (echoReplay && replayEntryKey !== undefined && agreedReplay !== undefined) {
        const replayAddress = createAcquisitionEntryAddress(selectedSite.address, replayEntryKey);
        const fixedReward = createUnresolvedAcquisitionRewardState(catalog, agreedReplay.offer, {
          kind: 'producerLifecycle',
          key: 'EchoLastReward',
        });
        derivedEntryFrontiers.push(
          ...sourceBranches.map((branch) =>
            Object.freeze({
              address: replayAddress,
              kind: 'echoLastReward' as const,
              branchCohortSize: sourceBranches.length,
              rewardTypes: Object.freeze([agreedReplay.offer.rewardType]),
              fixedReward,
              retainedSourceMismatch:
                replayEntry !== undefined &&
                replayEntry !== null &&
                JSON.stringify(replayEntry.offer) !== JSON.stringify(agreedReplay.offer),
              branchesBeforeEntry: Object.freeze([branch]),
            }),
          ),
        );
      }
      if (replaySourceMismatch && replayEntryKey !== undefined) {
        const replayAddress = createAcquisitionEntryAddress(selectedSite.address, replayEntryKey);
        addRewardFinding(
          targetFindings,
          rewardFinding('rewardSourceUnavailable', replayAddress, {
            reason: agreedReplay === undefined ? 'branchDivergence' : 'retainedSourceMismatch',
            ...(agreedReplay === undefined ? {} : { rewardType: agreedReplay.offer.rewardType }),
          }),
          ownerRegion(replayAddress),
          findingChronology,
        );
      }
      const pickupEntries =
        onlyEntry === undefined || onlyEntry.entryKey.length === 0
          ? selectedSite.entries
          : Object.freeze({
              [onlyEntry.entryKey]: selectedSite.entries[onlyEntry.entryKey] ?? null,
            });
      const settled = settlePickupAcquisitionSite(
        catalog,
        sourceBranches,
        {
          siteOwner: room.origin,
          site: selectedSite.address,
          entries: pickupEntries,
          order: activationOnly
            ? Object.freeze([])
            : onlyEntry === undefined || onlyEntry.entryKey.length === 0
              ? Object.freeze(
                  room.roomActions.order.flatMap((reference) =>
                    reference.kind === 'interactAcquisitionEntry' &&
                    reference.siteKey === selectedSiteKey
                      ? [reference.entryKey]
                      : [],
                  ),
                )
              : Object.freeze([onlyEntry.entryKey]),
          producerLifecycleKey: producer.producerLifecycleKey,
          ...(echoReplay && replayEntryKey !== undefined
            ? {
                producerByEntryKey: Object.freeze({
                  [replayEntryKey]: Object.freeze({
                    kind: 'echoLastReward' as const,
                    sourceOwner: producer.source,
                    sourceRole: 'self',
                  }),
                }),
              }
            : {}),
          authoredSeaStarDuplicateSiteKeys,
          requiredEntryKeys,
          historySequence,
          findingChronology,
          facts: pickupFacts,
          traitContext: routeLoadout,
          publishUnpickedChildFrontiers: activationOnly,
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
        targetFindings,
      );
      if (!replaySourceMismatch) {
        acquisitionRoleFrontiers.push(...(settled.roleFrontiers ?? []));
        traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
      }
      for (const frontier of activationOnly ? (settled.pickupEntryFrontiers ?? []) : []) {
        const entryKey = semanticAddressKey(frontier.address);
        producerFrontiers.push(
          Object.freeze({
            generationPolicy: 'sequential',
            generationHistorySequence: historySequence,
            reachableBranchCount: frontier.branchesBeforeEntry.length,
            acquisitionHorizon: 'ownEnteredLifecycle',
            owners: Object.freeze([frontier.address]),
            evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
              if (semanticAddressKey(owner) !== entryKey) {
                return contractFail('pickup reward frontier received a foreign owner');
              }
              // A pickup producer fixes its reward identity. Candidate editing
              // resolves only its declaration-compatible payload at this
              // exact site frontier; pickup order independently decides
              // whether the completed entry is acquired.
              const fixedRewardType = echoReplay
                ? agreedReplay?.offer.rewardType
                : (frontier.reward?.offer.rewardType ??
                  producer.pickups.find((pickup) => pickup.key === frontier.address.entryKey)
                    ?.rewardType);
              if (
                fixedRewardType === undefined ||
                offer.rewardType !== fixedRewardType ||
                (echoReplay && JSON.stringify(offer) !== JSON.stringify(agreedReplay?.offer))
              ) {
                return Object.freeze({ findings: Object.freeze([]), supported: false });
              }
              const candidateFindings = new Map<string, FindingRegionEntry>();
              const candidateBranches = settlePickupAcquisitionSite(
                catalog,
                frontier.branchesBeforeEntry,
                {
                  siteOwner: room.origin,
                  site: selectedSite.address,
                  entries: Object.freeze({
                    [frontier.address.entryKey]: createUnresolvedPickupRewardState(
                      catalog,
                      offer,
                      producer.producerLifecycleKey,
                    ),
                  }),
                  order: room.roomActions.order.some(
                    (reference) =>
                      reference.kind === 'interactAcquisitionEntry' &&
                      reference.siteKey === selectedSiteKey &&
                      reference.entryKey === frontier.address.entryKey,
                  )
                    ? Object.freeze([frontier.address.entryKey])
                    : Object.freeze([]),
                  producerLifecycleKey: producer.producerLifecycleKey,
                  authoredSeaStarDuplicateSiteKeys,
                  requiredEntryKeys,
                  historySequence,
                  findingChronology,
                  publishUnpickedChildFrontiers: false,
                  facts: pickupFacts,
                  traitContext: routeLoadout,
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
              ).branches;
              return createRewardProducerCandidateResult(candidateFindings, candidateBranches);
            },
          }),
        );
      }
      return replaySourceMismatch ? Object.freeze([]) : settled.branches;
    }
    const settlementRoom = room;
    const settled = settleShopAcquisitionSite(
      sourceBranches,
      {
        catalog,
        room: settlementRoom,
        order: activationOnly
          ? Object.freeze([])
          : onlyEntry === undefined
            ? Object.freeze(
                room.roomActions.order.flatMap((reference) =>
                  reference.kind === 'interactShopOffer' ? [reference.offerKey] : [],
                ),
              )
            : Object.freeze([onlyEntry.entryKey]),
        completeAfterOrder: completeShopAfterOrder,
        authoredSeaStarDuplicateSiteKeys,
        declaration,
        historySequence,
        findingChronology: rewardFindingChronologyForRoom(
          snapshot,
          room.origin,
          historySequence,
          'localRoomLifecycle',
        ),
        facts: (branchHistory, shopNames = new Set(), branch) =>
          createBiomeRewardFacts(
            catalog,
            settlementRoom,
            settlementRoom,
            declaration,
            roomView.outgoingGeneration ?? roomView.preOutgoing ?? roomView.entry,
            branchHistory,
            enteredBiomeCount,
            shopNames,
            undefined,
            undefined,
            rewardLookups,
            branch,
          ),
        fail: contractFail,
      },
      targetFindings,
    );
    // Shop-spawned objects cannot duplicate. Their structurally retained
    // result stays available for repair, but has no active child action; use
    // the captured source frontiers to publish the source-role finding.
    for (const siteKey of Object.keys(room.acquisitionSites)) {
      const seaStarDuplicate = parseSeaStarDuplicateSiteKey(siteKey);
      if (seaStarDuplicate === undefined) continue;
      const source = canonicalArtificerSource(room, seaStarDuplicate.sourceKey);
      if (source === undefined) continue;
      const sourceAddress = createAcquisitionRoleAddress(
        source.owner,
        seaStarDuplicate.acquisitionRole,
      );
      if (
        source.reward.dispositionByAcquisitionRole[seaStarDuplicate.acquisitionRole]?.kind !==
        'normal'
      )
        continue;
      const unsupportedFromFrontier = (settled.roleFrontiers ?? [])
        .filter(
          (frontier) => semanticAddressKey(frontier.address) === semanticAddressKey(sourceAddress),
        )
        .flatMap((frontier) =>
          frontier.branchesBeforeRole.map((branch) =>
            assessSeaStarDuplication(catalog, branch, frontier.source, {
              role: seaStarDuplicate.acquisitionRole,
              lifecyclePoint: frontier.lifecyclePoint,
            }),
          ),
        )
        .find((assessment) => !assessment.supported);
      const sourceOfferKey = source.owner.kind === 'shopOffer' ? source.owner.offerKey : undefined;
      const sourceWasPurchased =
        !activationOnly &&
        sourceOfferKey !== undefined &&
        (onlyEntry === undefined
          ? room.roomActions.order.some(
              (action) => action.kind === 'interactShopOffer' && action.offerKey === sourceOfferKey,
            )
          : onlyEntry.entryKey === sourceOfferKey);
      const unsupported =
        unsupportedFromFrontier ??
        (sourceWasPurchased
          ? sourceBranches
              .map((branch) =>
                assessSeaStarDuplication(
                  catalog,
                  branch,
                  Object.freeze({
                    origin: source.owner,
                    offer: source.reward.offer,
                    producerLifecycleKey: 'Shop',
                    instanceProvenance: 'paid' as const,
                    dispositionByAcquisitionRole: source.reward.dispositionByAcquisitionRole,
                  }),
                  { role: seaStarDuplicate.acquisitionRole, lifecyclePoint: 'purchase' },
                ),
              )
              .find((assessment) => !assessment.supported)
          : undefined);
      if (unsupported === undefined) continue;
      addRewardFinding(
        targetFindings,
        rewardFinding('seaStarDuplicationUnavailable', sourceAddress, unsupported.evidence),
        ownerRegion(sourceAddress),
        rewardFindingChronologyForRoom(
          snapshot,
          room.origin,
          historySequence,
          'localRoomLifecycle',
        ),
      );
    }
    acquisitionRoleFrontiers.push(...(settled.roleFrontiers ?? []));
    runtimeOfferFallbacks.push(...(settled.runtimeOfferFallbacks ?? []));
    derivedEntryFrontiers.push(...(settled.derivedEntryFrontiers ?? []));
    traitChildSettlements.push(...(settled.traitChildSettlements ?? []));
    return settled.branches;
  }

  const branches = settle();
  return Object.freeze({
    branches: Object.freeze(branches),
    producerFrontiers: Object.freeze(producerFrontiers),
    emissions: createAuthoredSiteSettlementEmissions({
      acquisitionRoleFrontiers,
      derivedEntryFrontiers,
      traitChildSettlements,
      runtimeOfferFallbacks,
      findings: targetFindings,
    }),
  });
}
