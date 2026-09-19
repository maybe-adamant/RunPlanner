import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import { resolveEntryDeclaration } from '../../authored-project/room-state/entry-resolution';
import type { Catalog, EncounterEnvelopeSlot, RoomDeclaration } from '../../catalog-schema';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  type EncounterPhaseAddress,
} from '../../authored-project/addresses';
import {
  encounterAuthoringProfiles,
  encounterBindingsBySlot,
  encounterEnvelopeSlots,
  encounterSetForBinding,
} from '../../authored-project/room-state/encounter-envelope';
import { evaluateRequirement, type RequirementEvaluationContext } from '../../requirements';
import {
  projectBiomeEncounterKeyCounts,
  projectEncounterRecordPreparation,
  projectOfferedExitCount,
  projectPreviousRoomEncounterKeys,
  projectRecentEncounterEnvelopeSlots,
  projectRouteEncounterKeyCounts,
} from '../history/facts';
import type { HistoryStateView } from '../history/model';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { SemanticFinding } from '../model';
import type { ResolvedEncounterPhase } from './model';
import {
  prepareGeneratedEncounter,
  type GeneratedEncounterCandidateCapability,
} from './generation-preparation';
import {
  encounterResolutionContext,
  resolveEncounterAuthoringProfile,
  resolveMaterializedEncounterPhase,
} from './resolve';
import {
  encounterRequirementEvidence,
  type EncounterCandidateExclusion,
  type EncounterRequirementEvidence,
} from './requirement-evidence';

export interface EncounterPhaseCandidateSupport {
  readonly origin: EncounterPhaseAddress;
  readonly selectedEncounterKey: string;
  readonly candidateEncounterKeys: readonly string[];
  readonly exclusions: readonly EncounterCandidateExclusion[];
  /** Whether this declared slot's structural activation requirement holds. */
  readonly activationSatisfied: boolean;
  readonly activationFailure?: EncounterRequirementEvidence;
  readonly selectedPossible: boolean;
  /** This is a structurally active editable pooled slot. */
  readonly active: true;
  /** Independent phase-local Fig Leaf control support, when reached. */
}

/**
 * Exact sequence reachability for one structurally active phase. The status
 * is intentionally separate from candidate support: support is absent for a
 * dormant suffix, while an absent status means this room has no exact
 * preparation coverage at all.
 */
export type EncounterPhaseSequenceStatus =
  | {
      readonly kind: 'active';
      /** Present only after this phase actually starts; preparation alone is not execution. */
      readonly execution?: 'normal' | 'skippedByFigLeaf';
    }
  | { readonly kind: 'dormantSuffix' };

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
  readonly generation: readonly GeneratedEncounterCandidateCapability[];
  readonly statuses: readonly EncounterPhaseSequenceStatusEntry[];
  readonly findings: readonly SemanticFinding[];
  readonly blockedAt?: EncounterPhaseAddress;
}

export type EncounterAuthoringRoom = CanonicalAuthoredRoom;

function roomsEntered(view: HistoryStateView): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const room of view.ledgers.roomAppearances) {
    counts[room.gameName] = (counts[room.gameName] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

function requirementContext(
  catalog: Catalog,
  room: EncounterAuthoringRoom,
  routePosition: ResolvedRoutePosition,
  declaration: RoomDeclaration,
  view: HistoryStateView,
  pendingSpellDrop: boolean,
  allSpellInvested = false,
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
      enteredBiomes: routePosition.ordinal,
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
    currentRoomRewardType: (() => {
      const resolution = encounterResolutionContext(room, declaration);
      return resolution.kind === 'knownReward' ? resolution.rewardType : undefined;
    })(),
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
    offeredExitCount: projectOfferedExitCount(view, room.origin, declaration.exits.length),
    currentBatchRoomGameNames: Object.freeze([]),
    clockwork: hasClockwork
      ? {
          remainingGoals: goalsRemaining!,
          nonGoalRewardsAcquired: nonGoalRewardsAcquired!,
          maxNonGoalRewards: maxNonGoalRewards!,
        }
      : undefined,
    flags: Object.freeze({ allSpellInvested, pendingSpellDrop }),
  });
}

