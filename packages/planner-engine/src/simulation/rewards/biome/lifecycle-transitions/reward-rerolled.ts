import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  semanticAddressKey,
  type HubRerollAddress,
  type RoomActionAddress,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import type { RerolledRewardOwner } from '../../../../authored-project/rerolls';
import { rerollTargetOwner } from '../../../../authored-project/rerolls';
import type { RerollTarget } from '../../../../authored-project/model';
import type { CountedRewardBinding } from '../../../../reward-kernel/bindings';
import type { ResolvedRewardOffer } from '../../../../reward-kernel';
import { rerollPoolRemaining, spendRerolls } from '../../../arcana-fear';
import type { HistoryStateView, RoomCreationSource } from '../../../history';
import type { CanonicalLifecycleRoom } from '../../../history/lifecycleInput';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalHubDecision,
} from '../../../materialization';
import { forGeneration } from '../../../materialization';
import {
  ownerRegion,
  type FindingChronology,
  type FindingRegionEntry,
} from '../../../finding-regions';
import type { SimulationState } from '../../../state/model';
import type { RewardBranchState } from '../../branch-primitives';
import { advanceRewardBranches } from '../../branch-lifecycle';
import { createBiomeRewardFacts } from '../../facts';
import { addRewardFinding, rewardFinding } from '../../findings';
import {
  countedBinding,
  explainRewardOfferExclusions,
  processRewardOffer,
  type OfferProcessingContext,
  type OfferProcessingPeer,
} from '../../offer-generation';
import {
  createRewardProducerCandidateResult,
  type RewardProducerCandidateResult,
  type RewardProducerFrontier,
} from '../../producer-frontiers';
import type { RerollSettlement } from '../../model';
import { localRewardBinding } from '../room-reward-bindings';
import { rewardWheelBinding } from '../offer-lifecycle/reward-wheel-lifecycle';
import { historyFindingChronology } from '../finding-chronology';
import { BiomeRewardSimulationContractError } from '../biome-contract';

/** The current reward of every door, cage or wheel offer redrawn so far, by its peer origin. */
export type RerolledOffers = ReadonlyMap<string, ResolvedRewardOffer>;

