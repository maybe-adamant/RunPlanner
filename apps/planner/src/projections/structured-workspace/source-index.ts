import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  additionalExitsForDecision,
  declaredPhysicalExits as resolveDeclaredPhysicalExits,
  selectedExitContinuation,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type DeclaredPhysicalExit,
  type ExitDecision,
  type ExitDecisionAddress,
  type ExitDecisionSourceAddress,
  type EncounterPhaseAddress,
  type HubDecision,
  type HubDecisionAddress,
  type OccurrenceId,
  type ProjectDocument,
  type RoomOccurrence,
  type SemanticAddress,
  type LevelResolutionAddress,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog } from '@run-planner/engine/catalog-schema';
import type {
  BiomeCompletenessResult,
  CanonicalAdditionalContinuation,
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalBiome,
  CanonicalCompletionRoom,
  CanonicalDecision,
  CanonicalHubDecision,
  CanonicalHubTarget,
  CanonicalHubVisit,
  CanonicalLocalChildRoom,
  EncounterPhaseSequenceStatus,
  FigLeafPhaseCandidateSupport,
  CanonicalTarget,
  MaterializedBiomePrefix,
  ProjectBiomeEvaluation,
  ProjectEvaluation,
  SemanticFinding,
  DecisionRunStateAvailability,
  DecisionRunStateSnapshot,
  SelectedLevelResolutionAssessment,
} from '@run-planner/engine/simulation';
import {
  evaluateBiomeCompleteness,
  materializedBiomePrefixCoveragePoint,
} from '@run-planner/engine/simulation';

import { StructuredWorkspaceProjectionContractError } from './contract';
import { compareAuthoredTargetsInPhysicalOrder, compareCodeUnitStrings } from './assembly/ordering';

export interface WorkspaceEvaluatedBatchOverlay {
  readonly batch: CanonicalBatch;
  readonly partial: boolean;
}

export interface WorkspaceBiomeSource {
  readonly biome: BiomeAddress;
  readonly completeness: BiomeCompletenessResult;
  readonly entryRoom?: CanonicalAuthoredRoom;
  /** Exact engine preparation status; absent means the phase is not covered. */
  readonly encounterPhaseStatus: (
    phase: EncounterPhaseAddress,
  ) => EncounterPhaseSequenceStatus | undefined;
  readonly figLeafSupport: (
    phase: EncounterPhaseAddress,
  ) => FigLeafPhaseCandidateSupport | undefined;
  /** Exact engine-published reached/pending Gorgon capability. */
  readonly gorgonSupport: (phase: EncounterPhaseAddress) => boolean;
  readonly evaluation: ProjectBiomeEvaluation | undefined;
  readonly exitDecisions: readonly ExitDecision[];
  readonly findings: readonly SemanticFinding[];
  readonly layout: BiomeLayout;
  readonly plan: AuthoredBiomePlan;
  readonly evaluatedBatch: (
    owner: ExitDecisionAddress,
  ) => WorkspaceEvaluatedBatchOverlay | undefined;
  readonly evaluatedAdditional: (
    owner: ExitDecisionAddress,
  ) => readonly CanonicalAdditionalContinuation[];
  readonly evaluatedHub: (owner: HubDecisionAddress) => CanonicalHubDecision | undefined;
  readonly exitDecision: (source: ExitDecisionSourceAddress) => ExitDecision | undefined;
  readonly findingsFor: (owner: SemanticAddress) => readonly SemanticFinding[];
  readonly hubDecision: (hubKey: string) => HubDecision | undefined;
  readonly isAssessed: (owner: SemanticAddress) => boolean;
  readonly levelResolutionAssessment: (
    owner: LevelResolutionAddress,
  ) => SelectedLevelResolutionAssessment | undefined;
  readonly occurrence: (occurrenceId: OccurrenceId) => RoomOccurrence | undefined;
  readonly runState: (owner: ExitDecisionAddress | HubDecisionAddress) =>
    | { readonly availability: 'available'; readonly snapshot: DecisionRunStateSnapshot }
    | {
        readonly availability: 'unavailable';
        readonly reason?: DecisionRunStateAvailability['reason'];
      }
    | undefined;
}

