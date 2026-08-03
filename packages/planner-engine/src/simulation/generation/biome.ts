import type {
  BiomeLayout,
  Catalog,
  ExitCompatibilityPolicy,
  NormalDoorBatchPolicy,
  RoomDeclaration,
  RoomForce,
} from '../../catalog-schema';
import {
  evaluateRequirement,
  type RequirementEvaluationContext,
} from '../../requirements/evaluator';
import type { RequirementExpression } from '../../requirements/model';
import {
  createBiomeAddress,
  createTargetAddress,
  semanticAddressKey,
  type ExitDecisionAddress,
} from '../../authored-project/addresses';
import {
  declaredPhysicalExitsForSourceRoom,
  fixedWidthOneTakeoverForLayout,
  normalDecisionProgressionForLayout,
  ordinaryProgressionBatchLimit,
} from '../../authored-project/topology/query';
import type { RewardHistoryState } from '../../reward-kernel';
import type {
  BiomeHistoryPrefix,
  CanonicalBiomeHistory,
  HistoryStateView,
  ProgressiveRoomHistoryViews,
  TargetGenerationView,
} from '../history';
import { projectRecentEncounterPhases } from '../history';
import type { RoomHistoryOrigin } from '../lifecycle';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalBiome,
  CanonicalDecision,
  CanonicalPhysicalExit,
  CanonicalTarget,
  MaterializedBiomePrefix,
} from '../materialization';
import type { TargetRewardHistoryCheckpoint } from '../rewards';
import type {
  EncounterCountSupportEntry,
  FieldsCageOutcome,
  FieldsCageOutcomeCandidateSupport,
  FieldsCageOutcomeSupportEntry,
  ForcePressureLedgerEntry,
  GeneratedRoomGenerationValidation,
  HubTerminalTakeoverCandidateSupport,
  RoomTargetCandidateContext,
  RoomTargetCandidateValidation,
  RequirementEvaluationEvidence,
  RoomGenerationExclusionEvidence,
  RoomGenerationExclusionReason,
  TakeoverPrebossBatchCandidateSupport,
} from './model';
import type { FindingEvidence, SemanticFinding } from '../model';
import {
  createRoomTargetCandidateArtifacts,
  type RoomTargetCandidateArtifacts,
} from '../candidate-artifacts';

export class BiomeRoomGenerationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'BiomeRoomGenerationContractError';
  }
}

type ForceSupport = 'none' | 'optional' | 'required';

interface CandidateEvaluation {
  readonly room: RoomDeclaration;
  readonly reasons: readonly RoomGenerationExclusionReason[];
  readonly exclusions: readonly RoomGenerationExclusionEvidence[];
  readonly forceSupport: ForceSupport;
}

interface SourceForceCandidate {
  readonly eligible: boolean;
  readonly forceSupport: ForceSupport;
  readonly gameName: string;
}

interface SourceGenerationSupport {
  readonly eligibleGameNames: readonly string[];
  readonly optionalForcedGameNames: readonly string[];
  readonly requiredForcedGameNames: readonly string[];
  readonly supportGameNames: ReadonlySet<string>;
  readonly supportRoomGameNames: readonly string[];
}

interface TakeoverShapeEvaluation {
  readonly candidate: RoomDeclaration;
  readonly entries: readonly CandidateEvaluation[];
  readonly forceSupport: ForceSupport;
}

interface FirstTargetGenerationSupport {
  readonly context: RequirementEvaluationContext;
  readonly counts: RoomGenerationCounts;
  readonly ordinaryCandidates: ReadonlyMap<string, CandidateEvaluation>;
  readonly sourceSupport: SourceGenerationSupport;
  readonly takeoverCandidates: ReadonlyMap<string, TakeoverShapeEvaluation>;
}

interface FirstTargetCandidateDomain {
  readonly ordinary: readonly RoomDeclaration[];
  readonly takeover: readonly RoomDeclaration[];
  readonly fixedTakeover: RoomDeclaration | undefined;
}

interface RoomGenerationCounts {
  readonly appearancesByGameName: Readonly<Record<string, number>>;
  readonly creationsByGameName: Readonly<Record<string, number>>;
  readonly parentCreationsByGameName: Readonly<Record<string, number>>;
}

type CanonicalGenerationSource = CanonicalAuthoredRoom;

/**
 * Generation consumes the selected, materialized decision spine. A complete
 * biome and an incomplete prefix carry the same facts for every decision that
 * precedes the frontier; completion-only rooms are intentionally irrelevant.
 */
export type BiomeGenerationSnapshot =
  CanonicalBiome | (MaterializedBiomePrefix & { readonly entryRoom: CanonicalAuthoredRoom });
export type BiomeGenerationHistory = CanonicalBiomeHistory | BiomeHistoryPrefix;

/**
 * A prefix may stop inside a normal-door batch after physical targets have
 * already been generated. The partial batch is still a real generation
 * owner: omitting it would validate and evaluate later controls as though
 * those target facts never existed.
 */
function generationDecisions(snapshot: BiomeGenerationSnapshot): readonly CanonicalDecision[] {
  const partialBatch =
    snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
      ? snapshot.frontier.partialBatch
      : undefined;
  return partialBatch === undefined
    ? snapshot.decisions
    : Object.freeze([...snapshot.decisions, partialBatch]);
}

function countByGameName(
  entries: readonly { readonly gameName: string }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.gameName] = (counts[entry.gameName] ?? 0) + 1;
  }
  return counts;
}

function assertGenerationRequirement(requirement: RequirementExpression): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach(assertGenerationRequirement);
      return;
    case 'not':
      assertGenerationRequirement(requirement.requirement);
      return;
    case 'counterRange':
      if (requirement.axis !== 'biomeDepthCache' && requirement.axis !== 'biomeEncounterDepth') {
        throw new BiomeRoomGenerationContractError(
          `room generation cannot project counter ${requirement.axis}`,
        );
      }
      return;
    case 'recordCount':
      if (requirement.record !== 'roomsEntered') {
        throw new BiomeRoomGenerationContractError(
          `room generation cannot project record ${requirement.record}`,
        );
      }
      return;
    case 'distinctRecordKeyCount':
    case 'recentEncounterPhaseCount':
      return;
    case 'currentBatchTargetCount':
    case 'currentBatchRoomCount':
    case 'clockworkGoalsRemaining':
    case 'clockworkNonGoalCapacity':
    case 'minExits':
      return;
    default:
      throw new BiomeRoomGenerationContractError(
        `room generation cannot evaluate ${requirement.kind}`,
      );
  }
}

function assertGenerationForce(force: RoomForce): void {
  switch (force.kind) {
    case 'always':
      return;
    case 'requirement':
      assertGenerationRequirement(force.requirement);
      return;
    case 'depthWindow':
      if (force.axis !== 'biomeDepthCache' && force.axis !== 'biomeEncounterDepth') {
        throw new BiomeRoomGenerationContractError(
          `room generation cannot project force counter ${force.axis}`,
        );
      }
  }
}

function priorPeerGameNames(
  view: HistoryStateView,
  parentOrigin: RoomHistoryOrigin,
): readonly string[] {
  return Object.freeze(
    view.ledgers.roomCreations
      .filter(
        (creation) =>
          creation.source === 'generatedTarget' &&
          semanticAddressKey(creation.parentOrigin) === semanticAddressKey(parentOrigin),
      )
      .map((creation) => creation.gameName),
  );
}

