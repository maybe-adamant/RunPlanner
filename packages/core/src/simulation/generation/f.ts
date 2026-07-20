import type { Catalog, ExitCompatibilityPolicy, RoomDeclaration, RoomForce } from '../../catalog';
import { evaluateRequirement, type RequirementEvaluationContext } from '../../requirementEvaluator';
import type { RequirementExpression } from '../../requirements';
import { semanticAddressKey, type OccurrenceAddress } from '../../project/addresses';
import type { CanonicalFHistory, FHistoryStateView, FTargetGenerationView } from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalLinearBiome,
  CanonicalPhysicalExit,
  CanonicalTarget,
} from '../materialization';
import type {
  FForcePressureLedgerEntry,
  FRoomGenerationValidation,
  FRoomTargetCandidateValidation,
  RoomGenerationExclusionReason,
} from './model';
import type { FindingEvidence, SemanticFinding } from '../model';

export class FRoomGenerationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'FRoomGenerationContractError';
  }
}

type ForceSupport = 'none' | 'optional' | 'required';

interface CandidateEvaluation {
  readonly room: RoomDeclaration;
  readonly reasons: readonly RoomGenerationExclusionReason[];
  readonly forceSupport: ForceSupport;
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

function assertFGenerationRequirement(requirement: RequirementExpression): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach(assertFGenerationRequirement);
      return;
    case 'not':
      assertFGenerationRequirement(requirement.requirement);
      return;
    case 'counterRange':
      if (requirement.axis !== 'biomeDepthCache' && requirement.axis !== 'biomeEncounterDepth') {
        throw new FRoomGenerationContractError(
          `F room generation cannot project counter ${requirement.axis}`,
        );
      }
      return;
    case 'recordCount':
      if (requirement.record !== 'roomsEntered') {
        throw new FRoomGenerationContractError(
          `F room generation cannot project record ${requirement.record}`,
        );
      }
      return;
    case 'minExits':
      return;
    default:
      throw new FRoomGenerationContractError(
        `F room generation cannot evaluate ${requirement.kind}`,
      );
  }
}

function assertFGenerationForce(force: RoomForce): void {
  switch (force.kind) {
    case 'always':
      return;
    case 'requirement':
      assertFGenerationRequirement(force.requirement);
      return;
    case 'depthWindow':
      if (force.axis !== 'biomeDepthCache' && force.axis !== 'biomeEncounterDepth') {
        throw new FRoomGenerationContractError(
          `F room generation cannot project force counter ${force.axis}`,
        );
      }
  }
}

