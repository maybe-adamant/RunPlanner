import type { Catalog } from '../../../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createRoomRunStateCheckpointAddress,
  createTravelDealRefillRealizationAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import { parseHermesShrineDeliveryEntryKey } from '../../../authored-project/hermes-shrine-delivery';
import { routeRoomDeclaration } from '../../../authored-project/route-profile';
import type { ResolvedRoutePosition } from '../../../authored-project/route-context';
import type { HermesShrineTravelDealRefillAssessment } from '../../commerce/hermes-shrine';
import type { PurgingPoolAssessment } from '../../commerce/purging-pool';
import type { StygianWellCandidateContext } from '../../commerce/stygian-well';
import type { HistoryEvent, HistoryStateView, ProgressiveRoomHistoryViews } from '../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../materialization';
import type { SemanticFinding } from '../../model';
import { attestDerivedAcquisitionEntryCandidateCapability } from '../acquisition/artifacts';
import type { RewardBranchState } from '../branch-primitives';
import type { WellRefillRealization } from '../model';
import type { RunStateSnapshot } from '../run-state';
import {
  lifecycleFindings,
  mergedFindings,
  settledFindings,
  siteSettlementEmissions,
  type ChronologyAccumulator,
  type ChronologyEmission,
} from './chronology-accumulator';
import {
  applyAcquisitionPointReachedTransition,
  type HermesShrineRefillState,
} from './encounter-acquisition/acquisition-point-reached';
import { applyWellPurchaseTransition } from './encounter-acquisition/well-purchase';
import { applyGorgonStartedTransition } from './encounter-acquisition/gorgon-started';
import { applyEncounterSettlementTransition } from './encounter-acquisition/encounter-settlement';
import { applyEncounterStartedTransition } from './lifecycle-transitions/encounter-started';
import { BiomeRewardSimulationContractError } from './biome-contract';
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
  readonly fullRunBiomeCount: number;
  readonly routePosition: ResolvedRoutePosition;
  readonly resourcePlacements: ResourcePlacements;
  readonly resourceFindings: readonly SemanticFinding[];
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
  /** Ordered reads of what earlier seams accumulated. */
  readonly accumulated: Pick<
    ChronologyAccumulator,
    'derivedAcquisitionEntryFrontiers' | 'gorgonPhaseCandidate'
  >;
}

export interface PurgingPoolRoomAssessment {
  readonly origin: OccurrenceAddress;
  readonly assessments: readonly PurgingPoolAssessment[];
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
  readonly purgingPoolAssessments: ReadonlyMap<string, PurgingPoolRoomAssessment>;
  /** Shrine-keyed Travel Deal refill frontier carried between its deliveries. */
  readonly hermesShrineTravelDealRefills: ReadonlyMap<
    string,
    readonly HermesShrineTravelDealRefillAssessment[]
  >;
  readonly hermesShrineTravelDealRefillValid: ReadonlyMap<string, boolean>;
  // The handler's FirstSpeedUpPurchase guard belongs to the Shrine room, not
  // to a branch.  We still require Travel Deal to agree across every branch
  // at that first action prefix before publishing a refill generation.
  readonly firstRushedInitialGenerationByShrine: ReadonlySet<string>;
  /** Gorgon phases keyed `occurrence::phase`, shared by encounter start and settlement. */
  readonly eligibleGorgonPhases: ReadonlySet<string>;
  readonly blockedGorgonPhases: ReadonlySet<string>;
  readonly gorgonEvaluationBlocked: boolean;
}

export function createChronologyWalkState(
  branches: readonly RewardBranchState[],
): ChronologyWalkState {
  return Object.freeze({
    branches,
    halted: false,
    stygianWellAssessments: new Map(),
    wellRefillRealizations: new Map(),
    purgingPoolAssessments: new Map(),
    hermesShrineTravelDealRefills: new Map(),
    hermesShrineTravelDealRefillValid: new Map(),
    firstRushedInitialGenerationByShrine: new Set<string>(),
    eligibleGorgonPhases: new Set<string>(),
    blockedGorgonPhases: new Set<string>(),
    gorgonEvaluationBlocked: false,
  });
}

