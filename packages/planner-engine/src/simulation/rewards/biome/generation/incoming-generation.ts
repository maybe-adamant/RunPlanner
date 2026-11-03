import type { Catalog } from '../../../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../../../authored-project/addresses';
import { createUnresolvedAcquisitionRewardState } from '../../../../authored-project/traits/state';
import type { ResolvedRewardOffer } from '../../../../reward-kernel';
import type { HistoryEvent, HistoryStateView, ProgressiveRoomHistoryViews } from '../../../history';
import { forGeneration, type CanonicalResolvedIncomingReward } from '../../../materialization';
import { preparedAcquisitionSiteOwner, type RewardLifecycleReferences } from '../prepared-inputs';
import { createBiomeRewardFacts } from '../../facts';
import { advanceReachedBranch } from '../../branch-lifecycle';
import type { RewardFactsFactory } from '../../acquisition/contracts';
import { addRewardFinding, mergeRewardFindingEmissions, rewardFinding } from '../../findings';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import {
  countedBinding,
  drawUnspawnedRewardRoll,
  explainRewardOfferExclusions,
  processRewardOffer,
  type OfferProcessingContext,
  type OfferProcessingPeer,
} from '../../offer-generation';
import { settleProducerAcquisitionSite } from '../../acquisition/site-settlement';
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
import type { HubBoardDoor } from './hub-board-order';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { SimulationState } from '../../../state/model';

function incomingCandidateForOffer(
  catalog: Catalog,
  incoming: CanonicalResolvedIncomingReward,
  offer: ResolvedRewardOffer,
): CanonicalResolvedIncomingReward {
  if (JSON.stringify(incoming.offer) === JSON.stringify(offer)) return incoming;
  const state = createUnresolvedAcquisitionRewardState(
    catalog,
    offer,
    {
      kind: 'producerLifecycle',
      key: incoming.producerLifecycleKey,
    },
    incoming.origin.routeKey,
  );
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
  /** The state reaching generation, before the offer was processed. */
  readonly frontier: RewardBranchState | undefined;
  readonly declaration: RoomCreatedRewardContext['declaration'];
  readonly room: RoomCreatedRewardContext['room'];
  readonly incoming: CanonicalResolvedIncomingReward;
  readonly acquisitionView?: HistoryStateView;
  readonly producerPoints: readonly Extract<
    HistoryEvent,
    { readonly kind: 'producerPointReached' }
  >[];
  /** The last history sequence the published attempt reached. */
  readonly reachedThrough: number;
}

function completeIncomingOfferCandidate(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  enteredBiomeCount: number,
  authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>,
  entry: IncomingOfferCandidateContext,
  offer: CanonicalResolvedIncomingReward['offer'],
  offered: RewardBranchState | undefined,
  candidateFindings: Map<string, FindingRegionEntry>,
) {
  const exclusions =
    offered === undefined ? explainRewardOfferExclusions(entry.frontier, entry.context) : undefined;
  // Only the unchanged envelope retains authored acquisition children. A new
  // reward's children are authored after selection, not prerequisites for it.
  if (entry.incoming !== entry.room.incomingReward) {
    return createRewardProducerCandidateResult(candidateFindings, offered, exclusions);
  }
  let branch = offered;
  if (
    branch !== undefined &&
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
                (point) =>
                  point.point === binding.lifecyclePoint && point.sequence <= entry.reachedThrough,
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
      if (branch === undefined) break;
      const settlement = settleProducerAcquisitionSite(
        catalog,
        branch,
        candidateRoom,
        acquisitionEvent,
        (state) =>
          createBiomeRewardFacts({
            catalog,
            state,
            source: candidateRoom,
            currentRoom: candidateRoom,
            sourceDeclaration: entry.declaration,
            view: entry.acquisitionView!,
            hubBoardLookups: 'notConsulted',
          }),
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
      );
      mergeRewardFindingEmissions(candidateFindings, settlement.findingEmissions);
      branch = settlement.branch;
    }
  }
  return createRewardProducerCandidateResult(candidateFindings, branch, exclusions);
}

/** A fresh opening's run-start roll leaves the bag one entry short and nothing else. */
function unspawnedRollBranch(
  catalog: Catalog,
  context: RoomCreatedRewardContext,
  branch: RewardBranchState | undefined,
  historySequence: number,
  facts: RewardFactsFactory,
): RewardBranchState | undefined {
  const roll = context.room.unspawnedRunStartRoll;
  if (roll === undefined || branch === undefined) return branch;
  const drawn = drawUnspawnedRewardRoll(catalog, branch, roll, facts);
  if (drawn === undefined)
    throw new BiomeRewardSimulationContractError(
      `${context.room.gameName} rolls no single ${roll.storeKey} reward type`,
    );
  return advanceReachedBranch(drawn, historySequence);
}

function requireHubDoor(context: RoomCreatedRewardContext): HubBoardDoor {
  if (context.hubDoor === undefined)
    throw new BiomeRewardSimulationContractError(
      `${context.room.gameName} lost its Hub board door`,
    );
  return context.hubDoor;
}

