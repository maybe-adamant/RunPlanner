import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import { createBiomeAddress, semanticAddressKey } from '../../../../authored-project/addresses';
import type { RouteLoadout, ShipCombatState } from '../../../../authored-project/model';
import { encounterEnvelopeSlots } from '../../../../authored-project/room-state/encounter-envelope';
import type { CountedRewardBinding } from '../../../../reward-kernel/bindings';
import type {
  EncounterHistoryEntry,
  HistoryStateView,
  ProgressiveRoomHistoryViews,
} from '../../../history';
import type { ResolvedEncounterPhase } from '../../../encounters';
import {
  encounterResolutionContext,
  resolveMaterializedEncounterPhase,
} from '../../../encounters/resolve';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import {
  materializeShipCombatState,
  type CanonicalAuthoredRoom,
  type CanonicalRewardWheel,
} from '../../../materialization';
import { createRewardProducerCandidateResult } from '../../producer-frontiers';
import { createBiomeRewardFacts } from '../../facts';
import { addRewardFinding, mergeRewardFindingEmissions, rewardFinding } from '../../findings';
import type { ResolvedRewardOffer } from '../../../../reward-kernel';
import type { RewardBranchState } from '../../branch-primitives';
import { processOfferGenerationCohort } from '../../offer-generation';
import { settleOwnedAcquisitionSite } from '../../acquisition/site-settlement';
import type { AcquisitionSource } from '../../acquisition/source';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { ShipLifecycleCandidateContext } from '../../lifecycle-artifacts';
import type { RewardLifecycleReferences } from '../prepared-inputs';
import { rewardStoreHistorySupport, type RewardStoreHistorySupport } from '../reward-store-support';
import type { SimulationState } from '../../../state/model';

export interface WheelLifecycleView {
  readonly generation: HistoryStateView;
  readonly acquisition: HistoryStateView;
  readonly acquisitionSequence: number;
}

/**
 * A selected Ship wheel reward is materialized by the game's SpawnRoomReward
 * path after combat. Keep that native contact explicit across canonical and
 * candidate settlement so Vow of Forfeit cannot diverge between them.
 */
export function shipWheelRoomRewardSource(
  wheel: CanonicalRewardWheel,
  picked: CanonicalRewardWheel['offers'][number],
  offer: ResolvedRewardOffer = picked.offer,
): AcquisitionSource {
  return Object.freeze({
    ...picked,
    offer,
    producerLifecycleKey: wheel.producerLifecycleKey,
    resolvedStoreKey: wheel.storeKey,
    instanceProvenance: 'free',
    roomRewardForfeitEligible: true,
    // A picked wheel offer is the materialized screen the player acted on.
    presentsMaterializedScreen: true,
  });
}

export function rewardWheelBinding(
  catalog: Catalog,
  declaration: RoomDeclaration,
  wheel: CanonicalRewardWheel,
): CountedRewardBinding {
  const descriptor = encounterEnvelopeSlots(catalog, declaration, declaration.gameName).find(
    (slot) => slot.key === wheel.encounterPhaseKey,
  )?.rewardAttachment;
  if (
    descriptor?.kind !== 'rewardWheel' ||
    descriptor.key !== wheel.wheelKey ||
    descriptor.reward.producerLifecycleKey !== wheel.producerLifecycleKey ||
    !descriptor.reward.storeKeys.includes(wheel.storeKey)
  ) {
    throw new BiomeRewardSimulationContractError(
      `${declaration.gameName} does not own reward wheel ${wheel.wheelKey}`,
    );
  }
  return descriptor.reward;
}

function projectedEncounterEntry(
  room: CanonicalAuthoredRoom,
  phase: ResolvedEncounterPhase,
  sequence: number,
): EncounterHistoryEntry {
  return Object.freeze({
    sequence,
    origin: room.origin,
    gameName: room.gameName,
    encounterEnvelopeKey: phase.envelopeKey,
    slotKey: phase.slotKey,
    encounterKey: phase.encounterKey,
    phaseKind: phase.kind,
  });
}