function priorPeerGameNames(
  view: FHistoryStateView,
  parentOrigin: OccurrenceAddress,
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

function projectFRoomGenerationRequirementContext(
  source: CanonicalAuthoredRoom,
  sourceDeclaration: RoomDeclaration,
  view: FHistoryStateView,
): RequirementEvaluationContext {
  const roomsEntered = countByGameName(view.ledgers.roomAppearances);
  const shopOptions =
    source.entryState?.kind === 'shop'
      ? new Set(source.entryState.offers.map((offer) => offer.offer.rewardType))
      : new Set<string>();
  return Object.freeze({
    counters: Object.freeze({
      biomeDepthCache: view.ledgers.counters.biomeDepthCache,
      biomeEncounterDepth: view.ledgers.counters.biomeEncounterDepth,
      encounterDepth: view.ledgers.counters.routeEncounterDepth,
      enteredBiomes: 1,
      upgradableTraitCount: 0,
    }),
    records: Object.freeze({
      biomeUseRecord: Object.freeze({}),
      lootTypeHistory: Object.freeze({}),
      roomsEntered: Object.freeze(roomsEntered),
      useRecord: Object.freeze({}),
    }),
    currentRoomShopOptionNames: shopOptions,
    currentRoomRewardType: source.incomingReward?.offer.rewardType,
    rewardLookups: Object.freeze({}),
    runDepthCache: view.ledgers.counters.roomHistoryOrdinal + 1,
    lastEventRunDepthCaches: Object.freeze({}),
    recentEncounterPhases: Object.freeze([]),
    offeredExitCount: sourceDeclaration.exits.length,
    currentBatchRoomGameNames: priorPeerGameNames(view, source.origin),
    clockwork: undefined,
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
      assertFGenerationRequirement(force.requirement);
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
  view: FHistoryStateView,
  gameName: string,
  parentOrigin?: OccurrenceAddress,
): number {
  return view.ledgers.roomCreations.filter(
    (creation) =>
      creation.gameName === gameName &&
      (parentOrigin === undefined ||
        (creation.source === 'generatedTarget' &&
          semanticAddressKey(creation.parentOrigin) === semanticAddressKey(parentOrigin))),
  ).length;
}

function appearanceCount(view: FHistoryStateView, gameName: string): number {
  return view.ledgers.roomAppearances.filter((appearance) => appearance.gameName === gameName)
    .length;
}

function evaluateCandidate(
  catalog: Catalog,
  source: CanonicalAuthoredRoom,
  sourceDeclaration: RoomDeclaration,
  exit: CanonicalPhysicalExit,
  view: FHistoryStateView,
  room: RoomDeclaration,
  context: RequirementEvaluationContext,
): CandidateEvaluation {
  const reasons: RoomGenerationExclusionReason[] = [];
  if (room.force !== undefined) {
    assertFGenerationForce(room.force);
  }
  if (exit.kind === 'unavailable') {
    reasons.push('physicalExitUnavailable');
  } else {
    const policy = catalog.exitCompatibilityPolicies.byKey[exit.compatibilityPolicyKey];
    if (policy === undefined) {
      throw new FRoomGenerationContractError(
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
    assertFGenerationRequirement(room.eligibility);
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

function fCandidatePool(catalog: Catalog): readonly RoomDeclaration[] {
  const layout = catalog.biomeLayouts.byKey.F;
  if (layout?.kind !== 'LinearBiome' || layout.start.kind !== 'authoredStart') {
    throw new FRoomGenerationContractError('catalog does not provide F candidate structure');
  }
  const startNames = new Set(layout.start.roomGameNames);
  return Object.freeze(
    catalog.rooms.values.filter(
      (room) =>
        room.biomeKey === 'F' && room.mode.kind === 'authored' && !startNames.has(room.gameName),
    ),
  );
}

function targetGenerationViews(
  history: CanonicalFHistory,
): ReadonlyMap<string, FTargetGenerationView> {
  const entries = history.rooms.flatMap((room) => room.targetGenerations);
  return new Map(entries.map((view) => [semanticAddressKey(view.targetOrigin), view]));
}

function authoredRooms(snapshot: CanonicalLinearBiome): ReadonlyMap<string, CanonicalAuthoredRoom> {
  const rooms = [
    ...snapshot.entryRooms,
    ...snapshot.batches.flatMap((batch) => batch.targets.map((target) => target.room)),
    ...snapshot.terminalEntry.targets.map((target) => target.room),
  ];
  return new Map(rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function finding(
  code: 'targetRoomSupportEmpty' | 'targetRoomUnavailable',
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

function selectedEvidence(entry: FForcePressureLedgerEntry): FindingEvidence {
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
  source: CanonicalAuthoredRoom,
  target: CanonicalTarget,
  view: FTargetGenerationView,
): void {
  const targetKey = semanticAddressKey(target.origin);
  const sourceKey = semanticAddressKey(source.origin);
  if (
    semanticAddressKey(view.targetOrigin) !== targetKey ||
    semanticAddressKey(view.roomOrigin) !== semanticAddressKey(target.room.origin)
  ) {
    throw new FRoomGenerationContractError(
      `target ${targetKey} does not match its history generation view`,
    );
  }

  const sourceAppearance = view.before.ledgers.roomAppearances.find(
    (appearance) => semanticAddressKey(appearance.origin) === sourceKey,
  );
  if (sourceAppearance?.gameName !== source.gameName) {
    throw new FRoomGenerationContractError(
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
    throw new FRoomGenerationContractError(
      `target ${targetKey} does not match its history creation`,
    );
  }
}

function evaluateTargetGameName(
  catalog: Catalog,
  pool: readonly RoomDeclaration[],
  source: CanonicalAuthoredRoom,
  targetOrigin: CanonicalTarget['origin'],
  exit: CanonicalPhysicalExit,
  view: FTargetGenerationView,
  selectedGameName: string,
): FRoomTargetCandidateValidation {
  const sourceDeclaration = catalog.rooms.byKey[source.gameName];
  if (sourceDeclaration === undefined) {
    throw new FRoomGenerationContractError(`unknown source room ${source.gameName}`);
  }
  const context = projectFRoomGenerationRequirementContext(source, sourceDeclaration, view.before);
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
  const pressure: FForcePressureLedgerEntry = Object.freeze({
    targetOrigin,
    beforeSequence: view.before.sequence,
    sourceGameName: source.gameName,
    selectedGameName,
    exitIndex: targetOrigin.exitIndex,
    biomeDepthCache: view.before.ledgers.counters.biomeDepthCache,
    biomeEncounterDepth: view.before.ledgers.counters.biomeEncounterDepth,
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
  source: CanonicalAuthoredRoom,
  target: CanonicalTarget,
  view: FTargetGenerationView,
): FRoomTargetCandidateValidation {
  assertTargetHistoryMatches(source, target, view);
  return evaluateTargetGameName(
    catalog,
    pool,
    source,
    target.origin,
    target.exit,
    view,
    target.room.gameName,
  );
}

function requireSource(
  rooms: ReadonlyMap<string, CanonicalAuthoredRoom>,
  origin: OccurrenceAddress,
): CanonicalAuthoredRoom {
  const room = rooms.get(semanticAddressKey(origin));
  if (room === undefined || !room.entered) {
    throw new FRoomGenerationContractError(
      `history source ${semanticAddressKey(origin)} is not an entered canonical room`,
    );
  }
  return room;
}

function evaluateTargets(
  catalog: Catalog,
  pool: readonly RoomDeclaration[],
  source: CanonicalAuthoredRoom,
  targets: readonly CanonicalTarget[],
  views: ReadonlyMap<string, FTargetGenerationView>,
  pressure: FForcePressureLedgerEntry[],
  findings: SemanticFinding[],
): void {
  for (const target of targets) {
    const view = views.get(semanticAddressKey(target.origin));
    if (view === undefined) {
      throw new FRoomGenerationContractError(
        `target ${semanticAddressKey(target.origin)} has no history generation view`,
      );
    }
    const result = validateTarget(catalog, pool, source, target, view);
    pressure.push(result.pressure);
    findings.push(...result.findings);
  }
}

export function evaluateFRoomGeneration(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  history: CanonicalFHistory,
): FRoomGenerationValidation {
  if (
    snapshot.biomeKey !== 'F' ||
    history.biomeKey !== 'F' ||
    snapshot.routeKey !== history.routeKey
  ) {
    throw new FRoomGenerationContractError('F generation inputs do not share one biome owner');
  }
  const pool = fCandidatePool(catalog);
  const rooms = authoredRooms(snapshot);
  const views = targetGenerationViews(history);
  const pressure: FForcePressureLedgerEntry[] = [];
  const findings: SemanticFinding[] = [];

  for (const batch of snapshot.batches) {
    evaluateTargets(
      catalog,
      pool,
      requireSource(rooms, batch.parent.origin),
      batch.targets,
      views,
      pressure,
      findings,
    );
  }
  evaluateTargets(
    catalog,
    pool,
    requireSource(rooms, snapshot.terminalEntry.predecessor.origin),
    snapshot.terminalEntry.targets,
    views,
    pressure,
    findings,
  );

  return Object.freeze({
    biomeKey: 'F',
    validity: findings.length === 0 ? 'valid' : 'invalid',
    forcePressure: Object.freeze(pressure),
    findings: Object.freeze(findings),
  });
}

export function evaluateFRoomTargetCandidate(
  catalog: Catalog,
  snapshot: CanonicalLinearBiome,
  history: CanonicalFHistory,
  targetOrigin: CanonicalTarget['origin'],
  gameName: string,
): FRoomTargetCandidateValidation {
  if (
    snapshot.biomeKey !== 'F' ||
    history.biomeKey !== 'F' ||
    snapshot.routeKey !== history.routeKey ||
    targetOrigin.routeKey !== snapshot.routeKey ||
    targetOrigin.biomeKey !== snapshot.biomeKey
  ) {
    throw new FRoomGenerationContractError(
      'F candidate generation inputs do not share one biome owner',
    );
  }
  const batch = snapshot.batches.find(
    (candidate) =>
      candidate.parent.origin.occurrenceId === targetOrigin.parentOccurrenceId &&
      candidate.targets.some((target) => target.origin.exitIndex === targetOrigin.exitIndex),
  );
  const target = batch?.targets.find(
    (candidate) => candidate.origin.exitIndex === targetOrigin.exitIndex,
  );
  if (batch === undefined || target === undefined) {
    throw new FRoomGenerationContractError(
      `target ${semanticAddressKey(targetOrigin)} is not an ordinary F batch target`,
    );
  }
  const rooms = authoredRooms(snapshot);
  const source = requireSource(rooms, batch.parent.origin);
  const view = targetGenerationViews(history).get(semanticAddressKey(targetOrigin));
  if (view === undefined) {
    throw new FRoomGenerationContractError(
      `target ${semanticAddressKey(targetOrigin)} has no history generation view`,
    );
  }
  assertTargetHistoryMatches(source, target, view);
  return evaluateTargetGameName(
    catalog,
    fCandidatePool(catalog),
    source,
    targetOrigin,
    target.exit,
    view,
    gameName,
  );
}
