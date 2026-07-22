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
import { semanticAddressKey } from '../../authored-project/addresses';
import type { RewardHistoryState } from '../../reward-kernel';
import type {
  CanonicalLinearHistory,
  LinearRoomHistoryViews,
  LinearHistoryStateView,
  LinearTargetGenerationView,
} from '../history';
import { projectRecentEncounterPhases } from '../history';
import type { RoomHistoryOrigin } from '../lifecycle';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalFixedEntryRoom,
  CanonicalLinearBiome,
  CanonicalPhysicalExit,
  CanonicalTarget,
} from '../materialization';
import type { LinearTargetRewardHistoryCheckpoint } from '../rewards';
import type {
  EncounterCountSupportEntry,
  FieldsCageOutcome,
  FieldsCageOutcomeSupportEntry,
  LinearForcePressureLedgerEntry,
  LinearRoomGenerationValidation,
  LinearRoomTargetCandidateValidation,
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

interface CandidateEvaluation {
  readonly room: RoomDeclaration;
  readonly reasons: readonly RoomGenerationExclusionReason[];
  readonly forceSupport: ForceSupport;
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

function creationCount(
  view: LinearHistoryStateView,
  gameName: string,
  parentOrigin?: RoomHistoryOrigin,
): number {
  return view.ledgers.roomCreations.filter(
    (creation) =>
      creation.gameName === gameName &&
      (parentOrigin === undefined ||
        (creation.source === 'generatedTarget' &&
          semanticAddressKey(creation.parentOrigin) === semanticAddressKey(parentOrigin))),
  ).length;
}

function appearanceCount(view: LinearHistoryStateView, gameName: string): number {
  return view.ledgers.roomAppearances.filter((appearance) => appearance.gameName === gameName)
    .length;
}

function evaluateCandidate(
  catalog: Catalog,
  source: CanonicalGenerationSource,
  sourceDeclaration: RoomDeclaration,
  exit: CanonicalPhysicalExit,
  view: LinearHistoryStateView,
  room: RoomDeclaration,
  context: RequirementEvaluationContext,
): CandidateEvaluation {
  const reasons: RoomGenerationExclusionReason[] = [];
  if (room.force !== undefined) {
    assertLinearGenerationForce(room.force);
  }
  if (exit.kind === 'unavailable') {
    reasons.push('physicalExitUnavailable');
  } else {
    const policy = catalog.exitCompatibilityPolicies.byKey[exit.compatibilityPolicyKey];
    if (policy === undefined) {
      throw new LinearRoomGenerationContractError(
        `unknown exit compatibility policy ${exit.compatibilityPolicyKey}`,
      );
    }
    if (!compatible(policy, sourceDeclaration, room)) {
      reasons.push('exitIncompatible');
    }
  }
  if (room.gameName === source.gameName) {
    reasons.push('currentRoomRepeat');
  }
  if (room.force?.kind === 'depthWindow' && context.counters[room.force.axis] < room.force.start) {
    reasons.push('forceMinimum');
  }
  if (room.eligibility !== undefined) {
    assertLinearGenerationRequirement(room.eligibility);
    if (!evaluateRequirement(room.eligibility, context)) {
      reasons.push('eligibilityRequirement');
    }
  }
  if (
    room.caps.maxCreationsThisRun !== undefined &&
    creationCount(view, room.gameName) >= room.caps.maxCreationsThisRun
  ) {
    reasons.push('maxCreationsThisRun');
  }
  if (
    room.caps.maxCreationsPerRoom !== undefined &&
    creationCount(view, room.gameName, source.origin) >= room.caps.maxCreationsPerRoom
  ) {
    reasons.push('maxCreationsPerRoom');
  }
  if (
    room.caps.maxAppearancesThisBiome !== undefined &&
    appearanceCount(view, room.gameName) >= room.caps.maxAppearancesThisBiome
  ) {
    reasons.push('maxAppearancesThisBiome');
  }
  return Object.freeze({
    room,
    reasons: Object.freeze(reasons),
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
  history: CanonicalLinearHistory,
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
  snapshot: CanonicalLinearBiome,
): ReadonlyMap<string, CanonicalGenerationSource> {
  const rooms = [
    ...snapshot.entryRooms,
    ...snapshot.batches.flatMap((batch) => batch.targets.map((target) => target.room)),
    ...snapshot.terminalEntry.targets.map((target) => target.room),
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
  view: LinearRoomHistoryViews,
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
    view.preparation,
    enteredBiomeCount,
    rewardHistory,
  );
  const supportEncounterCounts = evaluateRequirement(optional.requirement, context)
    ? Object.freeze([optionalIndex, optionalIndex + 1])
    : Object.freeze([optionalIndex]);
  const selectedEncounterCount = room.encounterPhases.length;
  return Object.freeze({
    origin: room.origin,
    beforeSequence: view.preparation.sequence,
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

function evaluateFieldsCageOutcome(
  batchPolicy: Extract<GeneratedBatchPolicy, { readonly kind: 'fields' }>,
  batch: CanonicalBatch,
  view: LinearHistoryStateView,
): FieldsCageOutcomeSupportEntry {
  if (batch.batchState.kind !== 'fields') {
    throw new LinearRoomGenerationContractError('Fields layout lost its canonical batch state');
  }
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
    origin: batch.origin,
    beforeSequence: view.sequence,
    biomeDepthCache: view.ledgers.counters.biomeDepthCache,
    fieldsMaxDoorsRolled,
    maxDoorCageCeiling: batchPolicy.maxDoorCageCeiling,
    selectedOutcome: batch.batchState.cageOutcome,
    supportOutcomes,
    selectedPossible: supportOutcomes.includes(batch.batchState.cageOutcome),
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

function evaluateTargetGameName(
  catalog: Catalog,
  pool: readonly RoomDeclaration[],
  source: CanonicalGenerationSource,
  targetOrigin: CanonicalTarget['origin'],
  exit: CanonicalPhysicalExit,
  view: LinearTargetGenerationView,
  selectedGameName: string,
  enteredBiomeCount: number,
  rewardHistory: RewardHistoryState | undefined,
  includeSourceDepth: boolean,
): LinearRoomTargetCandidateValidation {
  const sourceDeclaration = catalog.rooms.byKey[source.gameName];
  if (sourceDeclaration === undefined) {
    throw new LinearRoomGenerationContractError(`unknown source room ${source.gameName}`);
  }
  const baseContext = projectLinearRoomGenerationRequirementContext(
    source,
    sourceDeclaration,
    view.before,
    enteredBiomeCount,
    rewardHistory,
  );
  const context = includeSourceDepth
    ? Object.freeze({
        ...baseContext,
        counters: Object.freeze({
          ...baseContext.counters,
          biomeDepthCache:
            baseContext.counters.biomeDepthCache + sourceDeclaration.counters.biomeDepthCache,
        }),
      })
    : baseContext;
  const candidates = pool.map((room) =>
    evaluateCandidate(catalog, source, sourceDeclaration, exit, view.before, room, context),
  );
  const eligible = candidates.filter((candidate) => candidate.reasons.length === 0);
  const optional = eligible.filter((candidate) => candidate.forceSupport === 'optional');
  const required = eligible.filter((candidate) => candidate.forceSupport === 'required');
  const support =
    required.length === 0
      ? eligible
      : eligible.filter((candidate) => candidate.forceSupport !== 'none');
  const selected = candidates.find((candidate) => candidate.room.gameName === selectedGameName);
  const reasons = [...(selected?.reasons ?? ['notCandidate'])] as RoomGenerationExclusionReason[];
  if (selected !== undefined && selected.reasons.length === 0 && !support.includes(selected)) {
    reasons.push('forcedPool');
  }
  const selectedPossible = selected !== undefined && support.includes(selected);
  const pressure: LinearForcePressureLedgerEntry = Object.freeze({
    targetOrigin,
    beforeSequence: view.before.sequence,
    sourceGameName: source.gameName,
    selectedGameName,
    exitIndex: targetOrigin.exitIndex,
    biomeDepthCache: context.counters.biomeDepthCache,
    biomeEncounterDepth: context.counters.biomeEncounterDepth,
    selectedCreationCount: creationCount(view.before, selectedGameName),
    selectedAppearanceCount: appearanceCount(view.before, selectedGameName),
    selectedParentCreationCount: creationCount(view.before, selectedGameName, source.origin),
    eligibleRoomGameNames: Object.freeze(eligible.map((candidate) => candidate.room.gameName)),
    optionalForcedRoomGameNames: Object.freeze(
      optional.map((candidate) => candidate.room.gameName),
    ),
    requiredForcedRoomGameNames: Object.freeze(
      required.map((candidate) => candidate.room.gameName),
    ),
    supportRoomGameNames: Object.freeze(support.map((candidate) => candidate.room.gameName)),
    selectedPossible,
    selectedExclusionReasons: Object.freeze(reasons),
  });
  const findings: SemanticFinding[] = [];
  if (support.length === 0) {
    findings.push(finding('targetRoomSupportEmpty', targetOrigin, selectedEvidence(pressure)));
  }
  if (!selectedPossible) {
    findings.push(finding('targetRoomUnavailable', targetOrigin, selectedEvidence(pressure)));
  }
  return Object.freeze({ pressure, findings: Object.freeze(findings) });
}

function validateTarget(
  catalog: Catalog,
  pool: readonly RoomDeclaration[],
  source: CanonicalGenerationSource,
  target: CanonicalTarget,
  view: LinearTargetGenerationView,
  enteredBiomeCount: number,
  rewardHistory: RewardHistoryState | undefined,
  includeSourceDepth: boolean,
): LinearRoomTargetCandidateValidation {
  assertTargetHistoryMatches(source, target, view);
  return evaluateTargetGameName(
    catalog,
    pool,
    source,
    target.origin,
    target.exit,
    view,
    target.room.gameName,
    enteredBiomeCount,
    rewardHistory,
    includeSourceDepth,
  );
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

function evaluateTargets(
  catalog: Catalog,
  pool: readonly RoomDeclaration[],
  source: CanonicalGenerationSource,
  targets: readonly CanonicalTarget[],
  views: ReadonlyMap<string, LinearTargetGenerationView>,
  pressure: LinearForcePressureLedgerEntry[],
  encounterCounts: EncounterCountSupportEntry[],
  findings: SemanticFinding[],
  enteredBiomeCount: number,
  rewardHistories: ReadonlyMap<string, RewardHistoryState>,
  roomViews: ReadonlyMap<string, LinearRoomHistoryViews>,
  includeSourceDepth: boolean,
): void {
  for (const target of targets) {
    const view = views.get(semanticAddressKey(target.origin));
    if (view === undefined) {
      throw new LinearRoomGenerationContractError(
        `target ${semanticAddressKey(target.origin)} has no history generation view`,
      );
    }
    const result = validateTarget(
      catalog,
      pool,
      source,
      target,
      view,
      enteredBiomeCount,
      rewardHistories.get(semanticAddressKey(target.origin)),
      includeSourceDepth,
    );
    pressure.push(result.pressure);
    findings.push(...result.findings);
    if (
      target.room.kind === 'authored' &&
      catalog.encounterProfiles.byKey[target.room.encounterProfileKey]?.phases.some(
        (phase) => phase.presence !== undefined,
      )
    ) {
      const roomView = roomViews.get(semanticAddressKey(target.room.origin));
      if (roomView === undefined) {
        throw new LinearRoomGenerationContractError(
          `${target.room.gameName} has no room history view`,
        );
      }
      const encounterCount = evaluateEncounterCount(
        catalog,
        target.room,
        roomView,
        enteredBiomeCount,
        rewardHistories.get(semanticAddressKey(target.origin)),
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
  }
}

export function evaluateLinearRoomGeneration(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  history: CanonicalLinearHistory,
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
  const roomViews = new Map(history.rooms.map((view) => [semanticAddressKey(view.origin), view]));
  const rewardHistories = targetRewardHistories(rewardHistoryCheckpoints);
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
    if (layout.continuation.batchPolicy.kind === 'fields') {
      const sourceView = history.rooms.find(
        (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
      )?.preOutgoing;
      if (sourceView === undefined) {
        throw new LinearRoomGenerationContractError(
          `Fields source ${semanticAddressKey(source.origin)} has no pre-generation view`,
        );
      }
      const support = evaluateFieldsCageOutcome(layout.continuation.batchPolicy, batch, sourceView);
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
    evaluateTargets(
      catalog,
      stagedCandidatePool(catalog, layout, batchIndex),
      source,
      batch.targets,
      views,
      pressure,
      encounterCounts,
      findings,
      enteredBiomeCount,
      rewardHistories,
      roomViews,
      layout.continuation.progressionPolicy.kind === 'staged',
    );
  }
  evaluateTargets(
    catalog,
    terminalCandidatePool(catalog, layout),
    requireSource(rooms, snapshot.terminalEntry.predecessor.origin),
    snapshot.terminalEntry.targets,
    views,
    pressure,
    encounterCounts,
    findings,
    enteredBiomeCount,
    rewardHistories,
    roomViews,
    layout.continuation.progressionPolicy.kind === 'staged',
  );

  return Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: findings.length === 0 ? 'valid' : 'invalid',
    forcePressure: Object.freeze(pressure),
    encounterCounts: Object.freeze(encounterCounts),
    fieldsCageOutcomes: Object.freeze(fieldsCageOutcomes),
    findings: Object.freeze(findings),
  });
}

export function evaluateLinearRoomTargetCandidate(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  history: CanonicalLinearHistory,
  targetOrigin: CanonicalTarget['origin'],
  gameName: string,
  enteredBiomeCount: number,
  rewardHistoryCheckpoints?: readonly LinearTargetRewardHistoryCheckpoint[],
): LinearRoomTargetCandidateValidation {
  if (
    snapshot.biomeKey !== history.biomeKey ||
    snapshot.routeKey !== history.routeKey ||
    targetOrigin.routeKey !== snapshot.routeKey ||
    targetOrigin.biomeKey !== snapshot.biomeKey
  ) {
    throw new LinearRoomGenerationContractError(
      'linear candidate generation inputs do not share one biome owner',
    );
  }
  const owner = [...snapshot.batches, snapshot.terminalEntry].find((candidate) =>
    candidate.targets.some(
      (target) => semanticAddressKey(target.origin) === semanticAddressKey(targetOrigin),
    ),
  );
  const target = owner?.targets.find(
    (candidate) => candidate.origin.exitIndex === targetOrigin.exitIndex,
  );
  if (owner === undefined || target === undefined) {
    throw new LinearRoomGenerationContractError(
      `target ${semanticAddressKey(targetOrigin)} is not a linear batch target`,
    );
  }
  const rooms = generationRooms(snapshot);
  const source = requireSource(
    rooms,
    'parent' in owner ? owner.parent.origin : owner.predecessor.origin,
  );
  const view = targetGenerationViews(history).get(semanticAddressKey(targetOrigin));
  if (view === undefined) {
    throw new LinearRoomGenerationContractError(
      `target ${semanticAddressKey(targetOrigin)} has no history generation view`,
    );
  }
  assertTargetHistoryMatches(source, target, view);
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    throw new LinearRoomGenerationContractError(
      `catalog does not provide ${snapshot.biomeKey} linear generation policy`,
    );
  }
  const batchIndex = 'parent' in owner ? snapshot.batches.indexOf(owner) : -1;
  return evaluateTargetGameName(
    catalog,
    batchIndex < 0
      ? terminalCandidatePool(catalog, layout)
      : stagedCandidatePool(catalog, layout, batchIndex),
    source,
    targetOrigin,
    target.exit,
    view,
    gameName,
    enteredBiomeCount,
    targetRewardHistories(rewardHistoryCheckpoints).get(semanticAddressKey(targetOrigin)),
    layout.continuation.progressionPolicy.kind === 'staged',
  );
}

export function evaluateFRoomTargetCandidate(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  history: CanonicalLinearHistory,
  targetOrigin: CanonicalTarget['origin'],
  gameName: string,
): LinearRoomTargetCandidateValidation {
  if (snapshot.biomeKey !== 'F' || history.biomeKey !== 'F') {
    throw new LinearRoomGenerationContractError('F candidate generation requires biome F');
  }
  return evaluateLinearRoomTargetCandidate(catalog, snapshot, history, targetOrigin, gameName, 1);
}

export function evaluateFRoomGeneration(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  history: CanonicalLinearHistory,
): LinearRoomGenerationValidation {
  if (snapshot.biomeKey !== 'F' || history.biomeKey !== 'F') {
    throw new LinearRoomGenerationContractError('F generation requires biome F');
  }
  return evaluateLinearRoomGeneration(catalog, snapshot, history, 1);
}