function projectDormantWheelView(
  room: CanonicalAuthoredRoom,
  phase: ResolvedEncounterPhase,
  generation: HistoryStateView,
): WheelLifecycleView {
  const start = projectedEncounterEntry(room, phase, generation.sequence + 2);
  const completion = projectedEncounterEntry(room, phase, generation.sequence + 4);
  const encounterDelta = phase.countsEncounterDepth ? 1 : 0;
  const acquisition = Object.freeze({
    sequence: completion.sequence,
    ledgers: Object.freeze({
      ...generation.ledgers,
      encounterStarts: Object.freeze([...generation.ledgers.encounterStarts, start]),
      encounterCompletions: Object.freeze([...generation.ledgers.encounterCompletions, completion]),
      counters: Object.freeze({
        ...generation.ledgers.counters,
        biomeEncounterDepth: generation.ledgers.counters.biomeEncounterDepth + encounterDelta,
        routeEncounterDepth: generation.ledgers.counters.routeEncounterDepth + encounterDelta,
      }),
    }),
  });
  return Object.freeze({ generation, acquisition, acquisitionSequence: acquisition.sequence + 1 });
}

export function wheelLifecycleViews(
  catalog: Catalog,
  lifecycle: RewardLifecycleReferences,
  room: CanonicalAuthoredRoom,
  roomView: ProgressiveRoomHistoryViews,
  wheel: CanonicalRewardWheel,
): WheelLifecycleView {
  const selected = roomView.offerPoints?.find(
    (candidate) => candidate.offerPoint === wheel.wheelKey,
  );
  if (selected !== undefined) {
    const acquisitionEvent = lifecycle.wheelsByOwner
      .get(semanticAddressKey(room.origin))
      ?.find(
        (candidate) =>
          candidate.kind === 'offerPointAcquired' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin) &&
          candidate.offerPoint === wheel.wheelKey,
      );
    if (selected.acquisitionBefore === undefined || acquisitionEvent === undefined)
      throw new BiomeRewardSimulationContractError(
        `${room.gameName}.${wheel.wheelKey} has no acquisition lifecycle view`,
      );
    return Object.freeze({
      generation: selected.before,
      acquisition: selected.acquisitionBefore,
      acquisitionSequence: acquisitionEvent.sequence,
    });
  }
  const materializedPhase = room.encounterPhases.find(
    (candidate) => candidate.slotKey === wheel.encounterPhaseKey,
  );
  const declaration = catalog.rooms.byKey[room.gameName];
  const phase =
    declaration === undefined || materializedPhase === undefined
      ? undefined
      : resolveMaterializedEncounterPhase(
          catalog,
          declaration,
          materializedPhase,
          encounterResolutionContext(room, declaration),
        );
  const generation =
    roomView.preOutgoing ?? roomView.offerPoints?.at(-1)?.acquisitionAfter ?? roomView.entry;
  if (phase === undefined || generation === undefined)
    throw new BiomeRewardSimulationContractError(
      `${room.gameName}.${wheel.wheelKey} has no dormant lifecycle view`,
    );
  return projectDormantWheelView(room, phase, generation);
}

export interface ShipLifecycleCandidateInputs {
  readonly catalog: Catalog;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly roomView: ProgressiveRoomHistoryViews;
  readonly lifecycle: RewardLifecycleReferences;
  readonly branchesBeforeFirstWheel: readonly RewardBranchState[];
  readonly routeLoadout: RouteLoadout;
}

