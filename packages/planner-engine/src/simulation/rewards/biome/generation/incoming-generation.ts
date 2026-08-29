import type { Catalog } from '../../../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../../../authored-project/addresses';
import type { RouteLoadout } from '../../../../authored-project/model';
import { createUnresolvedAcquisitionRewardState } from '../../../../authored-project/traits';
import type { ResolvedRewardOffer, RewardHistoryState } from '../../../../reward-kernel';
import type { HistoryEvent, HistoryStateView, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalResolvedIncomingReward } from '../../../materialization';
import { preparedAcquisitionSiteOwner, type RewardLifecycleReferences } from '../prepared-inputs';
import { createBiomeRewardFacts } from '../../facts';
import { rewardFinding } from '../../findings';
import { addRewardFinding } from '../../findings';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import {
  countedBinding,
  processRewardOffer,
  type OfferProcessingContext,
  type OfferProcessingPeer,
} from '../../processing';
import { settleProducerAcquisitionSite } from '../../acquisition-settlement';
import {
  createRewardProducerCandidateResult,
  type RewardProducerFrontier,
} from '../../producer-frontiers';
import type { RewardBranchState } from '../../branch-primitives';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import {
  createGenerationEmissions,
  type GenerationEmissions,
  type PendingHubBoardGeneration,
} from './emissions';
import { historyFindingChronology, rewardFindingChronologyForRoom } from '../finding-chronology';
import type { RoomCreatedRewardContext } from './room-created-context';
import { BiomeRewardSimulationContractError } from '../biome-contract';

function incomingCandidateForOffer(
  catalog: Catalog,
  incoming: CanonicalResolvedIncomingReward,
  offer: ResolvedRewardOffer,
): CanonicalResolvedIncomingReward {
  if (JSON.stringify(incoming.offer) === JSON.stringify(offer)) return incoming;
  const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
    kind: 'producerLifecycle',
    key: incoming.producerLifecycleKey,
  });
  return Object.freeze({
    ...incoming,
    ...state,
    traitContext: Object.freeze({
      ...incoming.traitContext,
      devotionNoDuo: offer.rewardType === 'Devotion',
    }),
  });
}

interface IncomingOfferCandidateContext {
  readonly context: OfferProcessingContext;
  readonly room: RoomCreatedRewardContext['room'];
  readonly incoming: CanonicalResolvedIncomingReward;
  readonly acquisitionView?: HistoryStateView;
  readonly producerPoints: readonly Extract<
    HistoryEvent,
    { readonly kind: 'producerPointReached' }
  >[];
}

function completeIncomingOfferCandidate(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  enteredBiomeCount: number,
  authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>,
  entry: IncomingOfferCandidateContext,
  offer: CanonicalResolvedIncomingReward['offer'],
  candidateBranches: readonly RewardBranchState[],
  candidateFindings: Map<string, FindingRegionEntry>,
) {
  let branches = candidateBranches;
  if (
    branches.length > 0 &&
    entry.incoming.acquisitionEnabled !== false &&
    entry.acquisitionView !== undefined
  ) {
    const candidateRoom = Object.freeze({
      ...entry.room,
      incomingReward: Object.freeze({ ...entry.incoming, offer }),
    });
    const lifecycle =
      catalog.rewards.producerLifecycles.byKey[entry.incoming.producerLifecycleKey]?.rewardTypes
        .byKey[offer.rewardType];
    const events =
      lifecycle === undefined
        ? Object.freeze([])
        : Object.freeze(
            lifecycle.acquisitionLifecycle.flatMap((binding) => {
              const reached = entry.producerPoints.find(
                (point) => point.point === binding.lifecyclePoint,
              );
              return reached === undefined
                ? []
                : [
                    Object.freeze({
                      ...reached,
                      rewardType: offer.rewardType,
                      role: binding.role,
                      lifecyclePoint: binding.lifecyclePoint,
                      producerLifecycleKey: entry.incoming.producerLifecycleKey,
                      kind: 'producerRoleAdvanced' as const,
                    }),
                  ];
            }),
          );
    for (const acquisitionEvent of events) {
      if (branches.length === 0) break;
      branches = settleProducerAcquisitionSite(
        catalog,
        branches,
        candidateRoom,
        acquisitionEvent,
        (history) =>
          createBiomeRewardFacts(
            catalog,
            candidateRoom,
            candidateRoom,
            entry.context.catalog.rooms.byKey[candidateRoom.gameName]!,
            entry.acquisitionView!,
            history,
            enteredBiomeCount,
          ),
        candidateFindings,
        (detail) => {
          throw new BiomeRewardSimulationContractError(detail);
        },
        ownerRegion(entry.incoming.origin),
        rewardFindingChronologyForRoom(
          snapshot,
          entry.room.origin,
          acquisitionEvent.sequence,
          'localRoomLifecycle',
        ),
        preparedAcquisitionSiteOwner(snapshot, entry.room),
        authoredSeaStarDuplicateSiteKeys,
      ).branches;
    }
  }
  return createRewardProducerCandidateResult(candidateFindings, branches);
}

