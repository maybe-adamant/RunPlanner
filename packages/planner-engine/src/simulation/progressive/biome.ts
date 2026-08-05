import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
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
  composeBiomeHistoryPrefixWithEncounterValidation,
  type BiomeHistoryPrefix,
  type CanonicalBiomeHistory,
  type EncounterHistoryBlock,
} from '../history';
import type {
  CanonicalDecision,
  CanonicalHubVisit,
  CanonicalTarget,
  MaterializedBiomePrefix,
  MaterializedExitDecisionFrontier,
  MaterializedHubVisitFrontier,
} from '../materialization';
import {
  evaluateEncounterCandidates,
  structurallyActiveEncounterRooms,
  type EncounterCandidateBoundary,
} from '../encounters';
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
  /**
   * The bounded structural slice whose ordinary lifecycle products reached a
   * canonical checkpoint. An encounter block keeps the larger authored
   * prefix visible while this slice prevents assessed-state leakage beyond
   * the failed room.
   */
  readonly assessmentPrefix?: MaterializedBiomePrefix;
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
  productPrefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  encounterPrefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  history: BiomeHistoryPrefix,
  enteredBiomeCount: number,
  rewards: BiomeRewardSimulation,
  rewardProducers: RewardProducerCandidateArtifacts,
  roomLifecycles: RoomLifecycleCandidateArtifacts,
  encounterBoundary?: EncounterCandidateBoundary,
): ProgressiveGenerationAssembly {
  const ordinary = evaluateBiomeRoomGenerationAssembly(
    catalog,
    productPrefix,
    history,
    enteredBiomeCount,
    rewards.targetHistory,
  );
  const hub = evaluateHubDecisionGeneration(catalog, productPrefix, history);
  const encounters = evaluateEncounterCandidates(
    catalog,
    structurallyActiveEncounterRooms(encounterPrefix),
    new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room.preparation])),
    encounterBoundary,
  );
  const validation: BiomeGenerationValidation = Object.freeze({
    validity:
      ordinary.validation.validity === 'valid' &&
      hub.validity === 'valid' &&
      encounters.findings.length === 0
        ? 'valid'
        : 'invalid',
    ordinary: ordinary.validation,
    hub,
    findings: Object.freeze([
      ...ordinary.validation.findings,
      ...hub.findings,
      ...encounters.findings,
    ]),
  });
  return Object.freeze({
    validation,
    candidateArtifacts: createBiomeCandidateArtifacts(
      createBiomeAddress(productPrefix.routeKey, productPrefix.biomeKey),
      ordinary.candidateArtifacts,
      rewardProducers,
      roomLifecycles,
      encounters.artifacts,
    ),
  });
}

interface ProgressiveProducts {
  readonly evaluation: Omit<ProgressiveBiomeEvaluation, 'materializedPrefix' | 'blockedAt'>;
  readonly candidateArtifacts: BiomeCandidateArtifacts;
  readonly encounterBlock?: EncounterHistoryBlock;
}

