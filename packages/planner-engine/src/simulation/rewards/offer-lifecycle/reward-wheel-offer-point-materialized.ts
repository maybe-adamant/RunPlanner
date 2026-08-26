import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../../authored-project/addresses';
import { createUnresolvedAcquisitionRewardState } from '../../../authored-project/traits';
import type { RouteLoadout } from '../../../authored-project/model';
import {
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
  type RewardHistoryState,
} from '../../../reward-kernel';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalResolvedIncomingReward,
  CanonicalRewardWheel,
} from '../../materialization';
import { ownerRegion, type FindingRegionEntry } from '../../finding-regions';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { RewardBranchState } from '../branch-primitives';
import { processOfferGenerationCohort } from '../processing';
import { settleOwnedAcquisitionSite } from '../acquisition-settlement';
import { addRewardFinding, rewardFinding } from '../findings';
import { historyFindingChronology } from '../finding-chronology';
import type { RewardProducerFrontier } from '../producer-frontiers';
import type { ShipLifecycleCandidateContext } from '../lifecycle-artifacts';
import type { RewardLifecycleReferences } from '../prepared-inputs';
import { prepareShipLifecycleCandidateContext, rewardWheelBinding } from './reward-wheel-lifecycle';
import { createBiomeRewardFacts } from '../facts';

export interface RewardWheelOfferPointMaterializationInputs {
  readonly catalog: Catalog;
  readonly event: Extract<HistoryEvent, { readonly kind: 'offerPointMaterialized' }>;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly roomView: ProgressiveRoomHistoryViews;
  readonly lifecycle: RewardLifecycleReferences;
  readonly branches: readonly RewardBranchState[];
  readonly enteredBiomeCount: number;
  readonly routeLoadout: RouteLoadout;
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
}

export interface RewardWheelOfferPointMaterialization {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
  readonly shipLifecycleCandidate?: ShipLifecycleCandidateContext;
}