/** Generates exactly one resolved or unresolved incoming reward envelope. */
export function generateIncomingReward(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  event: Extract<HistoryEvent, { readonly kind: 'roomCreated' }>,
  context: RoomCreatedRewardContext,
  inputs: {
    readonly branches: readonly RewardBranchState[];
    readonly peers: readonly OfferProcessingPeer[];
    readonly pendingHubBoard?: PendingHubBoardGeneration;
    readonly lifecycle: RewardLifecycleReferences;
    readonly roomViews: ProgressiveRoomHistoryViews | undefined;
    readonly routeLoadout: RouteLoadout;
    readonly enteredBiomeCount: number;
    readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
  },
): GenerationEmissions {
  const findings = new Map<string, FindingRegionEntry>();
  const frontiers: RewardProducerFrontier[] = [];
  const roomKey = semanticAddressKey(context.room.origin);
  const producerPoints = inputs.lifecycle.producerPointsByOwner.get(roomKey) ?? Object.freeze([]);
  const acquisitionView =
    context.incoming?.acquisitionEnabled === false
      ? undefined
      : (inputs.roomViews?.preOutgoing ?? inputs.roomViews?.entry);

  const offerChronology =
    event.source === 'hubTarget'
      ? Object.freeze({
          kind: 'hubBoard' as const,
          history: historyFindingChronology(event.sequence),
        })
      : event.source === 'localVisit'
        ? rewardFindingChronologyForRoom(
            snapshot,
            context.room.origin,
            event.sequence,
            'sideGeneration',
          )
        : undefined;
  const facts = (history: RewardHistoryState, branch?: RewardBranchState) =>
    createBiomeRewardFacts(
      catalog,
      context.source,
      context.currentRoom,
      context.sourceDeclaration,
      context.generationView!,
      history,
      inputs.enteredBiomeCount,
      context.currentShopNames,
      context.source.kind === 'hub' ? context.source.origin : context.peerParentOrigin,
      context.source.kind === 'hub' ? 'hubTarget' : context.peerCreationSource,
      undefined,
      branch,
    );

  if (context.unresolvedIncoming !== undefined) {
    const unresolved = context.unresolvedIncoming;
    const candidateFor = (offer: ResolvedRewardOffer): CanonicalResolvedIncomingReward => {
      const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
        kind: 'producerLifecycle',
        key: unresolved.producerLifecycleKey,
      });
      return Object.freeze({
        ...unresolved,
        kind: 'resolved' as const,
        offer,
        traitOffersByAcquisitionRole: state.traitOffersByAcquisitionRole,
        ...(state.levelResolutionsByAcquisitionRole === undefined
          ? {}
          : { levelResolutionsByAcquisitionRole: state.levelResolutionsByAcquisitionRole }),
        dispositionByAcquisitionRole: state.dispositionByAcquisitionRole,
        traitContext: Object.freeze({
          ...inputs.routeLoadout,
          blockGiftBoons: context.declaration.blockGiftBoons,
          devotionNoDuo: offer.rewardType === 'Devotion',
        }),
      });
    };
    if (event.source === 'hubTarget') {
      const pending =
        inputs.pendingHubBoard ??
        Object.freeze({ frontierBranches: inputs.branches, participants: Object.freeze([]) });
      return createGenerationEmissions(
        inputs.branches,
        inputs.peers,
        findings,
        frontiers,
        Object.freeze({
          frontierBranches: pending.frontierBranches,
          participants: Object.freeze([
            ...pending.participants,
            Object.freeze({
              kind: 'unresolved' as const,
              declaration: context.declaration,
              incoming: unresolved,
              historySequence: event.sequence,
              facts,
              candidateFor,
            }),
          ]),
        }),
      );
    }
    const ownerKey = semanticAddressKey(unresolved.origin);
    frontiers.push(
      Object.freeze({
        generationPolicy: 'sequential',
        generationHistorySequence: event.sequence,
        reachableBranchCount: inputs.branches.length,
        acquisitionHorizon:
          acquisitionView === undefined ? 'generationOnly' : 'ownEnteredLifecycle',
        owners: Object.freeze([unresolved.origin]),
        ...(unresolved.resolvedStoreKey === undefined
          ? {}
          : { resolvedStoreKey: unresolved.resolvedStoreKey }),
        evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
          if (semanticAddressKey(owner) !== ownerKey)
            throw new BiomeRewardSimulationContractError(
              'unresolved reward frontier received a foreign owner',
            );
          const candidate = candidateFor(offer);
          const candidateFindings = new Map<string, FindingRegionEntry>();
          const candidateBinding = countedBinding(context.declaration, candidate);
          const candidateContext: OfferProcessingContext = Object.freeze({
            catalog,
            reward: candidate,
            ...(candidateBinding === undefined ? {} : { binding: candidateBinding }),
            historySequence: event.sequence,
            ...(offerChronology === undefined ? {} : { findingChronology: offerChronology }),
            peers: inputs.peers,
            facts: (history: RewardHistoryState) => facts(history),
          });
          const branches = processRewardOffer(inputs.branches, candidateContext, candidateFindings);
          return completeIncomingOfferCandidate(
            catalog,
            snapshot,
            inputs.enteredBiomeCount,
            inputs.authoredSeaStarDuplicateSiteKeys,
            Object.freeze({
              context: candidateContext,
              room: context.room,
              incoming: candidate,
              ...(acquisitionView === undefined ? {} : { acquisitionView }),
              producerPoints,
            }),
            offer,
            branches,
            candidateFindings,
          );
        },
      }),
    );
    addRewardFinding(
      findings,
      rewardFinding('rewardMissing', unresolved.origin, {}),
      ownerRegion(unresolved.origin),
      offerChronology ?? historyFindingChronology(event.sequence),
    );
    return createGenerationEmissions(Object.freeze([]), inputs.peers, findings, frontiers);
  }

  const incoming = context.incoming;
  if (incoming === undefined)
    return createGenerationEmissions(
      inputs.branches,
      inputs.peers,
      findings,
      frontiers,
      inputs.pendingHubBoard,
    );
  const binding = countedBinding(context.declaration, incoming);
  const offerContext: OfferProcessingContext = Object.freeze({
    catalog,
    reward: incoming,
    ...(binding === undefined ? {} : { binding }),
    historySequence: event.sequence,
    ...(offerChronology === undefined ? {} : { findingChronology: offerChronology }),
    peers: inputs.peers,
    facts: (
      history: RewardHistoryState,
      _shopNames: ReadonlySet<string> | undefined,
      branch: RewardBranchState | undefined,
    ) => facts(history, branch),
  });
  if (event.source === 'hubTarget') {
    const pending =
      inputs.pendingHubBoard ??
      Object.freeze({ frontierBranches: inputs.branches, participants: Object.freeze([]) });
    return createGenerationEmissions(
      inputs.branches,
      inputs.peers,
      findings,
      frontiers,
      Object.freeze({
        frontierBranches: pending.frontierBranches,
        participants: Object.freeze([
          ...pending.participants,
          Object.freeze({ kind: 'resolved' as const, context: offerContext, incoming }),
        ]),
      }),
    );
  }
  const ownerKey = semanticAddressKey(incoming.origin);
  frontiers.push(
    Object.freeze({
      generationPolicy: 'sequential',
      generationHistorySequence: event.sequence,
      reachableBranchCount: inputs.branches.length,
      acquisitionHorizon: acquisitionView === undefined ? 'generationOnly' : 'ownEnteredLifecycle',
      owners: Object.freeze([incoming.origin]),
      ...(binding === undefined || incoming.resolvedStoreKey === undefined
        ? {}
        : { resolvedStoreKey: incoming.resolvedStoreKey }),
      evaluateOffer: (owner: SemanticAddress, offer: CanonicalResolvedIncomingReward['offer']) => {
        if (semanticAddressKey(owner) !== ownerKey)
          throw new BiomeRewardSimulationContractError(
            'sequential reward frontier received a foreign owner',
          );
        const candidate = incomingCandidateForOffer(catalog, incoming, offer);
        const candidateFindings = new Map<string, FindingRegionEntry>();
        const candidateContext = Object.freeze({ ...offerContext, reward: candidate });
        const candidateBranches = processRewardOffer(
          inputs.branches,
          candidateContext,
          candidateFindings,
        );
        return completeIncomingOfferCandidate(
          catalog,
          snapshot,
          inputs.enteredBiomeCount,
          inputs.authoredSeaStarDuplicateSiteKeys,
          Object.freeze({
            context: candidateContext,
            room: context.room,
            incoming: candidate,
            ...(acquisitionView === undefined ? {} : { acquisitionView }),
            producerPoints,
          }),
          offer,
          candidateBranches,
          candidateFindings,
        );
      },
    }),
  );
  const branches = processRewardOffer(inputs.branches, offerContext, findings);
  const peers =
    event.source === 'generatedTarget' || event.source === 'localVisit'
      ? Object.freeze([
          ...inputs.peers,
          Object.freeze({ origin: event.targetOrigin, offer: incoming.offer }),
        ])
      : inputs.peers;
  return createGenerationEmissions(branches, peers, findings, frontiers, inputs.pendingHubBoard);
}
