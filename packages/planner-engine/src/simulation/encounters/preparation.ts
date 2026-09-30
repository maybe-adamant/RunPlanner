import { routeStartsWithUnfinishedIntroductions } from '../../authored-project/route-profile';
import { customizationValueRouteExcluded } from '../../authored-project/room-state/encounter-customization';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import { resolveEntryDeclaration } from '../../authored-project/room-state/entry-resolution';
import type {
  Catalog,
  EncounterEnvelopeSlot,
  GeneratedEncounterSelection,
  RoomDeclaration,
} from '../../catalog-schema';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  type EncounterPhaseAddress,
} from '../../authored-project/addresses';
import {
  encounterAuthoringProfileOnRoute,
  encounterAuthoringProfiles,
  encounterBindingsBySlot,
  encounterEnvelopeSlots,
  encounterSetForBinding,
} from '../../authored-project/room-state/encounter-envelope';
import {
  evaluateRequirement,
  type RequirementEvaluationContext,
  type RequirementExpression,
} from '../../requirements';
import {
  projectBiomeEncounterKeyCounts,
  projectEncounterRecordPreparation,
  projectOfferedExitCount,
  projectEncounterPreparationRoomWindow,
  projectRecentEncounterEnvelopeSlots,
  projectRouteEncounterCompletionCounts,
  projectRouteEncounterKeyCounts,
} from '../history/facts';
import type { HistoryStateView } from '../history/model';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { SemanticFinding } from '../model';
import type { ResolvedEncounterPhase } from './model';
import {
  generationAdmissionContext,
  prepareGeneratedEncounter,
  type GeneratedEncounterCandidateCapability,
  type GenerationAdmissionFacts,
} from './generation-preparation';
import { admissibleEnemyKeys, type EncounterGenerationContext } from './generation';
import { prepareInfiniteRoster, type InfiniteRosterCandidateCapability } from './infinite-roster';
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
      /** Exact selected identity resolved at preparation, before recording or execution. */
      readonly encounterDefinitionKey?: string;
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
  readonly rosters: readonly InfiniteRosterCandidateCapability[];
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
  const preparationRoomWindow = projectEncounterPreparationRoomWindow(view, room.origin).map(
    (appearance) => appearance.encounterKeys,
  );
  return Object.freeze({
    routeKey: routePosition.routeKey,
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
      const resolution = encounterResolutionContext(room, declaration, routePosition.routeKey);
      return resolution.kind === 'knownReward' ? resolution.rewardType : undefined;
    })(),
    currentRoomStructuralTags: declaration.structuralTags,
    rewardLookups: Object.freeze({}),
    // No encounter declaration consults the per-map offered-reward fact; the
    // ordinary World Shop inventory entry is its only consumer.
    offeredRewardTypes: new Set<string>(),
    runDepthCache: view.ledgers.counters.roomHistoryOrdinal + 1,
    lastEventRunDepthCaches: Object.freeze({}),
    recentEncounterEnvelopeSlots: projectRecentEncounterEnvelopeSlots(view),
    encounterHistory: Object.freeze({
      routeEncounterKeyCounts: projectRouteEncounterKeyCounts(view, room.origin.routeKey),
      routeEncounterCompletionCounts: projectRouteEncounterCompletionCounts(
        view,
        room.origin.routeKey,
      ),
      biomeEncounterKeyCounts: projectBiomeEncounterKeyCounts(
        view,
        room.origin.routeKey,
        room.origin.biomeKey,
      ),
      previousRoomEncounterKeys: preparationRoomWindow,
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
  readonly effectiveShadowRank?: number;
  readonly pendingSpellDrop?: boolean;
  readonly allSpellInvested?: boolean;
  readonly rewardGeneration?: HistoryStateView | undefined;
  readonly hordesRankAt?: (
    selection: GeneratedEncounterSelection,
    origin: EncounterPhaseAddress,
  ) => number | undefined;
  readonly fangsRankAt?: (origin: EncounterPhaseAddress) => number | undefined;
  readonly menaceRankAt?: (origin: EncounterPhaseAddress) => number | undefined;
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

/** A retained choice its route cannot produce stays authored but unsupported. */
function withoutRouteExcludedChoices(
  phase: ResolvedEncounterPhase,
  routeKey: string,
): ResolvedEncounterPhase {
  if (phase.customization === undefined) return phase;
  if (
    !phase.customization.some(
      (decision) =>
        decision.valueSupported &&
        decision.value !== undefined &&
        customizationValueRouteExcluded(decision, decision.value, routeKey),
    )
  )
    return phase;
  return Object.freeze({
    ...phase,
    customization: Object.freeze(
      phase.customization.map((decision) =>
        decision.valueSupported &&
        decision.value !== undefined &&
        customizationValueRouteExcluded(decision, decision.value, routeKey)
          ? Object.freeze({ ...decision, valueSupported: false })
          : decision,
      ),
    ),
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
  customizationRequired: boolean,
): void {
  for (const decision of phase.customization ?? []) {
    const generated =
      phase.generatedCustomization?.decisionKey === decision.key
        ? phase.generatedCustomization
        : undefined;
    for (const requirement of generated?.introductionRequirements ?? [])
      findings.push(
        Object.freeze({
          code: 'encounterIntroductionRequired',
          severity: 'error',
          phase: 'encounterResolution',
          origin,
          evidence: Object.freeze({ beforeSequence, decisionKey: decision.key, ...requirement }),
        }),
      );
    if (!decision.valueSupported && generated?.onlyIntroductionIssues !== true)
      findings.push(customizationFinding(origin, beforeSequence, decision.key));
    // Only an authored composition keeps the route's introduction history exact.
    if (
      customizationRequired &&
      decision.selection.kind === 'generated' &&
      decision.replaced !== true &&
      decision.value === undefined
    )
      findings.push(
        Object.freeze({
          code: 'encounterCustomizationRequired',
          severity: 'error',
          phase: 'encounterResolution',
          origin,
          evidence: Object.freeze({ beforeSequence, decisionKey: decision.key }),
        }),
      );
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

/** Every generated enemy the catalog links to this introduction, in declaration order. */
function introductionTriggerEnemyKeys(catalog: Catalog, definitionKey: string): readonly string[] {
  const keys = new Set<string>();
  for (const definition of catalog.encounterDefinitions.values)
    for (const decision of definition.customization ?? [])
      if (decision.selection.kind === 'generated')
        for (const choice of decision.selection.choices)
          if (choice.introductionEncounterKey === definitionKey) keys.add(choice.key);
  return Object.freeze([...keys]);
}

/**
 * An enemy-triggered introduction whose gate passes is still unreachable unless
 * an eligible ordinary identity here could draw one of its trigger enemies.
 * Returns each unreachable member with the trigger enemies it would need.
 */
function unreachableIntroductionTriggers(
  catalog: Catalog,
  gated: readonly { readonly profileKey: string; readonly definitionKey: string }[],
  admissionContext: (policy: GeneratedEncounterSelection) => EncounterGenerationContext,
): ReadonlyMap<string, readonly string[]> {
  const policies = gated.flatMap(({ definitionKey }) => {
    const definition = catalog.encounterDefinitions.byKey[definitionKey]!;
    if (definition.enemyTriggeredIntroduction === true) return [];
    const decision = definition.customization?.find(
      (entry) => entry.selection.kind === 'generated',
    );
    return decision?.selection.kind === 'generated' ? [decision.selection] : [];
  });
  const unreachable = new Map<string, readonly string[]>();
  for (const { profileKey, definitionKey } of gated) {
    if (catalog.encounterDefinitions.byKey[definitionKey]!.enemyTriggeredIntroduction !== true)
      continue;
    const triggers = introductionTriggerEnemyKeys(catalog, definitionKey);
    const reachable = policies.some((policy) => {
      const admissible = admissibleEnemyKeys(policy, admissionContext(policy));
      return triggers.some((key) => admissible.includes(key));
    });
    if (!reachable) unreachable.set(profileKey, triggers);
  }
  return unreachable;
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
  const rosters: InfiniteRosterCandidateCapability[] = [];
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

  const unfinishedIntroductions = routeStartsWithUnfinishedIntroductions(
    catalog,
    routePosition.routeKey,
  );
  const minDepthBeforeIntros = unfinishedIntroductions
    ? catalog.biomes.byKey[room.origin.biomeKey]?.minDepthBeforeIntros
    : undefined;
  if (unfinishedIntroductions && minDepthBeforeIntros === undefined)
    throw new Error(`encounter preparation lost biome ${room.origin.biomeKey}`);
  // Room-owned admission facts at the current preparation checkpoint: enemies
  // whose declared admission fails, and on a fresh profile the introductions
  // completed on the route and those whose native gate passes here.
  const admissionAt = (
    policy: GeneratedEncounterSelection,
    before: HistoryStateView,
  ): GenerationAdmissionFacts => {
    let gateContext: RequirementEvaluationContext | undefined;
    const passes = (requirement: RequirementExpression) =>
      evaluateRequirement(
        requirement,
        (gateContext ??= requirementContext(
          catalog,
          room,
          routePosition,
          declaration,
          before,
          pendingSpellDrop,
          allSpellInvested,
        )),
      );
    const inadmissible = policy.choices.flatMap((choice) =>
      choice.admission === undefined || passes(choice.admission) ? [] : [choice.key],
    );
    const facts =
      inadmissible.length === 0 ? {} : { inadmissibleEnemyKeys: Object.freeze(inadmissible) };
    if (minDepthBeforeIntros === undefined) return facts;
    const completed = projectRouteEncounterCompletionCounts(before, routePosition.routeKey);
    const linked = new Set(
      policy.choices.flatMap((choice) =>
        choice.introductionEncounterKey === undefined ? [] : [choice.introductionEncounterKey],
      ),
    );
    return Object.freeze({
      ...facts,
      introductions: Object.freeze({
        completedEncounterKeys: Object.freeze(Object.keys(completed)),
        triggeredEncounterKeys: Object.freeze(
          [...linked].filter((key) => {
            if (completed[key] !== undefined) return false;
            const gate = catalog.encounterDefinitions.byKey[key]?.requirements;
            return gate === undefined || passes(gate);
          }),
        ),
        minDepthBeforeIntros,
      }),
    });
  };
  const prepareCustomization = (
    resolved: ResolvedEncounterPhase,
    origin: EncounterPhaseAddress,
  ) => {
    const phase = withoutRouteExcludedChoices(resolved, routePosition.routeKey);
    const result = prepareGeneratedEncounter(
      phase,
      origin,
      preparation,
      runState.rewardGeneration,
      runState.hordesRankAt,
      runState.fangsRankAt,
      runState.menaceRankAt,
      admissionAt,
    );
    if (result.capability !== undefined) generation.push(result.capability);
    const roster = prepareInfiniteRoster(result.phase, origin, preparation);
    if (roster.capability !== undefined) rosters.push(roster.capability);
    return roster.phase;
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
    // Route encounter counts only feed a first-biome identity's completion guard.
    const guardsFirstBiome =
      binding.kind === 'set' &&
      encounterAuthoringProfiles(
        encounterSetForBinding(catalog, binding, declaration.gameName),
      ).some(
        (profile) =>
          profile.resolution.kind === 'rewardContext' &&
          (profile.resolution.firstBiomeEncounterDefinitionKey !== undefined ||
            profile.resolution.firstBiomeEncounterDefinitionKeyByRoute?.[routePosition.routeKey] !==
              undefined),
      );
    const resolution = encounterResolutionContext(room, declaration, routePosition.routeKey, {
      biomeEncounterDepth: preparation.ledgers.counters.biomeEncounterDepth,
      routeEncounterKeyCounts: guardsFirstBiome
        ? projectRouteEncounterKeyCounts(preparation, routePosition.routeKey)
        : {},
    });
    if (binding.kind === 'fixed') {
      const preparedPhase =
        binding.shadowEncounterDefinitionKey === undefined
          ? phase
          : {
              ...phase,
              authoredChoiceKey:
                (runState.effectiveShadowRank ?? 0) > 0
                  ? binding.shadowEncounterDefinitionKey
                  : binding.encounterDefinitionKey,
            };
      let resolvedPhase = resolveMaterializedEncounterPhase(
        catalog,
        declaration,
        preparedPhase,
        resolution,
      );
      if (resolvedPhase === undefined) {
        throw new Error(`${room.gameName}.${phase.slotKey} lost fixed encounter identity`);
      }
      statuses[statuses.length - 1] = Object.freeze({
        origin,
        status: Object.freeze({
          kind: 'active',
          encounterDefinitionKey: resolvedPhase.encounterKey,
        }),
      });
      if (!activationSatisfied) {
        findings.push(slotActivationFinding(origin, preparation.sequence, phase.slotKey));
        blockedAt ??= origin;
        prefixValid = false;
        continue;
      }
      if (prefixValid) {
        resolvedPhase = prepareCustomization(resolvedPhase, origin);
        appendCustomizationFindings(
          findings,
          resolvedPhase,
          origin,
          preparation.sequence,
          unfinishedIntroductions,
        );
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
    const selectedDefinitionKey = resolvedDefinitionsByProfile.get(phase.authoredChoiceKey);
    if (selectedDefinitionKey !== undefined) {
      statuses[statuses.length - 1] = Object.freeze({
        origin,
        status: Object.freeze({ kind: 'active', encounterDefinitionKey: selectedDefinitionKey }),
      });
    }
    const gatedEncounterKeys = profiles
      .filter((profile) => {
        if (!encounterAuthoringProfileOnRoute(profile, routePosition.routeKey)) return false;
        const key = resolvedDefinitionsByProfile.get(profile.key);
        const definition = key === undefined ? undefined : catalog.encounterDefinitions.byKey[key];
        if (key !== undefined && definition === undefined)
          throw new Error(`${set.key} lost encounter ${key}`);
        return (
          definition !== undefined &&
          (definition.requirements === undefined ||
            evaluateRequirement(definition.requirements, context))
        );
      })
      .map((profile) => profile.key);
    const unreachableIntroductions = unreachableIntroductionTriggers(
      catalog,
      gatedEncounterKeys.flatMap((key) => {
        const definitionKey = resolvedDefinitionsByProfile.get(key);
        return definitionKey === undefined ? [] : [{ profileKey: key, definitionKey }];
      }),
      (policy) => generationAdmissionContext(preparation, admissionAt(policy, preparation)),
    );
    const candidateEncounterKeys = Object.freeze(
      gatedEncounterKeys.filter((key) => !unreachableIntroductions.has(key)),
    );
    const exclusions: readonly EncounterCandidateExclusion[] = Object.freeze(
      profiles
        .filter(
          (profile) =>
            !candidateEncounterKeys.includes(profile.key) &&
            // A retained off-route selection keeps its evidence for repair.
            (encounterAuthoringProfileOnRoute(profile, routePosition.routeKey) ||
              profile.key === phase.authoredChoiceKey),
        )
        .map((profile) => {
          const key = resolvedDefinitionsByProfile.get(profile.key);
          if (key === undefined)
            return Object.freeze({
              encounterKey: profile.key,
              kind: 'resolutionUnavailable' as const,
            });
          const triggerEnemyKeys = unreachableIntroductions.get(profile.key);
          if (triggerEnemyKeys !== undefined)
            return Object.freeze({
              encounterKey: profile.key,
              kind: 'introductionUnreachable' as const,
              encounterDefinitionKey: key,
              triggerEnemyKeys,
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
      appendCustomizationFindings(
        findings,
        resolvedPhase,
        origin,
        preparation.sequence,
        unfinishedIntroductions,
      );
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
    rosters: Object.freeze(rosters),
    statuses: Object.freeze(statuses),
    findings: Object.freeze(findings),
    ...(blockedAt === undefined ? {} : { blockedAt }),
  });
}