function projectRoomGenerationRequirementContext(
  source: CanonicalGenerationSource,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  enteredBiomeCount: number,
  rewardHistory?: RewardHistoryState,
): RequirementEvaluationContext {
  const roomsEntered = countByGameName(view.ledgers.roomAppearances);
  const shopOptions =
    source.kind === 'authored' && source.entryState?.kind === 'shop'
      ? new Set(source.entryState.offers.map((offer) => offer.offer.rewardType))
      : new Set<string>();
  const goalsRemaining = view.ledgers.counters.clockworkGoalsRemaining;
  const nonGoalRewardsAcquired = view.ledgers.counters.clockworkNonGoalRewardsAcquired;
  const maxNonGoalRewards = view.ledgers.counters.clockworkMaxNonGoalRewards;
  const clockworkValues = [goalsRemaining, nonGoalRewardsAcquired, maxNonGoalRewards];
  const hasClockwork = clockworkValues.every((value) => value !== undefined);
  if (!hasClockwork && clockworkValues.some((value) => value !== undefined)) {
    throw new BiomeRoomGenerationContractError('history has partial Clockwork facts');
  }
  return Object.freeze({
    counters: Object.freeze({
      biomeDepthCache: view.ledgers.counters.biomeDepthCache,
      biomeEncounterDepth: view.ledgers.counters.biomeEncounterDepth,
      encounterDepth: view.ledgers.counters.routeEncounterDepth,
      enteredBiomes: enteredBiomeCount,
      upgradableTraitCount: 0,
    }),
    records: Object.freeze({
      biomeUseRecord: rewardHistory?.biomeUseRecord ?? Object.freeze({}),
      lootTypeHistory: rewardHistory?.lootTypeHistory ?? Object.freeze({}),
      roomsEntered: Object.freeze(roomsEntered),
      useRecord: rewardHistory?.useRecord ?? Object.freeze({}),
    }),
    currentRoomShopOptionNames: shopOptions,
    currentRoomRewardType: source.incomingReward?.offer.rewardType,
    rewardLookups: Object.freeze({}),
    runDepthCache: view.ledgers.counters.roomHistoryOrdinal + 1,
    lastEventRunDepthCaches: Object.freeze({}),
    recentEncounterPhases: projectRecentEncounterPhases(view),
    offeredExitCount: sourceDeclaration.exits.length,
    currentBatchRoomGameNames: priorPeerGameNames(view, source.origin),
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

/**
 * Most normal-door generation is evaluated at the source's outgoing
 * checkpoint. The bounded N entry is the one current exception: its
 * declaration means the Opening's committed depth-one state admits PreHub.
 * This preserves the real lifecycle event order while giving the normalized
 * ordinary candidate its game-equivalent counter context.
 */
export function normalTargetCandidateHistory(
  layout: BiomeLayout,
  source: CanonicalAuthoredRoom,
  views: ProgressiveRoomHistoryViews,
): HistoryStateView | undefined {
  if (
    layout.progression.kind === 'hub' &&
    layout.start.kind === 'fixedAuthored' &&
    source.gameName === layout.start.roomGameName
  ) {
    return views.postCommit;
  }
  return views.preOutgoing;
}

function compatible(
  policy: ExitCompatibilityPolicy,
  source: RoomDeclaration,
  target: RoomDeclaration,
): boolean {
  switch (policy.kind) {
    case 'unconstrained':
      return true;
    case 'targetHasTag':
      return target.structuralTags.includes(policy.targetTag);
    case 'sourceTagRequiresTargetTag':
      return (
        !source.structuralTags.includes(policy.sourceTag) ||
        target.structuralTags.includes(policy.targetTag)
      );
  }
}

function forceSupport(
  force: RoomForce | undefined,
  context: RequirementEvaluationContext,
): ForceSupport {
  if (force === undefined) {
    return 'none';
  }
  switch (force.kind) {
    case 'always':
      return 'required';
    case 'requirement':
      assertGenerationRequirement(force.requirement);
      return evaluateRequirement(force.requirement, context) ? 'required' : 'none';
    case 'depthWindow': {
      const currentDepth = context.counters[force.axis];
      if (currentDepth < force.start) {
        return 'none';
      }
      const forceChance = 1 / Math.max(1, force.deadline - currentDepth);
      return forceChance >= 1 ? 'required' : 'optional';
    }
  }
}

function requirementEvidence(
  requirement: RequirementExpression,
  context: RequirementEvaluationContext,
): RequirementEvaluationEvidence {
  const satisfied = evaluateRequirement(requirement, context);
  switch (requirement.kind) {
    case 'all':
    case 'any':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        children: Object.freeze(
          requirement.requirements.map((child) => requirementEvidence(child, context)),
        ),
      });
    case 'not':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        child: requirementEvidence(requirement.requirement, context),
      });
    case 'counterRange':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        axis: requirement.axis,
        actual: context.counters[requirement.axis],
        expected: requirement.range,
      });
    case 'recordCount': {
      const record = context.records[requirement.record];
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        record: requirement.record,
        keys: requirement.keys,
        actual: requirement.keys.reduce((total, key) => total + (record[key] ?? 0), 0),
        expected: requirement.range,
      });
    }
    case 'distinctRecordKeyCount': {
      const record = context.records[requirement.record];
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        record: requirement.record,
        keys: requirement.keys,
        actual: requirement.keys.filter((key) => (record[key] ?? 0) > 0).length,
        expected: requirement.range,
      });
    }
    case 'recentEncounterPhaseCount': {
      const recentRooms = context.recentEncounterPhases.slice(-requirement.roomWindow);
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        profileKey: requirement.profileKey,
        phaseKey: requirement.phaseKey,
        roomWindow: requirement.roomWindow,
        actual: recentRooms.reduce(
          (total, room) =>
            total +
            (room.profileKey === requirement.profileKey &&
            room.phaseKeys.includes(requirement.phaseKey)
              ? 1
              : 0),
          0,
        ),
        expected: requirement.range,
      });
    }
    case 'minExits':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        actual: context.offeredExitCount,
        minimum: requirement.count,
      });
    case 'currentBatchTargetCount':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        actual: context.currentBatchRoomGameNames.length,
        expected: requirement.range,
      });
    case 'currentBatchRoomCount':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        roomGameNames: requirement.roomGameNames,
        actual: context.currentBatchRoomGameNames.filter((gameName) =>
          requirement.roomGameNames.includes(gameName),
        ).length,
        expected: requirement.range,
      });
    case 'clockworkGoalsRemaining':
      if (context.clockwork === undefined) {
        throw new BiomeRoomGenerationContractError(
          'Clockwork requirement evidence has no Clockwork facts',
        );
      }
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        actual: context.clockwork.remainingGoals,
        expected: requirement.range,
      });
    case 'clockworkNonGoalCapacity':
      if (context.clockwork === undefined) {
        throw new BiomeRoomGenerationContractError(
          'Clockwork requirement evidence has no Clockwork facts',
        );
      }
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        acquired: context.clockwork.nonGoalRewardsAcquired,
        maximum: context.clockwork.maxNonGoalRewards,
        reserve: requirement.reserve,
      });
    default:
      throw new BiomeRoomGenerationContractError(
        `room generation cannot explain ${requirement.kind}`,
      );
  }
}

function roomGenerationCounts(
  view: HistoryStateView,
  parentOrigin: RoomHistoryOrigin,
): RoomGenerationCounts {
  const parentKey = semanticAddressKey(parentOrigin);
  return Object.freeze({
    appearancesByGameName: Object.freeze(countByGameName(view.ledgers.roomAppearances)),
    creationsByGameName: Object.freeze(countByGameName(view.ledgers.roomCreations)),
    parentCreationsByGameName: Object.freeze(
      countByGameName(
        view.ledgers.roomCreations.filter(
          (creation) =>
            creation.source === 'generatedTarget' &&
            semanticAddressKey(creation.parentOrigin) === parentKey,
        ),
      ),
    ),
  });
}

