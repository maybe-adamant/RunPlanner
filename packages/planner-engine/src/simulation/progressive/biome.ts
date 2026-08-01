import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createExitSelectionAddress,
  semanticAddressKey,
  type BiomeAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type { AuthoredBiomePlan } from '../../authored-project/model';
import {
  evaluateBiomeRoomGenerationAssembly,
  evaluateHubDecisionGeneration,
  type GeneratedRoomGenerationValidation,
  type HubRoomGenerationValidation,
} from '../generation';
import {
  createBiomeCandidateArtifacts,
  type BiomeCandidateArtifacts,
} from '../candidate-artifacts';
import {
  composeBiomeHistoryPrefix,
  type BiomeHistoryPrefix,
  type CanonicalBiomeHistory,
} from '../history';
import type {
  CanonicalDecision,
  CanonicalHubVisit,
  CanonicalTarget,
  MaterializedBiomePrefix,
  MaterializedExitDecisionFrontier,
  MaterializedHubVisitFrontier,
} from '../materialization';
import { materializeBiomePrefix } from '../materialization';
import type { SemanticFinding } from '../model';
import {
  evaluateBiomeRewardsAssembly,
  type BiomeRewardSimulation,
  type RewardBranch,
} from '../rewards';
import type { RewardProducerCandidateArtifacts } from '../rewards/producer-frontiers';
import type { RoomLifecycleCandidateArtifacts } from '../rewards/lifecycle-artifacts';

export interface BiomeGenerationValidation {
  readonly validity: 'invalid' | 'valid';
  readonly ordinary: GeneratedRoomGenerationValidation;
  readonly hub: HubRoomGenerationValidation;
  readonly findings: readonly SemanticFinding[];
}

export interface ProgressiveBiomeEvaluation {
  readonly materializedPrefix: MaterializedBiomePrefix;
  readonly history: BiomeHistoryPrefix;
  readonly roomGeneration: BiomeGenerationValidation;
  readonly rewards: BiomeRewardSimulation;
  readonly findings: readonly SemanticFinding[];
  readonly blockedAt?: SemanticAddress;
}

export interface ProgressiveBiomeEvaluationAssembly {
  readonly evaluation: ProgressiveBiomeEvaluation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
}

interface ProgressiveSeed {
  readonly history: CanonicalBiomeHistory;
  readonly rewardBranches: readonly RewardBranch[];
}

interface ProgressiveGenerationAssembly {
  readonly validation: BiomeGenerationValidation;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
}

function generation(
  catalog: Catalog,
  prefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  history: BiomeHistoryPrefix,
  enteredBiomeCount: number,
  rewards: BiomeRewardSimulation,
  rewardProducers: RewardProducerCandidateArtifacts,
  roomLifecycles: RoomLifecycleCandidateArtifacts,
): ProgressiveGenerationAssembly {
  const ordinary = evaluateBiomeRoomGenerationAssembly(
    catalog,
    prefix,
    history,
    enteredBiomeCount,
    rewards.targetHistory,
  );
  const hub = evaluateHubDecisionGeneration(catalog, prefix, history);
  const validation: BiomeGenerationValidation = Object.freeze({
    validity:
      ordinary.validation.validity === 'valid' && hub.validity === 'valid' ? 'valid' : 'invalid',
    ordinary: ordinary.validation,
    hub,
    findings: Object.freeze([...ordinary.validation.findings, ...hub.findings]),
  });
  return Object.freeze({
    validation,
    candidateArtifacts: createBiomeCandidateArtifacts(
      createBiomeAddress(prefix.routeKey, prefix.biomeKey),
      ordinary.candidateArtifacts,
      rewardProducers,
      roomLifecycles,
    ),
  });
}

interface ProgressiveProducts {
  readonly evaluation: Omit<ProgressiveBiomeEvaluation, 'materializedPrefix' | 'blockedAt'>;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
}

