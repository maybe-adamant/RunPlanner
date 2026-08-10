import type { Catalog, EncounterEnvelopeSlot, RoomDeclaration } from '../../catalog-schema';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  type EncounterPhaseAddress,
} from '../../authored-project/addresses';
import {
  encounterBindingsBySlot,
  encounterEnvelopeSlots,
  encounterSetForBinding,
} from '../../authored-project/room-state/encounters';
import { evaluateRequirement, type RequirementEvaluationContext } from '../../requirements';
import {
  projectBiomeEncounterKeyCounts,
  projectEncounterRecordPreparation,
  projectPreviousRoomEncounterKeys,
  projectRecentEncounterEnvelopeSlots,
  projectRouteEncounterKeyCounts,
} from '../history/facts';
import type { HistoryStateView } from '../history/model';
import type { CanonicalAuthoredRoom, CanonicalLocalChildRoom } from '../materialization';
import type { SemanticFinding } from '../model';
import type { ResolvedEncounterPhase } from './model';

export interface EncounterPhaseCandidateSupport {
  readonly origin: EncounterPhaseAddress;
  readonly selectedEncounterKey: string;
  readonly candidateEncounterKeys: readonly string[];
  /** Whether this declared slot's structural activation requirement holds. */
  readonly activationSatisfied: boolean;
  readonly selectedPossible: boolean;
  /** This is a structurally active editable pooled slot. */
  readonly active: true;
}

/**
 * Exact sequence reachability for one structurally active phase. The status
 * is intentionally separate from candidate support: support is absent for a
 * dormant suffix, while an absent status means this room has no exact
 * preparation coverage at all.
 */
export type EncounterPhaseSequenceStatus =
  { readonly kind: 'active' } | { readonly kind: 'dormantSuffix' };

export interface EncounterPhaseSequenceStatusEntry {
  readonly origin: EncounterPhaseAddress;
  readonly status: EncounterPhaseSequenceStatus;
}

/**
 * One room-local preparation result. `validPrefix` is the exact ordered
 * record prefix that may enter canonical history when a later slot is
 * invalid; no start, reward, counter, or completion effect accompanies it.
 * A valid suffix-terminating definition ends the active sequence at its own
 * stable slot, leaving retained later selections dormant.
 */
export interface PreparedEncounterPhases {
  readonly valid: boolean;
  readonly validPrefix: readonly ResolvedEncounterPhase[];
  readonly candidates: readonly EncounterPhaseCandidateSupport[];
  readonly statuses: readonly EncounterPhaseSequenceStatusEntry[];
  readonly findings: readonly SemanticFinding[];
  readonly blockedAt?: EncounterPhaseAddress;
}

export type EncounterAuthoringRoom = CanonicalAuthoredRoom | CanonicalLocalChildRoom;