/**
 * A direct encounter query has no route-branch input.  Lifecycle composition
 * supplies this narrow attested fact when a delayed Shrine Spell is live.
 */
export interface EncounterPreparationRunState {
  readonly pendingSpellDrop?: boolean;
  readonly allSpellInvested?: boolean;
  readonly rewardGeneration?: HistoryStateView | undefined;
}

function phaseAddress(room: EncounterAuthoringRoom, slotKey: string): EncounterPhaseAddress {
  const biome = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
  return createEncounterPhaseAddress(
    biome,
    { kind: 'occurrence', occurrenceId: room.occurrenceId },
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

function customizationFinding(
  origin: EncounterPhaseAddress,
  beforeSequence: number,
  decisionKey: string,
): SemanticFinding {
  return Object.freeze({
    code: 'encounterCustomizationUnavailable',
    severity: 'error',
    phase: 'encounterResolution',
    origin,
    evidence: Object.freeze({ beforeSequence, decisionKey }),
  });
}

function appendCustomizationFindings(
  findings: SemanticFinding[],
  phase: ResolvedEncounterPhase,
  origin: EncounterPhaseAddress,
  beforeSequence: number,
): void {
  for (const decision of phase.customization ?? []) {
    if (!decision.valueSupported)
      findings.push(customizationFinding(origin, beforeSequence, decision.key));
  }
}

function slotActivationSatisfied(
  catalog: Catalog,
  room: EncounterAuthoringRoom,
  routePosition: ResolvedRoutePosition,
  declaration: RoomDeclaration,
  slot: EncounterEnvelopeSlot,
  before: HistoryStateView,
  pendingSpellDrop: boolean,
  allSpellInvested = false,
): boolean {
  return (
    slot.activationRequirement === undefined ||
    evaluateRequirement(
      slot.activationRequirement,
      requirementContext(
        catalog,
        room,
        routePosition,
        declaration,
        before,
        pendingSpellDrop,
        allSpellInvested,
      ),
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
  routePosition: ResolvedRoutePosition,
  preparationCheckpoint: HistoryStateView,
  runState: EncounterPreparationRunState = Object.freeze({}),
): PreparedEncounterPhases {
  const rawDeclaration = catalog.rooms.byKey[room.gameName];
  if (rawDeclaration === undefined) {
    throw new Error(`encounter preparation lost declaration ${room.gameName}`);
  }
  const declaration = resolveEntryDeclaration(rawDeclaration, routePosition);
  const bindings = encounterBindingsBySlot(catalog, declaration, declaration.gameName);
  const pendingSpellDrop = runState.pendingSpellDrop === true;
  const allSpellInvested = runState.allSpellInvested === true;
  const slots = new Map(
    encounterEnvelopeSlots(catalog, declaration, declaration.gameName).map((slot) => [
      slot.key,
      slot,
    ]),
  );
  const candidates: EncounterPhaseCandidateSupport[] = [];
  const generation: GeneratedEncounterCandidateCapability[] = [];
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

  const prepareCustomization = (phase: ResolvedEncounterPhase, origin: EncounterPhaseAddress) => {
    const result = prepareGeneratedEncounter(phase, origin, preparation, runState.rewardGeneration);
    if (result.capability !== undefined) generation.push(result.capability);
    return result.phase;
  };

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
      routePosition,
      declaration,
      slot,
      preparation,
      pendingSpellDrop,
      allSpellInvested,
    );
    const resolution = encounterResolutionContext(room, declaration);
    if (binding.kind === 'fixed') {
      let resolvedPhase = resolveMaterializedEncounterPhase(
        catalog,
        declaration,
        phase,
        resolution,
      );
      if (resolvedPhase === undefined) {
        throw new Error(`${room.gameName}.${phase.slotKey} lost fixed encounter identity`);
      }
      if (!activationSatisfied) {
        findings.push(slotActivationFinding(origin, preparation.sequence, phase.slotKey));
        blockedAt ??= origin;
        prefixValid = false;
        continue;
      }
      if (prefixValid) {
        resolvedPhase = prepareCustomization(resolvedPhase, origin);
        appendCustomizationFindings(findings, resolvedPhase, origin, preparation.sequence);
        validPrefix.push(resolvedPhase);
        preparation = projectEncounterRecordPreparation(
          preparation,
          room.origin,
          room.gameName,
          resolvedPhase,
        );
        if (resolvedPhase.sequenceEffect?.kind === 'terminateSuffix') suffixTerminated = true;
      }
      continue;
    }

    const set = encounterSetForBinding(catalog, binding, declaration.gameName);
    const context = requirementContext(
      catalog,
      room,
      routePosition,
      declaration,
      preparation,
      pendingSpellDrop,
      allSpellInvested,
    );
    const profiles = encounterAuthoringProfiles(set);
    const resolvedDefinitionsByProfile = new Map(
      profiles.map((profile) => [
        profile.key,
        resolveEncounterAuthoringProfile(profile, resolution),
      ]),
    );
    const candidateEncounterKeys = Object.freeze(
      profiles
        .filter((profile) => {
          const key = resolvedDefinitionsByProfile.get(profile.key);
          const definition =
            key === undefined ? undefined : catalog.encounterDefinitions.byKey[key];
          if (key !== undefined && definition === undefined)
            throw new Error(`${set.key} lost encounter ${key}`);
          return (
            definition !== undefined &&
            (definition.requirements === undefined ||
              evaluateRequirement(definition.requirements, context))
          );
        })
        .map((profile) => profile.key),
    );
    const exclusions: readonly EncounterCandidateExclusion[] = Object.freeze(
      profiles
        .filter((profile) => !candidateEncounterKeys.includes(profile.key))
        .map((profile) => {
          const key = resolvedDefinitionsByProfile.get(profile.key);
          if (key === undefined)
            return Object.freeze({
              encounterKey: profile.key,
              kind: 'resolutionUnavailable' as const,
            });
          const requirement = catalog.encounterDefinitions.byKey[key]?.requirements;
          if (requirement === undefined) throw new Error(`${key} excluded without requirements`);
          return Object.freeze({
            encounterKey: profile.key,
            kind: 'requirements' as const,
            definitions: Object.freeze([
              Object.freeze({
                encounterDefinitionKey: key,
                evaluation: encounterRequirementEvidence(requirement, context),
              }),
            ]),
          });
        }),
    );
    const support: EncounterPhaseCandidateSupport = Object.freeze({
      origin,
      selectedEncounterKey: phase.authoredChoiceKey,
      candidateEncounterKeys,
      exclusions,
      activationSatisfied,
      ...(!activationSatisfied && slot.activationRequirement !== undefined
        ? { activationFailure: encounterRequirementEvidence(slot.activationRequirement, context) }
        : {}),
      selectedPossible:
        activationSatisfied && candidateEncounterKeys.includes(phase.authoredChoiceKey),
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
      let resolvedPhase = resolveMaterializedEncounterPhase(
        catalog,
        declaration,
        phase,
        resolution,
      );
      if (resolvedPhase === undefined)
        throw new Error(`${set.key}.${phase.authoredChoiceKey} lacks resolution`);
      resolvedPhase = prepareCustomization(resolvedPhase, origin);
      appendCustomizationFindings(findings, resolvedPhase, origin, preparation.sequence);
      validPrefix.push(resolvedPhase);
      preparation = projectEncounterRecordPreparation(
        preparation,
        room.origin,
        room.gameName,
        resolvedPhase,
      );
      if (resolvedPhase.sequenceEffect?.kind === 'terminateSuffix') suffixTerminated = true;
    }
  }

  return Object.freeze({
    valid: blockedAt === undefined,
    validPrefix: Object.freeze(validPrefix),
    candidates: Object.freeze(candidates),
    generation: Object.freeze(generation),
    statuses: Object.freeze(statuses),
    findings: Object.freeze(findings),
    ...(blockedAt === undefined ? {} : { blockedAt }),
  });
}
