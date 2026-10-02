import type { Catalog } from '../../../catalog-schema';
import {
  createBiomeAddress,
  createTravelDealRefillRealizationAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import type { StygianWellCandidateContext } from '../../commerce/stygian-well';
import type { HistoryEvent, HistoryStateView, ProgressiveRoomHistoryViews } from '../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../materialization';
import type { SemanticFinding } from '../../model';
import type { RewardBranchState } from '../branch-primitives';
import type { WellRefillRealization } from '../model';
import type { RunStateSnapshot } from '../run-state';
import {
  lifecycleFindings,
  mergedFindings,
  settledFindings,
  type ChronologyEmission,
} from './chronology-accumulator';
import { applyWellPurchaseTransition } from './encounter-acquisition/well-purchase';
import type { BiomeRewardSnapshot } from './evaluation-contract';
import { applyEncounterEndEffectsTransition } from './lifecycle-transitions/encounter-end-effects';
import { applyErisInteractedTransition } from './lifecycle-transitions/eris-interacted';
import { applyKeepsakeRackUsedTransition } from './lifecycle-transitions/keepsake-rack-used';
import { applyRoomExitedTransition } from './lifecycle-transitions/room-exited';

/** The fixed inputs every seam handler of one biome walk reads. */
export interface ChronologyWalkContext {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly rooms: ReadonlyMap<string, CanonicalAuthoredRoom | CanonicalHubRoom>;
  readonly views: ReadonlyMap<string, ProgressiveRoomHistoryViews>;
  readonly routeLoadout: RouteLoadout;
  readonly enteredBiomeCount: number;
  readonly resourcePlacements: ResourcePlacements;
  readonly resourceFindings: readonly SemanticFinding[];
}

export interface StygianWellAssessment {
  readonly origin: OccurrenceAddress;
  readonly assessments: readonly StygianWellCandidateContext[];
}

/** The walk state carried between seams; replaced, never mutated. */
export interface ChronologyWalkState {
  readonly branches: readonly RewardBranchState[];
  /** A seam stopped the walk at its own sequence. */
  readonly halted: boolean;
  readonly stygianWellAssessments: ReadonlyMap<string, StygianWellAssessment>;
  readonly wellRefillRealizations: ReadonlyMap<string, WellRefillRealization>;
}

export function createChronologyWalkState(
  branches: readonly RewardBranchState[],
): ChronologyWalkState {
  return Object.freeze({
    branches,
    halted: false,
    stygianWellAssessments: new Map(),
    wellRefillRealizations: new Map(),
  });
}

export function withBranches(
  state: ChronologyWalkState,
  branches: readonly RewardBranchState[],
): ChronologyWalkState {
  return Object.freeze({ ...state, branches });
}

/** One seam's result: its next state, ordered accumulator writes, and any Run State capture. */
export interface ChronologySeamStep {
  readonly state: ChronologyWalkState;
  readonly emissions: readonly ChronologyEmission[];
  /** Captured from the branches the seam received, before its state applies. */
  readonly runStateCheckpoint?: {
    readonly owner: RunStateSnapshot['owner'];
    readonly room: CanonicalAuthoredRoom;
    readonly view: HistoryStateView;
  };
}

type SeamEvent<K extends HistoryEvent['kind']> = Extract<HistoryEvent, { readonly kind: K }>;

export type ChronologySeamHandler<K extends HistoryEvent['kind']> = (
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: SeamEvent<K>,
) => ChronologySeamStep;

function authoredRoom(
  context: ChronologyWalkContext,
  origin: SemanticAddress,
): CanonicalAuthoredRoom | undefined {
  const room = context.rooms.get(semanticAddressKey(origin));
  return room?.kind === 'authored' ? room : undefined;
}

const erisInteracted: ChronologySeamHandler<'erisInteracted'> = (context, state, event) => {
  const transition = applyErisInteractedTransition(
    context.catalog,
    event,
    authoredRoom(context, event.origin),
    state.branches,
  );
  return {
    state: withBranches(state, transition.branches),
    emissions: [lifecycleFindings(transition.findings)],
  };
};

const keepsakeRackUsed: ChronologySeamHandler<'keepsakeRackUsed'> = (context, state, event) => {
  const transition = applyKeepsakeRackUsedTransition(
    context.catalog,
    event,
    authoredRoom(context, event.origin),
    context.views.get(semanticAddressKey(event.origin))?.entry,
    context.routeLoadout,
    state.branches,
    context.enteredBiomeCount + 1,
  );
  return {
    state: withBranches(state, transition.branches),
    emissions: [
      { kind: 'timelineFacts', facts: transition.timelineFacts },
      ...(transition.keepsakeSelectionCandidate === undefined
        ? []
        : [
            {
              kind: 'keepsakeSelectionCandidate' as const,
              key: transition.keepsakeSelectionCandidate.key,
              candidate: transition.keepsakeSelectionCandidate.candidate,
            },
          ]),
      {
        kind: 'keepsakeEquipResultCandidates',
        candidates: transition.keepsakeEquipResultCandidates,
      },
      lifecycleFindings(transition.findings),
    ],
  };
};

const roomExited: ChronologySeamHandler<'roomExited'> = (context, state, event) => {
  const exited = applyRoomExitedTransition(
    context.catalog,
    event,
    authoredRoom(context, event.origin),
    context.views.get(semanticAddressKey(event.origin)),
    context.resourcePlacements,
    state.branches,
    context.resourceFindings,
  );
  return {
    state: withBranches(state, exited.branches),
    emissions: [mergedFindings(exited.findingRegions)],
    ...(exited.runStateCheckpoint === undefined
      ? {}
      : { runStateCheckpoint: exited.runStateCheckpoint }),
  };
};

/** A Hermes Shrine delivery that still needs a placement halts the walk here. */
const encounterEndEffectsApplied: ChronologySeamHandler<'encounterEndEffectsApplied'> = (
  context,
  state,
  event,
) => {
  const transition = applyEncounterEndEffectsTransition(
    context.catalog,
    event,
    authoredRoom(context, event.origin),
    state.branches,
  );
  return {
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      halted: transition.hermesShrineDeliveryPlacementRequired,
    }),
    emissions: [
      { kind: 'timelineFacts', facts: transition.timelineFacts },
      {
        kind: 'derivedAcquisitionEntryFrontiers',
        frontiers: transition.derivedAcquisitionEntryFrontiers,
      },
      { kind: 'steadyGrowthThresholds', thresholds: transition.steadyGrowthThresholds },
      {
        kind: 'transcendentEmbryoThresholds',
        thresholds: transition.transcendentEmbryoThresholds,
      },
      {
        kind: 'traitChildSettlements',
        checkpoints: transition.traitChildSettlements,
        occurrenceOwner: event.origin,
      },
      lifecycleFindings(transition.findings),
    ],
  };
};

