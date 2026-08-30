import type { BiomeLayout, Catalog, RoomDeclaration } from '../../catalog-schema';
import type { RequirementEvaluationContext } from '../../requirements/evaluator';
import type { RewardHistoryState } from '../../reward-kernel';
import {
  createBiomeAddress,
  createTargetAddress,
  semanticAddressKey,
  type ExitDecisionAddress,
} from '../../authored-project/addresses';
import {
  declaredPhysicalExitsForSourceRoom,
  normalDecisionProgressionForLayout,
} from '../../authored-project/topology/query';
import type { HistoryStateView, TargetGenerationView } from '../history';
import type { RoomHistoryOrigin } from '../lifecycle';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalPhysicalExit,
  CanonicalTarget,
} from '../materialization';
import type { TargetRewardHistoryCheckpoint } from '../rewards';
import type {
  AnomalyTakeoverCandidateSupport,
  ForcePressureLedgerEntry,
  HubTerminalTakeoverCandidateSupport,
  OrdinaryTargetGenerationAssessment,
  RoomTargetCandidateContext,
  RoomTargetCandidateValidation,
  RoomGenerationExclusionEvidence,
  RoomGenerationExclusionReason,
  TakeoverPrebossBatchCandidateSupport,
} from './model';
import type { FindingEvidence, SemanticFinding } from '../model';
import type { FindingRegionEntry } from '../finding-regions';
import {
  BiomeRoomGenerationContractError,
  appendFinding,
  assertGenerationRequirement,
  evaluateCandidate,
  finding,
  firstTargetCandidateDomain,
  generationDecisions,
  generationRooms,
  projectRoomGenerationRequirementContext,
  requirementEvidence,
  roomGenerationCounts,
  sourceGenerationSupport,
  stagedCandidatePool,
  targetRewardHistories,
} from './normal-targets';
import type {
  BiomeGenerationHistory,
  BiomeGenerationSnapshot,
  CandidateEvaluation,
  CanonicalGenerationSource,
  FirstTargetGenerationSupport,
  RoomGenerationCounts,
  SourceGenerationSupport,
  TakeoverShapeEvaluation,
  TargetRewardRequirementFacts,
} from './normal-targets';

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
  rewardFacts: TargetRewardRequirementFacts | undefined,
): RoomTargetCandidateContext {
  const sourceDeclaration = catalog.rooms.byKey[source.gameName];
  if (sourceDeclaration === undefined) {
    throw new BiomeRoomGenerationContractError(`unknown source room ${source.gameName}`);
  }
  const context = projectRoomGenerationRequirementContext(
    catalog,
    source,
    sourceDeclaration,
    before,
    enteredBiomeCount,
    rewardFacts?.history,
    rewardFacts?.pendingSpellDrop,
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
  pendingSpellDrop = false,
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
    catalog,
    source,
    sourceDeclaration,
    before,
    enteredBiomeCount,
    rewardHistory,
    pendingSpellDrop,
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
          forceSupport: candidate.forceSupport,
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
  rewardFacts?: TargetRewardRequirementFacts,
): RoomTargetCandidateContext {
  const support = firstTargetGenerationSupport(
    catalog,
    biomeKey,
    ordinaryBatchIndex,
    source,
    exit,
    before,
    enteredBiomeCount,
    rewardFacts?.history,
    rewardFacts?.pendingSpellDrop,
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
  const rewardFacts = targetRewardHistories(rewardHistoryCheckpoints).get(
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
      rewardFacts,
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
    rewardFacts,
  );
}

export function requireSource(
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
export function normalPhysicalExitsForSource(
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

/**
 * An Anomaly occupies an otherwise ordinary G target, so ordinary candidate
 * evaluation remains responsible for the remembered target declaration. This
 * companion check owns only the source-side game rule that makes the
 * replacement available. Keeping the two products separate prevents the
 * Anomaly map from accidentally entering G's ordinary candidate pool.
 */
function anomalyTakeoverCandidateSupport(
  layout: BiomeLayout,
  source: CanonicalGenerationSource,
  targetOrigin: CanonicalTarget['origin'],
  rememberedTargetGameName: string,
  before: HistoryStateView,
): AnomalyTakeoverCandidateSupport | undefined {
  const descriptor =
    layout.progression.kind === 'generated' ? layout.progression.anomalyReplacement : undefined;
  if (
    descriptor === undefined ||
    !descriptor.replaceableTargetRoomGameNames.includes(rememberedTargetGameName)
  )
    return undefined;
  const excludedEncounterKeys = source.encounterPhases
    .map((phase) => phase.encounterKey)
    .filter((key) => descriptor.source.excludedSourceEncounterGameNames.includes(key));
  const priorEnteredReplacementCount = before.ledgers.roomAppearances.filter((appearance) =>
    descriptor.replacementRoomGameNames.includes(appearance.gameName),
  ).length;
  const failedConditions: AnomalyTakeoverCandidateSupport['failedConditions'][number][] = [];
  if (before.ledgers.counters.biomeDepthCache < descriptor.source.minimumBiomeDepthCache) {
    failedConditions.push('minimumBiomeDepthCache');
  }
  if (descriptor.source.excludedRoomGameNames.includes(source.gameName)) {
    failedConditions.push('sourceRoomExcluded');
  }
  if (excludedEncounterKeys.length > 0) {
    failedConditions.push('sourceEncounterExcluded');
  }
  if (priorEnteredReplacementCount > descriptor.source.maxEnteredReplacementsThisRoute) {
    failedConditions.push('enteredReplacementCap');
  }
  return Object.freeze({
    origin: targetOrigin,
    selectedPossible: failedConditions.length === 0,
    sourceGameName: source.gameName,
    sourceBiomeDepthCache: before.ledgers.counters.biomeDepthCache,
    minimumBiomeDepthCache: descriptor.source.minimumBiomeDepthCache,
    excludedSourceEncounterKeys: Object.freeze(excludedEncounterKeys),
    priorEnteredReplacementCount,
    maximumEnteredReplacementsThisRoute: descriptor.source.maxEnteredReplacementsThisRoute,
    failedConditions: Object.freeze(failedConditions),
  });
}

function anomalyReplacementEligibility(
  layout: BiomeLayout,
  source: CanonicalGenerationSource,
  target: CanonicalTarget,
  before: HistoryStateView,
): { readonly selectedPossible: boolean; readonly evidence: FindingEvidence } | undefined {
  const provenance = target.room.anomalyReplacement;
  if (provenance === undefined) return undefined;
  const descriptor =
    layout.progression.kind === 'generated' ? layout.progression.anomalyReplacement : undefined;
  if (
    descriptor === undefined ||
    !descriptor.replacementRoomGameNames.includes(target.room.gameName) ||
    !descriptor.replaceableTargetRoomGameNames.includes(provenance.replacedRoomGameName)
  ) {
    throw new BiomeRoomGenerationContractError(
      `${target.room.gameName} does not match the declared Anomaly replacement matrix`,
    );
  }
  const support = anomalyTakeoverCandidateSupport(
    layout,
    source,
    target.origin,
    provenance.replacedRoomGameName,
    before,
  );
  if (support === undefined) {
    throw new BiomeRoomGenerationContractError(
      `${target.room.gameName} has Anomaly provenance without a declared takeover target`,
    );
  }
  return Object.freeze({
    selectedPossible: support.selectedPossible,
    evidence: Object.freeze({
      kind: 'oceanusAnomaly',
      rememberedTargetGameName: provenance.replacedRoomGameName,
      replacementRoomGameName: target.room.gameName,
      sourceGameName: support.sourceGameName,
      sourceBiomeDepthCache: support.sourceBiomeDepthCache,
      minimumBiomeDepthCache: support.minimumBiomeDepthCache,
      excludedSourceEncounterKeys: support.excludedSourceEncounterKeys,
      priorEnteredReplacementCount: support.priorEnteredReplacementCount,
      maximumEnteredReplacementsThisRoute: support.maximumEnteredReplacementsThisRoute,
      failedConditions: support.failedConditions,
    }),
  });
}

export function evaluateTargetSlots(
  catalog: Catalog,
  layout: BiomeLayout,
  pool: readonly RoomDeclaration[],
  source: CanonicalGenerationSource,
  sourceBeforeGeneration: HistoryStateView,
  generationOrigin: ExitDecisionAddress,
  physicalExits: readonly CanonicalPhysicalExit[],
  targets: readonly CanonicalTarget[],
  views: ReadonlyMap<string, TargetGenerationView>,
  candidateContexts: Map<string, RoomTargetCandidateContext>,
  findings: SemanticFinding[],
  findingRegions: FindingRegionEntry[],
  enteredBiomeCount: number,
  rewardHistories: ReadonlyMap<string, TargetRewardRequirementFacts>,
): readonly OrdinaryTargetGenerationAssessment[] {
  const sourceDeclaration = catalog.rooms.byKey[source.gameName];
  if (sourceDeclaration === undefined) {
    throw new BiomeRoomGenerationContractError(`unknown source room ${source.gameName}`);
  }
  const biome = createBiomeAddress(generationOrigin.routeKey, generationOrigin.biomeKey);
  const assessments: OrdinaryTargetGenerationAssessment[] = [];
  const evaluateConcreteTarget = (target: CanonicalTarget): HistoryStateView => {
    const targetKey = semanticAddressKey(target.origin);
    const rewardFacts = rewardHistories.get(targetKey);
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
      rewardFacts,
    );
    candidateContexts.set(targetKey, candidateContext);
    const rememberedGameName =
      target.room.anomalyReplacement?.replacedRoomGameName ?? target.room.gameName;
    const anomalyTakeover = anomalyTakeoverCandidateSupport(
      layout,
      source,
      target.origin,
      rememberedGameName,
      before,
    );
    const result = candidateContext.evaluateGameName(rememberedGameName);
    assessments.push(
      Object.freeze({
        origin: target.origin,
        pressure: result.pressure,
        ...(anomalyTakeover === undefined ? {} : { anomaly: anomalyTakeover }),
      }),
    );
    const anomaly = anomalyReplacementEligibility(layout, source, target, before);
    if (anomaly?.selectedPossible !== false) {
      result.findings.forEach((value) => appendFinding(findings, findingRegions, value));
      return view.after;
    }
    // Preserve any ordinary support-empty diagnosis, but consolidate the
    // normal target and Anomaly source failures at the target's one stable
    // semantic owner.  A second generic unavailable finding would otherwise
    // be deduplicated later and discard the source-side evidence.
    result.findings
      .filter((findingEntry) => findingEntry.code !== 'targetRoomUnavailable')
      .forEach((value) => appendFinding(findings, findingRegions, value));
    appendFinding(
      findings,
      findingRegions,
      finding('targetRoomUnavailable', target.origin, {
        ...selectedEvidence(result.pressure),
        anomalyReplacement: anomaly.evidence,
      }),
    );
    return view.after;
  };
  let before = sourceBeforeGeneration;
  for (const exit of physicalExits) {
    const target = targets.find((candidate) => candidate.exit.exitKey === exit.exitKey);
    const targetOrigin =
      target?.origin ?? createTargetAddress(biome, generationOrigin.source, exit.exitKey);
    const rewardFacts = rewardHistories.get(semanticAddressKey(targetOrigin));
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
          rewardFacts,
        ),
      );
      return Object.freeze(assessments);
    }
    before = evaluateConcreteTarget(target);
  }
  const availableExitKeys = new Set(physicalExits.map((exit) => exit.exitKey));
  for (const target of targets) {
    if (!availableExitKeys.has(target.exit.exitKey)) {
      evaluateConcreteTarget(target);
    }
  }
  return Object.freeze(assessments);
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
    catalog,
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
