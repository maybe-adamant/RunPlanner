import type {
  Catalog,
  ExitCompatibilityPolicy,
  GeneratedBatchPolicy,
  LinearBiomeLayout,
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
  type ContinuationAddress,
} from '../../authored-project/addresses';
import type { RewardHistoryState } from '../../reward-kernel';
import type {
  LinearSimulationHistory,
  LinearHistoryStateView,
  LinearTargetGenerationView,
} from '../history';
import { projectRecentEncounterPhases } from '../history';
import type { RoomHistoryOrigin } from '../lifecycle';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalFixedEntryRoom,
  LinearSimulationMaterialization,
  CanonicalPhysicalExit,
  CanonicalTarget,
} from '../materialization';
import type { LinearTargetRewardHistoryCheckpoint } from '../rewards';
import type {
  EncounterCountSupportEntry,
  FieldsCageOutcome,
  FieldsCageOutcomeCandidateSupport,
  FieldsCageOutcomeSupportEntry,
  LinearForcePressureLedgerEntry,
  LinearRoomGenerationValidation,
  LinearRoomTargetCandidateContext,
  LinearRoomTargetCandidateValidation,
  RequirementEvaluationEvidence,
  RoomGenerationExclusionEvidence,
  RoomGenerationExclusionReason,
} from './model';
import type { FindingEvidence, SemanticFinding } from '../model';

export class LinearRoomGenerationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'LinearRoomGenerationContractError';
  }
}

type ForceSupport = 'none' | 'optional' | 'required';

const candidateContextsByValidation = new WeakMap<
  LinearRoomGenerationValidation,
  ReadonlyMap<string, LinearRoomTargetCandidateContext>
>();

interface CandidateEvaluation {
  readonly room: RoomDeclaration;
  readonly reasons: readonly RoomGenerationExclusionReason[];
  readonly exclusions: readonly RoomGenerationExclusionEvidence[];
  readonly forceSupport: ForceSupport;
}

interface RoomGenerationCounts {
  readonly appearancesByGameName: Readonly<Record<string, number>>;
  readonly creationsByGameName: Readonly<Record<string, number>>;
  readonly parentCreationsByGameName: Readonly<Record<string, number>>;
}

type CanonicalGenerationSource = CanonicalAuthoredRoom | CanonicalFixedEntryRoom;

function countByGameName(
  entries: readonly { readonly gameName: string }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.gameName] = (counts[entry.gameName] ?? 0) + 1;
  }
  return counts;
}

function assertLinearGenerationRequirement(requirement: RequirementExpression): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach(assertLinearGenerationRequirement);
      return;
    case 'not':
      assertLinearGenerationRequirement(requirement.requirement);
      return;
    case 'counterRange':
      if (requirement.axis !== 'biomeDepthCache' && requirement.axis !== 'biomeEncounterDepth') {
        throw new LinearRoomGenerationContractError(
          `linear room generation cannot project counter ${requirement.axis}`,
        );
      }
      return;
    case 'recordCount':
      if (requirement.record !== 'roomsEntered') {
        throw new LinearRoomGenerationContractError(
          `linear room generation cannot project record ${requirement.record}`,
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
      throw new LinearRoomGenerationContractError(
        `linear room generation cannot evaluate ${requirement.kind}`,
      );
  }
}

function assertLinearGenerationForce(force: RoomForce): void {
  switch (force.kind) {
    case 'always':
      return;
    case 'requirement':
      assertLinearGenerationRequirement(force.requirement);
      return;
    case 'depthWindow':
      if (force.axis !== 'biomeDepthCache' && force.axis !== 'biomeEncounterDepth') {
        throw new LinearRoomGenerationContractError(
          `linear room generation cannot project force counter ${force.axis}`,
        );
      }
  }
}