function evaluateCandidate(
  catalog: Catalog,
  source: CanonicalGenerationSource,
  sourceDeclaration: RoomDeclaration,
  exit: CanonicalPhysicalExit,
  counts: RoomGenerationCounts,
  room: RoomDeclaration,
  context: RequirementEvaluationContext,
): CandidateEvaluation {
  const reasons: RoomGenerationExclusionReason[] = [];
  const exclusions: RoomGenerationExclusionEvidence[] = [];
  if (room.force !== undefined) {
    assertGenerationForce(room.force);
  }
  if (exit.kind === 'unavailable') {
    reasons.push('physicalExitUnavailable');
    exclusions.push({ kind: 'physicalExitUnavailable', exitIndex: exit.index });
  } else {
    const policy = catalog.exitCompatibilityPolicies.byKey[exit.compatibilityPolicyKey];
    if (policy === undefined) {
      throw new BiomeRoomGenerationContractError(
        `unknown exit compatibility policy ${exit.compatibilityPolicyKey}`,
      );
    }
    if (!compatible(policy, sourceDeclaration, room)) {
      reasons.push('exitIncompatible');
      exclusions.push({
        kind: 'exitIncompatible',
        compatibilityPolicyKey: exit.compatibilityPolicyKey,
        sourceGameName: source.gameName,
        candidateGameName: room.gameName,
      });
    }
  }
  if (room.gameName === source.gameName) {
    reasons.push('currentRoomRepeat');
    exclusions.push({ kind: 'currentRoomRepeat', sourceGameName: source.gameName });
  }
  if (room.force?.kind === 'depthWindow' && context.counters[room.force.axis] < room.force.start) {
    reasons.push('forceMinimum');
    exclusions.push({
      kind: 'forceMinimum',
      axis: room.force.axis as 'biomeDepthCache' | 'biomeEncounterDepth',
      actual: context.counters[room.force.axis],
      minimum: room.force.start,
    });
  }
  if (room.eligibility !== undefined) {
    assertGenerationRequirement(room.eligibility);
    if (!evaluateRequirement(room.eligibility, context)) {
      reasons.push('eligibilityRequirement');
      exclusions.push({
        kind: 'eligibilityRequirement',
        evaluation: requirementEvidence(room.eligibility, context),
      });
    }
  }
  if (
    room.caps.maxCreationsThisRun !== undefined &&
    (counts.creationsByGameName[room.gameName] ?? 0) >= room.caps.maxCreationsThisRun
  ) {
    reasons.push('maxCreationsThisRun');
    exclusions.push({
      kind: 'maxCreationsThisRun',
      actual: counts.creationsByGameName[room.gameName] ?? 0,
      maximum: room.caps.maxCreationsThisRun,
    });
  }
  if (
    room.caps.maxCreationsPerRoom !== undefined &&
    (counts.parentCreationsByGameName[room.gameName] ?? 0) >= room.caps.maxCreationsPerRoom
  ) {
    reasons.push('maxCreationsPerRoom');
    exclusions.push({
      kind: 'maxCreationsPerRoom',
      actual: counts.parentCreationsByGameName[room.gameName] ?? 0,
      maximum: room.caps.maxCreationsPerRoom,
    });
  }
  if (
    room.caps.maxAppearancesThisBiome !== undefined &&
    (counts.appearancesByGameName[room.gameName] ?? 0) >= room.caps.maxAppearancesThisBiome
  ) {
    reasons.push('maxAppearancesThisBiome');
    exclusions.push({
      kind: 'maxAppearancesThisBiome',
      actual: counts.appearancesByGameName[room.gameName] ?? 0,
      maximum: room.caps.maxAppearancesThisBiome,
    });
  }
  return Object.freeze({
    room,
    reasons: Object.freeze(reasons),
    exclusions: Object.freeze(exclusions),
    forceSupport: reasons.length === 0 ? forceSupport(room.force, context) : 'none',
  });
}

function normalCandidatePool(catalog: Catalog, layout: BiomeLayout): readonly RoomDeclaration[] {
  const progression = normalDecisionProgressionForLayout(layout);
  if (progression === undefined) {
    throw new BiomeRoomGenerationContractError(
      `catalog does not provide ${layout.biomeKey} normal candidate structure`,
    );
  }
  const startNames = new Set(
    layout.start.kind === 'authoredChoice'
      ? layout.start.roomGameNames
      : [layout.start.roomGameName],
  );
  return Object.freeze(
    catalog.rooms.values.filter(
      (room) =>
        room.biomeKey === layout.biomeKey &&
        room.mode.kind === 'authored' &&
        room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors' &&
        !startNames.has(room.gameName),
    ),
  );
}

function stagedCandidatePool(
  catalog: Catalog,
  layout: BiomeLayout,
  batchIndex: number,
): readonly RoomDeclaration[] {
  const progression = normalDecisionProgressionForLayout(layout);
  if (progression === undefined) {
    throw new BiomeRoomGenerationContractError(`${layout.biomeKey} has no normal candidate policy`);
  }
  const policy = progression.progressionPolicy;
  if (policy.kind !== 'staged') {
    return normalCandidatePool(catalog, layout);
  }
  const stage = policy.stages[batchIndex];
  if (stage === undefined) {
    // An empty terminal decision envelope has no ordinary staged domain. The
    // topology codec and command boundary still reject any persisted ordinary
    // target beyond the final stage; generation must be able to evaluate the
    // declaration-owned fixed takeover choice without asking for stage N + 1.
    return Object.freeze([]);
  }
  return Object.freeze(
    stage.roomGameNames.map((gameName) => {
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new BiomeRoomGenerationContractError(
          `${layout.biomeKey} stage ${stage.key} lost room ${gameName}`,
        );
      }
      return room;
    }),
  );
}

function firstTargetCandidateDomain(
  catalog: Catalog,
  layout: BiomeLayout,
  ordinaryBatchIndex: number,
): FirstTargetCandidateDomain {
  const fixedForLayout = fixedWidthOneTakeoverForLayout(catalog, layout);
  const fixedTakeover =
    ordinaryBatchIndex === ordinaryProgressionBatchLimit(layout) ? fixedForLayout : undefined;
  if (fixedTakeover !== undefined) {
    return Object.freeze({
      ordinary: Object.freeze([]),
      takeover: Object.freeze([fixedTakeover]),
      fixedTakeover,
    });
  }
  return Object.freeze({
    ordinary: stagedCandidatePool(catalog, layout, ordinaryBatchIndex),
    // O/Q's declaration-owned width-one room is a terminal transition, never
    // an ordinary early-batch option. The topology query owns its identity
    // and shape, including malformed declaration rejection.
    takeover:
      layout.progression.kind === 'generated' && fixedForLayout === undefined
        ? takeoverCandidatePool(catalog, layout.biomeKey)
        : Object.freeze([]),
    fixedTakeover: undefined,
  });
}

function sourceGenerationSupport(
  candidates: readonly SourceForceCandidate[],
): SourceGenerationSupport {
  const eligible = candidates.filter((candidate) => candidate.eligible);
  const optional = eligible.filter((candidate) => candidate.forceSupport === 'optional');
  const required = eligible.filter((candidate) => candidate.forceSupport === 'required');
  const support =
    required.length === 0
      ? eligible
      : eligible.filter((candidate) => candidate.forceSupport !== 'none');
  return Object.freeze({
    eligibleGameNames: Object.freeze(eligible.map((candidate) => candidate.gameName)),
    optionalForcedGameNames: Object.freeze(optional.map((candidate) => candidate.gameName)),
    requiredForcedGameNames: Object.freeze(required.map((candidate) => candidate.gameName)),
    supportGameNames: new Set(support.map((candidate) => candidate.gameName)),
    supportRoomGameNames: Object.freeze(support.map((candidate) => candidate.gameName)),
  });
}

function targetGenerationViews(
  history: BiomeGenerationHistory,
): ReadonlyMap<string, TargetGenerationView> {
  const entries = history.rooms.flatMap((room) => room.targetGenerations);
  return new Map(entries.map((view) => [semanticAddressKey(view.targetOrigin), view]));
}

function sameRecord(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => left[key] === right[key]);
}

function targetRewardHistories(
  checkpoints: readonly TargetRewardHistoryCheckpoint[] | undefined,
): ReadonlyMap<string, RewardHistoryState> {
  const result = new Map<string, RewardHistoryState>();
  for (const checkpoint of checkpoints ?? []) {
    const first = checkpoint.histories[0];
    if (first === undefined) {
      continue;
    }
    if (
      checkpoint.histories.some(
        (history) =>
          !sameRecord(history.useRecord, first.useRecord) ||
          !sameRecord(history.biomeUseRecord, first.biomeUseRecord) ||
          !sameRecord(history.lootTypeHistory, first.lootTypeHistory),
      )
    ) {
      throw new BiomeRoomGenerationContractError(
        `target ${semanticAddressKey(checkpoint.origin)} has divergent reward-history eligibility facts`,
      );
    }
    result.set(semanticAddressKey(checkpoint.origin), first);
  }
  return result;
}