const wellPurchase: ChronologySeamHandler<'wellPurchase'> = (context, state, event) => {
  const wellRoom = context.rooms.get(semanticAddressKey(event.origin));
  const wellOrigin = wellRoom?.kind === 'authored' ? wellRoom.origin : undefined;
  const transition = applyWellPurchaseTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    room: wellRoom,
    branches: state.branches,
    refillGenerationSupported:
      wellOrigin !== undefined &&
      state.wellRefillRealizations.has(
        semanticAddressKey(
          createTravelDealRefillRealizationAddress(
            createBiomeAddress(wellOrigin.routeKey, wellOrigin.biomeKey),
            wellOrigin.occurrenceId,
          ),
        ),
      ),
  });
  let stygianWellAssessments = state.stygianWellAssessments;
  if (transition.candidateContexts.length > 0 && wellRoom?.kind === 'authored') {
    const key = semanticAddressKey(event.origin);
    const existing = stygianWellAssessments.get(key);
    stygianWellAssessments = new Map(stygianWellAssessments).set(
      key,
      Object.freeze({
        origin: wellRoom.origin,
        assessments: Object.freeze([
          ...(existing?.assessments ?? []),
          ...transition.candidateContexts,
        ]),
      }),
    );
  }
  const realization = transition.refillRealization;
  const wellRefillRealizations =
    realization === undefined
      ? state.wellRefillRealizations
      : new Map(state.wellRefillRealizations).set(
          semanticAddressKey(realization.owner),
          realization,
        );
  return {
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      stygianWellAssessments,
      wellRefillRealizations,
    }),
    emissions: [
      settledFindings(transition.findings),
      { kind: 'timelineFacts', facts: transition.timelineFacts },
    ],
  };
};

/** Seams whose handler is a thin adapter over its unchanged transition module. */
export const chronologySeamHandlers = Object.freeze({
  erisInteracted,
  keepsakeRackUsed,
  roomExited,
  encounterEndEffectsApplied,
  wellPurchase,
});