/** Builds the exact Ship first-wheel candidate capability for one reached room. */
export function prepareShipLifecycleCandidateContext(
  inputs: ShipLifecycleCandidateInputs,
): ShipLifecycleCandidateContext {
  const {
    catalog,
    room,
    declaration,
    roomView,
    lifecycle,
    branchesBeforeFirstWheel,
    routeLoadout,
  } = inputs;
  const activeWheelKeys = Object.freeze(room.rewardWheels?.map((wheel) => wheel.wheelKey) ?? []);
  const rewardStoreSupportAtGeneration = (wheelKey: string): RewardStoreHistorySupport => {
    const wheel = room.rewardWheels?.find((candidate) => candidate.wheelKey === wheelKey);
    const layout = catalog.biomeLayouts.byKey[room.origin.biomeKey];
    if (wheel === undefined)
      throw new BiomeRewardSimulationContractError(
        `${room.gameName}.${wheelKey} has no active reward-wheel store support`,
      );
    if (layout === undefined)
      throw new BiomeRewardSimulationContractError(
        `${room.origin.biomeKey} has no biome layout for reward-wheel store support`,
      );
    // The wheel rolls its pool as it spawns, so the controller reads the ledger
    // at this wheel's own generation boundary. One derivation serves both the
    // supported set and the ledger numbers that explain it.
    return rewardStoreHistorySupport(
      layout,
      wheelLifecycleViews(catalog, lifecycle, room, roomView, wheel).generation,
    );
  };
  const evaluateState = (state: ShipCombatState, stopAfterPickedWheelGeneration?: string) => {
    const ship = materializeShipCombatState(
      catalog,
      createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
      declaration,
      Object.freeze({
        occurrenceId: room.occurrenceId,
        gameName: room.gameName,
        state,
        encounters: room.encounters,
        additionalExits: Object.freeze([]),
        roomActions: Object.freeze({ order: Object.freeze([]) }),
      }),
      routeLoadout,
    );
    const candidateRoom = Object.freeze({
      ...room,
      encounterPhases: ship.encounterPhases,
      rewardWheels: ship.rewardWheels,
    });
    const candidateFindings = new Map<string, FindingRegionEntry>();
    let candidateBranches = branchesBeforeFirstWheel;
    for (const wheel of ship.rewardWheels) {
      if (candidateBranches.length === 0) break;
      const lifecycleView = wheelLifecycleViews(catalog, lifecycle, candidateRoom, roomView, wheel);
      const binding = rewardWheelBinding(catalog, declaration, wheel);
      candidateBranches = processOfferGenerationCohort(
        candidateBranches,
        wheel.offers.map((offer) => ({
          catalog,
          reward: {
            ...offer,
            producerLifecycleKey: wheel.producerLifecycleKey,
            resolvedStoreKey: wheel.storeKey,
          },
          binding,
          historySequence: lifecycleView.generation.sequence + 1,
          peers: Object.freeze([]),
          facts: (state: SimulationState) =>
            createBiomeRewardFacts({
              catalog,
              state,
              source: candidateRoom,
              currentRoom: candidateRoom,
              sourceDeclaration: declaration,
              view: lifecycleView.generation,
              hubBoardLookups: 'notConsulted',
            }),
        })),
        candidateFindings,
        { ordering: 'allOffers', atomicRegion: ownerRegion(wheel.origin) },
      );
      const picked = wheel.offers.find((offer) => offer.picked);
      if (picked === undefined) {
        const unresolvedPicked = wheel.unresolvedOffers.find((offer) => offer.picked);
        if (unresolvedPicked !== undefined) {
          addRewardFinding(
            candidateFindings,
            rewardFinding('rewardMissing', unresolvedPicked.origin, {}),
          );
          return createRewardProducerCandidateResult(candidateFindings, candidateBranches);
        }
        throw new BiomeRewardSimulationContractError(
          `${room.gameName}.${wheel.wheelKey} has no picked offer`,
        );
      }
      if (wheel.wheelKey === stopAfterPickedWheelGeneration) {
        return createRewardProducerCandidateResult(candidateFindings, candidateBranches);
      }
      if (candidateBranches.length > 0) {
        const timelineOwner = candidateRoom.roomActionRoster.rows.find(
          (candidate) =>
            !candidate.stale &&
            candidate.rank !== null &&
            candidate.reference.kind === 'interactWheelReward' &&
            candidate.reference.wheelKey === wheel.wheelKey,
        )?.owner;
        const settlement = settleOwnedAcquisitionSite(
          catalog,
          candidateBranches,
          {
            siteOwner: wheel.origin,
            pointKey: wheel.wheelKey,
            entryKey: 'picked',
            ...(timelineOwner === undefined ? {} : { timelineOwner }),
            source: shipWheelRoomRewardSource(wheel, picked),
            historySequence: lifecycleView.acquisitionSequence,
          },
          (state) =>
            createBiomeRewardFacts({
              catalog,
              state,
              source: candidateRoom,
              currentRoom: candidateRoom,
              sourceDeclaration: declaration,
              view: lifecycleView.acquisition,
              hubBoardLookups: 'notConsulted',
            }),
          ownerRegion(wheel.origin),
        );
        mergeRewardFindingEmissions(candidateFindings, settlement.findingEmissions);
        candidateBranches = settlement.branches;
      }
    }
    return createRewardProducerCandidateResult(candidateFindings, candidateBranches);
  };
  return Object.freeze({
    origin: room.origin,
    activeWheelKeys,
    rewardStoreSupportAtGeneration,
    evaluateState: (state: ShipCombatState) => evaluateState(state),
    evaluateStateThroughWheelPick: (state: ShipCombatState, wheelKey: string) =>
      evaluateState(state, wheelKey),
  });
}