function products(
  catalog: Catalog,
  prefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  enteredBiomeCount: number,
  seed?: ProgressiveSeed,
): ProgressiveProducts {
  const history = composeBiomeHistoryPrefix(catalog, prefix, seed?.history.afterTransition);
  if (history === null) {
    throw new Error(`${prefix.biomeKey} materialized prefix has no composable history`);
  }
  const rewards = evaluateBiomeRewardsAssembly(
    catalog,
    prefix,
    history,
    enteredBiomeCount,
    seed?.rewardBranches,
  );
  const roomGeneration = generation(
    catalog,
    prefix,
    history,
    enteredBiomeCount,
    rewards.simulation,
    rewards.producerArtifacts,
    rewards.lifecycleArtifacts,
  );
  return Object.freeze({
    evaluation: Object.freeze({
      history,
      rewards: rewards.simulation,
      roomGeneration: roomGeneration.validation,
      findings: Object.freeze([]),
    }),
    candidateArtifacts: roomGeneration.candidateArtifacts,
  });
}

function mergedFindings(
  evaluated: Omit<ProgressiveBiomeEvaluation, 'materializedPrefix' | 'blockedAt'>,
  retained: readonly SemanticFinding[] = [],
): readonly SemanticFinding[] {
  const findings = [
    ...retained,
    ...evaluated.roomGeneration.findings,
    ...evaluated.rewards.findings,
  ];
  const seen = new Set<string>();
  return Object.freeze(
    findings.filter((finding) => {
      const key = `${finding.code}:${semanticAddressKey(finding.origin)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}

function ownsOccurrence(origin: SemanticAddress, occurrenceId: string): boolean {
  return 'occurrenceId' in origin && origin.occurrenceId === occurrenceId;
}

function decisionOwnsFinding(decision: CanonicalDecision, finding: SemanticFinding): boolean {
  const origin = finding.origin;
  if (semanticAddressKey(decision.origin) === semanticAddressKey(origin)) return true;
  if (decision.kind === 'linkedExit') {
    return (
      semanticAddressKey(decision.target.origin) === semanticAddressKey(origin) ||
      ownsOccurrence(origin, decision.target.room.occurrenceId)
    );
  }
  if (decision.kind === 'batch') {
    return (
      semanticAddressKey(decision.selectedOrigin) === semanticAddressKey(origin) ||
      semanticAddressKey(decision.rewardStore.origin) === semanticAddressKey(origin) ||
      semanticAddressKey(decision.parent.origin) === semanticAddressKey(origin) ||
      decision.targets.some(
        (target) =>
          semanticAddressKey(target.origin) === semanticAddressKey(origin) ||
          ownsOccurrence(origin, target.room.occurrenceId),
      )
    );
  }
  return (
    semanticAddressKey(decision.board.origin) === semanticAddressKey(origin) ||
    semanticAddressKey(decision.room.origin) === semanticAddressKey(origin) ||
    decision.board.targets.some(
      (target) =>
        semanticAddressKey(target.origin) === semanticAddressKey(origin) ||
        ownsOccurrence(origin, target.room.occurrenceId),
    ) ||
    decision.visits.some(
      (visit) =>
        semanticAddressKey(visit.origin) === semanticAddressKey(origin) ||
        visit.localSlots.some(
          (slot) =>
            semanticAddressKey(slot.origin) === semanticAddressKey(origin) ||
            ownsOccurrence(origin, slot.origin.occurrenceId),
        ),
    )
  );
}

interface LocatedFinding {
  readonly finding: SemanticFinding;
  readonly decisionIndex: number;
  /** The owner belongs to the physical batch retained at the exit frontier. */
  readonly frontierBatch?: boolean;
  /** Earlier normal-door targets are already generated before this target. */
  readonly targetIndex?: number;
  /** Hub board targets exist before any selected Hub visit. */
  readonly hubBoardTargetIndex?: number;
  readonly hubVisitIndex?: number;
  readonly hubVisitPhase?: MaterializedHubVisitFrontier['phase'];
  readonly hubLocalLifecycleIndex?: number;
}

function lifecycleFinding(finding: SemanticFinding): boolean {
  return (
    finding.code === 'rewardAcquisitionUnavailable' ||
    finding.code === 'shopOfferUnavailable' ||
    finding.code === 'shopPurchaseUnavailable'
  );
}

function targetIndex(
  decision: Extract<CanonicalDecision, { readonly kind: 'batch' }>,
  finding: SemanticFinding,
): number | undefined {
  const index = decision.targets.findIndex(
    (target) =>
      semanticAddressKey(target.origin) === semanticAddressKey(finding.origin) ||
      ownsOccurrence(finding.origin, target.room.occurrenceId),
  );
  return index < 0 ? undefined : index;
}

function localSlotIndex(visit: CanonicalHubVisit, finding: SemanticFinding): number | undefined {
  const index = visit.localSlots.findIndex(
    (slot) =>
      semanticAddressKey(slot.origin) === semanticAddressKey(finding.origin) ||
      (slot.incomingReward !== undefined &&
        semanticAddressKey(slot.incomingReward.origin) === semanticAddressKey(finding.origin)),
  );
  return index < 0 ? undefined : index;
}

interface HubVisitFindingLocation {
  readonly visitIndex: number;
  readonly phase: MaterializedHubVisitFrontier['phase'];
  readonly localLifecycleIndex?: number;
}

function hubVisitFindingLocation(
  decision: Extract<CanonicalDecision, { readonly kind: 'hub' }>,
  finding: SemanticFinding,
): HubVisitFindingLocation | undefined {
  const origin = finding.origin;
  for (const [index, visit] of decision.visits.entries()) {
    const localIndex = localSlotIndex(visit, finding);
    if (localIndex !== undefined) {
      const enteredIndex = visit.enteredLocalRooms.findIndex(
        (slot) =>
          semanticAddressKey(slot.origin) ===
          semanticAddressKey(visit.localSlots[localIndex]!.origin),
      );
      return finding.phase === 'rewardGeneration' && lifecycleFinding(finding) && enteredIndex >= 0
        ? Object.freeze({
            visitIndex: index,
            phase: 'localRoomLifecycle',
            localLifecycleIndex: enteredIndex,
          })
        : Object.freeze({ visitIndex: index, phase: 'sideGeneration' });
    }
    if (lifecycleFinding(finding) && ownsOccurrence(origin, visit.target.room.occurrenceId)) {
      return Object.freeze({ visitIndex: index, phase: 'targetLifecycle' });
    }
    if (semanticAddressKey(visit.origin) === semanticAddressKey(origin)) {
      return Object.freeze({ visitIndex: index, phase: 'targetLifecycle' });
    }
  }
  return undefined;
}

function hubBoardTargetIndex(
  decision: Extract<CanonicalDecision, { readonly kind: 'hub' }>,
  finding: SemanticFinding,
  visitLocation: HubVisitFindingLocation | undefined,
): number | undefined {
  if (visitLocation?.phase === 'targetLifecycle') return undefined;
  const index = decision.board.targets.findIndex(
    (target) =>
      semanticAddressKey(target.origin) === semanticAddressKey(finding.origin) ||
      (finding.origin.kind === 'incomingReward' &&
        finding.origin.occurrenceId === target.room.occurrenceId),
  );
  return index < 0 ? undefined : index;
}

function hubVisitFrontier(
  visit: CanonicalHubVisit,
  location: HubVisitFindingLocation,
): MaterializedHubVisitFrontier {
  if (location.phase === 'targetLifecycle') {
    return Object.freeze({
      kind: 'hubVisit',
      origin: visit.origin,
      phase: location.phase,
      target: visit.target,
      localSlots: Object.freeze([]),
      enteredLocalRooms: Object.freeze([]),
      parentRestores: Object.freeze([]),
    });
  }
  if (location.phase === 'sideGeneration') {
    return Object.freeze({
      kind: 'hubVisit',
      origin: visit.origin,
      phase: location.phase,
      target: visit.target,
      localSlots: visit.localSlots,
      enteredLocalRooms: Object.freeze([]),
      parentRestores: Object.freeze([]),
    });
  }
  const localLifecycleIndex = location.localLifecycleIndex;
  if (localLifecycleIndex === undefined) {
    throw new Error(`Hub visit ${visit.visitIndex} local lifecycle has no local owner`);
  }
  const enteredLocalRooms = Object.freeze(
    visit.enteredLocalRooms.slice(0, localLifecycleIndex + 1),
  );
  const enteredOrigins = new Set(enteredLocalRooms.map((slot) => semanticAddressKey(slot.origin)));
  const localSlots = Object.freeze(
    visit.localSlots.map((slot) =>
      enteredOrigins.has(semanticAddressKey(slot.origin)) || !slot.entered
        ? slot
        : Object.freeze({ ...slot, entered: false }),
    ),
  );
  return Object.freeze({
    kind: 'hubVisit',
    origin: visit.origin,
    phase: location.phase,
    target: visit.target,
    localSlots,
    enteredLocalRooms: Object.freeze(
      enteredLocalRooms.map((slot) =>
        localSlots.find(
          (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(slot.origin),
        )!,
      ),
    ),
    // The local owner itself is the stopping room: earlier completed local
    // rooms restore their parent, but no restore may follow the invalid one.
    parentRestores: Object.freeze(visit.parentRestores.slice(0, localLifecycleIndex)),
  });
}

interface PrefixDecisionEntry {
  readonly decision: CanonicalDecision;
  readonly decisionIndex: number;
  readonly frontierBatch: boolean;
}

function prefixDecisionEntries(prefix: MaterializedBiomePrefix): readonly PrefixDecisionEntry[] {
  const completed = prefix.decisions.map((decision, decisionIndex) =>
    Object.freeze({ decision, decisionIndex, frontierBatch: false }),
  );
  const partialBatch =
    prefix.frontier?.kind === 'exitDecision' ? prefix.frontier.partialBatch : undefined;
  return partialBatch === undefined
    ? Object.freeze(completed)
    : Object.freeze([
        ...completed,
        Object.freeze({
          decision: partialBatch,
          decisionIndex: prefix.decisions.length,
          frontierBatch: true,
        }),
      ]);
}

function firstUnsupportedFinding(
  prefix: MaterializedBiomePrefix,
  evaluation: Omit<ProgressiveBiomeEvaluation, 'materializedPrefix' | 'blockedAt'>,
): LocatedFinding | undefined {
  const findings = [...evaluation.roomGeneration.findings, ...evaluation.rewards.findings];
  const located = findings.flatMap((finding): readonly LocatedFinding[] => {
    if (
      prefix.entryRoom !== undefined &&
      ownsOccurrence(finding.origin, prefix.entryRoom.occurrenceId)
    ) {
      return [Object.freeze({ finding, decisionIndex: -1 })];
    }
    const decisionEntry = prefixDecisionEntries(prefix).find(({ decision }) =>
      decisionOwnsFinding(decision, finding),
    );
    if (decisionEntry === undefined) return [];
    const { decision, decisionIndex, frontierBatch } = decisionEntry;
    const indexedTarget = decision.kind === 'batch' ? targetIndex(decision, finding) : undefined;
    const hubVisitLocation =
      decision.kind === 'hub' ? hubVisitFindingLocation(decision, finding) : undefined;
    const indexedHubBoard =
      decision.kind === 'hub'
        ? hubBoardTargetIndex(decision, finding, hubVisitLocation)
        : undefined;
    return [
      Object.freeze({
        finding,
        decisionIndex,
        ...(frontierBatch ? { frontierBatch: true } : {}),
        ...(indexedTarget === undefined ? {} : { targetIndex: indexedTarget }),
        ...(indexedHubBoard === undefined ? {} : { hubBoardTargetIndex: indexedHubBoard }),
        ...(hubVisitLocation === undefined
          ? {}
          : {
              hubVisitIndex: hubVisitLocation.visitIndex,
              hubVisitPhase: hubVisitLocation.phase,
              ...(hubVisitLocation.localLifecycleIndex === undefined
                ? {}
                : { hubLocalLifecycleIndex: hubVisitLocation.localLifecycleIndex }),
            }),
      }),
    ];
  });
  return located.sort(
    (left, right) =>
      left.decisionIndex - right.decisionIndex ||
      (left.targetIndex ?? -1) - (right.targetIndex ?? -1) ||
      (left.hubBoardTargetIndex ?? -1) - (right.hubBoardTargetIndex ?? -1) ||
      (left.hubVisitIndex ?? -1) - (right.hubVisitIndex ?? -1),
  )[0];
}

function exitFrontier(
  decision: Extract<CanonicalDecision, { readonly kind: 'batch' | 'linkedExit' }>,
  targets: readonly CanonicalTarget[] = [],
): MaterializedExitDecisionFrontier {
  const parent = decision.kind === 'batch' ? decision.parent : decision.source;
  const selectedOrigin =
    decision.kind === 'batch'
      ? decision.selectedOrigin
      : createExitSelectionAddress(
          {
            routeKey: decision.origin.routeKey,
            biomeKey: decision.origin.biomeKey,
            kind: 'biome',
          },
          { kind: 'occurrence', occurrenceId: decision.source.occurrenceId },
        );
  const partialBatch =
    decision.kind === 'batch' && targets.length > 0
      ? Object.freeze({ ...decision, targets: Object.freeze([...targets]) })
      : undefined;
  return Object.freeze({
    kind: 'exitDecision',
    origin: decision.origin,
    parent,
    targets: Object.freeze([...targets]),
    ...(partialBatch === undefined ? {} : { partialBatch, batchState: partialBatch.batchState }),
    selectedExitKey: decision.kind === 'batch' ? decision.selectedExitKey : null,
    selectedOrigin,
  });
}

function clampPrefix(
  prefix: MaterializedBiomePrefix,
  located: LocatedFinding,
): MaterializedBiomePrefix {
  if (located.decisionIndex < 0) {
    return Object.freeze({
      kind: 'biomePrefix',
      routeKey: prefix.routeKey,
      biomeKey: prefix.biomeKey,
      ...(prefix.entryRoom === undefined ? {} : { entryRoom: prefix.entryRoom }),
      decisions: Object.freeze([]),
      biomeState: prefix.biomeState,
    });
  }
  const decision = located.frontierBatch
    ? prefix.frontier?.kind === 'exitDecision'
      ? prefix.frontier.partialBatch
      : undefined
    : prefix.decisions[located.decisionIndex];
  if (decision === undefined) return prefix;
  if (decision.kind === 'hub') {
    if (located.hubVisitIndex !== undefined) {
      const frontierVisit = decision.visits[located.hubVisitIndex];
      if (frontierVisit === undefined) return prefix;
      const phase = located.hubVisitPhase;
      if (phase === undefined) return prefix;
      const frontier = hubVisitFrontier(frontierVisit, {
        visitIndex: located.hubVisitIndex,
        phase,
        ...(located.hubLocalLifecycleIndex === undefined
          ? {}
          : { localLifecycleIndex: located.hubLocalLifecycleIndex }),
      });
      return Object.freeze({
        ...prefix,
        decisions: Object.freeze([
          ...prefix.decisions.slice(0, located.decisionIndex),
          Object.freeze({
            ...decision,
            // The blocked visit is represented by a phase-aware frontier.
            // Completed prior visits remain canonical; replay must not make
            // the blocked visit's later local lifecycle or Hub return true.
            visits: Object.freeze(decision.visits.slice(0, located.hubVisitIndex)),
          }),
        ]),
        frontier,
      });
    }
    return Object.freeze({
      ...prefix,
      // Board targets are all physically generated by the Hub's outgoing
      // checkpoint. A board-owned failure prevents visits, not that already
      // reached board region or its reward producers from existing.
      decisions: Object.freeze([
        ...prefix.decisions.slice(0, located.decisionIndex),
        Object.freeze({ ...decision, visits: Object.freeze([]) }),
      ]),
      frontier: Object.freeze({ kind: 'hubBoard', origin: decision.origin }),
    });
  }
  const retainedTargets =
    decision.kind === 'batch' && located.targetIndex !== undefined
      ? decision.targets.slice(0, located.targetIndex)
      : Object.freeze([]);
  return Object.freeze({
    ...prefix,
    decisions: Object.freeze(
      located.frontierBatch
        ? [...prefix.decisions]
        : prefix.decisions.slice(0, located.decisionIndex),
    ),
    frontier: exitFrontier(decision, retainedTargets),
  });
}

/**
 * Evaluates the materializable prefix before applying its first-invalid clamp.
 * This is an engine-internal repair product: callers may consult only the
 * exact blocked owner’s pre-decision frontier, never later owners.
 */
export function evaluateProgressiveBiomeBeforeClamp(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  enteredBiomeCount: number,
  seed?: ProgressiveSeed,
): ProgressiveBiomeEvaluation | null {
  return (
    evaluateProgressiveBiomeAssemblyBeforeClamp(catalog, biome, plan, enteredBiomeCount, seed)
      ?.evaluation ?? null
  );
}

export function evaluateProgressiveBiomeAssemblyBeforeClamp(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  enteredBiomeCount: number,
  seed?: ProgressiveSeed,
): ProgressiveBiomeEvaluationAssembly | null {
  const initial = materializeBiomePrefix(catalog, biome, plan);
  if (initial?.entryRoom === undefined) return null;
  const materializedPrefix = initial as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  const evaluated = products(catalog, materializedPrefix, enteredBiomeCount, seed);
  const unsupported = firstUnsupportedFinding(materializedPrefix, evaluated.evaluation);
  return Object.freeze({
    evaluation: Object.freeze({
      materializedPrefix,
      ...evaluated.evaluation,
      findings: mergedFindings(evaluated.evaluation),
      ...(unsupported === undefined ? {} : { blockedAt: unsupported.finding.origin }),
    }),
    candidateArtifacts: evaluated.candidateArtifacts,
  });
}

/**
 * Evaluates the maximum materializable authored prefix, then clamps once at
 * the first unsupported semantic owner. The retained prefix is replayed so no
 * history, reward, or candidate product claims coverage beyond that owner.
 */
export function evaluateProgressiveBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  enteredBiomeCount: number,
  seed?: ProgressiveSeed,
): ProgressiveBiomeEvaluation | null {
  return (
    evaluateProgressiveBiomeAssembly(catalog, biome, plan, enteredBiomeCount, seed)?.evaluation ??
    null
  );
}

export function evaluateProgressiveBiomeAssembly(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  enteredBiomeCount: number,
  seed?: ProgressiveSeed,
): ProgressiveBiomeEvaluationAssembly | null {
  const initial = materializeBiomePrefix(catalog, biome, plan);
  if (initial?.entryRoom === undefined) return null;
  let materializedPrefix = initial as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  let evaluated = products(catalog, materializedPrefix, enteredBiomeCount, seed);
  const unsupported = firstUnsupportedFinding(materializedPrefix, evaluated.evaluation);
  let retainedFindings: readonly SemanticFinding[] = Object.freeze([]);
  if (unsupported !== undefined) {
    retainedFindings = Object.freeze([unsupported.finding]);
    const clamped = clampPrefix(materializedPrefix, unsupported);
    if (clamped.entryRoom === undefined) return null;
    materializedPrefix = clamped as MaterializedBiomePrefix & {
      readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
    };
    evaluated = products(catalog, materializedPrefix, enteredBiomeCount, seed);
  }
  return Object.freeze({
    evaluation: Object.freeze({
      materializedPrefix,
      ...evaluated.evaluation,
      findings: mergedFindings(evaluated.evaluation, retainedFindings),
      ...(unsupported === undefined ? {} : { blockedAt: unsupported.finding.origin }),
    }),
    candidateArtifacts: evaluated.candidateArtifacts,
  });
}