function priorPeerGameNames(
  view: LinearHistoryStateView,
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

function projectLinearRoomGenerationRequirementContext(
  source: CanonicalGenerationSource,
  sourceDeclaration: RoomDeclaration,
  view: LinearHistoryStateView,
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
    throw new LinearRoomGenerationContractError('linear history has partial Clockwork facts');
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
      assertLinearGenerationRequirement(force.requirement);
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
        throw new LinearRoomGenerationContractError(
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
        throw new LinearRoomGenerationContractError(
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
      throw new LinearRoomGenerationContractError(
        `linear room generation cannot explain ${requirement.kind}`,
      );
  }
}

function roomGenerationCounts(
  view: LinearHistoryStateView,
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
    assertLinearGenerationForce(room.force);
  }
  if (exit.kind === 'unavailable') {
    reasons.push('physicalExitUnavailable');
    exclusions.push({ kind: 'physicalExitUnavailable', exitIndex: exit.index });
  } else {
    const policy = catalog.exitCompatibilityPolicies.byKey[exit.compatibilityPolicyKey];
    if (policy === undefined) {
      throw new LinearRoomGenerationContractError(
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
    assertLinearGenerationRequirement(room.eligibility);
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

function linearCandidatePool(catalog: Catalog, biomeKey: string): readonly RoomDeclaration[] {
  const layout = catalog.biomeLayouts.byKey[biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    throw new LinearRoomGenerationContractError(
      `catalog does not provide ${biomeKey} candidate structure`,
    );
  }
  const startNames = new Set(
    layout.start.kind === 'authoredStart'
      ? layout.start.roomGameNames
      : [layout.start.roomGameName],
  );
  return Object.freeze(
    catalog.rooms.values.filter(
      (room) =>
        room.biomeKey === biomeKey &&
        room.mode.kind === 'authored' &&
        !startNames.has(room.gameName),
    ),
  );
}

function stagedCandidatePool(
  catalog: Catalog,
  layout: Extract<LinearBiomeLayout, { readonly kind: 'LinearBiome' }>,
  batchIndex: number,
): readonly RoomDeclaration[] {
  const policy = layout.continuation.progressionPolicy;
  if (policy.kind !== 'staged') {
    return linearCandidatePool(catalog, layout.biomeKey);
  }
  const stage = policy.stages[batchIndex];
  if (stage === undefined) {
    throw new LinearRoomGenerationContractError(
      `${layout.biomeKey} has no candidate stage ${batchIndex + 1}`,
    );
  }
  return Object.freeze(
    stage.roomGameNames.map((gameName) => {
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new LinearRoomGenerationContractError(
          `${layout.biomeKey} stage ${stage.key} lost room ${gameName}`,
        );
      }
      return room;
    }),
  );
}

function terminalCandidatePool(
  catalog: Catalog,
  layout: LinearBiomeLayout,
): readonly RoomDeclaration[] {
  if (layout.continuation.progressionPolicy.kind !== 'staged') {
    return linearCandidatePool(catalog, layout.biomeKey);
  }
  const room = catalog.rooms.byKey[layout.terminal.roomGameName];
  if (room === undefined) {
    throw new LinearRoomGenerationContractError(
      `${layout.biomeKey} lost terminal room ${layout.terminal.roomGameName}`,
    );
  }
  return Object.freeze([room]);
}

function targetGenerationViews(
  history: LinearSimulationHistory,
): ReadonlyMap<string, LinearTargetGenerationView> {
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
  checkpoints: readonly LinearTargetRewardHistoryCheckpoint[] | undefined,
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
      throw new LinearRoomGenerationContractError(
        `target ${semanticAddressKey(checkpoint.origin)} has divergent reward-history eligibility facts`,
      );
    }
    result.set(semanticAddressKey(checkpoint.origin), first);
  }
  return result;
}

function generationRooms(
  snapshot: LinearSimulationMaterialization,
): ReadonlyMap<string, CanonicalGenerationSource> {
  const frontierTargets =
    snapshot.kind === 'LinearBiome'
      ? snapshot.terminalEntry.targets
      : (snapshot.frontierGeneration?.targets ?? []);
  const rooms = [
    ...snapshot.entryRooms,
    ...snapshot.batches.flatMap((batch) => batch.targets.map((target) => target.room)),
    ...frontierTargets.map((target) => target.room),
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
  view: LinearHistoryStateView,
  enteredBiomeCount: number,
  rewardHistory: RewardHistoryState | undefined,
): EncounterCountSupportEntry | undefined {
  const declaration = catalog.rooms.byKey[room.gameName];
  const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
  if (declaration === undefined || profile === undefined) {
    throw new LinearRoomGenerationContractError(`${room.gameName} lost its encounter declaration`);
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
    throw new LinearRoomGenerationContractError(
      `${room.gameName} has unsupported optional encounter-phase structure`,
    );
  }
  assertLinearGenerationRequirement(optional.requirement);
  const context = projectLinearRoomGenerationRequirementContext(
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
  batchPolicy: Extract<GeneratedBatchPolicy, { readonly kind: 'fields' }>,
  biomeDepthCache: number,
  fieldsMaxDoorsRolled: number,
): readonly FieldsCageOutcome[] {
  if (
    !Number.isInteger(biomeDepthCache) ||
    biomeDepthCache < 1 ||
    !Number.isInteger(fieldsMaxDoorsRolled) ||
    fieldsMaxDoorsRolled < 0
  ) {
    throw new LinearRoomGenerationContractError('Fields outcome support has invalid counters');
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
  batchPolicy: Extract<GeneratedBatchPolicy, { readonly kind: 'fields' }>,
  origin: ContinuationAddress,
  view: LinearHistoryStateView,
): FieldsCageOutcomeCandidateSupport {
  const fieldsMaxDoorsRolled = view.ledgers.counters.fieldsMaxDoorsRolled;
  if (fieldsMaxDoorsRolled === undefined) {
    throw new LinearRoomGenerationContractError('Fields history lost its Max outcome counter');
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
  batchPolicy: Extract<GeneratedBatchPolicy, { readonly kind: 'fields' }>,
  batch: Pick<CanonicalBatch, 'batchState' | 'origin'>,
  view: LinearHistoryStateView,
): FieldsCageOutcomeSupportEntry {
  if (batch.batchState.kind !== 'fields') {
    throw new LinearRoomGenerationContractError('Fields layout lost its canonical batch state');
  }
  const support = fieldsCageOutcomeCandidateSupport(batchPolicy, batch.origin, view);
  return Object.freeze({
    ...support,
    selectedOutcome: batch.batchState.cageOutcome,
    selectedPossible: support.supportOutcomes.includes(batch.batchState.cageOutcome),
  });
}

function selectedEvidence(entry: LinearForcePressureLedgerEntry): FindingEvidence {
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
  view: LinearTargetGenerationView,
): void {
  const targetKey = semanticAddressKey(target.origin);
  const sourceKey = semanticAddressKey(source.origin);
  if (
    semanticAddressKey(view.targetOrigin) !== targetKey ||
    semanticAddressKey(view.roomOrigin) !== semanticAddressKey(target.room.origin)
  ) {
    throw new LinearRoomGenerationContractError(
      `target ${targetKey} does not match its history generation view`,
    );
  }

  const sourceAppearance = view.before.ledgers.roomAppearances.find(
    (appearance) => semanticAddressKey(appearance.origin) === sourceKey,
  );
  if (sourceAppearance?.gameName !== source.gameName) {
    throw new LinearRoomGenerationContractError(
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
    throw new LinearRoomGenerationContractError(
      `target ${targetKey} does not match its history creation`,
    );
  }
}

function prepareTargetGameNameContext(
  catalog: Catalog,
  pool: readonly RoomDeclaration[],
  source: CanonicalGenerationSource,
  targetOrigin: CanonicalTarget['origin'],
  exit: CanonicalPhysicalExit,
  before: LinearHistoryStateView,
  enteredBiomeCount: number,
  rewardHistory: RewardHistoryState | undefined,
): LinearRoomTargetCandidateContext {
  const sourceDeclaration = catalog.rooms.byKey[source.gameName];
  if (sourceDeclaration === undefined) {
    throw new LinearRoomGenerationContractError(`unknown source room ${source.gameName}`);
  }
  const context = projectLinearRoomGenerationRequirementContext(
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
  const eligible = candidates.filter((candidate) => candidate.reasons.length === 0);
  const optional = eligible.filter((candidate) => candidate.forceSupport === 'optional');
  const required = eligible.filter((candidate) => candidate.forceSupport === 'required');
  const support =
    required.length === 0
      ? eligible
      : eligible.filter((candidate) => candidate.forceSupport !== 'none');
  const candidatesByGameName = new Map(
    candidates.map((candidate) => [candidate.room.gameName, candidate]),
  );
  const supportGameNames = new Set(support.map((candidate) => candidate.room.gameName));
  const requiredRoomGameNames = Object.freeze(required.map((candidate) => candidate.room.gameName));
  const sharedPressure = Object.freeze({
    targetOrigin,
    beforeSequence: before.sequence,
    sourceGameName: source.gameName,
    exitIndex: targetOrigin.exitIndex,
    biomeDepthCache: context.counters.biomeDepthCache,
    biomeEncounterDepth: context.counters.biomeEncounterDepth,
    eligibleRoomGameNames: Object.freeze(eligible.map((candidate) => candidate.room.gameName)),
    optionalForcedRoomGameNames: Object.freeze(
      optional.map((candidate) => candidate.room.gameName),
    ),
    requiredForcedRoomGameNames: requiredRoomGameNames,
    supportRoomGameNames: Object.freeze(support.map((candidate) => candidate.room.gameName)),
  });
  return Object.freeze({
    targetOrigin,
    evaluateGameName: (selectedGameName: string): LinearRoomTargetCandidateValidation => {
      const selected = candidatesByGameName.get(selectedGameName);
      const reasons = [
        ...(selected?.reasons ?? ['notCandidate']),
      ] as RoomGenerationExclusionReason[];
      const exclusions: RoomGenerationExclusionEvidence[] = [
        ...(selected?.exclusions ?? [{ kind: 'notCandidate' as const }]),
      ];
      if (
        selected !== undefined &&
        selected.reasons.length === 0 &&
        !supportGameNames.has(selectedGameName)
      ) {
        reasons.push('forcedPool');
        exclusions.push({
          kind: 'forcedPool',
          requiredRoomGameNames,
        });
      }
      const selectedPossible = selected !== undefined && supportGameNames.has(selectedGameName);
      const pressure: LinearForcePressureLedgerEntry = Object.freeze({
        ...sharedPressure,
        selectedGameName,
        selectedCreationCount: counts.creationsByGameName[selectedGameName] ?? 0,
        selectedAppearanceCount: counts.appearancesByGameName[selectedGameName] ?? 0,
        selectedParentCreationCount: counts.parentCreationsByGameName[selectedGameName] ?? 0,
        selectedPossible,
        selectedExclusionReasons: Object.freeze(reasons),
        selectedExclusions: Object.freeze(exclusions),
      });
      const findings: SemanticFinding[] = [];
      if (support.length === 0) {
        findings.push(finding('targetRoomSupportEmpty', targetOrigin, selectedEvidence(pressure)));
      }
      if (!selectedPossible) {
        findings.push(finding('targetRoomUnavailable', targetOrigin, selectedEvidence(pressure)));
      }
      return Object.freeze({ pressure, findings: Object.freeze(findings) });
    },
  });
}

function requireSource(
  rooms: ReadonlyMap<string, CanonicalGenerationSource>,
  origin: RoomHistoryOrigin,
): CanonicalGenerationSource {
  const room = rooms.get(semanticAddressKey(origin));
  if (room === undefined || !room.entered) {
    throw new LinearRoomGenerationContractError(
      `history source ${semanticAddressKey(origin)} is not an entered canonical room`,
    );
  }
  return room;
}

function evaluateTargetSlots(
  catalog: Catalog,
  pool: readonly RoomDeclaration[],
  source: CanonicalGenerationSource,
  sourceBeforeGeneration: LinearHistoryStateView,
  generationOrigin: ContinuationAddress,
  targets: readonly CanonicalTarget[],
  views: ReadonlyMap<string, LinearTargetGenerationView>,
  candidateContexts: Map<string, LinearRoomTargetCandidateContext>,
  pressure: LinearForcePressureLedgerEntry[],
  encounterCounts: EncounterCountSupportEntry[],
  findings: SemanticFinding[],
  enteredBiomeCount: number,
  rewardHistories: ReadonlyMap<string, RewardHistoryState>,
): void {
  const sourceDeclaration = catalog.rooms.byKey[source.gameName];
  if (sourceDeclaration === undefined) {
    throw new LinearRoomGenerationContractError(`unknown source room ${source.gameName}`);
  }
  const biome = createBiomeAddress(generationOrigin.routeKey, generationOrigin.biomeKey);
  const exits = [...sourceDeclaration.exits].sort((left, right) => left.index - right.index);
  const evaluateConcreteTarget = (target: CanonicalTarget): LinearHistoryStateView => {
    const targetKey = semanticAddressKey(target.origin);
    const rewardHistory = rewardHistories.get(targetKey);
    const view = views.get(targetKey);
    if (view === undefined) {
      throw new LinearRoomGenerationContractError(
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
      view.before,
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
  for (const exit of exits) {
    const target = targets.find((candidate) => candidate.exit.index === exit.index);
    const targetOrigin =
      target?.origin ?? createTargetAddress(biome, generationOrigin.parentOccurrenceId, exit.index);
    const rewardHistory = rewardHistories.get(semanticAddressKey(targetOrigin));
    if (target === undefined) {
      candidateContexts.set(
        semanticAddressKey(targetOrigin),
        prepareTargetGameNameContext(
          catalog,
          pool,
          source,
          targetOrigin,
          Object.freeze({
            kind: 'available' as const,
            index: exit.index,
            type: exit.type,
            compatibilityPolicyKey: exit.compatibilityPolicyKey,
          }),
          before,
          enteredBiomeCount,
          rewardHistory,
        ),
      );
      return;
    }
    before = evaluateConcreteTarget(target);
  }
  const availableExitIndexes = new Set(exits.map((exit) => exit.index));
  for (const target of targets) {
    if (!availableExitIndexes.has(target.exit.index)) {
      evaluateConcreteTarget(target);
    }
  }
}

export function evaluateLinearRoomGeneration(
  catalog: Catalog,
  snapshot: LinearSimulationMaterialization,
  history: LinearSimulationHistory,
  enteredBiomeCount: number,
  rewardHistoryCheckpoints?: readonly LinearTargetRewardHistoryCheckpoint[],
): LinearRoomGenerationValidation {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new LinearRoomGenerationContractError(
      'linear generation inputs do not share one biome owner',
    );
  }
  const rooms = generationRooms(snapshot);
  const views = targetGenerationViews(history);
  const rewardHistories = targetRewardHistories(rewardHistoryCheckpoints);
  const candidateContexts = new Map<string, LinearRoomTargetCandidateContext>();
  const pressure: LinearForcePressureLedgerEntry[] = [];
  const encounterCounts: EncounterCountSupportEntry[] = [];
  const fieldsCageOutcomes: FieldsCageOutcomeSupportEntry[] = [];
  const findings: SemanticFinding[] = [];
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    throw new LinearRoomGenerationContractError(
      `catalog does not provide ${snapshot.biomeKey} linear generation policy`,
    );
  }

  for (const [batchIndex, batch] of snapshot.batches.entries()) {
    const source = requireSource(rooms, batch.parent.origin);
    const sourceBeforeGeneration = history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
    )?.preOutgoing;
    if (sourceBeforeGeneration === undefined) {
      throw new LinearRoomGenerationContractError(
        `source ${semanticAddressKey(source.origin)} has no pre-generation view`,
      );
    }
    if (layout.continuation.batchPolicy.kind === 'fields') {
      const support = evaluateFieldsCageOutcome(
        layout.continuation.batchPolicy,
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
      stagedCandidatePool(catalog, layout, batchIndex),
      source,
      sourceBeforeGeneration,
      batch.origin,
      batch.targets,
      views,
      candidateContexts,
      pressure,
      encounterCounts,
      findings,
      enteredBiomeCount,
      rewardHistories,
    );
  }
  const finalGeneration =
    snapshot.kind === 'LinearBiome' ? snapshot.terminalEntry : snapshot.frontierGeneration;
  if (finalGeneration !== undefined) {
    const finalPool =
      snapshot.kind === 'LinearBiome'
        ? terminalCandidatePool(catalog, layout)
        : snapshot.frontierGeneration!.kind === 'terminal'
          ? terminalCandidatePool(catalog, layout)
          : stagedCandidatePool(catalog, layout, snapshot.batches.length);
    const sourceOrigin =
      snapshot.kind === 'LinearBiome'
        ? snapshot.terminalEntry.predecessor.origin
        : snapshot.frontierGeneration!.parent.origin;
    const source = requireSource(rooms, sourceOrigin);
    const sourceBeforeGeneration = history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(sourceOrigin),
    )?.preOutgoing;
    if (sourceBeforeGeneration === undefined) {
      throw new LinearRoomGenerationContractError(
        `source ${semanticAddressKey(sourceOrigin)} has no pre-generation view`,
      );
    }
    if (
      layout.continuation.batchPolicy.kind === 'fields' &&
      snapshot.kind === 'LinearBiomePrefix' &&
      snapshot.frontierGeneration?.batchState?.kind === 'fields'
    ) {
      const support = evaluateFieldsCageOutcome(
        layout.continuation.batchPolicy,
        {
          origin: snapshot.frontierGeneration.origin,
          batchState: snapshot.frontierGeneration.batchState,
        },
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
      finalPool,
      source,
      sourceBeforeGeneration,
      finalGeneration.origin,
      finalGeneration.targets,
      views,
      candidateContexts,
      pressure,
      encounterCounts,
      findings,
      enteredBiomeCount,
      rewardHistories,
    );
  }

  const validation: LinearRoomGenerationValidation = Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: findings.length === 0 ? 'valid' : 'invalid',
    forcePressure: Object.freeze(pressure),
    encounterCounts: Object.freeze(encounterCounts),
    fieldsCageOutcomes: Object.freeze(fieldsCageOutcomes),
    findings: Object.freeze(findings),
  });
  candidateContextsByValidation.set(validation, new Map(candidateContexts));
  return validation;
}

export function linearRoomTargetCandidateContexts(
  validation: LinearRoomGenerationValidation,
): ReadonlyMap<string, LinearRoomTargetCandidateContext> {
  const contexts = candidateContextsByValidation.get(validation);
  if (contexts === undefined) {
    throw new LinearRoomGenerationContractError(
      `room generation for ${validation.biomeKey} has no prepared candidate contexts`,
    );
  }
  return contexts;
}