/** Copies a keyed scratch map only when the key's value changes; undefined removes it. */
export function withKeyed<V>(
  map: ReadonlyMap<string, V>,
  key: string,
  value: V | undefined,
): ReadonlyMap<string, V> {
  if (value === undefined) {
    if (!map.has(key)) return map;
    const next = new Map(map);
    next.delete(key);
    return next;
  }
  if (map.has(key) && map.get(key) === value) return map;
  return new Map(map).set(key, value);
}

function withMember(set: ReadonlySet<string>, key: string, member: boolean): ReadonlySet<string> {
  if (set.has(key) === member) return set;
  const next = new Set(set);
  if (member) next.add(key);
  else next.delete(key);
  return next;
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

function roomDeclaration(context: ChronologyWalkContext, room: CanonicalAuthoredRoom | undefined) {
  return room === undefined
    ? undefined
    : routeRoomDeclaration(context.catalog.rooms.byKey[room.gameName], room.origin.routeKey);
}

function acquisitionEmissions(
  transition: ReturnType<typeof applyAcquisitionPointReachedTransition>,
  room: CanonicalAuthoredRoom | undefined,
): readonly ChronologyEmission[] {
  return [
    settledFindings(transition.findings),
    { kind: 'producerFrontiers', frontiers: transition.producerFrontiers },
    { kind: 'acquisitionRoleFrontiers', frontiers: transition.roleFrontiers },
    { kind: 'timelineFacts', facts: transition.timelineFacts },
    ...(room === undefined
      ? []
      : [
          {
            kind: 'traitChildSettlements' as const,
            checkpoints: transition.traitChildSettlements,
            occurrenceOwner: room.origin,
          },
        ]),
  ];
}

const hermesShrineDeliveriesScheduled: ChronologySeamHandler<'hermesShrineDeliveriesScheduled'> = (
  context,
  state,
  event,
) => {
  const room = authoredRoom(context, event.origin);
  const transition = applyAcquisitionPointReachedTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    room,
    declaration: roomDeclaration(context, room),
    roomView: context.views.get(semanticAddressKey(event.origin)),
    sourceBranches: state.branches,
    authoredSeaStarDuplicateSiteKeys: Object.freeze([...context.authoredSeaStarDuplicateSiteKeys]),
    purgingPoolAssessment: undefined,
    hermesShrineRefillState: undefined,
  });
  return {
    state: withBranches(state, transition.branches),
    emissions: acquisitionEmissions(transition, room),
  };
};

const acquisitionPointReached: ChronologySeamHandler<'acquisitionPointReached'> = (
  context,
  state,
  event,
) => {
  const room = authoredRoom(context, event.origin);
  const emissions: ChronologyEmission[] = [];
  if (room !== undefined && event.point.startsWith('purgingPool:')) {
    const poolSlot = event.point.slice('purgingPool:'.length);
    const poolRow = room.roomActionRoster.rows.find(
      (row) =>
        !row.stale &&
        row.rank !== null &&
        row.reference.kind === 'sellPurgingPoolTrait' &&
        row.reference.slotKey === poolSlot,
    );
    if (poolRow !== undefined)
      emissions.push({
        kind: 'timelineFacts',
        facts: { nodes: [{ owner: poolRow.owner, included: true }] },
      });
  }
  const deliverySource =
    event.siteKey === 'hermesShrineDelivery' && event.entryKey !== undefined
      ? parseHermesShrineDeliveryEntryKey(event.entryKey)
      : undefined;
  const shrineKey =
    deliverySource === undefined
      ? semanticAddressKey(event.origin)
      : semanticAddressKey({
          kind: 'occurrence' as const,
          routeKey: deliverySource.routeKey,
          biomeKey: deliverySource.biomeKey,
          occurrenceId: deliverySource.sourceOccurrenceId,
        });
  const refillState: HermesShrineRefillState | undefined =
    deliverySource === undefined
      ? undefined
      : Object.freeze({
          firstRushedInitialGeneration: state.firstRushedInitialGenerationByShrine.has(shrineKey),
          refillAssessments: state.hermesShrineTravelDealRefills.get(shrineKey),
          refillSupported: state.hermesShrineTravelDealRefillValid.get(shrineKey),
        });
  const derivedSite =
    event.siteKey === undefined || room === undefined
      ? undefined
      : room.acquisitionSites[event.siteKey]?.address;
  const derivedCapability =
    derivedSite === undefined || event.entryKey === undefined
      ? undefined
      : attestDerivedAcquisitionEntryCandidateCapability(
          context.accumulated.derivedAcquisitionEntryFrontiers(
            semanticAddressKey(createAcquisitionEntryAddress(derivedSite, event.entryKey)),
          ),
        );
  const transition = applyAcquisitionPointReachedTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    event,
    room,
    declaration: roomDeclaration(context, room),
    roomView: context.views.get(semanticAddressKey(event.origin)),
    sourceBranches: state.branches,
    authoredSeaStarDuplicateSiteKeys: Object.freeze([...context.authoredSeaStarDuplicateSiteKeys]),
    purgingPoolAssessment: state.purgingPoolAssessments.get(shrineKey),
    hermesShrineRefillState: refillState,
    ...(derivedCapability === undefined
      ? {}
      : { derivedAcquisitionEntryCapability: derivedCapability }),
  });
  emissions.push(...acquisitionEmissions(transition, room));
  if (transition.authoredSiteSettlement !== undefined && room !== undefined)
    emissions.push(...siteSettlementEmissions(transition.authoredSiteSettlement, room.origin));
  const next = transition.hermesShrineRefillState;
  return {
    state:
      next === undefined
        ? withBranches(state, transition.branches)
        : Object.freeze({
            ...state,
            branches: transition.branches,
            firstRushedInitialGenerationByShrine: withMember(
              state.firstRushedInitialGenerationByShrine,
              shrineKey,
              next.firstRushedInitialGeneration,
            ),
            hermesShrineTravelDealRefills: withKeyed(
              state.hermesShrineTravelDealRefills,
              shrineKey,
              next.refillAssessments,
            ),
            hermesShrineTravelDealRefillValid: withKeyed(
              state.hermesShrineTravelDealRefillValid,
              shrineKey,
              next.refillSupported,
            ),
          }),
    emissions,
  };
};