export interface WorkspaceRouteSource {
  readonly biomes: readonly WorkspaceBiomeSource[];
  readonly evaluation: ProjectEvaluation['routes'][number] | undefined;
  readonly routeKey: string;
}

export interface WorkspaceProjectSourceIndex {
  readonly routes: readonly WorkspaceRouteSource[];
}

/**
 * Application-local mapping from engine-published canonical entities to the
 * semantic owners whose evaluation has actually been reached. It deliberately
 * does not discover addresses by walking object shape: every owner below is
 * either an explicit canonical origin or the engine's declared coverage point.
 */
export interface WorkspaceEvaluatedOwnerCoverage {
  readonly isAssessed: (owner: SemanticAddress) => boolean;
}

interface WorkspaceEvaluatedOwnerCoverageIndex extends WorkspaceEvaluatedOwnerCoverage {
  readonly hasKey: (key: string) => boolean;
}

type WorkspaceHubVisitFrontier = Extract<
  NonNullable<MaterializedBiomePrefix['frontier']>,
  { readonly phase: string }
>;
type WorkspacePrefixEvaluation = Extract<
  ProjectBiomeEvaluation,
  { readonly materializedPrefix: MaterializedBiomePrefix }
>;

function appendOwner(keys: Set<string>, owner: SemanticAddress): void {
  keys.add(semanticAddressKey(owner));
}

function appendAuthoredRoomOwners(keys: Set<string>, room: CanonicalAuthoredRoom): void {
  appendOwner(keys, room.origin);
  const biome = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
  for (const phase of room.encounterPhases) {
    appendOwner(
      keys,
      createEncounterPhaseAddress(
        biome,
        { kind: 'occurrence', occurrenceId: room.occurrenceId },
        phase.slotKey,
      ),
    );
  }
  if (room.incomingReward !== undefined) appendOwner(keys, room.incomingReward.origin);
  for (const reward of room.localRewards ?? []) appendOwner(keys, reward.origin);
  for (const wheel of room.rewardWheels ?? []) {
    appendOwner(keys, wheel.origin);
    for (const offer of wheel.offers) appendOwner(keys, offer.origin);
  }
  for (const offer of room.entryState?.offers ?? []) {
    appendOwner(keys, offer.offerOrigin);
  }
}

function appendLocalChildRoomOwners(keys: Set<string>, room: CanonicalLocalChildRoom): void {
  appendOwner(keys, room.origin);
  const biome = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
  for (const phase of room.encounterPhases) {
    appendOwner(
      keys,
      createEncounterPhaseAddress(
        biome,
        {
          kind: 'localChild',
          occurrenceId: room.origin.occurrenceId,
          groupKey: room.groupKey,
          slotKey: room.slotKey,
        },
        phase.slotKey,
      ),
    );
  }
  if (room.incomingReward !== undefined) appendOwner(keys, room.incomingReward.origin);
}

function appendTargetOwners(keys: Set<string>, target: CanonicalTarget): void {
  appendOwner(keys, target.origin);
  appendAuthoredRoomOwners(keys, target.room);
}

function appendAdditionalContinuationOwners(
  keys: Set<string>,
  continuation: CanonicalAdditionalContinuation,
): void {
  appendOwner(keys, continuation.origin);
  appendAuthoredRoomOwners(keys, continuation.room);
}

function appendBatchOwners(keys: Set<string>, batch: CanonicalBatch): void {
  appendOwner(keys, batch.origin);
  appendOwner(keys, batch.parent.origin);
  appendOwner(keys, batch.rewardStore.origin);
  appendOwner(keys, batch.selectedOrigin);
  for (const target of batch.targets) appendTargetOwners(keys, target);
  for (const continuation of batch.additional) {
    appendAdditionalContinuationOwners(keys, continuation);
  }
}

function appendHubTargetOwners(keys: Set<string>, target: CanonicalHubTarget): void {
  appendOwner(keys, target.origin);
  appendAuthoredRoomOwners(keys, target.room);
}