/** Evaluates one reached non-Shop, non-Fields reward-wheel materialization. */
export function applyRewardWheelOfferPointMaterialization(
  inputs: RewardWheelOfferPointMaterializationInputs,
): RewardWheelOfferPointMaterialization {
  const {
    catalog,
    event,
    room,
    declaration,
    roomView,
    lifecycle,
    branches,
    enteredBiomeCount,
    routeLoadout,
    authoredSeaStarDuplicateSiteKeys,
  } = inputs;
  if (event.offerPoint === 'shopInventory' || event.offerPoint === 'fieldsOptionalRewards')
    throw new BiomeRewardSimulationContractError(
      'reward-wheel transition received a non-wheel point',
    );
  const wheel = room.rewardWheels?.find((candidate) => candidate.wheelKey === event.offerPoint);
  const view = roomView.offerPoints?.find(
    (candidate) => candidate.offerPoint === event.offerPoint,
  )?.before;
  if (wheel === undefined || view === undefined) {
    throw new BiomeRewardSimulationContractError(
      `${room.gameName} has no canonical ${event.offerPoint} materialization`,
    );
  }

  const findings = new Map<string, FindingRegionEntry>();
  const binding = rewardWheelBinding(catalog, declaration, wheel);
  const wheelStateFor = (
    base: (typeof wheel.unresolvedOffers)[number],
    offer: ResolvedRewardOffer,
  ): CanonicalRewardWheel['offers'][number] => {
    const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
      kind: 'producerLifecycle',
      key: wheel.producerLifecycleKey,
    });
    return Object.freeze({
      ...base,
      offer,
      traitOffersByAcquisitionRole: state.traitOffersByAcquisitionRole,
      ...(state.levelResolutionsByAcquisitionRole === undefined
        ? {}
        : { levelResolutionsByAcquisitionRole: state.levelResolutionsByAcquisitionRole }),
      dispositionByAcquisitionRole: state.dispositionByAcquisitionRole,
      traitContext: Object.freeze({
        ...routeLoadout,
        blockGiftBoons: declaration.blockGiftBoons,
        devotionNoDuo: offer.rewardType === 'Devotion',
      }),
    });
  };
  const contextForWheel = (offer: CanonicalRewardWheel['offers'][number]) => ({
    catalog,
    reward: {
      ...offer,
      producerLifecycleKey: wheel.producerLifecycleKey,
      resolvedStoreKey: wheel.storeKey,
    },
    binding,
    historySequence: event.sequence,
    peers: Object.freeze([]),
    facts: (
      branchHistory: RewardHistoryState,
      _shopNames: ReadonlySet<string> | undefined,
      branch: RewardBranchState | undefined,
    ) =>
      createBiomeRewardFacts(
        catalog,
        room,
        room,
        declaration,
        view,
        branchHistory,
        enteredBiomeCount,
        undefined,
        undefined,
        undefined,
        undefined,
        branch,
      ),
  });
  const contexts = wheel.offers.map(contextForWheel);
  const frontierBranches = branches;
  const owners = Object.freeze(
    [...wheel.offers, ...wheel.unresolvedOffers].map((offer) => offer.origin),
  );
  const ownerKeys = new Set(owners.map(semanticAddressKey));
  const acquisitionView = roomView.offerPoints?.find(
    (candidate) => candidate.offerPoint === event.offerPoint,
  )?.acquisitionBefore;
  const acquisitionEvent = lifecycle.wheelsByOwner
    .get(semanticAddressKey(room.origin))
    ?.find((candidate) => candidate.offerPoint === wheel.wheelKey);
  const producerFrontier: RewardProducerFrontier = Object.freeze({
    generationPolicy: 'jointUnordered',
    generationHistorySequence: event.sequence,
    reachableBranchCount: frontierBranches.length,
    acquisitionHorizon:
      acquisitionEvent?.kind !== 'offerPointAcquired' || acquisitionView === undefined
        ? 'generationOnly'
        : 'ownEnteredLifecycle',
    owners,
    resolvedStoreKey: wheel.storeKey,
    evaluateOffer: (owner: SemanticAddress, offer: CanonicalResolvedIncomingReward['offer']) => {
      const ownerKey = semanticAddressKey(owner);
      if (!ownerKeys.has(ownerKey))
        throw new BiomeRewardSimulationContractError(
          'reward-wheel frontier received a foreign owner',
        );
      const candidateFindings = new Map<string, FindingRegionEntry>();
      const focused = [...wheel.offers, ...wheel.unresolvedOffers].find(
        (candidate) => semanticAddressKey(candidate.origin) === ownerKey,
      );
      if (focused === undefined)
        throw new BiomeRewardSimulationContractError('reward-wheel frontier lost its owner');
      const concreteByKey = new Map(
        wheel.offers.map((candidate) => [candidate.offerKey, candidate]),
      );
      const unresolvedByKey = new Map(
        wheel.unresolvedOffers.map((candidate) => [candidate.offerKey, candidate]),
      );
      const offerKeys = Object.freeze(
        [...wheel.offers, ...wheel.unresolvedOffers]
          .sort((left, right) => left.offerKey.localeCompare(right.offerKey))
          .map((candidate) => candidate.offerKey),
      );
      const store = catalog.rewards.stores.byKey[wheel.storeKey];
      if (store === undefined)
        throw new BiomeRewardSimulationContractError(`unknown wheel store ${wheel.storeKey}`);
      const domain = Object.freeze(
        store.entries.flatMap((entry) =>
          locallyValidRewardOffers(catalog.rewards, entry.rewardType),
        ),
      );
      const proposals: CanonicalRewardWheel['offers'][number][][] = [];
      const build = (index: number, values: CanonicalRewardWheel['offers'][number][]): void => {
        if (proposals.length > 0) return;
        if (index === offerKeys.length) {
          proposals.push(values);
          return;
        }
        const key = offerKeys[index]!;
        const concrete = concreteByKey.get(key);
        const unresolved = unresolvedByKey.get(key);
        const offers =
          key === focused.offerKey
            ? Object.freeze([offer])
            : concrete === undefined
              ? domain
              : Object.freeze([concrete.offer]);
        for (const candidateOffer of offers) {
          const candidate =
            concrete !== undefined && candidateOffer === concrete.offer
              ? concrete
              : unresolved === undefined
                ? Object.freeze({ ...concrete!, offer: candidateOffer })
                : wheelStateFor(unresolved, candidateOffer);
          const trialFindings = new Map<string, FindingRegionEntry>();
          const trial = processOfferGenerationCohort(
            frontierBranches,
            [...values, candidate].map(contextForWheel),
            trialFindings,
            { ordering: 'allOffers', atomicRegion: ownerRegion(wheel.origin) },
          );
          if (trial.length === 0) continue;
          build(index + 1, [...values, candidate]);
          if (proposals.length > 0) return;
        }
      };
      build(0, []);
      const candidateBranches = processOfferGenerationCohort(
        frontierBranches,
        (proposals[0] ?? []).map(contextForWheel),
        candidateFindings,
        { ordering: 'allOffers', atomicRegion: ownerRegion(wheel.origin) },
      );
      const selectedOffer = (proposals[0] ?? []).find(
        (candidate) => semanticAddressKey(candidate.origin) === ownerKey,
      );
      if (
        candidateBranches.length > 0 &&
        selectedOffer?.picked === true &&
        acquisitionView !== undefined &&
        acquisitionEvent?.kind === 'offerPointAcquired'
      ) {
        const source = Object.freeze({
          ...selectedOffer,
          offer,
          producerLifecycleKey: wheel.producerLifecycleKey,
          instanceProvenance: 'free',
        });
        settleOwnedAcquisitionSite(
          catalog,
          candidateBranches,
          {
            siteOwner: wheel.origin,
            pointKey: wheel.wheelKey,
            entryKey: 'picked',
            source,
            historySequence: acquisitionEvent.sequence,
            authoredSeaStarDuplicateSiteKeys,
          },
          (branchHistory) =>
            createBiomeRewardFacts(
              catalog,
              room,
              room,
              declaration,
              acquisitionView,
              branchHistory,
              enteredBiomeCount,
            ),
          candidateFindings,
          ownerRegion(wheel.origin),
        );
      }
      return Object.freeze({
        findings: Object.freeze(
          [...candidateFindings.values()]
            .map((entry) => entry.finding)
            .filter((finding) => finding.code !== 'traitOfferMissing'),
        ),
        supported: proposals.length > 0,
      });
    },
  });

  const nextBranches =
    wheel.unresolvedOffers.length > 0
      ? Object.freeze([])
      : processOfferGenerationCohort(branches, contexts, findings, {
          ordering: 'allOffers',
          atomicRegion: ownerRegion(wheel.origin),
        });
  if (wheel.unresolvedOffers.length > 0) {
    for (const unresolved of wheel.unresolvedOffers) {
      addRewardFinding(
        findings,
        rewardFinding('rewardMissing', unresolved.origin, {}),
        ownerRegion(wheel.origin),
        historyFindingChronology(event.sequence),
      );
    }
  }
  const shipLifecycleCandidate =
    room.rewardWheels?.[0] !== wheel
      ? undefined
      : prepareShipLifecycleCandidateContext({
          catalog,
          room,
          declaration,
          roomView,
          lifecycle,
          branchesBeforeFirstWheel: branches,
          enteredBiomeCount,
          routeLoadout: Object.freeze({
            ...routeLoadout,
            ...(declaration.boonRarityOverride === undefined
              ? {}
              : { boonRarityRoomOverride: declaration.boonRarityOverride }),
          }),
        });
  return Object.freeze({
    branches: nextBranches,
    findings: Object.freeze([...findings.values()]),
    producerFrontiers: Object.freeze([producerFrontier]),
    ...(shipLifecycleCandidate === undefined ? {} : { shipLifecycleCandidate }),
  });
}