function roomsEntered(view: HistoryStateView): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const room of view.ledgers.roomAppearances) {
    counts[room.gameName] = (counts[room.gameName] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

function effectiveCurrentRoomRewardType(room: EncounterAuthoringRoom): string | undefined {
  if (room.kind === 'authored' && room.clockworkReward === 'goal') return 'ClockworkGoal';
  return room.incomingReward?.offer.rewardType;
}

function enteredBiomeCount(catalog: Catalog, room: EncounterAuthoringRoom): number {
  const route = catalog.routes.byKey[room.origin.routeKey];
  const index = route?.biomeKeys.indexOf(room.origin.biomeKey) ?? -1;
  if (index < 0) {
    throw new Error(
      `${room.origin.routeKey} does not place ${room.origin.biomeKey} for encounter preparation`,
    );
  }
  return index + 1;
}

function requirementContext(
  catalog: Catalog,
  room: EncounterAuthoringRoom,
  declaration: RoomDeclaration,
  view: HistoryStateView,
): RequirementEvaluationContext {
  const goalsRemaining = view.ledgers.counters.clockworkGoalsRemaining;
  const nonGoalRewardsAcquired = view.ledgers.counters.clockworkNonGoalRewardsAcquired;
  const maxNonGoalRewards = view.ledgers.counters.clockworkMaxNonGoalRewards;
  const clockworkValues = [goalsRemaining, nonGoalRewardsAcquired, maxNonGoalRewards];
  const hasClockwork = clockworkValues.every((value) => value !== undefined);
  if (!hasClockwork && clockworkValues.some((value) => value !== undefined)) {
    throw new Error('encounter requirements received partial Clockwork facts');
  }
  return Object.freeze({
    counters: Object.freeze({
      biomeDepthCache: view.ledgers.counters.biomeDepthCache,
      biomeEncounterDepth: view.ledgers.counters.biomeEncounterDepth,
      encounterDepth: view.ledgers.counters.routeEncounterDepth,
      enteredBiomes: enteredBiomeCount(catalog, room),
      // Encounter declarations do not consume reward-owned trait facts; keep
      // this required context axis neutral rather than inventing a ledger.
      upgradableTraitCount: 0,
    }),
    records: Object.freeze({
      biomeUseRecord: Object.freeze({}),
      lootTypeHistory: Object.freeze({}),
      roomsEntered: roomsEntered(view),
      useRecord: Object.freeze({}),
    }),
    currentRoomShopOptionNames: new Set<string>(),
    currentRoomRewardType: effectiveCurrentRoomRewardType(room),
    currentRoomStructuralTags: declaration.structuralTags,
    rewardLookups: Object.freeze({}),
    runDepthCache: view.ledgers.counters.roomHistoryOrdinal + 1,
    lastEventRunDepthCaches: Object.freeze({}),
    recentEncounterEnvelopeSlots: projectRecentEncounterEnvelopeSlots(view),
    encounterHistory: Object.freeze({
      routeEncounterKeyCounts: projectRouteEncounterKeyCounts(view, room.origin.routeKey),
      biomeEncounterKeyCounts: projectBiomeEncounterKeyCounts(
        view,
        room.origin.routeKey,
        room.origin.biomeKey,
      ),
      previousRoomEncounterKeys: projectPreviousRoomEncounterKeys(view, room.origin),
    }),
    offeredExitCount: declaration.exits.length,
    currentBatchRoomGameNames: Object.freeze([]),
    clockwork: hasClockwork
      ? {
          remainingGoals: goalsRemaining!,
          nonGoalRewardsAcquired: nonGoalRewardsAcquired!,
          maxNonGoalRewards: maxNonGoalRewards!,
        }
      : undefined,
    flags: Object.freeze({ allSpellInvested: false, pendingSpellDrop: false }),
  });
}

function phaseAddress(room: EncounterAuthoringRoom, slotKey: string): EncounterPhaseAddress {
  const biome = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
  return room.kind === 'authored'
    ? createEncounterPhaseAddress(
        biome,
        { kind: 'occurrence', occurrenceId: room.occurrenceId },
        slotKey,
      )
    : createEncounterPhaseAddress(
        biome,
        {
          kind: 'localChild',
          occurrenceId: room.origin.occurrenceId,
          groupKey: room.groupKey,
          slotKey: room.slotKey,
        },
        slotKey,
      );
}

function selectedEncounterFinding(
  support: EncounterPhaseCandidateSupport,
  beforeSequence: number,
): SemanticFinding {
  return Object.freeze({
    code: 'encounterUnavailable',
    severity: 'error',
    phase: 'encounterResolution',
    origin: support.origin,
    evidence: Object.freeze({
      beforeSequence,
      selectedEncounterKey: support.selectedEncounterKey,
      candidateEncounterKeys: support.candidateEncounterKeys,
    }),
  });
}

function slotActivationFinding(
  origin: EncounterPhaseAddress,
  beforeSequence: number,
  slotKey: string,
): SemanticFinding {
  return Object.freeze({
    code: 'encounterSlotActivationUnavailable',
    severity: 'error',
    phase: 'encounterResolution',
    origin,
    evidence: Object.freeze({ beforeSequence, slotKey }),
  });
}

function slotActivationSatisfied(
  catalog: Catalog,
  room: EncounterAuthoringRoom,
  declaration: RoomDeclaration,
  slot: EncounterEnvelopeSlot,
  before: HistoryStateView,
): boolean {
  return (
    slot.activationRequirement === undefined ||
    evaluateRequirement(
      slot.activationRequirement,
      requirementContext(catalog, room, declaration, before),
    )
  );
}

/**
 * Evaluates every active pool-backed phase against the exact predecessor
 * checkpoint. A valid preceding phase extends the local record prefix for
 * later phase requirements without advancing any encounter counter. Once a
 * phase is invalid, later structurally active phases remain status-addressable
 * but unassessed: the blocker alone receives candidate support and findings.
 */
export function prepareRoomEncounterPhases(
  catalog: Catalog,
  room: EncounterAuthoringRoom,
  preparationCheckpoint: HistoryStateView,
): PreparedEncounterPhases {
  const declaration = catalog.rooms.byKey[room.gameName];
  if (declaration === undefined) {
    throw new Error(`encounter preparation lost declaration ${room.gameName}`);
  }
  const bindings = encounterBindingsBySlot(catalog, declaration, declaration.gameName);
  const slots = new Map(
    encounterEnvelopeSlots(catalog, declaration, declaration.gameName).map((slot) => [
      slot.key,
      slot,
    ]),
  );
  const candidates: EncounterPhaseCandidateSupport[] = [];
  const statuses: EncounterPhaseSequenceStatusEntry[] = [];
  const findings: SemanticFinding[] = [];
  const validPrefix: ResolvedEncounterPhase[] = [];
  let blockedAt: EncounterPhaseAddress | undefined;
  // The caller provides the real roomPrepared checkpoint. Later selected
  // phases advance this transient view through their preceding record facts,
  // exactly as the composed lifecycle event stream does.
  let preparation = preparationCheckpoint;
  let prefixValid = true;
  let suffixTerminated = false;

  for (const phase of room.encounterPhases) {
    const origin = phaseAddress(room, phase.slotKey);
    if (suffixTerminated) {
      statuses.push(
        Object.freeze({ origin, status: Object.freeze({ kind: 'dormantSuffix' as const }) }),
      );
      continue;
    }
    statuses.push(Object.freeze({ origin, status: Object.freeze({ kind: 'active' as const }) }));
    if (!prefixValid) continue;
    const binding = bindings.get(phase.slotKey);
    if (binding === undefined) {
      throw new Error(`${room.gameName} lost binding ${phase.slotKey}`);
    }
    const slot = slots.get(phase.slotKey);
    if (slot === undefined) {
      throw new Error(`${room.gameName} lost envelope slot ${phase.slotKey}`);
    }
    const activationSatisfied = slotActivationSatisfied(
      catalog,
      room,
      declaration,
      slot,
      preparation,
    );
    if (binding.kind === 'fixed') {
      if (phase.encounterKey !== binding.encounterDefinitionKey) {
        throw new Error(`${room.gameName}.${phase.slotKey} lost fixed encounter identity`);
      }
      if (!activationSatisfied) {
        findings.push(slotActivationFinding(origin, preparation.sequence, phase.slotKey));
        blockedAt ??= origin;
        prefixValid = false;
        continue;
      }
      if (prefixValid) {
        validPrefix.push(phase);
        preparation = projectEncounterRecordPreparation(
          preparation,
          room.origin,
          room.gameName,
          phase,
        );
        if (phase.sequenceEffect?.kind === 'terminateSuffix') suffixTerminated = true;
      }
      continue;
    }

    const set = encounterSetForBinding(catalog, binding, declaration.gameName);
    const context = requirementContext(catalog, room, declaration, preparation);
    const candidateEncounterKeys = Object.freeze(
      set.encounterDefinitionKeys.filter((key) => {
        const definition = catalog.encounterDefinitions.byKey[key];
        if (definition === undefined) {
          throw new Error(`${set.key} lost encounter ${key}`);
        }
        return (
          definition.requirements === undefined ||
          evaluateRequirement(definition.requirements, context)
        );
      }),
    );
    const support: EncounterPhaseCandidateSupport = Object.freeze({
      origin,
      selectedEncounterKey: phase.encounterKey,
      candidateEncounterKeys,
      activationSatisfied,
      selectedPossible: activationSatisfied && candidateEncounterKeys.includes(phase.encounterKey),
      active: true,
    });
    candidates.push(support);
    if (!activationSatisfied) {
      findings.push(slotActivationFinding(origin, preparation.sequence, phase.slotKey));
      blockedAt ??= support.origin;
      prefixValid = false;
      continue;
    }
    if (!support.selectedPossible) {
      findings.push(selectedEncounterFinding(support, preparation.sequence));
      blockedAt ??= support.origin;
      prefixValid = false;
      continue;
    }
    if (prefixValid) {
      validPrefix.push(phase);
      preparation = projectEncounterRecordPreparation(
        preparation,
        room.origin,
        room.gameName,
        phase,
      );
      if (phase.sequenceEffect?.kind === 'terminateSuffix') suffixTerminated = true;
    }
  }

  return Object.freeze({
    valid: blockedAt === undefined,
    validPrefix: Object.freeze(validPrefix),
    candidates: Object.freeze(candidates),
    statuses: Object.freeze(statuses),
    findings: Object.freeze(findings),
    ...(blockedAt === undefined ? {} : { blockedAt }),
  });
}