function appendHubVisitOwners(keys: Set<string>, visit: CanonicalHubVisit): void {
  appendOwner(keys, visit.origin);
  appendHubTargetOwners(keys, visit.target);
  for (const local of visit.localSlots) appendLocalChildRoomOwners(keys, local);
  for (const restore of visit.parentRestores) {
    appendOwner(keys, restore.after);
    appendOwner(keys, restore.room.origin);
  }
  appendOwner(keys, visit.hubRestore.after);
  appendOwner(keys, visit.hubRestore.room.origin);
}

function appendHubOwners(
  keys: Set<string>,
  hub: CanonicalHubDecision,
  omittedBoardTargetKey?: string,
): void {
  appendOwner(keys, hub.origin);
  appendOwner(keys, hub.room.origin);
  appendOwner(keys, hub.board.origin);
  appendOwner(keys, hub.board.room.origin);
  for (const target of hub.board.targets) {
    if (semanticAddressKey(target.origin) !== omittedBoardTargetKey)
      appendHubTargetOwners(keys, target);
  }
  for (const visit of hub.visits) appendHubVisitOwners(keys, visit);
}

function appendDecisionOwners(
  keys: Set<string>,
  decision: CanonicalDecision,
  omittedHubBoardTargetKey?: string,
): void {
  switch (decision.kind) {
    case 'batch':
      appendBatchOwners(keys, decision);
      return;
    case 'hub':
      appendHubOwners(keys, decision, omittedHubBoardTargetKey);
      return;
  }
}

function appendCompletionRoomOwners(keys: Set<string>, room: CanonicalCompletionRoom): void {
  appendOwner(keys, room.origin);
}

function isHubVisitFrontier(
  frontier: MaterializedBiomePrefix['frontier'],
): frontier is WorkspaceHubVisitFrontier {
  return frontier?.kind === 'hubVisit' && 'phase' in frontier;
}

function hasMaterializedPrefix(
  evaluation: ProjectBiomeEvaluation,
): evaluation is WorkspacePrefixEvaluation {
  return 'materializedPrefix' in evaluation;
}

function appendPrefixOwners(
  keys: Set<string>,
  prefix: MaterializedBiomePrefix,
  evaluation: WorkspacePrefixEvaluation,
): void {
  const frontier = prefix.frontier;
  const hubVisitFrontier = isHubVisitFrontier(frontier) ? frontier : undefined;
  const omittedHubTargetKey =
    hubVisitFrontier?.phase === 'targetLifecycle'
      ? semanticAddressKey(hubVisitFrontier.target.origin)
      : undefined;
  const derivedCoverage = materializedBiomePrefixCoveragePoint(prefix);
  if (
    derivedCoverage.checkpoint !== evaluation.coverage.through.checkpoint ||
    semanticAddressKey(derivedCoverage.owner) !==
      semanticAddressKey(evaluation.coverage.through.owner)
  ) {
    throw new StructuredWorkspaceProjectionContractError(
      `${evaluation.biomeKey} assessment prefix extends beyond declared coverage`,
    );
  }

  if (prefix.entryRoom !== undefined) appendAuthoredRoomOwners(keys, prefix.entryRoom);
  for (const decision of prefix.decisions) {
    // A clamped target-lifecycle frontier still retains its board target for
    // diagnosis, but coverage stops before that target. Earlier completed
    // visits remain independently covered even if malformed state reuses it.
    appendDecisionOwners(keys, decision, omittedHubTargetKey);
  }

  if (frontier?.kind === 'exitDecision') {
    appendOwner(keys, frontier.origin);
    appendOwner(keys, frontier.parent.origin);
    appendOwner(keys, frontier.selectedOrigin);
    if (frontier.partialBatch !== undefined) appendBatchOwners(keys, frontier.partialBatch);
    else for (const target of frontier.targets) appendTargetOwners(keys, target);
    for (const continuation of frontier.additional) {
      appendAdditionalContinuationOwners(keys, continuation);
    }
  }
  if (hubVisitFrontier !== undefined) {
    if (hubVisitFrontier.phase !== 'targetLifecycle') {
      appendOwner(keys, hubVisitFrontier.origin);
      appendHubTargetOwners(keys, hubVisitFrontier.target);
      for (const local of hubVisitFrontier.localSlots) appendLocalChildRoomOwners(keys, local);
      for (const restore of hubVisitFrontier.parentRestores) {
        appendOwner(keys, restore.after);
        appendOwner(keys, restore.room.origin);
      }
    }
  }

  // The point is the engine's explicit statement of the final covered owner.
  // It also covers an empty frontier whose owner has no canonical child yet.
  appendOwner(keys, evaluation.coverage.through.owner);
}