function products(
  catalog: Catalog,
  prefix: MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  },
  enteredBiomeCount: number,
  seed?: ProgressiveSeed,
): ProgressiveProducts {
  const composed = composeBiomeHistoryPrefixWithEncounterValidation(
    catalog,
    prefix,
    seed?.history.afterTransition,
  );
  if (composed === null) {
    throw new Error(`${prefix.biomeKey} materialized prefix has no composable history`);
  }
  const history = composed.history;
  const encounterBoundary =
    composed.kind === 'blocked'
      ? Object.freeze({
          fallback: composed.block.afterValidRecordPrefix,
          blocked: Object.freeze({
            room: composed.block.room,
            before: composed.block.before,
          }),
        })
      : undefined;
  const generationPrefix =
    composed.kind === 'blocked' ? encounterBlockProductPrefix(prefix, composed.block) : prefix;
  const rewards = evaluateBiomeRewardsAssembly(
    catalog,
    prefix,
    history,
    enteredBiomeCount,
    seed?.rewardBranches,
  );
  const roomGeneration = generation(
    catalog,
    generationPrefix as MaterializedBiomePrefix & {
      readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
    },
    prefix,
    history,
    enteredBiomeCount,
    rewards.simulation,
    rewards.producerArtifacts,
    rewards.lifecycleArtifacts,
    encounterBoundary,
  );
  return Object.freeze({
    evaluation: Object.freeze({
      history,
      rewards: rewards.simulation,
      roomGeneration: roomGeneration.validation,
      findings: Object.freeze([]),
      ...(composed.kind === 'blocked' ? { assessmentPrefix: generationPrefix } : {}),
    }),
    candidateArtifacts: roomGeneration.candidateArtifacts,
    ...(composed.kind === 'blocked' ? { encounterBlock: composed.block } : {}),
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
  if ('occurrenceId' in origin && origin.occurrenceId === occurrenceId) return true;
  return origin.kind === 'encounterPhase' && origin.owner.occurrenceId === occurrenceId;
}

function decisionOwnsFinding(decision: CanonicalDecision, finding: SemanticFinding): boolean {
  const origin = finding.origin;
  if (semanticAddressKey(decision.origin) === semanticAddressKey(origin)) return true;
  if (decision.kind === 'batch') {
    return (
      semanticAddressKey(decision.selectedOrigin) === semanticAddressKey(origin) ||
      semanticAddressKey(decision.rewardStore.origin) === semanticAddressKey(origin) ||
      semanticAddressKey(decision.parent.origin) === semanticAddressKey(origin) ||
      decision.targets.some(
        (target) =>
          semanticAddressKey(target.origin) === semanticAddressKey(origin) ||
          ownsOccurrence(origin, target.room.occurrenceId),
      ) ||
      decision.additional.some(
        (continuation) =>
          semanticAddressKey(continuation.origin) === semanticAddressKey(origin) ||
          ownsOccurrence(origin, continuation.room.occurrenceId),
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
      (finding.origin.kind === 'encounterPhase' &&
        finding.origin.owner.kind === 'localChild' &&
        slot.origin.occurrenceId === finding.origin.owner.occurrenceId &&
        slot.origin.groupKey === finding.origin.owner.groupKey &&
        slot.origin.slotKey === finding.origin.owner.slotKey) ||
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

function locateFinding(
  prefix: MaterializedBiomePrefix,
  finding: SemanticFinding,
): LocatedFinding | undefined {
  if (
    prefix.entryRoom !== undefined &&
    ownsOccurrence(finding.origin, prefix.entryRoom.occurrenceId)
  ) {
    return Object.freeze({ finding, decisionIndex: -1 });
  }
  const decisionEntry = prefixDecisionEntries(prefix).find(({ decision }) =>
    decisionOwnsFinding(decision, finding),
  );
  if (decisionEntry === undefined) return undefined;
  const { decision, decisionIndex, frontierBatch } = decisionEntry;
  const indexedTarget = decision.kind === 'batch' ? targetIndex(decision, finding) : undefined;
  const hubVisitLocation =
    decision.kind === 'hub' ? hubVisitFindingLocation(decision, finding) : undefined;
  const indexedHubBoard =
    decision.kind === 'hub' ? hubBoardTargetIndex(decision, finding, hubVisitLocation) : undefined;
  return Object.freeze({
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
  });
}

function firstUnsupportedFinding(
  prefix: MaterializedBiomePrefix,
  evaluation: Omit<ProgressiveBiomeEvaluation, 'materializedPrefix' | 'blockedAt'>,
  include: (finding: SemanticFinding) => boolean = () => true,
): LocatedFinding | undefined {
  const located = [...evaluation.roomGeneration.findings, ...evaluation.rewards.findings]
    .filter(include)
    .flatMap((finding) => {
      const location = locateFinding(prefix, finding);
      return location === undefined ? [] : [location];
    });
  return located.sort(compareLocatedFindings)[0];
}

function isEncounterResolutionFinding(finding: SemanticFinding): boolean {
  return (
    (finding.code === 'encounterUnavailable' ||
      finding.code === 'encounterSlotActivationUnavailable') &&
    finding.phase === 'encounterResolution'
  );
}

function encounterBlockFinding(block: EncounterHistoryBlock): SemanticFinding {
  const finding = block.preparation.findings.find(
    (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(block.blockedAt),
  );
  if (finding === undefined) {
    throw new Error(`encounter block ${semanticAddressKey(block.blockedAt)} has no finding`);
  }
  return finding;
}

function encounterBlockProductPrefix(
  prefix: MaterializedBiomePrefix,
  block: EncounterHistoryBlock,
): MaterializedBiomePrefix {
  const located = locateFinding(prefix, encounterBlockFinding(block));
  if (located === undefined) {
    throw new Error(
      `encounter block ${semanticAddressKey(block.blockedAt)} has no structural owner`,
    );
  }
  return clampPrefix(prefix, located);
}

function compareLocatedFindings(left: LocatedFinding, right: LocatedFinding): number {
  return (
    left.decisionIndex - right.decisionIndex ||
    (left.targetIndex ?? -1) - (right.targetIndex ?? -1) ||
    (left.hubBoardTargetIndex ?? -1) - (right.hubBoardTargetIndex ?? -1) ||
    (left.hubVisitIndex ?? -1) - (right.hubVisitIndex ?? -1) ||
    (left.hubLocalLifecycleIndex ?? -1) - (right.hubLocalLifecycleIndex ?? -1)
  );
}

function exitFrontier(
  decision: Extract<CanonicalDecision, { readonly kind: 'batch' }>,
  targets: readonly CanonicalTarget[] = [],
): MaterializedExitDecisionFrontier {
  const partialBatch =
    targets.length > 0
      ? Object.freeze({ ...decision, targets: Object.freeze([...targets]) })
      : undefined;
  return Object.freeze({
    kind: 'exitDecision',
    origin: decision.origin,
    parent: decision.parent,
    targets: Object.freeze([...targets]),
    additional: decision.additional,
    ...(partialBatch === undefined ? {} : { partialBatch, batchState: partialBatch.batchState }),
    selectedExitKey: decision.selectedExitKey,
    selectedOrigin: decision.selectedOrigin,
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
    located.targetIndex === undefined
      ? Object.freeze([])
      : decision.targets.slice(0, located.targetIndex);
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
 * A selected target's incoming offer is produced with that target, before
 * the target's own room lifecycle. A generic target or incoming-offer
 * finding therefore retains that one target in an interaction-only prefix:
 * its offer can be corrected from the actual offer-time checkpoint, while
 * the execution prefix still excludes the invalid room and every later
 * lifecycle effect. All other generic boundaries use the ordinary clamp.
 */
function retainedInteractionPrefix(
  prefix: MaterializedBiomePrefix,
  located: LocatedFinding,
): MaterializedBiomePrefix {
  if (located.targetIndex === undefined) return clampPrefix(prefix, located);
  const decision = located.frontierBatch
    ? prefix.frontier?.kind === 'exitDecision'
      ? prefix.frontier.partialBatch
      : undefined
    : prefix.decisions[located.decisionIndex];
  if (decision === undefined || decision.kind !== 'batch') return clampPrefix(prefix, located);
  const targets = decision.targets.slice(0, located.targetIndex + 1);
  return Object.freeze({
    ...prefix,
    decisions: Object.freeze(
      located.frontierBatch
        ? [...prefix.decisions]
        : prefix.decisions.slice(0, located.decisionIndex),
    ),
    frontier: exitFrontier(decision, targets),
  });
}

/**
 * Evaluates the materializable prefix before applying its first-invalid clamp.
 * This is an engine-internal diagnostic product. Repair callers may consult
 * only the exact blocked owner’s pre-decision frontier, never later owners.
 * A bounded aggregate candidate may inspect findings across its complete
 * proposed region, but it must not publish the resulting downstream lifecycle
 * as selected simulation output.
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
  const unsupported = firstUnsupportedFinding(
    materializedPrefix,
    evaluated.evaluation,
    (finding) => !isEncounterResolutionFinding(finding),
  );
  return Object.freeze({
    evaluation: Object.freeze({
      materializedPrefix,
      ...evaluated.evaluation,
      findings: mergedFindings(evaluated.evaluation),
      ...(evaluated.encounterBlock !== undefined
        ? { blockedAt: evaluated.encounterBlock.blockedAt }
        : unsupported === undefined
          ? {}
          : { blockedAt: unsupported.finding.origin }),
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
  const authoredPrefix = initial as MaterializedBiomePrefix & {
    readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
  };
  let executionPrefix = authoredPrefix;
  let evaluated = products(catalog, executionPrefix, enteredBiomeCount, seed);
  let retainedInteractions = evaluated.candidateArtifacts;
  let encounterArtifacts = evaluated.candidateArtifacts.encounters;
  let encounterFindings: readonly SemanticFinding[] =
    evaluated.evaluation.roomGeneration.findings.filter(isEncounterResolutionFinding);
  const unsupported = firstUnsupportedFinding(
    authoredPrefix,
    evaluated.evaluation,
    (finding) => !isEncounterResolutionFinding(finding),
  );
  const encounterLocated =
    evaluated.encounterBlock === undefined
      ? undefined
      : locateFinding(authoredPrefix, encounterBlockFinding(evaluated.encounterBlock));
  let retainedFindings: readonly SemanticFinding[] = Object.freeze([]);
  const genericPrecedesEncounter =
    unsupported !== undefined &&
    (encounterLocated === undefined || compareLocatedFindings(unsupported, encounterLocated) <= 0);
  if (genericPrecedesEncounter && unsupported !== undefined) {
    retainedFindings = Object.freeze([unsupported.finding]);
    const clamped = clampPrefix(authoredPrefix, unsupported);
    if (clamped.entryRoom === undefined) return null;
    executionPrefix = clamped as MaterializedBiomePrefix & {
      readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
    };
    evaluated = products(catalog, executionPrefix, enteredBiomeCount, seed);
    const interactionPrefix = retainedInteractionPrefix(
      authoredPrefix,
      unsupported,
    ) as MaterializedBiomePrefix & {
      readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
    };
    retainedInteractions = products(
      catalog,
      interactionPrefix,
      enteredBiomeCount,
      seed,
    ).candidateArtifacts;
    const retainedEncounterCandidates = evaluateEncounterCandidates(
      catalog,
      structurallyActiveEncounterRooms(authoredPrefix),
      new Map(
        evaluated.evaluation.history.rooms.map((room) => [
          semanticAddressKey(room.origin),
          room.preparation,
        ]),
      ),
      Object.freeze({ fallback: evaluated.evaluation.history.current }),
    );
    encounterArtifacts = retainedEncounterCandidates.artifacts;
    encounterFindings = retainedEncounterCandidates.findings;
  }
  const blockedAt =
    evaluated.encounterBlock !== undefined && !genericPrecedesEncounter
      ? evaluated.encounterBlock.blockedAt
      : unsupported?.finding.origin;
  return Object.freeze({
    evaluation: Object.freeze({
      ...evaluated.evaluation,
      materializedPrefix: authoredPrefix,
      ...(genericPrecedesEncounter
        ? { assessmentPrefix: executionPrefix }
        : evaluated.evaluation.assessmentPrefix === undefined
          ? {}
          : { assessmentPrefix: evaluated.evaluation.assessmentPrefix }),
      findings: mergedFindings(
        evaluated.evaluation,
        Object.freeze([...retainedFindings, ...encounterFindings]),
      ),
      ...(blockedAt === undefined ? {} : { blockedAt }),
    }),
    candidateArtifacts: createBiomeCandidateArtifacts(
      evaluated.candidateArtifacts.origin,
      retainedInteractions.roomTargets,
      retainedInteractions.rewardProducers,
      retainedInteractions.roomLifecycles,
      encounterArtifacts,
    ),
  });
}