/** Generates exactly one resolved or unresolved incoming reward envelope. */
export function generateIncomingReward(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  event: Extract<HistoryEvent, { readonly kind: 'roomCreated' }>,
  context: RoomCreatedRewardContext,
  inputs: {
    readonly branch: RewardBranchState | undefined;
    readonly peers: readonly OfferProcessingPeer[];
    readonly pendingHubBoard?: PendingHubBoardGeneration;
    readonly lifecycle: RewardLifecycleReferences;
    readonly roomViews: ProgressiveRoomHistoryViews | undefined;
    readonly enteredBiomeCount: number;
    readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
  },
): GenerationEmissions {
  const findings = new Map<string, FindingRegionEntry>();
  const frontiers: RewardProducerFrontier[] = [];
  const roomKey = semanticAddressKey(context.room.origin);
  const producerPoints = inputs.lifecycle.producerPointsByOwner.get(roomKey) ?? Object.freeze([]);
  const acquisitionView =
    context.incoming?.acquisitionEnabled === false || context.incoming?.reroll !== undefined
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
  const facts = (state: SimulationState) =>
    createBiomeRewardFacts({
      catalog,
      state,
      source: context.source,
      currentRoom: context.currentRoom,
      sourceDeclaration: context.sourceDeclaration,
      view: context.generationView!,
      currentRoomShopOptionNames: context.currentShopNames,
      peerParentOrigin:
        context.source.kind === 'hub' ? context.source.origin : context.peerParentOrigin,
      peerCreationSource: context.source.kind === 'hub' ? 'hubTarget' : context.peerCreationSource,
      hubBoardLookups: 'notConsulted',
    });

  if (context.unresolvedIncoming !== undefined) {
    const unresolved = context.unresolvedIncoming;
    const offerOrigin = unresolved.offerOrigin ?? unresolved.origin;
    const candidateFor = (offer: ResolvedRewardOffer): CanonicalResolvedIncomingReward => {
      const state = createUnresolvedAcquisitionRewardState(
        catalog,
        offer,
        {
          kind: 'producerLifecycle',
          key: unresolved.producerLifecycleKey,
        },
        unresolved.origin.routeKey,
      );
      return Object.freeze({
        ...unresolved,
        kind: 'resolved' as const,
        offer,
        traitOffersByAcquisitionRole: state.traitOffersByAcquisitionRole,
        ...(state.levelResolutionsByAcquisitionRole === undefined
          ? {}
          : { levelResolutionsByAcquisitionRole: state.levelResolutionsByAcquisitionRole }),
        ...(state.hexActivationsByAcquisitionRole === undefined
          ? {}
          : { hexActivationsByAcquisitionRole: state.hexActivationsByAcquisitionRole }),
        dispositionByAcquisitionRole: state.dispositionByAcquisitionRole,
        traitContext: Object.freeze({
          blockGiftBoons: context.declaration.blockGiftBoons,
          devotionNoDuo: offer.rewardType === 'Devotion',
        }),
      });
    };
    if (event.source === 'hubTarget') {
      const pending =
        inputs.pendingHubBoard ??
        Object.freeze({ frontier: inputs.branch, participants: Object.freeze([]) });
      return createGenerationEmissions(
        inputs.branch,
        inputs.peers,
        findings,
        frontiers,
        Object.freeze({
          frontier: pending.frontier,
          participants: Object.freeze([
            ...pending.participants,
            Object.freeze({
              kind: 'unresolved' as const,
              door: requireHubDoor(context),
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
    const ownerKey = semanticAddressKey(offerOrigin);
    frontiers.push(
      Object.freeze({
        generationPolicy: 'sequential',
        generationHistorySequence: event.sequence,
        acquisitionHorizon:
          acquisitionView === undefined ? 'generationOnly' : 'ownEnteredLifecycle',
        owners: Object.freeze([offerOrigin]),
        ...(unresolved.resolvedStoreKey === undefined
          ? {}
          : { resolvedStoreKey: unresolved.resolvedStoreKey }),
        evaluateOffer: (
          owner: SemanticAddress,
          offer: ResolvedRewardOffer,
          reachedThrough: number,
        ) => {
          if (semanticAddressKey(owner) !== ownerKey)
            throw new BiomeRewardSimulationContractError(
              'unresolved reward frontier received a foreign owner',
            );
          const candidate = candidateFor(offer);
          const candidateFindings = new Map<string, FindingRegionEntry>();
          const candidateBinding = countedBinding(
            context.declaration,
            candidate,
            context.incomingBinding,
          );
          const candidateContext: OfferProcessingContext = Object.freeze({
            catalog,
            reward: Object.freeze({ ...candidate, origin: offerOrigin }),
            ...(candidateBinding === undefined ? {} : { binding: candidateBinding }),
            historySequence: event.sequence,
            ...(offerChronology === undefined ? {} : { findingChronology: offerChronology }),
            peers: inputs.peers,
            facts: (state: SimulationState) => facts(state),
          });
          const offered = processRewardOffer(inputs.branch, candidateContext, candidateFindings);
          return completeIncomingOfferCandidate(
            catalog,
            snapshot,
            inputs.enteredBiomeCount,
            inputs.authoredSeaStarDuplicateSiteKeys,
            Object.freeze({
              context: candidateContext,
              frontier: inputs.branch,
              declaration: context.declaration,
              room: context.room,
              incoming: candidate,
              ...(acquisitionView === undefined ? {} : { acquisitionView }),
              producerPoints,
              reachedThrough,
            }),
            offer,
            offered,
            candidateFindings,
          );
        },
      }),
    );
    addRewardFinding(
      findings,
      rewardFinding('rewardMissing', offerOrigin, {}),
      ownerRegion(offerOrigin),
      offerChronology ?? historyFindingChronology(event.sequence),
    );
    return createGenerationEmissions(undefined, inputs.peers, findings, frontiers);
  }

  // A rerolled door still offers its first draw; its acquisition is the effective reward's.
  const incoming = context.incoming === undefined ? undefined : forGeneration(context.incoming);
  if (context.incoming?.rerolledRewardMismatch === true)
    addRewardFinding(
      findings,
      rewardFinding('rerolledRewardMismatch', context.incoming.origin, {}),
      ownerRegion(context.incoming.origin),
      offerChronology ?? historyFindingChronology(event.sequence),
    );
  if (incoming === undefined)
    return createGenerationEmissions(
      unspawnedRollBranch(catalog, context, inputs.branch, event.sequence, facts),
      inputs.peers,
      findings,
      frontiers,
      inputs.pendingHubBoard,
    );
  const binding = countedBinding(context.declaration, incoming, context.incomingBinding);
  const offerOrigin = incoming.offerOrigin ?? incoming.origin;
  const offerContext: OfferProcessingContext = Object.freeze({
    catalog,
    reward: Object.freeze({ ...incoming, origin: offerOrigin }),
    ...(binding === undefined ? {} : { binding }),
    historySequence: event.sequence,
    ...(offerChronology === undefined ? {} : { findingChronology: offerChronology }),
    peers: inputs.peers,
    facts: (state: SimulationState) => facts(state),
  });
  if (event.source === 'hubTarget') {
    const pending =
      inputs.pendingHubBoard ??
      Object.freeze({ frontier: inputs.branch, participants: Object.freeze([]) });
    return createGenerationEmissions(
      inputs.branch,
      inputs.peers,
      findings,
      frontiers,
      Object.freeze({
        frontier: pending.frontier,
        participants: Object.freeze([
          ...pending.participants,
          Object.freeze({
            kind: 'resolved' as const,
            door: requireHubDoor(context),
            context: offerContext,
            incoming,
          }),
        ]),
      }),
    );
  }
  const ownerKey = semanticAddressKey(offerOrigin);
  frontiers.push(
    Object.freeze({
      generationPolicy: 'sequential',
      generationHistorySequence: event.sequence,
      acquisitionHorizon: acquisitionView === undefined ? 'generationOnly' : 'ownEnteredLifecycle',
      owners: Object.freeze([offerOrigin]),
      ...(binding === undefined || incoming.resolvedStoreKey === undefined
        ? {}
        : { resolvedStoreKey: incoming.resolvedStoreKey }),
      evaluateOffer: (
        owner: SemanticAddress,
        offer: CanonicalResolvedIncomingReward['offer'],
        reachedThrough: number,
      ) => {
        if (semanticAddressKey(owner) !== ownerKey)
          throw new BiomeRewardSimulationContractError(
            'sequential reward frontier received a foreign owner',
          );
        const candidate = incomingCandidateForOffer(catalog, incoming, offer);
        const candidateFindings = new Map<string, FindingRegionEntry>();
        const candidateContext = Object.freeze({
          ...offerContext,
          reward: Object.freeze({ ...candidate, origin: offerOrigin }),
        });
        const offered = processRewardOffer(inputs.branch, candidateContext, candidateFindings);
        return completeIncomingOfferCandidate(
          catalog,
          snapshot,
          inputs.enteredBiomeCount,
          inputs.authoredSeaStarDuplicateSiteKeys,
          Object.freeze({
            context: candidateContext,
            frontier: inputs.branch,
            declaration: context.declaration,
            room: context.room,
            incoming: candidate,
            ...(acquisitionView === undefined ? {} : { acquisitionView }),
            producerPoints,
            reachedThrough,
          }),
          offer,
          offered,
          candidateFindings,
        );
      },
    }),
  );
  const branch = processRewardOffer(inputs.branch, offerContext, findings);
  const peers =
    event.source === 'generatedTarget' || event.source === 'localVisit'
      ? Object.freeze([
          ...inputs.peers,
          Object.freeze({ origin: event.targetOrigin, offer: incoming.offer }),
        ])
      : inputs.peers;
  return createGenerationEmissions(branch, peers, findings, frontiers, inputs.pendingHubBoard);
}