function createWorkspaceEvaluatedOwnerCoverage(
  evaluation: ProjectBiomeEvaluation | undefined,
): WorkspaceEvaluatedOwnerCoverageIndex {
  const keys = new Set<string>();
  if (evaluation === undefined || evaluation.coverage.kind === 'none') {
    return Object.freeze({
      hasKey: (key: string) => keys.has(key),
      isAssessed: (owner: SemanticAddress) => keys.has(semanticAddressKey(owner)),
    });
  }
  if (evaluation.authoring === 'complete' && evaluation.validity === 'valid') {
    const snapshot = evaluation.snapshot;
    appendAuthoredRoomOwners(keys, snapshot.entryRoom);
    for (const decision of snapshot.decisions) appendDecisionOwners(keys, decision);
    for (const room of snapshot.completionRooms) appendCompletionRoomOwners(keys, room);
  } else {
    if (!hasMaterializedPrefix(evaluation)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${evaluation.biomeKey} has progressive evaluation without prefix coverage`,
      );
    }
    appendPrefixOwners(
      keys,
      evaluation.assessmentPrefix ?? evaluation.materializedPrefix,
      evaluation,
    );
  }
  return Object.freeze({
    hasKey: (key: string) => keys.has(key),
    isAssessed: (owner: SemanticAddress) => keys.has(semanticAddressKey(owner)),
  });
}

function indexFindings(
  findings: readonly SemanticFinding[],
): ReadonlyMap<string, readonly SemanticFinding[]> {
  const mutable = new Map<string, SemanticFinding[]>();
  for (const finding of findings) {
    const key = semanticAddressKey(finding.origin);
    const values = mutable.get(key);
    if (values === undefined) mutable.set(key, [finding]);
    else values.push(finding);
  }
  return new Map([...mutable].map(([key, value]) => [key, Object.freeze(value)] as const));
}

function assessedMaterialization(
  evaluation: ProjectBiomeEvaluation | undefined,
): CanonicalBiome | MaterializedBiomePrefix | undefined {
  if (evaluation === undefined) return undefined;
  if (evaluation.authoring === 'complete' && evaluation.validity === 'valid') {
    return evaluation.snapshot;
  }
  return hasMaterializedPrefix(evaluation)
    ? (evaluation.assessmentPrefix ?? evaluation.materializedPrefix)
    : undefined;
}

function partialBatchFromPrefix(prefix: MaterializedBiomePrefix): CanonicalBatch | undefined {
  return prefix.frontier?.kind === 'exitDecision' ? prefix.frontier.partialBatch : undefined;
}

interface EvaluatedBiomeOverlay {
  readonly additional: ReadonlyMap<string, readonly CanonicalAdditionalContinuation[]>;
  readonly batches: ReadonlyMap<string, WorkspaceEvaluatedBatchOverlay>;
  readonly entryRoom?: CanonicalAuthoredRoom;
  readonly hubs: ReadonlyMap<string, CanonicalHubDecision>;
}

function evaluatedBiomeOverlay(
  snapshot: CanonicalBiome | MaterializedBiomePrefix | undefined,
  coverage: WorkspaceEvaluatedOwnerCoverageIndex,
): EvaluatedBiomeOverlay {
  const additional = new Map<string, readonly CanonicalAdditionalContinuation[]>();
  const batches = new Map<string, WorkspaceEvaluatedBatchOverlay>();
  const hubs = new Map<string, CanonicalHubDecision>();
  const insert = <T>(map: Map<string, T>, key: string, value: T, label: string): void => {
    if (map.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `evaluation has duplicate ${label} owner ${key}`,
      );
    }
    map.set(key, value);
  };
  for (const decision of snapshot?.decisions ?? []) {
    const key = semanticAddressKey(decision.origin);
    switch (decision.kind) {
      case 'batch':
        insert(batches, key, Object.freeze({ batch: decision, partial: false }), 'batch');
        if (decision.additional.length > 0) additional.set(key, decision.additional);
        break;
      case 'hub':
        insert(
          hubs,
          key,
          Object.freeze({
            ...decision,
            board: Object.freeze({
              ...decision.board,
              targets: Object.freeze(
                decision.board.targets.filter(
                  (target) =>
                    coverage.isAssessed(target.origin) && coverage.isAssessed(target.room.origin),
                ),
              ),
            }),
          }),
          'Hub',
        );
        break;
    }
  }
  const partial = snapshot?.kind === 'biomePrefix' ? partialBatchFromPrefix(snapshot) : undefined;
  if (partial !== undefined) {
    const key = semanticAddressKey(partial.origin);
    if (batches.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `evaluation has duplicate batch owner ${key}`,
      );
    }
    batches.set(key, Object.freeze({ batch: partial, partial: true }));
  }
  if (
    snapshot?.kind === 'biomePrefix' &&
    snapshot.frontier?.kind === 'exitDecision' &&
    snapshot.frontier.additional.length > 0
  ) {
    const key = semanticAddressKey(snapshot.frontier.origin);
    if (additional.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `evaluation has duplicate additional-continuation owner ${key}`,
      );
    }
    additional.set(key, snapshot.frontier.additional);
  }
  return Object.freeze({
    additional,
    batches,
    ...(snapshot?.entryRoom === undefined ? {} : { entryRoom: snapshot.entryRoom }),
    hubs,
  });
}

function requireOverlayWithinCoverage(
  overlay: EvaluatedBiomeOverlay,
  coverage: WorkspaceEvaluatedOwnerCoverageIndex,
): void {
  const requireOwners = (label: string, append: (keys: Set<string>) => void): void => {
    const keys = new Set<string>();
    append(keys);
    for (const key of keys) {
      if (coverage.hasKey(key)) continue;
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has ${label} after evaluated coverage`,
      );
    }
  };
  if (overlay.entryRoom !== undefined) {
    requireOwners('entry overlay', (keys) => appendAuthoredRoomOwners(keys, overlay.entryRoom!));
  }
  for (const { batch } of overlay.batches.values()) {
    requireOwners('batch overlay', (keys) => appendBatchOwners(keys, batch));
  }
  for (const continuations of overlay.additional.values()) {
    for (const additional of continuations) {
      requireOwners('additional continuation overlay', (keys) =>
        appendAdditionalContinuationOwners(keys, additional),
      );
    }
  }
  for (const hub of overlay.hubs.values()) {
    requireOwners('Hub overlay', (keys) => appendHubOwners(keys, hub));
  }
}

