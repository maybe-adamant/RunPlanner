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
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import {
  materializeShipCombatState,
  type CanonicalAuthoredRoom,
  type CanonicalRewardWheel,
} from '../../../materialization';
import { createRewardProducerCandidateResult } from '../../producer-frontiers';
import { createBiomeRewardFacts } from '../../facts';
import { addRewardFinding, rewardFinding } from '../../findings';
import type { RewardHistoryState } from '../../../../reward-kernel';
import type { RewardBranchState } from '../../branch-primitives';
import { processOfferGenerationCohort } from '../../processing';
import { settleOwnedAcquisitionSite } from '../../acquisition-settlement';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { ShipLifecycleCandidateContext } from '../../lifecycle-artifacts';
import type { RewardLifecycleReferences } from '../prepared-inputs';
import { rewardStoreHistorySupport } from '../reward-store-support';

export interface WheelLifecycleView {
  readonly generation: HistoryStateView;
  readonly acquisition: HistoryStateView;
  readonly acquisitionSequence: number;
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
  const phase = room.encounterPhases.find(
    (candidate) => candidate.slotKey === wheel.encounterPhaseKey,
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
  readonly enteredBiomeCount: number;
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
    enteredBiomeCount,
    routeLoadout,
  } = inputs;
  const activeWheelKeys = Object.freeze(room.rewardWheels?.map((wheel) => wheel.wheelKey) ?? []);
  const supportedStoreKeysAtGeneration = (wheelKey: string): readonly string[] => {
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
    return rewardStoreHistorySupport(
      layout,
      room.origin.biomeKey,
      wheelLifecycleViews(lifecycle, room, roomView, wheel).generation,
    ).supportStoreKeys;
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
      const lifecycleView = wheelLifecycleViews(lifecycle, candidateRoom, roomView, wheel);
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
          facts: (
            branchHistory: RewardHistoryState,
            _shopNames: ReadonlySet<string> | undefined,
            branch: RewardBranchState | undefined,
          ) =>
            createBiomeRewardFacts(
              catalog,
              candidateRoom,
              candidateRoom,
              declaration,
              lifecycleView.generation,
              branchHistory,
              enteredBiomeCount,
              undefined,
              undefined,
              undefined,
              undefined,
              branch,
            ),
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
        candidateBranches = settleOwnedAcquisitionSite(
          catalog,
          candidateBranches,
          {
            siteOwner: wheel.origin,
            pointKey: wheel.wheelKey,
            entryKey: 'picked',
            source: Object.freeze({
              ...picked,
              producerLifecycleKey: wheel.producerLifecycleKey,
              instanceProvenance: 'free',
            }),
            historySequence: lifecycleView.acquisitionSequence,
          },
          (branchHistory) =>
            createBiomeRewardFacts(
              catalog,
              candidateRoom,
              candidateRoom,
              declaration,
              lifecycleView.acquisition,
              branchHistory,
              enteredBiomeCount,
            ),
          candidateFindings,
          ownerRegion(wheel.origin),
        ).branches;
      }
    }
    return createRewardProducerCandidateResult(candidateFindings, candidateBranches);
  };
  return Object.freeze({
    origin: room.origin,
    activeWheelKeys,
    supportedStoreKeysAtGeneration,
    evaluateState: (state: ShipCombatState) => evaluateState(state),
    evaluateStateThroughWheelPick: (state: ShipCombatState, wheelKey: string) =>
      evaluateState(state, wheelKey),
  });
}
