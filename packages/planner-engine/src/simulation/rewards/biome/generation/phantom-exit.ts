import type { Catalog } from '../../../../catalog-schema';
import {
  semanticAddressKey,
  type PhantomExitAddress,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import {
  phantomPlaceholderDraw,
  phantomPlaceholderRewardTypes,
} from '../../../../authored-project/phantom-exit';
import { locallyValidRewardOffers, type ResolvedRewardOffer } from '../../../../reward-kernel';
import type { HistoryEvent, HistoryStateView } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import {
  phantomPlaceholderCandidates,
  type PhantomPlaceholderCandidate,
} from '../../../generation/phantom-exit';
import { withBag, type RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches } from '../../branch-lifecycle';
import { createBiomeRewardFacts } from '../../facts';
import { addRewardFinding, historyChronology, rewardFinding } from '../../findings';
import {
  explainRewardOfferExclusions,
  processRewardOffer,
  type OfferProcessingContext,
  type OfferProcessingPeer,
} from '../../offer-generation';
import {
  createRewardProducerCandidateResult,
  type RewardProducerFrontier,
} from '../../producer-frontiers';
import type { PhantomExitSettlement } from '../../model';
import type { SimulationState } from '../../../state/model';
import { BiomeRewardSimulationContractError } from '../biome-contract';

export interface PhantomExitTransition {
  readonly branches: readonly RewardBranchState[];
  /** The drawn offer, a prior door of the same unlock for the side doors that follow. */
  readonly peers: readonly OfferProcessingPeer[];
  readonly findings: readonly FindingRegionEntry[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
  readonly settlement: PhantomExitSettlement;
}

function sameOffer(left: ResolvedRewardOffer, right: ResolvedRewardOffer): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Settles one hidden return door at its room's first doors unlock: the
 * placeholder `ChooseNextRoomData` created and, unless its fixed or Shop
 * reward returns first, one ordinary draw from its own store with every
 * native side effect (removal, refill, priorities, offer projection). The
 * placeholder is never entered or acquired.
 */
export function applyPhantomExitTransition(inputs: {
  readonly catalog: Catalog;
  readonly event: Extract<HistoryEvent, { readonly kind: 'phantomExitCreated' }>;
  readonly room: CanonicalAuthoredRoom | undefined;
  /** History immediately before the door is filled. */
  readonly view: HistoryStateView | undefined;
  readonly branches: readonly RewardBranchState[];
}): PhantomExitTransition {
  const { catalog, event, room, view } = inputs;
  const phantom = room?.phantomExit;
  const declaration = room === undefined ? undefined : catalog.rooms.byKey[room.gameName];
  if (
    room === undefined ||
    phantom === undefined ||
    declaration === undefined ||
    view === undefined ||
    semanticAddressKey(phantom.origin) !== semanticAddressKey(event.owner)
  )
    throw new BiomeRewardSimulationContractError(
      `${semanticAddressKey(event.owner)} lost its entered room or history`,
    );
  const owner: PhantomExitAddress = phantom.origin;
  const chronology = historyChronology(event.sequence);
  const region = ownerRegion(owner);
  const findings = new Map<string, FindingRegionEntry>();
  const placeholderCandidates: readonly PhantomPlaceholderCandidate[] =
    phantomPlaceholderCandidates(catalog, declaration, view);
  const placeholder = event.placeholderRoomGameName;
  const draw = phantomPlaceholderDraw(catalog, placeholder);
  const baseSettlement = {
    owner,
    historySequence: event.sequence,
    placeholderRoomGameName: placeholder,
    placeholderPinned: event.pinned,
    placeholderCandidates,
    rewardPinned: phantom.rewardType !== null,
    ...(draw === undefined ? {} : { storeKey: draw.storeKey }),
  };
  const exclusion = placeholderCandidates.find(
    (candidate) => candidate.roomGameName === placeholder,
  )?.exclusion;
  if (exclusion !== undefined) {
    addRewardFinding(
      findings,
      rewardFinding('phantomExitPlaceholderUnavailable', owner, {
        placeholderRoomGameName: placeholder,
        exclusion,
      }),
      region,
      chronology,
    );
    return Object.freeze({
      branches: Object.freeze([]),
      peers: Object.freeze([]),
      findings: Object.freeze([...findings.values()]),
      producerFrontiers: Object.freeze([]),
      settlement: Object.freeze({ ...baseSettlement, offers: Object.freeze([]) }),
    });
  }
  if (draw === undefined)
    return Object.freeze({
      branches: advanceRewardBranches(inputs.branches, event.sequence),
      peers: Object.freeze([]),
      findings: Object.freeze([]),
      producerFrontiers: Object.freeze([]),
      settlement: Object.freeze({ ...baseSettlement, offers: Object.freeze([]) }),
    });

  const facts = (state: SimulationState) =>
    createBiomeRewardFacts({
      catalog,
      state,
      source: room,
      currentRoom: room,
      sourceDeclaration: declaration,
      view,
      hubBoardLookups: 'notConsulted',
    });
  // The return door sorts first in its unlock, so no earlier door shares its draw.
  const contextFor = (offer: ResolvedRewardOffer): OfferProcessingContext =>
    Object.freeze({
      catalog,
      reward: Object.freeze({
        origin: owner,
        offer,
        producerLifecycleKey: draw.binding.producerLifecycleKey,
        resolvedStoreKey: draw.storeKey,
      }),
      binding: draw.binding,
      historySequence: event.sequence,
      findingChronology: chronology,
      peers: Object.freeze([]),
      facts,
    });
  const declaredTypes = phantomPlaceholderRewardTypes(catalog, placeholder);
  const store = catalog.rewards.stores.byKey[draw.storeKey];
  // An unpinned draw takes the type with the most entries left in the bag as it
  // stands (ties in declaration order), so it least often exhausts a type a
  // later door draws; each type's payloads follow their declared order.
  const rewardTypesFor = (branch: RewardBranchState): readonly string[] => {
    if (phantom.rewardType !== null) return [phantom.rewardType];
    const bag = withBag(catalog, branch, draw.storeKey)?.bag;
    const remaining = new Map<string, number>();
    store?.entries.forEach((entry, index) =>
      remaining.set(
        entry.rewardType,
        (remaining.get(entry.rewardType) ?? 0) + (bag?.remainingEntryCounts[index] ?? 0),
      ),
    );
    return [...declaredTypes].sort(
      (left, right) => (remaining.get(right) ?? 0) - (remaining.get(left) ?? 0),
    );
  };
  const next: RewardBranchState[] = [];
  const offers: ResolvedRewardOffer[] = [];
  for (const branch of inputs.branches) {
    let drawn = false;
    const orderedOffers = rewardTypesFor(branch).flatMap((rewardType) =>
      locallyValidRewardOffers(catalog.rewards, rewardType),
    );
    for (const offer of orderedOffers) {
      const survivors = processRewardOffer([branch], contextFor(offer), new Map());
      if (survivors.length === 0) continue;
      next.push(...survivors);
      if (!offers.some((known) => sameOffer(known, offer))) offers.push(offer);
      drawn = true;
      break;
    }
    if (!drawn)
      addRewardFinding(
        findings,
        rewardFinding('phantomExitRewardUnavailable', owner, {
          placeholderRoomGameName: placeholder,
          ...(phantom.rewardType === null ? {} : { rewardType: phantom.rewardType }),
        }),
        region,
        chronology,
      );
  }
  const branches = findings.size > 0 ? Object.freeze([]) : Object.freeze(next);

  const frontierBranches = inputs.branches;
  const ownerKey = semanticAddressKey(owner);
  const producerFrontiers: readonly RewardProducerFrontier[] = Object.freeze([
    Object.freeze({
      generationPolicy: 'sequential' as const,
      generationHistorySequence: event.sequence,
      reachableBranchCount: frontierBranches.length,
      acquisitionHorizon: 'generationOnly' as const,
      owners: Object.freeze([owner]),
      resolvedStoreKey: draw.storeKey,
      evaluateOffer: (candidate: SemanticAddress, offer: ResolvedRewardOffer) => {
        if (semanticAddressKey(candidate) !== ownerKey)
          throw new BiomeRewardSimulationContractError(
            'phantom exit frontier received a foreign owner',
          );
        const candidateFindings = new Map<string, FindingRegionEntry>();
        const context = contextFor(offer);
        const candidateBranches = processRewardOffer(frontierBranches, context, candidateFindings);
        return createRewardProducerCandidateResult(
          candidateFindings,
          candidateBranches,
          candidateBranches.length === 0
            ? explainRewardOfferExclusions(frontierBranches, context)
            : undefined,
        );
      },
    }),
  ]);
  const settledOffers = Object.freeze(offers);
  return Object.freeze({
    branches,
    peers:
      branches.length === 0
        ? Object.freeze([])
        : Object.freeze(settledOffers.map((offer) => Object.freeze({ origin: owner, offer }))),
    findings: Object.freeze([...findings.values()]),
    producerFrontiers,
    settlement: Object.freeze({ ...baseSettlement, offers: settledOffers }),
  });
}
