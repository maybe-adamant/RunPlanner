import type {
  BiomeLayout,
  Catalog,
  ExitCompatibilityPolicy,
  RoomDeclaration,
  RoomForce,
} from '../../catalog-schema';
import {
  evaluateRequirement,
  type RequirementEvaluationContext,
} from '../../requirements/evaluator';
import type { RequirementExpression } from '../../requirements/model';
import { semanticAddressKey } from '../../authored-project/addresses';
import {
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
import { projectRecentEncounterEnvelopeSlots } from '../history';
import type { RoomHistoryOrigin } from '../lifecycle';
import type {
  CanonicalAuthoredRoom,
  CanonicalAdditionalContinuation,
  CanonicalBiome,
  CanonicalDecision,
  CanonicalPhysicalExit,
  MaterializedBiomePrefix,
} from '../materialization';
import { assessHermesShrine, priorTwoSurfaceShopPresence } from '../hermes-shrine';
import type { TargetRewardHistoryCheckpoint } from '../rewards';
import type {
  NaturalChaosCandidateCapability,
  ZagreusContractCandidateCapability,
} from '../candidate-artifacts';
import type {
  RequirementEvaluationEvidence,
  RoomGenerationExclusionEvidence,
  RoomGenerationExclusionReason,
} from './model';
import type { FindingEvidence, SemanticFinding } from '../model';
import {
  findingRegion,
  ownerRegion,
  type FindingRegionEntry,
  type HistoryFindingChronology,
} from '../finding-regions';

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
    case 'recentEnvelopeSlotCount':
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
  catalog: Catalog,
  source: CanonicalGenerationSource,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  enteredBiomeCount: number,
  rewardHistory?: RewardHistoryState,
  pendingSpellDrop = false,
  allSpellInvested = false,
): RequirementEvaluationContext {
  const roomsEntered = countByGameName(view.ledgers.roomAppearances);
  // Shrine inventory is a pre-outgoing room fact, but it deliberately never
  // enters structural Shop settlement or consumes a reward bag.
  const shopOptions = new Set<string>();
  if (source.kind === 'authored') {
    for (const offer of source.entryState?.kind === 'shop' ? source.entryState.offers : [])
      shopOptions.add(offer.offer.rewardType);
  }
  const goalsRemaining = view.ledgers.counters.clockworkGoalsRemaining;
  const nonGoalRewardsAcquired = view.ledgers.counters.clockworkNonGoalRewardsAcquired;
  const maxNonGoalRewards = view.ledgers.counters.clockworkMaxNonGoalRewards;
  const clockworkValues = [goalsRemaining, nonGoalRewardsAcquired, maxNonGoalRewards];
  const hasClockwork = clockworkValues.every((value) => value !== undefined);
  if (!hasClockwork && clockworkValues.some((value) => value !== undefined)) {
    throw new BiomeRoomGenerationContractError('history has partial Clockwork facts');
  }
  const context = Object.freeze({
    counters: Object.freeze({
      biomeDepthCache: view.ledgers.counters.biomeDepthCache,
      biomeEncounterDepth: view.ledgers.counters.biomeEncounterDepth,
      encounterDepth: view.ledgers.counters.routeEncounterDepth,
      enteredBiomes: enteredBiomeCount,
      // Generation requirements consume the same derived trait facts as the
      // reward kernel when a reward-history checkpoint is available. A
      // missing checkpoint means the empty equipped ledger, never a loot
      // source approximation.
      upgradableTraitCount:
        rewardHistory === undefined ? 0 : rewardHistory.traitFacts.upgradableTraitCount,
    }),
    records: Object.freeze({
      biomeUseRecord: rewardHistory?.biomeUseRecord ?? Object.freeze({}),
      lootTypeHistory: rewardHistory?.lootTypeHistory ?? Object.freeze({}),
      roomsEntered: Object.freeze(roomsEntered),
      useRecord: rewardHistory?.useRecord ?? Object.freeze({}),
    }),
    currentRoomShopOptionNames: shopOptions,
    currentRoomRewardType: source.incomingReward?.offer.rewardType,
    currentRoomStructuralTags: sourceDeclaration.structuralTags,
    rewardLookups: Object.freeze({}),
    runDepthCache: view.ledgers.counters.roomHistoryOrdinal + 1,
    lastEventRunDepthCaches: Object.freeze({}),
    recentEncounterEnvelopeSlots: projectRecentEncounterEnvelopeSlots(view),
    offeredExitCount: sourceDeclaration.exits.length,
    currentBatchRoomGameNames: priorPeerGameNames(view, source.origin),
    clockwork: hasClockwork
      ? {
          remainingGoals: goalsRemaining!,
          nonGoalRewardsAcquired: nonGoalRewardsAcquired!,
          maxNonGoalRewards: maxNonGoalRewards!,
        }
      : undefined,
    flags: Object.freeze({ allSpellInvested, pendingSpellDrop }),
  });
  const shrine = source.hermesShrine;
  const shrineAssessment =
    shrine === undefined
      ? undefined
      : assessHermesShrine(
          catalog,
          sourceDeclaration,
          shrine,
          context,
          priorTwoSurfaceShopPresence(view.ledgers.roomAppearances),
        );
  if (shrineAssessment?.complete === true && shrine !== undefined) {
    for (const offer of Object.values(shrine.offerBySlot)) shopOptions.add(offer!.rewardType);
  }
  return context;
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
    case 'recentEnvelopeSlotCount': {
      const recentRooms = context.recentEncounterEnvelopeSlots.slice(-requirement.roomWindow);
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        envelopeKey: requirement.envelopeKey,
        slotKey: requirement.slotKey,
        roomWindow: requirement.roomWindow,
        actual: recentRooms.reduce(
          (total, room) =>
            total +
            (room.envelopeKey === requirement.envelopeKey &&
            room.slotKeys.includes(requirement.slotKey)
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
        room.roomSetKey === layout.biomeKey &&
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

interface TargetRewardRequirementFacts {
  readonly history: RewardHistoryState;
  readonly pendingSpellDrop: boolean;
  readonly allSpellInvested: boolean;
}

function targetRewardHistories(
  checkpoints: readonly TargetRewardHistoryCheckpoint[] | undefined,
): ReadonlyMap<string, TargetRewardRequirementFacts> {
  const result = new Map<string, TargetRewardRequirementFacts>();
  for (const checkpoint of checkpoints ?? []) {
    const first = checkpoint.histories[0];
    if (first === undefined) {
      continue;
    }
    const firstPendingSpellDrop = checkpoint.pendingSpellDrops[0];
    const firstAllSpellInvested = checkpoint.allSpellInvested[0];
    if (
      firstPendingSpellDrop === undefined ||
      firstAllSpellInvested === undefined ||
      checkpoint.pendingSpellDrops.length !== checkpoint.histories.length ||
      checkpoint.allSpellInvested.length !== checkpoint.histories.length ||
      checkpoint.histories.some(
        (history) =>
          !sameRecord(history.useRecord, first.useRecord) ||
          !sameRecord(history.biomeUseRecord, first.biomeUseRecord) ||
          !sameRecord(history.lootTypeHistory, first.lootTypeHistory) ||
          history.traitFacts.upgradableTraitCount !== first.traitFacts.upgradableTraitCount,
      ) ||
      checkpoint.pendingSpellDrops.some((pending) => pending !== firstPendingSpellDrop) ||
      checkpoint.allSpellInvested.some((closed) => closed !== firstAllSpellInvested)
    ) {
      throw new BiomeRoomGenerationContractError(
        `target ${semanticAddressKey(checkpoint.origin)} has divergent reward-history eligibility facts`,
      );
    }
    result.set(
      semanticAddressKey(checkpoint.origin),
      Object.freeze({
        history: first,
        pendingSpellDrop: firstPendingSpellDrop,
        allSpellInvested: firstAllSpellInvested,
      }),
    );
  }
  return result;
}

function generationRooms(
  snapshot: BiomeGenerationSnapshot,
): ReadonlyMap<string, CanonicalGenerationSource> {
  const frontierAdditional =
    snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
      ? snapshot.frontier.additional
      : Object.freeze([]);
  const rooms = [
    snapshot.entryRoom,
    ...generationDecisions(snapshot).flatMap((decision) =>
      decision.kind === 'batch'
        ? [
            ...decision.targets.map((target) => target.room),
            ...decision.additional.map((entry) => entry.room),
          ]
        : [],
    ),
    ...frontierAdditional.map((entry) => entry.room),
  ];
  return new Map(rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

interface AdditionalContinuationEntry {
  readonly continuation: CanonicalAdditionalContinuation;
  readonly parentOrigin: RoomHistoryOrigin;
}

/**
 * Assess one reached natural-Chaos source. Authored continuation validation
 * and the candidate artifact use this same helper so the editor cannot expose
 * a source that the normal target evaluator would immediately reject.
 */
export function assessNaturalChaosPlacement(
  catalog: Catalog,
  layout: BiomeLayout,
  source: CanonicalGenerationSource,
  sourceDeclaration: RoomDeclaration,
  parentHistory: ProgressiveRoomHistoryViews | undefined,
  targetGameName: string | undefined,
  enteredBiomeCount: number,
): NaturalChaosCandidateCapability | undefined {
  if (parentHistory?.entry === undefined) return undefined;
  const declaration = sourceDeclaration.additionalExits.find(
    (
      candidate,
    ): candidate is Extract<RoomDeclaration['additionalExits'][number], { kind: 'naturalChaos' }> =>
      candidate.kind === 'naturalChaos' && candidate.key === 'naturalChaos',
  );
  const host = layout.naturalChaos;
  const failedConditions: string[] = [];
  if (declaration === undefined) failedConditions.push('sourceCapability');
  if (host === undefined || host.roomGameNames.length === 0) failedConditions.push('targetDomain');
  if (
    sourceDeclaration.secretPointAnchorCount !== undefined &&
    sourceDeclaration.secretPointAnchorCount <= 0
  )
    failedConditions.push('physicalCapability');
  if (
    declaration?.requirement !== undefined &&
    !evaluateRequirement(
      declaration.requirement,
      projectRoomGenerationRequirementContext(
        catalog,
        source,
        sourceDeclaration,
        parentHistory.entry,
        enteredBiomeCount,
      ),
    )
  ) {
    failedConditions.push('sourceRequirement');
  }
  const window = host?.offerSpacingWindow;
  if (window !== undefined) {
    const recentOrigins = new Set(
      parentHistory.entry.ledgers.roomAppearances
        .slice(0, -1)
        .slice(-window)
        .map((appearance) => semanticAddressKey(appearance.origin)),
    );
    const recentOffer = parentHistory.entry.ledgers.roomCreations.find(
      (creation) =>
        creation.source === 'additionalExit' &&
        (creation.additionalOrigin.additionalExitKey === 'naturalChaos' ||
          creation.additionalOrigin.additionalExitKey === 'sparkChaos') &&
        recentOrigins.has(semanticAddressKey(creation.parentOrigin)),
    );
    if (recentOffer !== undefined) failedConditions.push('offerSpacing');
  }
  if (targetGameName !== undefined && !host?.roomGameNames.includes(targetGameName)) {
    if (!failedConditions.includes('targetDomain')) failedConditions.push('targetDomain');
  }
  return Object.freeze({
    placementEligible: failedConditions.length === 0,
    failedConditions: Object.freeze(failedConditions),
  });
}

/** Assess the entry-consumed Contract cap at one reached Midshop source. */
export function assessZagreusContractPlacement(
  sourceDeclaration: RoomDeclaration,
  parentHistory: ProgressiveRoomHistoryViews | undefined,
): ZagreusContractCandidateCapability | undefined {
  if (parentHistory?.entry === undefined) return undefined;
  const declaration = sourceDeclaration.additionalExits.find(
    (
      candidate,
    ): candidate is Extract<
      RoomDeclaration['additionalExits'][number],
      { kind: 'zagreusContract' }
    > => candidate.kind === 'zagreusContract' && candidate.key === 'zagreusContract',
  );
  if (declaration === undefined) return undefined;
  const enteredContractCount = parentHistory.entry.ledgers.roomAppearances.filter(
    (appearance) => appearance.gameName === declaration.targetRoomGameName,
  ).length;
  return Object.freeze({
    placementEligible: enteredContractCount <= declaration.maxEnteredThisRoute,
    enteredContractCount,
    maximumEnteredThisRoute: declaration.maxEnteredThisRoute,
  });
}

function additionalContinuationEntries(
  snapshot: BiomeGenerationSnapshot,
): readonly AdditionalContinuationEntry[] {
  const entries = new Map<string, AdditionalContinuationEntry>();
  for (const decision of generationDecisions(snapshot)) {
    if (decision.kind !== 'batch' || decision.parent.origin.kind !== 'occurrence') continue;
    for (const continuation of decision.additional) {
      entries.set(
        semanticAddressKey(continuation.origin),
        Object.freeze({ continuation, parentOrigin: decision.parent.origin }),
      );
    }
  }
  if (snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision') {
    for (const continuation of snapshot.frontier.additional) {
      entries.set(
        semanticAddressKey(continuation.origin),
        Object.freeze({ continuation, parentOrigin: snapshot.frontier.parent.origin }),
      );
    }
  }
  return Object.freeze([...entries.values()]);
}

/**
 * A Zagreus door may exist unpicked indefinitely, but its Midshop creation
 * checkpoint is still where a later door learns whether an earlier entered
 * C_Boss has consumed the route allowance. Use the parent Midshop entry view:
 * it precedes this door's C room and therefore never counts the current
 * selection, while the seeded route history includes every earlier contract.
 */
function evaluateAdditionalContinuationEntries(
  catalog: Catalog,
  snapshot: BiomeGenerationSnapshot,
  history: BiomeGenerationHistory,
  rooms: ReadonlyMap<string, CanonicalGenerationSource>,
  findings: SemanticFinding[],
  findingRegions: FindingRegionEntry[],
  enteredBiomeCount = 0,
): void {
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (layout === undefined) {
    throw new BiomeRoomGenerationContractError(`catalog lost ${snapshot.biomeKey} layout`);
  }
  for (const { continuation, parentOrigin } of additionalContinuationEntries(snapshot)) {
    const source = rooms.get(semanticAddressKey(parentOrigin));
    const sourceDeclaration =
      source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
    const parentHistory = history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(parentOrigin),
    );
    if (continuation.key === 'naturalChaos' || continuation.key === 'sparkChaos') {
      if (source === undefined || parentHistory?.entry === undefined) continue;
      const forced = continuation.key === 'sparkChaos';
      const declaration = forced
        ? sourceDeclaration?.additionalExits.find(
            (
              candidate,
            ): candidate is Extract<
              (typeof sourceDeclaration.additionalExits)[number],
              { readonly kind: 'sparkChaos' }
            > => candidate.kind === 'sparkChaos' && candidate.key === 'sparkChaos',
          )
        : sourceDeclaration?.additionalExits.find(
            (
              candidate,
            ): candidate is Extract<
              (typeof sourceDeclaration.additionalExits)[number],
              { readonly kind: 'naturalChaos' }
            > => candidate.kind === 'naturalChaos' && candidate.key === 'naturalChaos',
          );
      const host = forced ? layout.sparkChaos : layout.naturalChaos;
      const failedConditions: string[] = [];
      if (declaration === undefined) failedConditions.push('sourceCapability');
      if (host === undefined || !host.roomGameNames.includes(continuation.room.gameName)) {
        failedConditions.push('targetDomain');
      }
      if (!forced && sourceDeclaration !== undefined) {
        const capability = assessNaturalChaosPlacement(
          catalog,
          layout,
          source,
          sourceDeclaration,
          parentHistory,
          continuation.room.gameName,
          enteredBiomeCount,
        );
        for (const condition of capability?.failedConditions ?? []) {
          if (!failedConditions.includes(condition)) failedConditions.push(condition);
        }
      }
      const window = forced ? undefined : layout.naturalChaos?.offerSpacingWindow;
      if (failedConditions.length > 0) {
        appendFinding(
          findings,
          findingRegions,
          finding('targetRoomUnavailable', continuation.origin, {
            kind: continuation.key,
            sourceGameName: source.gameName,
            chaosRoomGameName: continuation.room.gameName,
            offerSpacingWindow: window ?? null,
            failedConditions: Object.freeze(failedConditions),
          }),
        );
      }
      continue;
    }
    if (continuation.key !== 'zagreusContract') continue;
    const declaration = sourceDeclaration?.additionalExits.find(
      (
        candidate,
      ): candidate is Extract<
        (typeof sourceDeclaration.additionalExits)[number],
        { readonly kind: 'zagreusContract' }
      > => candidate.kind === 'zagreusContract' && candidate.key === continuation.key,
    );
    if (
      source === undefined ||
      sourceDeclaration === undefined ||
      declaration === undefined ||
      declaration.targetRoomGameName !== continuation.room.gameName
    ) {
      throw new BiomeRoomGenerationContractError(
        `${semanticAddressKey(continuation.origin)} lost its declared Midshop contract source`,
      );
    }
    // An authored later Midshop may be retained beyond an incomplete or
    // invalid prefix. Its declaration remains structurally valid, but its
    // entry-time cap checkpoint is not yet assessable.
    if (parentHistory?.entry === undefined) continue;
    const contractCapability = assessZagreusContractPlacement(sourceDeclaration, parentHistory);
    const priorEnteredContractCount = contractCapability?.enteredContractCount ?? 0;
    if (contractCapability?.placementEligible === false) {
      appendFinding(
        findings,
        findingRegions,
        finding('targetRoomUnavailable', continuation.origin, {
          kind: 'zagreusContract',
          sourceGameName: source.gameName,
          contractRoomGameName: continuation.room.gameName,
          priorEnteredContractCount,
          maximumEnteredThisRoute: declaration.maxEnteredThisRoute,
          failedConditions: Object.freeze(['enteredContractCap']),
        }),
      );
    }
  }
}

function finding(
  code: 'fieldsCageOutcomeUnavailable' | 'targetRoomSupportEmpty' | 'targetRoomUnavailable',
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

function appendFinding(
  findings: SemanticFinding[],
  findingRegions: FindingRegionEntry[],
  value: SemanticFinding,
  atomicRegion = ownerRegion(value.origin),
): void {
  findings.push(value);
  findingRegions.push(findingRegion(value, atomicRegion, undefined, 'generation'));
}

function generationFindingChronology(
  history: BiomeGenerationHistory,
  origin: SemanticFinding['origin'],
): HistoryFindingChronology | undefined {
  const target = history.rooms
    .flatMap((room) => room.targetGenerations)
    .find((candidate) => semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(origin));
  if (target !== undefined) {
    return Object.freeze({
      kind: 'history',
      sequence: target.roomCreationSequence,
      boundary: 'before',
    });
  }
  const additional = history.events.find(
    (event) =>
      event.kind === 'roomCreated' &&
      event.source === 'additionalExit' &&
      semanticAddressKey(event.additionalOrigin) === semanticAddressKey(origin),
  );
  if (additional !== undefined) {
    return Object.freeze({ kind: 'history', sequence: additional.sequence, boundary: 'before' });
  }
  const fields = history.events.find(
    (event) =>
      event.kind === 'fieldsBatchOutcomeRecorded' &&
      semanticAddressKey(event.origin) === semanticAddressKey(origin),
  );
  return fields === undefined
    ? undefined
    : Object.freeze({ kind: 'history', sequence: fields.sequence, boundary: 'at' });
}

export {
  appendFinding,
  assertGenerationRequirement,
  evaluateAdditionalContinuationEntries,
  evaluateCandidate,
  finding,
  firstTargetCandidateDomain,
  generationDecisions,
  generationFindingChronology,
  generationRooms,
  normalCandidatePool,
  projectRoomGenerationRequirementContext,
  requirementEvidence,
  roomGenerationCounts,
  sourceGenerationSupport,
  stagedCandidatePool,
  targetGenerationViews,
  targetRewardHistories,
};
export type {
  CandidateEvaluation,
  CanonicalGenerationSource,
  FirstTargetGenerationSupport,
  ForceSupport,
  RoomGenerationCounts,
  SourceGenerationSupport,
  TakeoverShapeEvaluation,
  TargetRewardRequirementFacts,
};

function takeoverCandidatePool(catalog: Catalog, biomeKey: string): readonly RoomDeclaration[] {
  return Object.freeze(
    catalog.rooms.values.filter(
      (room) =>
        room.roomSetKey === biomeKey && room.prebossBatchPolicy?.kind === 'takeOverNormalDoors',
    ),
  );
}