export interface RewardRerolledTransition {
  readonly branches: readonly RewardBranchState[];
  readonly rerolledOffers: RerolledOffers;
  readonly findings: readonly FindingRegionEntry[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
  readonly settlement?: RerollSettlement;
}

/** One target as its reroll reads it: where it draws, what it shows, and its exclusions. */
export interface RerollTargetContext {
  readonly owner: RerolledRewardOwner;
  /** The key its current reward is tracked under: the origin its generation peers carry. */
  readonly peerKey: string;
  /** Its reward when its doors were last assigned: the first draw, or a restored Hub's persisted offer. */
  readonly generated: ResolvedRewardOffer;
  readonly producerLifecycleKey: string;
  readonly resolvedStoreKey?: string;
  readonly binding?: CountedRewardBinding;
  readonly traitContext?: OfferProcessingContext['reward']['traitContext'];
  /** Rewards the game's `rewardsChosen` lists before the press, as generated. */
  readonly peers: readonly OfferProcessingPeer[];
  /** Whether the native reroll counts the target's original reward among them. */
  readonly excludesOriginal: boolean;
  readonly rerollable: boolean;
  /** The room whose doors (or wheels) the press redraws, as its generation saw it. */
  readonly source: CanonicalLifecycleRoom;
  readonly sourceDeclaration: RoomDeclaration;
  readonly peerCreationSource?: RoomCreationSource;
}

/**
 * The destination rule `AssignRoomToExitDoor` applies when the doors unlock:
 * the door or its destination allows a reroll, the destination does not
 * refuse one, and the first-drawn reward does not block door rerolls.
 */
function doorRerollable(
  catalog: Catalog,
  allowReroll: boolean,
  destination: RoomDeclaration,
  generated: ResolvedRewardOffer,
): boolean {
  return (
    (allowReroll || destination.forceDoorAllowReroll) &&
    !destination.noReroll &&
    catalog.rewards.rewardTypes.byKey[generated.rewardType]?.blocksDoorReroll !== true
  );
}

function withCurrent(
  peers: readonly OfferProcessingPeer[],
  rerolled: RerolledOffers,
): readonly OfferProcessingPeer[] {
  return peers.map((peer) => {
    const current = rerolled.get(semanticAddressKey(peer.origin));
    return current === undefined ? peer : Object.freeze({ ...peer, offer: current });
  });
}

export function roomTargetContext(
  catalog: Catalog,
  source: CanonicalAuthoredRoom,
  batch: CanonicalBatch | undefined,
  target: RerollTarget,
  batchPeers: readonly OfferProcessingPeer[],
): RerollTargetContext | undefined {
  const sourceDeclaration = catalog.rooms.byKey[source.gameName];
  if (sourceDeclaration === undefined) return undefined;
  const biome = createBiomeAddress(source.origin.routeKey, source.origin.biomeKey);
  const owner = rerollTargetOwner(biome, source.occurrenceId, target);
  if (target.kind === 'wheelOffer') {
    const wheel = source.rewardWheels?.find((candidate) => candidate.wheelKey === target.wheelKey);
    const offer = wheel?.offers.find((candidate) => candidate.offerKey === target.offerKey);
    if (wheel === undefined || offer === undefined) return undefined;
    const generated = forGeneration(offer);
    return Object.freeze({
      owner,
      peerKey: semanticAddressKey(offer.origin),
      generated: generated.offer,
      producerLifecycleKey: wheel.producerLifecycleKey,
      resolvedStoreKey: wheel.storeKey,
      binding: rewardWheelBinding(catalog, sourceDeclaration, wheel),
      ...(offer.traitContext === undefined ? {} : { traitContext: offer.traitContext }),
      peers: Object.freeze(
        wheel.offers.map((candidate) =>
          Object.freeze({ origin: candidate.origin, offer: forGeneration(candidate).offer }),
        ),
      ),
      excludesOriginal: true,
      rerollable: true,
      source,
      sourceDeclaration,
    });
  }
  const door = batch?.targets.find(
    (candidate) =>
      candidate.origin.exitKey === target.exitKey &&
      candidate.room.occurrenceId === target.occurrenceId,
  );
  if (door === undefined || door.exit.kind !== 'available') return undefined;
  const destination = catalog.rooms.byKey[door.room.gameName];
  if (destination === undefined) return undefined;
  const cages = door.room.localRewards?.filter((reward) => reward.groupKey === 'cages') ?? [];
  if (target.kind === 'cage') {
    const cage = cages.find((candidate) => candidate.slotKey === target.slotKey);
    if (cage === undefined) return undefined;
    const generated = forGeneration(cage).offer;
    return Object.freeze({
      owner,
      peerKey: semanticAddressKey(cage.origin),
      generated,
      producerLifecycleKey: cage.producerLifecycleKey,
      resolvedStoreKey: cage.resolvedStoreKey,
      binding: localRewardBinding(destination, cage),
      ...(cage.traitContext === undefined ? {} : { traitContext: cage.traitContext }),
      // A cage reroll redraws one cage against that door's current cage rewards only.
      peers: Object.freeze(
        cages.map((candidate) =>
          Object.freeze({ origin: candidate.origin, offer: forGeneration(candidate).offer }),
        ),
      ),
      excludesOriginal: false,
      rerollable: doorRerollable(catalog, door.exit.allowReroll, destination, generated),
      source,
      sourceDeclaration,
    });
  }
  const incoming = door.room.incomingReward;
  // A door into a cage room rerolls one of its cages, never its own reward.
  if (incoming === undefined || cages.length > 0) return undefined;
  const generated = forGeneration(incoming);
  const binding = countedBinding(destination, generated, door.room.incomingRewardBinding);
  return Object.freeze({
    owner,
    peerKey: semanticAddressKey(door.origin),
    generated: generated.offer,
    producerLifecycleKey: incoming.producerLifecycleKey,
    ...(incoming.resolvedStoreKey === undefined
      ? {}
      : { resolvedStoreKey: incoming.resolvedStoreKey }),
    ...(binding === undefined ? {} : { binding }),
    ...(incoming.traitContext === undefined ? {} : { traitContext: incoming.traitContext }),
    peers: batchPeers,
    excludesOriginal: true,
    rerollable: doorRerollable(catalog, door.exit.allowReroll, destination, generated.offer),
    source,
    sourceDeclaration,
  });
}

/**
 * A board door as a press in one Hub stay reads it. The first entry assigns
 * the first draws; a restore re-assigns every unentered door its persisted
 * offer, so the press excludes that offer and the current rewards of the
 * doors still open, while entered doors are closed and count for nothing.
 */
export function hubTargetContext(
  catalog: Catalog,
  hub: CanonicalHubDecision,
  hubSlotKey: string,
  /** Room visits returned before the stay; their slots' doors are closed. */
  precedingVisitCount: number,
  /** Each door's settled current reward when the stay began, by its peer origin. */
  assignedOffers: RerolledOffers,
): RerollTargetContext | undefined {
  const sourceRoom = hub.room;
  const slot = hub.board.targets.find((candidate) => candidate.hubSlotKey === hubSlotKey);
  const incoming = slot?.room.incomingReward;
  const sourceDeclaration = catalog.rooms.byKey[sourceRoom.gameName];
  const destination = slot === undefined ? undefined : catalog.rooms.byKey[slot.room.gameName];
  if (
    slot === undefined ||
    incoming === undefined ||
    sourceDeclaration === undefined ||
    destination === undefined
  )
    return undefined;
  const generated = forGeneration(incoming);
  const peerKey = semanticAddressKey(incoming.origin);
  // Only settled presses persist an offer; the first stay assigns the first draws.
  const assigned =
    (precedingVisitCount === 0 ? undefined : assignedOffers.get(peerKey)) ?? generated.offer;
  const entered = new Set(
    hub.visits.slice(0, precedingVisitCount).map((visit) => visit.target.hubSlotKey),
  );
  const binding = countedBinding(destination, generated, slot.room.incomingRewardBinding);
  return Object.freeze({
    owner: createIncomingRewardAddress(
      createBiomeAddress(hub.origin.routeKey, hub.origin.biomeKey),
      slot.room.occurrenceId,
    ),
    peerKey,
    generated: assigned,
    producerLifecycleKey: incoming.producerLifecycleKey,
    ...(incoming.resolvedStoreKey === undefined
      ? {}
      : { resolvedStoreKey: incoming.resolvedStoreKey }),
    ...(binding === undefined ? {} : { binding }),
    ...(incoming.traitContext === undefined ? {} : { traitContext: incoming.traitContext }),
    peers: Object.freeze(
      hub.board.targets.flatMap((target) => {
        const reward = target.room.incomingReward;
        return reward === undefined || entered.has(target.hubSlotKey)
          ? []
          : [Object.freeze({ origin: reward.origin, offer: forGeneration(reward).offer })];
      }),
    ),
    excludesOriginal: true,
    // Board doors are ordinary exit doors; only the destination can refuse.
    rerollable: doorRerollable(catalog, true, destination, assigned),
    source: sourceRoom,
    sourceDeclaration,
    peerCreationSource: 'hubTarget',
  });
}

/** The lowest reroll pool remainder over reached branches. */
export function lowestRerollPool(branches: readonly RewardBranchState[]): number {
  return Math.min(...branches.map((branch) => rerollPoolRemaining(branch.state)));
}

/**
 * Evaluates one new reward for a press on the target, against the branches
 * that reach the press and every door's (wheel's, cage's) current reward.
 */
export function rerollOfferEvaluator(inputs: {
  readonly catalog: Catalog;
  readonly owner: RoomActionAddress | HubRerollAddress;
  readonly target: RerollTargetContext;
  readonly historySequence: number;
  readonly view: HistoryStateView;
  readonly chronology: FindingChronology;
  readonly branches: readonly RewardBranchState[];
  readonly rerolledOffers: RerolledOffers;
}): {
  readonly contextFor: (offer: ResolvedRewardOffer) => OfferProcessingContext;
  readonly evaluateOffer: (offer: ResolvedRewardOffer) => RewardProducerCandidateResult;
} {
  const { catalog, owner, target, historySequence, view, chronology, branches } = inputs;
  const peers = Object.freeze([
    ...(target.excludesOriginal
      ? [Object.freeze({ origin: target.owner as SemanticAddress, offer: target.generated })]
      : []),
    ...withCurrent(target.peers, inputs.rerolledOffers),
  ]);
  const contextFor = (offer: ResolvedRewardOffer): OfferProcessingContext =>
    Object.freeze({
      catalog,
      reward: Object.freeze({
        origin: owner,
        offer,
        producerLifecycleKey: target.producerLifecycleKey,
        ...(target.resolvedStoreKey === undefined
          ? {}
          : { resolvedStoreKey: target.resolvedStoreKey }),
        ...(target.traitContext === undefined ? {} : { traitContext: target.traitContext }),
      }),
      ...(target.binding === undefined ? {} : { binding: target.binding }),
      historySequence,
      findingChronology: chronology,
      peers,
      facts: (state: SimulationState) =>
        createBiomeRewardFacts({
          catalog,
          state,
          source: target.source,
          currentRoom: target.source,
          sourceDeclaration: target.sourceDeclaration,
          view,
          ...(target.peerCreationSource === undefined
            ? {}
            : { peerCreationSource: target.peerCreationSource }),
          hubBoardLookups: 'notConsulted',
        }),
    });
  return Object.freeze({
    contextFor,
    evaluateOffer: (offer: ResolvedRewardOffer) => {
      const candidateFindings = new Map<string, FindingRegionEntry>();
      const context = contextFor(offer);
      const candidateBranches = processRewardOffer(branches, context, candidateFindings);
      return createRewardProducerCandidateResult(
        candidateFindings,
        candidateBranches,
        candidateBranches.length === 0
          ? explainRewardOfferExclusions(branches, context)
          : undefined,
      );
    },
  });
}

/**
 * One reroll press at its authored rank: legal while a held card enables
 * door rerolls and the target was rerollable when its doors unlocked; a real
 * draw from the target's own store against every door's (wheel's, cage's)
 * current reward and the target's original; one spent from the pool. The
 * target's current reward becomes the pressed reward.
 */
export function applyRewardRerolledTransition(inputs: {
  readonly catalog: Catalog;
  readonly owner: RoomActionAddress | HubRerollAddress;
  readonly reward: ResolvedRewardOffer | undefined;
  readonly target: RerollTargetContext | undefined;
  /** Why a Hub reroll cannot act: its slot's room was entered and that door closed. */
  readonly refused?: 'slotEntered';
  /** A held card enabled door rerolls when the target was assigned (AssignRoomToExitDoor). */
  readonly flagged: boolean;
  readonly historySequence: number;
  readonly view: HistoryStateView | undefined;
  readonly chronology?: FindingChronology;
  readonly branches: readonly RewardBranchState[];
  readonly rerolledOffers: RerolledOffers;
}): RewardRerolledTransition {
  const { catalog, owner, target, historySequence, view } = inputs;
  const findings = new Map<string, FindingRegionEntry>();
  const region = ownerRegion(owner);
  const chronology = inputs.chronology ?? historyFindingChronology(historySequence);
  const blocked = (code: Parameters<typeof rewardFinding>[0], evidence = {}) => {
    addRewardFinding(findings, rewardFinding(code, owner, evidence), region, chronology);
    return Object.freeze({
      branches: Object.freeze([]),
      rerolledOffers: inputs.rerolledOffers,
      findings: Object.freeze([...findings.values()]),
      producerFrontiers: Object.freeze([]),
    });
  };
  if (inputs.branches.length === 0)
    return Object.freeze({
      branches: inputs.branches,
      rerolledOffers: inputs.rerolledOffers,
      findings: Object.freeze([]),
      producerFrontiers: Object.freeze([]),
    });
  if (inputs.reward === undefined)
    throw new BiomeRewardSimulationContractError(
      `${semanticAddressKey(owner)} reached without its reroll`,
    );
  if (inputs.refused === 'slotEntered')
    return blocked('rerollTargetUnavailable', { reason: 'slotEntered' });
  if (!inputs.flagged) return blocked('rerollUnavailable', { kind: 'doors' });
  if (target === undefined) return blocked('rerollTargetUnavailable', { reason: 'missing' });
  if (!target.rerollable) return blocked('rerollTargetUnavailable', { reason: 'notRerollable' });
  if (view === undefined)
    throw new BiomeRewardSimulationContractError(
      `${semanticAddressKey(owner)} has no history view`,
    );
  // An over-spend is spent and reported, like a screen's; the timeline continues.
  const remaining = lowestRerollPool(inputs.branches);
  if (remaining < 1)
    addRewardFinding(
      findings,
      rewardFinding('rerollPoolExceeded', owner, { cost: 1, remaining }),
      region,
      chronology,
    );
  const frontierBranches = inputs.branches;
  const evaluator = rerollOfferEvaluator({
    catalog,
    owner,
    target,
    historySequence,
    view,
    chronology,
    branches: frontierBranches,
    rerolledOffers: inputs.rerolledOffers,
  });
  const drawn = processRewardOffer(frontierBranches, evaluator.contextFor(inputs.reward), findings);
  const branches =
    drawn.length === 0
      ? Object.freeze([])
      : advanceRewardBranches(
          Object.freeze(
            drawn.map((branch) =>
              Object.freeze({
                ...branch,
                state: Object.freeze({
                  ...branch.state,
                  arcanaFear: spendRerolls(branch.state.arcanaFear, 1),
                }),
              }),
            ),
          ),
          historySequence,
        );
  const ownerKey = semanticAddressKey(owner);
  const producerFrontiers: readonly RewardProducerFrontier[] = Object.freeze([
    Object.freeze({
      generationPolicy: 'sequential' as const,
      generationHistorySequence: historySequence,
      reachableBranchCount: frontierBranches.length,
      acquisitionHorizon: 'generationOnly' as const,
      owners: Object.freeze([owner]),
      ...(target.resolvedStoreKey === undefined
        ? {}
        : { resolvedStoreKey: target.resolvedStoreKey }),
      evaluateOffer: (candidate: SemanticAddress, offer: ResolvedRewardOffer) => {
        if (semanticAddressKey(candidate) !== ownerKey)
          throw new BiomeRewardSimulationContractError('reroll frontier received a foreign owner');
        return evaluator.evaluateOffer(offer);
      },
    }),
  ]);
  const settled = branches.length > 0;
  return Object.freeze({
    branches,
    rerolledOffers: settled
      ? new Map(inputs.rerolledOffers).set(target.peerKey, inputs.reward)
      : inputs.rerolledOffers,
    findings: Object.freeze([...findings.values()]),
    producerFrontiers,
    settlement: Object.freeze({
      owner,
      target: target.owner,
      historySequence,
      reward: inputs.reward,
      poolRemainingBefore: remaining,
      ...(settled ? { poolRemainingAfter: lowestRerollPool(branches) } : {}),
    }),
  });
}