function physicalExitsForSource(
  catalog: Catalog,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  source: ExitDecisionSourceAddress,
): readonly DeclaredPhysicalExit[] {
  if (plan.topology === null) return Object.freeze([]);
  return resolveDeclaredPhysicalExits(catalog, layout, plan.topology, source) ?? Object.freeze([]);
}

function authoredExitDecisionsInTopologyOrder(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  byOwner: ReadonlyMap<string, ExitDecision>,
): readonly ExitDecision[] {
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const ordered: ExitDecision[] = [];
  const visited = new Set<string>();
  const visit = (source: ExitDecisionSourceAddress): void => {
    const key = semanticAddressKey(createExitDecisionAddress(biome, source));
    if (visited.has(key)) return;
    const decision = byOwner.get(key);
    if (decision === undefined) return;
    visited.add(key);
    ordered.push(decision);
    const rank = new Map(
      physicalExitsForSource(catalog, layout, plan, decision.source).map(
        (exit) => [exit.exitKey, exit.index] as const,
      ),
    );
    const targets = [...decision.normal.targets].sort((left, right) =>
      compareAuthoredTargetsInPhysicalOrder(rank, left, right),
    );
    const selected = selectedExitContinuation(
      decision,
      additionalExitsForDecision(topology, decision),
    );
    const selectedNormalTarget = selected?.kind === 'normal' ? selected.target : undefined;
    const selectedOccurrenceId =
      selected?.kind === 'normal'
        ? selected.target.occurrenceId
        : selected?.kind === 'additional'
          ? selected.exit.occurrenceId
          : undefined;
    if (selectedOccurrenceId !== undefined) {
      visit({ kind: 'occurrence', occurrenceId: selectedOccurrenceId });
    }
    for (const target of targets.filter((target) => target !== selectedNormalTarget)) {
      visit({ kind: 'occurrence', occurrenceId: target.occurrenceId });
    }
  };
  visit({ kind: 'occurrence', occurrenceId: topology.startOccurrenceId });
  for (const [key, decision] of [...byOwner.entries()].sort(([left], [right]) =>
    compareCodeUnitStrings(left, right),
  )) {
    if (!visited.has(key)) visit(decision.source);
  }
  return Object.freeze(ordered);
}