function generationRooms(
  snapshot: BiomeGenerationSnapshot,
): ReadonlyMap<string, CanonicalGenerationSource> {
  const rooms = [
    snapshot.entryRoom,
    ...generationDecisions(snapshot).flatMap((decision) =>
      decision.kind === 'batch' ? decision.targets.map((target) => target.room) : [],
    ),
  ];
  return new Map(rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function finding(
  code:
    | 'encounterCountUnavailable'
    | 'fieldsCageOutcomeUnavailable'
    | 'targetRoomSupportEmpty'
    | 'targetRoomUnavailable',
  origin: SemanticFinding['origin'],
  evidence: FindingEvidence,
): SemanticFinding {
  return Object.freeze({
    code,
    severity: 'error',
    phase: 'roomGeneration',
    origin,
    evidence: Object.freeze(evidence),
  });
}

function encounterCountEvidence(entry: EncounterCountSupportEntry): FindingEvidence {
  return {
    beforeSequence: entry.beforeSequence,
    selectedEncounterCount: entry.selectedEncounterCount,
    supportEncounterCounts: entry.supportEncounterCounts,
  };
}

function evaluateEncounterCount(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  view: HistoryStateView,
  enteredBiomeCount: number,
  rewardHistory: RewardHistoryState | undefined,
): EncounterCountSupportEntry | undefined {
  const declaration = catalog.rooms.byKey[room.gameName];
  const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
  if (declaration === undefined || profile === undefined) {
    throw new BiomeRoomGenerationContractError(`${room.gameName} lost its encounter declaration`);
  }
  const optionalIndexes = profile.phases.flatMap((phase, index) =>
    phase.presence === undefined ? [] : [index],
  );
  if (optionalIndexes.length === 0) {
    return undefined;
  }
  const optionalIndex = optionalIndexes[0];
  const optional =
    optionalIndex === undefined ? undefined : profile.phases[optionalIndex]?.presence;
  if (
    optionalIndexes.length !== 1 ||
    optional === undefined ||
    optionalIndex !== profile.phases.length - 1
  ) {
    throw new BiomeRoomGenerationContractError(
      `${room.gameName} has unsupported optional encounter-phase structure`,
    );
  }
  assertGenerationRequirement(optional.requirement);
  const context = projectRoomGenerationRequirementContext(
    room,
    declaration,
    view,
    enteredBiomeCount,
    rewardHistory,
  );
  const supportEncounterCounts = evaluateRequirement(optional.requirement, context)
    ? Object.freeze([optionalIndex, optionalIndex + 1])
    : Object.freeze([optionalIndex]);
  const selectedEncounterCount = room.encounterPhases.length;
  return Object.freeze({
    origin: room.origin,
    beforeSequence: view.sequence,
    selectedEncounterCount,
    supportEncounterCounts,
    selectedPossible: supportEncounterCounts.includes(selectedEncounterCount),
  });
}

function fieldsCageOutcomeEvidence(entry: FieldsCageOutcomeSupportEntry): FindingEvidence {
  return {
    beforeSequence: entry.beforeSequence,
    biomeDepthCache: entry.biomeDepthCache,
    fieldsMaxDoorsRolled: entry.fieldsMaxDoorsRolled,
    maxDoorCageCeiling: entry.maxDoorCageCeiling,
    selectedOutcome: entry.selectedOutcome,
    supportOutcomes: entry.supportOutcomes,
  };
}

export function supportedFieldsCageOutcomes(
  batchPolicy: Extract<NormalDoorBatchPolicy, { readonly kind: 'fields' }>,
  biomeDepthCache: number,
  fieldsMaxDoorsRolled: number,
): readonly FieldsCageOutcome[] {
  if (
    !Number.isInteger(biomeDepthCache) ||
    biomeDepthCache < 1 ||
    !Number.isInteger(fieldsMaxDoorsRolled) ||
    fieldsMaxDoorsRolled < 0
  ) {
    throw new BiomeRoomGenerationContractError('Fields outcome support has invalid counters');
  }
  if (fieldsMaxDoorsRolled >= batchPolicy.maxDoorCageCeiling) {
    return Object.freeze(['min']);
  }
  if (batchPolicy.maxOutcomeSupport.requiredBiomeDepths.includes(biomeDepthCache)) {
    return Object.freeze(['max']);
  }
  return batchPolicy.maxOutcomeSupport.optionalBiomeDepths.includes(biomeDepthCache)
    ? Object.freeze(['min', 'max'])
    : Object.freeze(['min']);
}

export function fieldsCageOutcomeCandidateSupport(
  batchPolicy: Extract<NormalDoorBatchPolicy, { readonly kind: 'fields' }>,
  origin: ExitDecisionAddress,
  view: HistoryStateView,
): FieldsCageOutcomeCandidateSupport {
  const fieldsMaxDoorsRolled = view.ledgers.counters.fieldsMaxDoorsRolled;
  if (fieldsMaxDoorsRolled === undefined) {
    throw new BiomeRoomGenerationContractError('Fields history lost its Max outcome counter');
  }
  const supportOutcomes = supportedFieldsCageOutcomes(
    batchPolicy,
    view.ledgers.counters.biomeDepthCache,
    fieldsMaxDoorsRolled,
  );
  return Object.freeze({
    origin,
    beforeSequence: view.sequence,
    biomeDepthCache: view.ledgers.counters.biomeDepthCache,
    fieldsMaxDoorsRolled,
    maxDoorCageCeiling: batchPolicy.maxDoorCageCeiling,
    supportOutcomes,
  });
}

function evaluateFieldsCageOutcome(
  batchPolicy: Extract<NormalDoorBatchPolicy, { readonly kind: 'fields' }>,
  batch: Pick<CanonicalBatch, 'batchState' | 'origin'>,
  view: HistoryStateView,
): FieldsCageOutcomeSupportEntry {
  if (batch.batchState.kind !== 'fields') {
    throw new BiomeRoomGenerationContractError('Fields layout lost its canonical batch state');
  }
  const support = fieldsCageOutcomeCandidateSupport(batchPolicy, batch.origin, view);
  return Object.freeze({
    ...support,
    selectedOutcome: batch.batchState.cageOutcome,
    selectedPossible: support.supportOutcomes.includes(batch.batchState.cageOutcome),
  });
}

function selectedEvidence(entry: ForcePressureLedgerEntry): FindingEvidence {
  return {
    sourceGameName: entry.sourceGameName,
    selectedGameName: entry.selectedGameName,
    exitIndex: entry.exitIndex,
    beforeSequence: entry.beforeSequence,
    biomeDepthCache: entry.biomeDepthCache,
    biomeEncounterDepth: entry.biomeEncounterDepth,
    selectedCreationCount: entry.selectedCreationCount,
    selectedAppearanceCount: entry.selectedAppearanceCount,
    selectedParentCreationCount: entry.selectedParentCreationCount,
    eligibleRoomGameNames: entry.eligibleRoomGameNames,
    optionalForcedRoomGameNames: entry.optionalForcedRoomGameNames,
    requiredForcedRoomGameNames: entry.requiredForcedRoomGameNames,
    supportRoomGameNames: entry.supportRoomGameNames,
    exclusionReasons: entry.selectedExclusionReasons,
  };
}

function assertTargetHistoryMatches(
  source: CanonicalGenerationSource,
  target: CanonicalTarget,
  view: TargetGenerationView,
): void {
  const targetKey = semanticAddressKey(target.origin);
  const sourceKey = semanticAddressKey(source.origin);
  if (
    semanticAddressKey(view.targetOrigin) !== targetKey ||
    semanticAddressKey(view.roomOrigin) !== semanticAddressKey(target.room.origin)
  ) {
    throw new BiomeRoomGenerationContractError(
      `target ${targetKey} does not match its history generation view`,
    );
  }

  const sourceAppearance = view.before.ledgers.roomAppearances.find(
    (appearance) => semanticAddressKey(appearance.origin) === sourceKey,
  );
  if (sourceAppearance?.gameName !== source.gameName) {
    throw new BiomeRoomGenerationContractError(
      `source ${sourceKey} does not match its history appearance`,
    );
  }

  const beforeCreations = view.before.ledgers.roomCreations;
  const afterCreations = view.after.ledgers.roomCreations;
  const creation = afterCreations.at(-1);
  if (
    afterCreations.length !== beforeCreations.length + 1 ||
    creation?.source !== 'generatedTarget' ||
    semanticAddressKey(creation.targetOrigin) !== targetKey ||
    semanticAddressKey(creation.parentOrigin) !== sourceKey ||
    semanticAddressKey(creation.origin) !== semanticAddressKey(target.room.origin) ||
    creation.gameName !== target.room.gameName
  ) {
    throw new BiomeRoomGenerationContractError(
      `target ${targetKey} does not match its history creation`,
    );
  }
}

function candidatePressure(
  source: CanonicalGenerationSource,
  targetOrigin: CanonicalTarget['origin'],
  exit: CanonicalPhysicalExit,
  before: HistoryStateView,
  context: RequirementEvaluationContext,
  counts: RoomGenerationCounts,
  selectedGameName: string,
  selected: CandidateEvaluation | undefined,
  support: SourceGenerationSupport,
): ForcePressureLedgerEntry {
  const reasons = [...(selected?.reasons ?? ['notCandidate'])] as RoomGenerationExclusionReason[];
  const exclusions: RoomGenerationExclusionEvidence[] = [
    ...(selected?.exclusions ?? [{ kind: 'notCandidate' as const }]),
  ];
  if (
    selected !== undefined &&
    selected.reasons.length === 0 &&
    !support.supportGameNames.has(selectedGameName)
  ) {
    reasons.push('forcedPool');
    exclusions.push({
      kind: 'forcedPool',
      requiredRoomGameNames: support.requiredForcedGameNames,
    });
  }
  return Object.freeze({
    targetOrigin,
    beforeSequence: before.sequence,
    sourceGameName: source.gameName,
    selectedGameName,
    exitIndex: exit.index,
    biomeDepthCache: context.counters.biomeDepthCache,
    biomeEncounterDepth: context.counters.biomeEncounterDepth,
    selectedCreationCount: counts.creationsByGameName[selectedGameName] ?? 0,
    selectedAppearanceCount: counts.appearancesByGameName[selectedGameName] ?? 0,
    selectedParentCreationCount: counts.parentCreationsByGameName[selectedGameName] ?? 0,
    eligibleRoomGameNames: support.eligibleGameNames,
    optionalForcedRoomGameNames: support.optionalForcedGameNames,
    requiredForcedRoomGameNames: support.requiredForcedGameNames,
    supportRoomGameNames: support.supportRoomGameNames,
    selectedPossible:
      selected !== undefined &&
      selected.reasons.length === 0 &&
      support.supportGameNames.has(selectedGameName),
    selectedExclusionReasons: Object.freeze(reasons),
    selectedExclusions: Object.freeze(exclusions),
  });
}

function targetCandidateContext(
  source: CanonicalGenerationSource,
  targetOrigin: CanonicalTarget['origin'],
  exit: CanonicalPhysicalExit,
  before: HistoryStateView,
  context: RequirementEvaluationContext,
  counts: RoomGenerationCounts,
  candidates: readonly CandidateEvaluation[],
  support: SourceGenerationSupport,
): RoomTargetCandidateContext {
  const candidatesByGameName = new Map(
    candidates.map((candidate) => [candidate.room.gameName, candidate] as const),
  );
  return Object.freeze({
    targetOrigin,
    evaluateGameName: (selectedGameName: string): RoomTargetCandidateValidation => {
      const pressure = candidatePressure(
        source,
        targetOrigin,
        exit,
        before,
        context,
        counts,
        selectedGameName,
        candidatesByGameName.get(selectedGameName),
        support,
      );
      const findings: SemanticFinding[] = [];
      if (support.supportGameNames.size === 0) {
        findings.push(finding('targetRoomSupportEmpty', targetOrigin, selectedEvidence(pressure)));
      }
      if (!pressure.selectedPossible) {
        findings.push(finding('targetRoomUnavailable', targetOrigin, selectedEvidence(pressure)));
      }
      return Object.freeze({ pressure, findings: Object.freeze(findings) });
    },
  });
}

function prepareTargetGameNameContext(
  catalog: Catalog,
  pool: readonly RoomDeclaration[],
  source: CanonicalGenerationSource,
  targetOrigin: CanonicalTarget['origin'],
  exit: CanonicalPhysicalExit,
  before: HistoryStateView,
  enteredBiomeCount: number,
  rewardHistory: RewardHistoryState | undefined,
): RoomTargetCandidateContext {
  const sourceDeclaration = catalog.rooms.byKey[source.gameName];
  if (sourceDeclaration === undefined) {
    throw new BiomeRoomGenerationContractError(`unknown source room ${source.gameName}`);
  }
  const context = projectRoomGenerationRequirementContext(
    source,
    sourceDeclaration,
    before,
    enteredBiomeCount,
    rewardHistory,
  );
  const counts = roomGenerationCounts(before, source.origin);
  const candidates = pool.map((room) =>
    evaluateCandidate(catalog, source, sourceDeclaration, exit, counts, room, context),
  );
  return targetCandidateContext(
    source,
    targetOrigin,
    exit,
    before,
    context,
    counts,
    candidates,
    sourceGenerationSupport(
      candidates.map((candidate) =>
        Object.freeze({
          eligible: candidate.reasons.length === 0,
          forceSupport: candidate.forceSupport,
          gameName: candidate.room.gameName,
        }),
      ),
    ),
  );
}

function withCandidateExclusion(
  candidate: CandidateEvaluation,
  reason: Extract<RoomGenerationExclusionReason, 'maxCreationsPerRoom' | 'maxCreationsThisRun'>,
  actual: number,
  maximum: number,
): CandidateEvaluation {
  if (candidate.reasons.includes(reason)) return candidate;
  return Object.freeze({
    ...candidate,
    reasons: Object.freeze([...candidate.reasons, reason]),
    exclusions: Object.freeze([
      ...candidate.exclusions,
      Object.freeze({ kind: reason, actual, maximum }),
    ]),
    forceSupport: 'none' as const,
  });
}

function applyAggregateTakeoverCreationCaps(
  entries: readonly CandidateEvaluation[],
  candidate: RoomDeclaration,
  counts: RoomGenerationCounts,
): readonly CandidateEvaluation[] {
  let capped = entries;
  const apply = (
    maximum: number | undefined,
    actualBefore: number,
    reason: Extract<RoomGenerationExclusionReason, 'maxCreationsPerRoom' | 'maxCreationsThisRun'>,
  ): void => {
    if (maximum === undefined || actualBefore + capped.length <= maximum) return;
    const firstUnavailable = Math.max(0, maximum - actualBefore);
    capped = Object.freeze(
      capped.map((entry, index) =>
        index < firstUnavailable
          ? entry
          : withCandidateExclusion(entry, reason, actualBefore + index, maximum),
      ),
    );
  };
  apply(
    candidate.caps.maxCreationsThisRun,
    counts.creationsByGameName[candidate.gameName] ?? 0,
    'maxCreationsThisRun',
  );
  apply(
    candidate.caps.maxCreationsPerRoom,
    counts.parentCreationsByGameName[candidate.gameName] ?? 0,
    'maxCreationsPerRoom',
  );
  return capped;
}

function evaluateTakeoverShape(
  catalog: Catalog,
  source: CanonicalGenerationSource,
  sourceDeclaration: RoomDeclaration,
  context: RequirementEvaluationContext,
  counts: RoomGenerationCounts,
  candidate: RoomDeclaration,
): TakeoverShapeEvaluation {
  const entries = applyAggregateTakeoverCreationCaps(
    ownerNormalExits(sourceDeclaration).map((exit) =>
      evaluateCandidate(catalog, source, sourceDeclaration, exit, counts, candidate, context),
    ),
    candidate,
    counts,
  );
  return Object.freeze({
    candidate,
    entries,
    forceSupport: entries.every((entry) => entry.reasons.length === 0)
      ? (entries[0]?.forceSupport ?? 'none')
      : 'none',
  });
}

function ownerNormalExits(ownerDeclaration: RoomDeclaration): readonly CanonicalPhysicalExit[] {
  return Object.freeze(
    [...ownerDeclaration.exits]
      .sort((left, right) => left.index - right.index)
      .map((exit) =>
        Object.freeze({
          kind: 'available' as const,
          exitKey: `exit${exit.index}`,
          index: exit.index,
          type: exit.type,
          compatibilityPolicyKey: exit.compatibilityPolicyKey,
        }),
      ),
  );
}

function firstTargetGenerationSupport(
  catalog: Catalog,
  biomeKey: string,
  ordinaryBatchIndex: number,
  source: CanonicalAuthoredRoom,
  exit: CanonicalPhysicalExit,
  before: HistoryStateView,
  enteredBiomeCount: number,
  rewardHistory?: RewardHistoryState,
): FirstTargetGenerationSupport {
  const layout = catalog.biomeLayouts.byKey[biomeKey];
  if (layout === undefined || normalDecisionProgressionForLayout(layout) === undefined) {
    throw new BiomeRoomGenerationContractError(
      `${biomeKey} has no normal first-target candidate domain`,
    );
  }
  const sourceDeclaration = catalog.rooms.byKey[source.gameName];
  if (sourceDeclaration === undefined) {
    throw new BiomeRoomGenerationContractError(`unknown source room ${source.gameName}`);
  }
  const context = projectRoomGenerationRequirementContext(
    source,
    sourceDeclaration,
    before,
    enteredBiomeCount,
    rewardHistory,
  );
  const counts = roomGenerationCounts(before, source.origin);
  const domain = firstTargetCandidateDomain(catalog, layout, ordinaryBatchIndex);
  const ordinary = domain.ordinary.map((room) =>
    evaluateCandidate(catalog, source, sourceDeclaration, exit, counts, room, context),
  );
  const takeovers = domain.takeover.map((room) =>
    evaluateTakeoverShape(catalog, source, sourceDeclaration, context, counts, room),
  );
  const support = sourceGenerationSupport(
    Object.freeze([
      ...ordinary.map((candidate) =>
        Object.freeze({
          eligible: candidate.reasons.length === 0,
          forceSupport: candidate.forceSupport,
          gameName: candidate.room.gameName,
        }),
      ),
      ...takeovers.map((candidate) =>
        Object.freeze({
          eligible: candidate.entries.every((entry) => entry.reasons.length === 0),
          forceSupport:
            candidate.candidate.gameName === domain.fixedTakeover?.gameName &&
            candidate.entries.every((entry) => entry.reasons.length === 0)
              ? ('required' as const)
              : candidate.forceSupport,
          gameName: candidate.candidate.gameName,
        }),
      ),
    ]),
  );
  return Object.freeze({
    context,
    counts,
    ordinaryCandidates: new Map(
      ordinary.map((candidate) => [candidate.room.gameName, candidate] as const),
    ),
    sourceSupport: support,
    takeoverCandidates: new Map(
      takeovers.map((candidate) => [candidate.candidate.gameName, candidate] as const),
    ),
  });
}

function firstTargetRoomCandidateContext(
  catalog: Catalog,
  biomeKey: string,
  ordinaryBatchIndex: number,
  source: CanonicalAuthoredRoom,
  targetOrigin: CanonicalTarget['origin'],
  exit: CanonicalPhysicalExit,
  before: HistoryStateView,
  enteredBiomeCount: number,
  rewardHistory?: RewardHistoryState,
): RoomTargetCandidateContext {
  const support = firstTargetGenerationSupport(
    catalog,
    biomeKey,
    ordinaryBatchIndex,
    source,
    exit,
    before,
    enteredBiomeCount,
    rewardHistory,
  );
  return targetCandidateContext(
    source,
    targetOrigin,
    exit,
    before,
    support.context,
    support.counts,
    [...support.ordinaryCandidates.values()],
    support.sourceSupport,
  );
}

/**
 * Builds the candidate domain at an uncommitted ordinary decision frontier.
 * It consumes the declaration-selected source checkpoint rather than a
 * speculative target, so callers can evaluate an empty or partially authored
 * batch without changing its persisted topology. Ordinary layouts use the
 * outgoing checkpoint; the bounded N entry uses its committed checkpoint.
 */
export function roomTargetCandidateContextAtFrontier(
  catalog: Catalog,
  biomeKey: string,
  ordinaryBatchIndex: number,
  source: CanonicalAuthoredRoom,
  targetOrigin: CanonicalTarget['origin'],
  exit: CanonicalPhysicalExit,
  before: HistoryStateView,
  enteredBiomeCount: number,
  includeTakeoverSupport = false,
  rewardHistoryCheckpoints?: readonly TargetRewardHistoryCheckpoint[],
): RoomTargetCandidateContext {
  const layout = catalog.biomeLayouts.byKey[biomeKey];
  if (layout === undefined || normalDecisionProgressionForLayout(layout) === undefined) {
    throw new BiomeRoomGenerationContractError(`${biomeKey} has no normal target candidate domain`);
  }
  const rewardHistory = targetRewardHistories(rewardHistoryCheckpoints).get(
    semanticAddressKey(targetOrigin),
  );
  if (includeTakeoverSupport) {
    return firstTargetRoomCandidateContext(
      catalog,
      biomeKey,
      ordinaryBatchIndex,
      source,
      targetOrigin,
      exit,
      before,
      enteredBiomeCount,
      rewardHistory,
    );
  }
  return prepareTargetGameNameContext(
    catalog,
    stagedCandidatePool(catalog, layout, ordinaryBatchIndex),
    source,
    targetOrigin,
    exit,
    before,
    enteredBiomeCount,
    rewardHistory,
  );
}

function requireSource(
  rooms: ReadonlyMap<string, CanonicalGenerationSource>,
  origin: RoomHistoryOrigin,
): CanonicalGenerationSource {
  const room = rooms.get(semanticAddressKey(origin));
  if (room === undefined || !room.entered) {
    throw new BiomeRoomGenerationContractError(
      `history source ${semanticAddressKey(origin)} is not an entered canonical room`,
    );
  }
  return room;
}

/**
 * A normal decision's semantic exit keys are declared by its layout, not
 * reconstructed from `exit${n}`.  N's bounded Opening entry deliberately
 * uses the stable physical key `prehub`; the later PreHub terminal envelope
 * deliberately has no ordinary physical target at all.
 */
function normalPhysicalExitsForSource(
  layout: BiomeLayout,
  startOccurrenceId: CanonicalAuthoredRoom['occurrenceId'],
  source: ExitDecisionAddress['source'],
  sourceDeclaration: RoomDeclaration,
): readonly CanonicalPhysicalExit[] {
  const declared = declaredPhysicalExitsForSourceRoom(
    layout,
    startOccurrenceId,
    source,
    sourceDeclaration,
  );
  if (declared === undefined) {
    throw new BiomeRoomGenerationContractError(
      `${layout.biomeKey} has no declared physical exits for ${source.kind}`,
    );
  }
  return Object.freeze(
    declared.flatMap((exit) =>
      exit.kind === 'normal'
        ? [
            Object.freeze({
              kind: 'available' as const,
              exitKey: exit.exitKey,
              index: exit.index,
              type: exit.type,
              compatibilityPolicyKey: exit.compatibilityPolicyKey,
            }),
          ]
        : [],
    ),
  );
}

function evaluateTargetSlots(
  catalog: Catalog,
  pool: readonly RoomDeclaration[],
  source: CanonicalGenerationSource,
  sourceBeforeGeneration: HistoryStateView,
  generationOrigin: ExitDecisionAddress,
  physicalExits: readonly CanonicalPhysicalExit[],
  targets: readonly CanonicalTarget[],
  views: ReadonlyMap<string, TargetGenerationView>,
  candidateContexts: Map<string, RoomTargetCandidateContext>,
  pressure: ForcePressureLedgerEntry[],
  encounterCounts: EncounterCountSupportEntry[],
  findings: SemanticFinding[],
  enteredBiomeCount: number,
  rewardHistories: ReadonlyMap<string, RewardHistoryState>,
): void {
  const sourceDeclaration = catalog.rooms.byKey[source.gameName];
  if (sourceDeclaration === undefined) {
    throw new BiomeRoomGenerationContractError(`unknown source room ${source.gameName}`);
  }
  const biome = createBiomeAddress(generationOrigin.routeKey, generationOrigin.biomeKey);
  const evaluateConcreteTarget = (target: CanonicalTarget): HistoryStateView => {
    const targetKey = semanticAddressKey(target.origin);
    const rewardHistory = rewardHistories.get(targetKey);
    const view = views.get(targetKey);
    if (view === undefined) {
      throw new BiomeRoomGenerationContractError(
        `target ${semanticAddressKey(target.origin)} has no history generation view`,
      );
    }
    assertTargetHistoryMatches(source, target, view);
    const candidateContext = prepareTargetGameNameContext(
      catalog,
      pool,
      source,
      target.origin,
      target.exit,
      before,
      enteredBiomeCount,
      rewardHistory,
    );
    candidateContexts.set(targetKey, candidateContext);
    const result = candidateContext.evaluateGameName(target.room.gameName);
    pressure.push(result.pressure);
    findings.push(...result.findings);
    if (
      target.room.kind === 'authored' &&
      catalog.encounterProfiles.byKey[target.room.encounterProfileKey]?.phases.some(
        (phase) => phase.presence !== undefined,
      )
    ) {
      const encounterCount = evaluateEncounterCount(
        catalog,
        target.room,
        view.before,
        enteredBiomeCount,
        rewardHistory,
      );
      if (encounterCount !== undefined) {
        encounterCounts.push(encounterCount);
        if (!encounterCount.selectedPossible) {
          findings.push(
            finding(
              'encounterCountUnavailable',
              encounterCount.origin,
              encounterCountEvidence(encounterCount),
            ),
          );
        }
      }
    }
    return view.after;
  };
  let before = sourceBeforeGeneration;
  for (const exit of physicalExits) {
    const target = targets.find((candidate) => candidate.exit.exitKey === exit.exitKey);
    const targetOrigin =
      target?.origin ?? createTargetAddress(biome, generationOrigin.source, exit.exitKey);
    const rewardHistory = rewardHistories.get(semanticAddressKey(targetOrigin));
    if (target === undefined) {
      candidateContexts.set(
        semanticAddressKey(targetOrigin),
        prepareTargetGameNameContext(
          catalog,
          pool,
          source,
          targetOrigin,
          exit,
          before,
          enteredBiomeCount,
          rewardHistory,
        ),
      );
      return;
    }
    before = evaluateConcreteTarget(target);
  }
  const availableExitKeys = new Set(physicalExits.map((exit) => exit.exitKey));
  for (const target of targets) {
    if (!availableExitKeys.has(target.exit.exitKey)) {
      evaluateConcreteTarget(target);
    }
  }
}

function takeoverCandidatePool(catalog: Catalog, biomeKey: string): readonly RoomDeclaration[] {
  return Object.freeze(
    catalog.rooms.values.filter(
      (room) =>
        room.biomeKey === biomeKey && room.prebossBatchPolicy?.kind === 'takeOverNormalDoors',
    ),
  );
}

function evaluateTakeoverAgainstSource(
  catalog: Catalog,
  source: ExitDecisionAddress,
  owner: CanonicalAuthoredRoom,
  ownerDeclaration: RoomDeclaration,
  ownerHistory: HistoryStateView,
  gameName: string,
  enteredBiomeCount: number,
  ordinaryBatchIndex: number,
): TakeoverPrebossBatchCandidateSupport {
  const exits = ownerNormalExits(ownerDeclaration);
  const requiredExitKeys = Object.freeze(exits.map((exit) => exit.exitKey));
  const candidate = catalog.rooms.byKey[gameName];
  if (candidate?.prebossBatchPolicy?.kind !== 'takeOverNormalDoors') {
    return Object.freeze({
      source,
      gameName,
      requiredExitKeys,
      requiredTargetCount: requiredExitKeys.length,
      support: 'impossible' as const,
      pressure: Object.freeze([]),
      selectedPossible: false,
      findings: Object.freeze([]),
    });
  }
  const firstExit = exits[0];
  if (firstExit === undefined) {
    return Object.freeze({
      source,
      gameName,
      requiredExitKeys,
      requiredTargetCount: 0,
      support: 'impossible' as const,
      pressure: Object.freeze([]),
      selectedPossible: false,
      findings: Object.freeze([]),
    });
  }
  const support = firstTargetGenerationSupport(
    catalog,
    source.biomeKey,
    ordinaryBatchIndex,
    owner,
    firstExit,
    ownerHistory,
    enteredBiomeCount,
  );
  const shape = support.takeoverCandidates.get(gameName);
  const pressure = Object.freeze(
    (shape?.entries ?? []).map((entry, index) => {
      const exit = exits[index];
      if (exit === undefined) {
        throw new BiomeRoomGenerationContractError(
          `${semanticAddressKey(source)} takeover shape lost normal exit ${index + 1}`,
        );
      }
      return candidatePressure(
        owner,
        createTargetAddress(
          createBiomeAddress(source.routeKey, source.biomeKey),
          source.source,
          exit.exitKey,
        ),
        exit,
        ownerHistory,
        support.context,
        support.counts,
        gameName,
        entry,
        support.sourceSupport,
      );
    }),
  );
  const findings: SemanticFinding[] = [];
  for (const entry of pressure) {
    if (support.sourceSupport.supportGameNames.size === 0) {
      findings.push(finding('targetRoomSupportEmpty', entry.targetOrigin, selectedEvidence(entry)));
    }
    if (!entry.selectedPossible) {
      findings.push(finding('targetRoomUnavailable', entry.targetOrigin, selectedEvidence(entry)));
    }
  }
  const selectedPossible =
    shape !== undefined &&
    shape.entries.length === exits.length &&
    pressure.every((entry) => entry.selectedPossible);
  const batchSupport = !selectedPossible
    ? ('impossible' as const)
    : support.sourceSupport.requiredForcedGameNames.includes(gameName)
      ? ('required' as const)
      : ('possible' as const);
  return Object.freeze({
    source,
    gameName,
    requiredExitKeys,
    requiredTargetCount: requiredExitKeys.length,
    support: batchSupport,
    pressure,
    selectedPossible,
    findings: Object.freeze(findings),
  });
}

/** Evaluates the source-owned takeover domain before target occurrences exist. */
export function evaluateTakeoverPrebossBatchCandidateAtFrontier(
  catalog: Catalog,
  source: ExitDecisionAddress,
  owner: CanonicalAuthoredRoom,
  ownerHistory: HistoryStateView,
  gameName: string,
  enteredBiomeCount: number,
  ordinaryBatchIndex: number,
): TakeoverPrebossBatchCandidateSupport {
  const ownerDeclaration = catalog.rooms.byKey[owner.gameName];
  if (ownerDeclaration === undefined) {
    throw new BiomeRoomGenerationContractError(
      `${semanticAddressKey(source)} has no declared takeover source`,
    );
  }
  return evaluateTakeoverAgainstSource(
    catalog,
    source,
    owner,
    ownerDeclaration,
    ownerHistory,
    gameName,
    enteredBiomeCount,
    ordinaryBatchIndex,
  );
}

/**
 * Evaluates the single declaration-owned terminal after a bounded Hub entry.
 * The caller establishes structural reachability and the exact empty-envelope
 * shape; this generation authority evaluates only the terminal's current-run
 * requirement and its required force against the predecessor's committed
 * post-room history.
 */
export function hubTerminalTakeoverCandidateSupportAtFrontier(
  catalog: Catalog,
  source: ExitDecisionAddress,
  owner: CanonicalAuthoredRoom,
  ownerHistory: HistoryStateView,
  enteredBiomeCount: number,
): HubTerminalTakeoverCandidateSupport {
  if (source.source.kind !== 'occurrence' || source.source.occurrenceId !== owner.occurrenceId) {
    throw new BiomeRoomGenerationContractError(
      `${semanticAddressKey(source)} does not own its Hub terminal predecessor`,
    );
  }
  const layout = catalog.biomeLayouts.byKey[source.biomeKey];
  if (layout?.progression.kind !== 'hub') {
    throw new BiomeRoomGenerationContractError(
      `${source.biomeKey} has no declaration-owned Hub terminal`,
    );
  }
  const sourceDeclaration = catalog.rooms.byKey[owner.gameName];
  if (sourceDeclaration === undefined) {
    throw new BiomeRoomGenerationContractError(
      `${semanticAddressKey(source)} lost predecessor declaration ${owner.gameName}`,
    );
  }
  const terminal = layout.progression.terminal;
  assertGenerationRequirement(terminal.eligibility);
  const context = projectRoomGenerationRequirementContext(
    owner,
    sourceDeclaration,
    ownerHistory,
    enteredBiomeCount,
  );
  const eligibility = requirementEvidence(terminal.eligibility, context);
  const selectedPossible = eligibility.satisfied;
  return Object.freeze({
    source,
    hubKey: layout.progression.hubKey,
    gameName: terminal.roomGameName,
    eligibility,
    force: terminal.force,
    support: selectedPossible ? ('required' as const) : ('impossible' as const),
    selectedPossible,
  });
}

function ordinaryBatchIndexBeforeSource(
  catalog: Catalog,
  snapshot: BiomeGenerationSnapshot,
  source: ExitDecisionAddress,
): number {
  let ordinaryBatchIndex = 0;
  for (const decision of generationDecisions(snapshot)) {
    if (semanticAddressKey(decision.origin) === semanticAddressKey(source)) {
      return ordinaryBatchIndex;
    }
    if (
      decision.kind === 'batch' &&
      decision.parent.origin.kind === 'occurrence' &&
      !decision.targets.some(
        (target) =>
          catalog.rooms.byKey[target.room.gameName]?.prebossBatchPolicy?.kind ===
          'takeOverNormalDoors',
      )
    ) {
      ordinaryBatchIndex += 1;
    }
  }
  throw new BiomeRoomGenerationContractError(
    `${semanticAddressKey(source)} is absent from the generated decision spine`,
  );
}

export function evaluateTakeoverPrebossBatchCandidate(
  catalog: Catalog,
  snapshot: BiomeGenerationSnapshot,
  history: BiomeGenerationHistory,
  source: ExitDecisionAddress,
  gameName: string,
  enteredBiomeCount: number,
): TakeoverPrebossBatchCandidateSupport {
  const batch = generationDecisions(snapshot).find(
    (decision): decision is CanonicalBatch =>
      decision.kind === 'batch' &&
      semanticAddressKey(decision.origin) === semanticAddressKey(source),
  );
  if (batch === undefined) {
    throw new BiomeRoomGenerationContractError(
      `${semanticAddressKey(source)} has no materialized normal-door batch`,
    );
  }
  if (batch.parent.origin.kind === 'hubRoom') {
    const requiredExitKeys = Object.freeze(batch.targets.map((target) => target.exit.exitKey));
    return Object.freeze({
      source,
      gameName,
      requiredExitKeys,
      requiredTargetCount: requiredExitKeys.length,
      support:
        gameName === batch.targets[0]?.room.gameName
          ? ('required' as const)
          : ('impossible' as const),
      pressure: Object.freeze([]),
      selectedPossible: gameName === batch.targets[0]?.room.gameName,
      findings: Object.freeze([]),
    });
  }
  const rooms = generationRooms(snapshot);
  const owner = requireSource(rooms, batch.parent.origin);
  const ownerDeclaration = catalog.rooms.byKey[owner.gameName];
  const ownerHistory = history.rooms.find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(owner.origin),
  )?.preOutgoing;
  if (ownerDeclaration === undefined || ownerHistory === undefined) {
    throw new BiomeRoomGenerationContractError(
      `${semanticAddressKey(source)} has no source generation history`,
    );
  }
  return evaluateTakeoverAgainstSource(
    catalog,
    source,
    owner,
    ownerDeclaration,
    ownerHistory,
    gameName,
    enteredBiomeCount,
    ordinaryBatchIndexBeforeSource(catalog, snapshot, source),
  );
}

export interface BiomeRoomGenerationAssembly {
  readonly validation: GeneratedRoomGenerationValidation;
  readonly candidateArtifacts: RoomTargetCandidateArtifacts;
}

export function evaluateBiomeRoomGenerationAssembly(
  catalog: Catalog,
  snapshot: BiomeGenerationSnapshot,
  history: BiomeGenerationHistory,
  enteredBiomeCount: number,
  rewardHistoryCheckpoints?: readonly TargetRewardHistoryCheckpoint[],
): BiomeRoomGenerationAssembly {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new BiomeRoomGenerationContractError(
      'biome generation inputs do not share one biome owner',
    );
  }
  const rooms = generationRooms(snapshot);
  const views = targetGenerationViews(history);
  const rewardHistories = targetRewardHistories(rewardHistoryCheckpoints);
  const candidateContexts = new Map<string, RoomTargetCandidateContext>();
  const pressure: ForcePressureLedgerEntry[] = [];
  const encounterCounts: EncounterCountSupportEntry[] = [];
  const fieldsCageOutcomes: FieldsCageOutcomeSupportEntry[] = [];
  const findings: SemanticFinding[] = [];
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (layout === undefined) {
    throw new BiomeRoomGenerationContractError(
      `catalog does not provide ${snapshot.biomeKey} progression policy`,
    );
  }
  const normalProgression = normalDecisionProgressionForLayout(layout);
  if (normalProgression === undefined) {
    throw new BiomeRoomGenerationContractError(
      `${snapshot.biomeKey} has no normal decision progression`,
    );
  }

  let ordinaryBatchIndex = 0;
  for (const batch of generationDecisions(snapshot).filter(
    (decision): decision is CanonicalBatch =>
      decision.kind === 'batch' && decision.parent.origin.kind === 'occurrence',
  )) {
    const takeover = batch.targets.some((target) => {
      const room = catalog.rooms.byKey[target.room.gameName];
      return room?.prebossBatchPolicy?.kind === 'takeOverNormalDoors';
    });
    if (takeover) {
      if (batch.selectedExitKey === null) {
        // Appearance creates the atomic takeover target set before a player
        // chooses one door. Until that selection exists it is a physical
        // frontier, not a selected room-generation assertion.
        continue;
      }
      const gameName = batch.targets[0]?.room.gameName;
      if (gameName === undefined) {
        throw new BiomeRoomGenerationContractError(
          `${semanticAddressKey(batch.origin)} takeover batch has no target`,
        );
      }
      const support = evaluateTakeoverPrebossBatchCandidate(
        catalog,
        snapshot,
        history,
        batch.origin,
        gameName,
        enteredBiomeCount,
      );
      findings.push(...support.findings);
      if (!support.selectedPossible) {
        findings.push(
          finding('targetRoomUnavailable', batch.origin, {
            gameName,
            requiredExitKeys: support.requiredExitKeys,
            requiredTargetCount: support.requiredTargetCount,
          }),
        );
      }
      continue;
    }
    const source = requireSource(rooms, batch.parent.origin);
    const sourceViews = history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
    );
    const sourceBeforeGeneration =
      sourceViews === undefined
        ? undefined
        : normalTargetCandidateHistory(layout, source, sourceViews);
    if (sourceBeforeGeneration === undefined) {
      throw new BiomeRoomGenerationContractError(
        `source ${semanticAddressKey(source.origin)} has no pre-generation view`,
      );
    }
    const sourceDeclaration = catalog.rooms.byKey[source.gameName];
    if (sourceDeclaration === undefined) {
      throw new BiomeRoomGenerationContractError(`unknown source room ${source.gameName}`);
    }
    const physicalExits = normalPhysicalExitsForSource(
      layout,
      snapshot.entryRoom.occurrenceId,
      batch.source,
      sourceDeclaration,
    );
    if (normalProgression.batchPolicy.kind === 'fields') {
      const support = evaluateFieldsCageOutcome(
        normalProgression.batchPolicy,
        batch,
        sourceBeforeGeneration,
      );
      fieldsCageOutcomes.push(support);
      if (!support.selectedPossible) {
        findings.push(
          finding(
            'fieldsCageOutcomeUnavailable',
            support.origin,
            fieldsCageOutcomeEvidence(support),
          ),
        );
      }
    }
    evaluateTargetSlots(
      catalog,
      stagedCandidatePool(catalog, layout, ordinaryBatchIndex),
      source,
      sourceBeforeGeneration,
      batch.origin,
      physicalExits,
      batch.targets,
      views,
      candidateContexts,
      pressure,
      encounterCounts,
      findings,
      enteredBiomeCount,
      rewardHistories,
    );
    ordinaryBatchIndex += 1;
  }

  const validation: GeneratedRoomGenerationValidation = Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: findings.length === 0 ? 'valid' : 'invalid',
    forcePressure: Object.freeze(pressure),
    encounterCounts: Object.freeze(encounterCounts),
    fieldsCageOutcomes: Object.freeze(fieldsCageOutcomes),
    findings: Object.freeze(findings),
  });
  return Object.freeze({
    validation,
    candidateArtifacts: createRoomTargetCandidateArtifacts(candidateContexts),
  });
}

export function evaluateBiomeRoomGeneration(
  catalog: Catalog,
  snapshot: BiomeGenerationSnapshot,
  history: BiomeGenerationHistory,
  enteredBiomeCount: number,
  rewardHistoryCheckpoints?: readonly TargetRewardHistoryCheckpoint[],
): GeneratedRoomGenerationValidation {
  return evaluateBiomeRoomGenerationAssembly(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    rewardHistoryCheckpoints,
  ).validation;
}