/** A Ship room captures its Run State before each encounter starts. */
const encounterStarted: ChronologySeamHandler<'encounterStarted'> = (context, state, event) => {
  const sourceRoom = context.rooms.get(semanticAddressKey(event.origin));
  const room = sourceRoom?.kind === 'authored' ? sourceRoom : undefined;
  let runStateCheckpoint: ChronologySeamStep['runStateCheckpoint'];
  if (room !== undefined && room.lifecycleProfileKey === 'ShipCombatRoom') {
    const view = context.views
      .get(semanticAddressKey(event.origin))
      ?.encounterStarts.find((candidate) => candidate.phaseKey === event.phaseKey)?.before;
    if (view === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${room.gameName} ${event.phaseKey} has no pre-encounter Run State view`,
      );
    }
    runStateCheckpoint = {
      owner: createRoomRunStateCheckpointAddress(room.origin, {
        kind: 'beforeEncounterStart',
        phaseKey: event.phaseKey,
      }),
      room,
      view,
    };
  }
  const figLeaf = applyEncounterStartedTransition(
    context.catalog,
    context.snapshot,
    event,
    room,
    state.branches,
  );
  const gorgon = applyGorgonStartedTransition({
    catalog: context.catalog,
    event,
    room,
    view:
      sourceRoom === undefined
        ? undefined
        : context.views.get(semanticAddressKey(sourceRoom.origin)),
    branches: figLeaf.branches,
    evaluationBlocked: state.gorgonEvaluationBlocked,
  });
  return {
    state: Object.freeze({
      ...state,
      branches: gorgon.branches,
      eligibleGorgonPhases:
        gorgon.eligiblePhaseKey === undefined
          ? state.eligibleGorgonPhases
          : withMember(state.eligibleGorgonPhases, gorgon.eligiblePhaseKey, true),
    }),
    emissions: [
      { kind: 'figLeafPhaseCandidates', candidates: figLeaf.figLeafCandidates },
      lifecycleFindings(figLeaf.findings),
      ...(gorgon.candidate === undefined
        ? []
        : [
            {
              kind: 'gorgonPhaseCandidate' as const,
              key: gorgon.candidate.key,
              candidate: gorgon.candidate.value,
            },
          ]),
      lifecycleFindings(gorgon.findings),
    ],
    ...(runStateCheckpoint === undefined ? {} : { runStateCheckpoint }),
  };
};

/** Encounter completion and its cleanup-window Room Actions settle through one transition. */
const encounterSettled: ChronologySeamHandler<
  'bossDefeated' | 'encounterInteractionReached' | 'encounterCompleted'
> = (context, state, event) => {
  const room = context.rooms.get(semanticAddressKey(event.origin));
  const gorgonPhaseKey = `${semanticAddressKey(event.origin)}::${event.phaseKey}`;
  const gorgonCandidate =
    room?.kind === 'authored'
      ? context.accumulated.gorgonPhaseCandidate(
          semanticAddressKey(
            createEncounterPhaseAddress(
              createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
              { kind: 'occurrence', occurrenceId: room.occurrenceId },
              event.phaseKey,
            ),
          ),
        )
      : undefined;
  const transition = applyEncounterSettlementTransition({
    catalog: context.catalog,
    snapshot: context.snapshot,
    routePosition: context.routePosition,
    event,
    room,
    view: context.views.get(semanticAddressKey(event.origin)),
    branches: state.branches,
    enteredBiomeCount: context.enteredBiomeCount,
    fullRunBiomeCount: context.fullRunBiomeCount,
    authoredSeaStarDuplicateSiteKeys: context.authoredSeaStarDuplicateSiteKeys,
    gorgonEligible: state.eligibleGorgonPhases.has(gorgonPhaseKey),
    gorgonCandidate,
    gorgonPhaseBlocked: state.blockedGorgonPhases.has(gorgonPhaseKey),
    gorgonEvaluationBlocked: state.gorgonEvaluationBlocked,
  });
  return {
    state: Object.freeze({
      ...state,
      branches: transition.branches,
      blockedGorgonPhases:
        transition.blockGorgonPhaseKey === undefined
          ? state.blockedGorgonPhases
          : withMember(state.blockedGorgonPhases, transition.blockGorgonPhaseKey, true),
      gorgonEvaluationBlocked: transition.gorgonEvaluationBlocked,
    }),
    emissions: [
      settledFindings(transition.findings),
      { kind: 'acquisitionRoleFrontiers', frontiers: transition.roleFrontiers },
      {
        kind: 'traitOfferCandidateContacts',
        contacts: transition.traitOfferCandidateContacts,
      },
      ...transition.traitChildSettlements.map((settlement) => ({
        kind: 'traitChildSettlements' as const,
        checkpoints: Object.freeze([settlement.checkpoint]),
        occurrenceOwner: settlement.occurrenceOwner,
      })),
      ...(transition.judgmentCandidate === undefined
        ? []
        : [
            {
              kind: 'judgmentArcanaCandidate' as const,
              key: transition.judgmentCandidate.key,
              candidate: Object.freeze({
                activeArcanaKeys: transition.judgmentCandidate.activeArcanaKeys,
                activeArcana: transition.judgmentCandidate.activeArcana,
                inactiveArcanaKeys: transition.judgmentCandidate.inactiveArcanaKeys,
                requiredCount: transition.judgmentCandidate.requiredCount,
              }),
            },
          ]),
      ...(transition.figurineCandidate === undefined
        ? []
        : [
            {
              kind: 'figurineArcanaCandidate' as const,
              key: transition.figurineCandidate.key,
              candidate: Object.freeze({
                activeArcanaKeys: transition.figurineCandidate.activeArcanaKeys,
                activeArcana: transition.figurineCandidate.activeArcana,
                inactiveArcanaKeys: transition.figurineCandidate.inactiveArcanaKeys,
                requiredCount: transition.figurineCandidate.requiredCount,
                rarity: transition.figurineCandidate.rarity,
              }),
            },
          ]),
      ...(transition.nemesisCandidate === undefined
        ? []
        : [
            {
              kind: 'nemesisRandomEventCandidate' as const,
              key: transition.nemesisCandidate.key,
              candidate: transition.nemesisCandidate.value,
            },
          ]),
      { kind: 'bossArcanaOutcomes', outcomes: transition.bossArcanaOutcomes ?? [] },
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
  hermesShrineDeliveriesScheduled,
  acquisitionPointReached,
  encounterStarted,
  bossDefeated: encounterSettled,
  encounterInteractionReached: encounterSettled,
  encounterCompleted: encounterSettled,
});