function createWorkspaceBiomeSource(
  catalog: Catalog,
  routeKey: string,
  plan: AuthoredBiomePlan,
  evaluation: ProjectBiomeEvaluation | undefined,
  encounterPhaseStatus: (phase: EncounterPhaseAddress) => EncounterPhaseSequenceStatus | undefined,
  figLeafSupport: (phase: EncounterPhaseAddress) => FigLeafPhaseCandidateSupport | undefined,
  gorgonSupport: (phase: EncounterPhaseAddress) => boolean,
): WorkspaceBiomeSource {
  const biome = createBiomeAddress(routeKey, plan.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`${plan.biomeKey} has no layout`);
  }
  const occurrencesById = new Map<OccurrenceId, RoomOccurrence>();
  const exitDecisionsByOwner = new Map<string, ExitDecision>();
  const hubDecisionsByKey = new Map<string, HubDecision>();
  const topology = plan.topology;
  if (topology !== null) {
    for (const occurrence of topology.occurrences) {
      if (occurrencesById.has(occurrence.occurrenceId)) {
        throw new StructuredWorkspaceProjectionContractError(
          semanticAddressKey(createOccurrenceAddress(biome, occurrence.occurrenceId)) +
            ' has duplicate authored occurrence identity',
        );
      }
      occurrencesById.set(occurrence.occurrenceId, occurrence);
    }
    for (const decision of topology.decisions) {
      if (decision.kind === 'exit') {
        const key = semanticAddressKey(createExitDecisionAddress(biome, decision.source));
        if (exitDecisionsByOwner.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            key + ' has duplicate authored exit-decision owner',
          );
        }
        exitDecisionsByOwner.set(key, decision);
        continue;
      }
      const key = semanticAddressKey(createHubDecisionAddress(biome, decision.hubKey));
      if (hubDecisionsByKey.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          key + ' has duplicate authored Hub-decision owner',
        );
      }
      hubDecisionsByKey.set(key, decision);
    }
  }
  // Reject malformed authored identity cheaply before asking the evaluator to
  // traverse the biome. Completeness remains one explicit source product, but
  // it is not the structural contract validator for workspace construction.
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  const exitDecisions = authoredExitDecisionsInTopologyOrder(
    catalog,
    biome,
    layout,
    plan,
    exitDecisionsByOwner,
  );
  const coverage = createWorkspaceEvaluatedOwnerCoverage(evaluation);
  const overlay = evaluatedBiomeOverlay(assessedMaterialization(evaluation), coverage);
  requireOverlayWithinCoverage(overlay, coverage);
  for (const key of overlay.batches.keys()) {
    if (exitDecisionsByOwner.get(key)?.normal.kind !== 'batch') {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has an evaluated batch without an authored batch decision`,
      );
    }
  }
  for (const key of overlay.additional.keys()) {
    if (exitDecisionsByOwner.get(key)?.normal.kind !== 'batch') {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has evaluated additional continuations without an authored batch decision`,
      );
    }
  }
  for (const key of overlay.hubs.keys()) {
    if (!hubDecisionsByKey.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has an evaluated Hub without an authored Hub decision`,
      );
    }
  }
  const findingsByOwner = indexFindings(evaluation?.findings ?? []);
  const runStateAvailability = new Map<string, DecisionRunStateAvailability>(
    (evaluation !== undefined && 'rewards' in evaluation
      ? evaluation.rewards.runStateAvailability
      : []
    ).map((item) => [semanticAddressKey(item.owner), item] as const),
  );
  const runStateSnapshots = new Map<string, DecisionRunStateSnapshot>(
    (evaluation !== undefined && 'rewards' in evaluation
      ? evaluation.rewards.runStateSnapshots
      : []
    ).map((item) => [semanticAddressKey(item.owner), item] as const),
  );
  const levelResolutionAssessments = new Map<string, SelectedLevelResolutionAssessment>(
    (evaluation !== undefined && 'rewards' in evaluation
      ? evaluation.rewards.selectedLevelResolutions
      : []
    ).map((assessment) => [semanticAddressKey(assessment.address), assessment] as const),
  );
  return Object.freeze({
    biome,
    completeness,
    encounterPhaseStatus,
    figLeafSupport,
    gorgonSupport,
    ...(overlay.entryRoom === undefined ? {} : { entryRoom: overlay.entryRoom }),
    evaluation,
    evaluatedAdditional: (owner: ExitDecisionAddress) =>
      overlay.additional.get(semanticAddressKey(owner)) ?? Object.freeze([]),
    evaluatedBatch: (owner: ExitDecisionAddress) => overlay.batches.get(semanticAddressKey(owner)),
    evaluatedHub: (owner: HubDecisionAddress) => overlay.hubs.get(semanticAddressKey(owner)),
    exitDecision: (source: ExitDecisionSourceAddress) =>
      exitDecisionsByOwner.get(semanticAddressKey(createExitDecisionAddress(biome, source))),
    exitDecisions,
    findings: Object.freeze([...(evaluation?.findings ?? [])]),
    findingsFor: (owner: SemanticAddress) =>
      findingsByOwner.get(semanticAddressKey(owner)) ?? Object.freeze([]),
    hubDecision: (hubKey: string) =>
      hubDecisionsByKey.get(semanticAddressKey(createHubDecisionAddress(biome, hubKey))),
    isAssessed: coverage.isAssessed,
    levelResolutionAssessment: (owner: LevelResolutionAddress) =>
      levelResolutionAssessments.get(semanticAddressKey(owner)),
    layout,
    occurrence: (occurrenceId: OccurrenceId) => occurrencesById.get(occurrenceId),
    plan,
    runState: (owner: ExitDecisionAddress | HubDecisionAddress) => {
      const availability = runStateAvailability.get(semanticAddressKey(owner));
      if (availability === undefined) return undefined;
      const snapshot = runStateSnapshots.get(semanticAddressKey(owner));
      if (availability.availability === 'available') {
        if (snapshot === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(owner)} publishes available Run State without a snapshot`,
          );
        }
        return Object.freeze({ availability: 'available' as const, snapshot });
      }
      return Object.freeze({
        availability: 'unavailable' as const,
        ...(availability.reason === undefined ? {} : { reason: availability.reason }),
      });
    },
  });
}

/**
 * Immutable authored-first lookup for workspace assembly. It indexes source
 * identities and evaluator overlays only; room policy, physical-exit policy,
 * projection outputs, and interaction registration remain outside it.
 */
export function createWorkspaceProjectSourceIndex(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  encounterPhaseStatus: (phase: EncounterPhaseAddress) => EncounterPhaseSequenceStatus | undefined,
  figLeafSupport: (phase: EncounterPhaseAddress) => FigLeafPhaseCandidateSupport | undefined = () =>
    undefined,
  gorgonSupport: (phase: EncounterPhaseAddress) => boolean = () => false,
): WorkspaceProjectSourceIndex {
  return Object.freeze({
    routes: Object.freeze(
      project.routes.map((route) => {
        const routeEvaluation = evaluation.routes.find(
          (candidate) => candidate.routeKey === route.routeKey,
        );
        return Object.freeze({
          biomes: Object.freeze(
            route.biomes.map((plan) =>
              createWorkspaceBiomeSource(
                catalog,
                route.routeKey,
                plan,
                routeEvaluation?.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey),
                encounterPhaseStatus,
                figLeafSupport,
                gorgonSupport,
              ),
            ),
          ),
          evaluation: routeEvaluation,
          routeKey: route.routeKey,
        });
      }),
    ),
  });
}
