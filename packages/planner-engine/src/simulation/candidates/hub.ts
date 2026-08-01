import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createHubOpenSetAddress,
  semanticAddressKey,
  type HubSlotAddress,
  type HubVisitAddress,
  type LocalChildAddress,
  type LocalChildGroupAddress,
} from '../../authored-project/addresses';
import {
  applyProjectCommand,
  ProjectCommandContractError,
} from '../../authored-project/commands/dispatch';
import type { HubDecision, OccurrenceId, ProjectDocument } from '../../authored-project/model';
import {
  evaluateHubOpenSetConstraints,
  type HubSideRoomGenerationSupportEntry,
} from '../generation';
import type { CanonicalHubDecision } from '../materialization';
import type { SemanticFinding } from '../model';
import type { ProjectEvaluation } from '../project';
import {
  evaluateProgressiveBiome,
  evaluateProgressiveBiomeBeforeClamp,
  type ProgressiveBiomeEvaluation,
} from '../progressive/biome';
import {
  coverageUnavailable,
  unavailableForBiome,
  unreachableTarget,
  type CandidateContextUnavailable,
} from './availability';
import { CandidateEvaluationContractError } from './contract';
import {
  candidateBiome,
  candidateBlockedAt,
  completeBiomeCount,
  planFor,
  progressiveSeed,
  type CandidateBiomeEvaluation,
} from './evaluated-biome';

/**
 * A Hub slot is a physical board position. Opening it needs the occurrence
 * identity that the eventual semantic command will create; closing ignores
 * that value and retains the existing occurrence instead.
 */
export interface HubSlotCandidateQuery {
  readonly kind: 'hubSlot';
  readonly slot: HubSlotAddress;
  readonly open: boolean;
  readonly occurrenceId: OccurrenceId;
}

export interface HubVisitCandidateQuery {
  readonly kind: 'hubVisit';
  readonly visit: HubVisitAddress;
  readonly hubSlotKey: string;
}

export interface SideRoomGenerationCandidateQuery {
  readonly kind: 'sideRoomGeneration';
  readonly sideRoom: LocalChildAddress;
  readonly generation: 'generated' | 'notGenerated';
}

export interface SideRoomEntryOrderCandidateQuery {
  readonly kind: 'sideRoomEntryOrder';
  readonly group: LocalChildGroupAddress;
  readonly enteredSlotKeys: readonly string[];
}

export interface HubSlotCandidateSupport {
  readonly candidateOpen: boolean;
  readonly currentlyOpen: boolean;
  readonly openSlotKeys: readonly string[];
  readonly minimumOpenCount: number;
  readonly maximumOpenCount: number;
  readonly referencedVisitIndexes: readonly number[];
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedHubSlotCandidate {
  readonly kind: 'hubSlot';
  readonly result: HubSlotCandidateSupport;
}

export interface HubVisitCandidateSupport {
  readonly candidateHubSlotKey: string;
  readonly openHubSlotKeys: readonly string[];
  readonly occupiedVisitIndexes: readonly number[];
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedHubVisitCandidate {
  readonly kind: 'hubVisit';
  readonly result: HubVisitCandidateSupport;
}

export interface SideRoomGenerationCandidateSupport {
  readonly candidateGeneration: 'generated' | 'notGenerated';
  readonly enteredOrdinal: number | null;
  readonly generatedBefore: number;
  readonly requiredGeneratedCount: number;
  readonly supportOutcomes: readonly ('generated' | 'notGenerated')[];
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedSideRoomGenerationCandidate {
  readonly kind: 'sideRoomGeneration';
  readonly result: SideRoomGenerationCandidateSupport;
}

export interface SideRoomEntryOrderCandidateSupport {
  readonly candidateEnteredSlotKeys: readonly string[];
  readonly generatedSlotKeys: readonly string[];
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedSideRoomEntryOrderCandidate {
  readonly kind: 'sideRoomEntryOrder';
  readonly result: SideRoomEntryOrderCandidateSupport;
}

export type HubSlotCandidateEvaluation = CandidateContextUnavailable | EvaluatedHubSlotCandidate;
export type HubVisitCandidateEvaluation = CandidateContextUnavailable | EvaluatedHubVisitCandidate;
export type SideRoomGenerationCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedSideRoomGenerationCandidate;
export type SideRoomEntryOrderCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedSideRoomEntryOrderCandidate;

interface CandidateHubState {
  readonly descriptor: Extract<
    Catalog['biomeLayouts']['values'][number]['progression'],
    { readonly kind: 'hub' }
  >;
  readonly plan: ProjectDocument['routes'][number]['biomes'][number];
  readonly topology: NonNullable<ProjectDocument['routes'][number]['biomes'][number]['topology']>;
  readonly decision: HubDecision;
}

function candidateHubState(
  catalog: Catalog,
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  hubKey: string,
): CandidateHubState | undefined {
  const plan = planFor(project, routeKey, biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout?.progression.kind !== 'hub') {
    throw new CandidateEvaluationContractError(`${biomeKey} has no Hub candidate domain`);
  }
  if (layout.progression.hubKey !== hubKey) {
    throw new CandidateEvaluationContractError(`${hubKey} is not ${biomeKey}'s Hub decision`);
  }
  const topology = plan.topology;
  if (topology === null) return undefined;
  const decision = topology.decisions.find(
    (candidate): candidate is HubDecision =>
      candidate.kind === 'hub' && candidate.hubKey === hubKey,
  );
  if (decision === undefined) return undefined;
  return Object.freeze({ descriptor: layout.progression, plan, topology, decision });
}

function hubOpenSetIncompleteFinding(
  query: HubSlotCandidateQuery,
  minimumOpenCount: number,
  maximumOpenCount: number,
  actualOpenCount: number,
): SemanticFinding {
  return Object.freeze({
    code: 'hubOpenSetIncomplete',
    severity: 'error',
    phase: 'completeness',
    origin: createHubOpenSetAddress(
      createBiomeAddress(query.slot.routeKey, query.slot.biomeKey),
      query.slot.hubKey,
    ),
    evidence: Object.freeze({ minimumOpenCount, maximumOpenCount, actualOpenCount }),
  });
}

function hubCandidateFindings(
  query: HubSlotCandidateQuery,
  state: CandidateHubState,
): readonly SemanticFinding[] {
  const candidateOpenSlotKeys = state.descriptor.slots.flatMap((slot) => {
    const isCandidate = slot.slotKey === query.slot.hubSlotKey;
    const remainsOpen = isCandidate
      ? query.open
      : state.decision.openTargets.some((target) => target.hubSlotKey === slot.slotKey);
    return remainsOpen ? [slot.slotKey] : [];
  });
  const count = candidateOpenSlotKeys.length;
  // An undersized board is incomplete authorship, not evidence that the slot
  // edit itself is unavailable. The player must be able to build a fresh Hub
  // one physical door at a time. Exceeding the maximum remains invalid.
  if (count > state.descriptor.openCount.max) {
    return Object.freeze([
      hubOpenSetIncompleteFinding(
        query,
        state.descriptor.openCount.min,
        state.descriptor.openCount.max,
        count,
      ),
    ]);
  }
  const constraints = evaluateHubOpenSetConstraints(
    state.descriptor,
    createBiomeAddress(query.slot.routeKey, query.slot.biomeKey),
    candidateOpenSlotKeys,
  );
  return Object.freeze(
    constraints.findings.filter(
      (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(query.slot),
    ),
  );
}

function hubCandidateProposal(
  catalog: Catalog,
  project: ProjectDocument,
  command: Parameters<typeof applyProjectCommand>[2],
): ProjectDocument | undefined {
  try {
    return applyProjectCommand(project, catalog, command);
  } catch (error) {
    if (error instanceof ProjectCommandContractError) return undefined;
    throw error;
  }
}

function hubRegionalPlan(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  hubKey: string,
  visitIndex: number,
) {
  const plan = planFor(project, routeKey, biomeKey);
  const topology = plan.topology;
  if (topology === null) return undefined;
  const decision = topology.decisions.find(
    (candidate): candidate is HubDecision =>
      candidate.kind === 'hub' && candidate.hubKey === hubKey,
  );
  if (decision === undefined) return undefined;
  const regionalPlan = Object.freeze({
    ...plan,
    topology: Object.freeze({
      ...topology,
      decisions: Object.freeze(
        topology.decisions.map((candidate) =>
          candidate === decision
            ? Object.freeze({
                ...candidate,
                visitOrder: Object.freeze(candidate.visitOrder.slice(0, visitIndex)),
              })
            : candidate,
        ),
      ),
    }),
  });
  return regionalPlan;
}

/** Evaluate only the addressed visit prefix of the persistent Hub region. */
function hubRegionEvaluation(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
  hubKey: string,
  visitIndex: number,
) {
  const regionalPlan = hubRegionalPlan(project, routeKey, biomeKey, hubKey, visitIndex);
  if (regionalPlan === undefined) return undefined;
  return evaluateProgressiveBiome(
    catalog,
    createBiomeAddress(routeKey, biomeKey),
    regionalPlan,
    completeBiomeCount(evaluation, routeKey, biomeKey),
    progressiveSeed(evaluation, routeKey, biomeKey),
  );
}

function hubRegionRepairForSideRoom(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  sideRoom: LocalChildAddress,
  bounded: CandidateBiomeEvaluation | undefined,
): ProgressiveBiomeEvaluation | undefined {
  const blockedAt = candidateBlockedAt(bounded);
  if (blockedAt === undefined || semanticAddressKey(blockedAt) !== semanticAddressKey(sideRoom)) {
    return undefined;
  }
  const plan = planFor(project, sideRoom.routeKey, sideRoom.biomeKey);
  const descriptor = catalog.biomeLayouts.byKey[plan.biomeKey]?.progression;
  if (descriptor?.kind !== 'hub') {
    throw new CandidateEvaluationContractError(`${plan.biomeKey} has no Hub candidate domain`);
  }
  const hub = candidateHubState(
    catalog,
    project,
    sideRoom.routeKey,
    sideRoom.biomeKey,
    descriptor.hubKey,
  );
  const hubSlotKey = hub?.decision.openTargets.find(
    (target) => target.occurrenceId === sideRoom.occurrenceId,
  )?.hubSlotKey;
  const visitIndex =
    hubSlotKey === undefined ? undefined : (hub?.decision.visitOrder.indexOf(hubSlotKey) ?? -1) + 1;
  if (visitIndex === undefined || visitIndex <= 0) return undefined;
  const regionalPlan = hubRegionalPlan(
    project,
    sideRoom.routeKey,
    sideRoom.biomeKey,
    descriptor.hubKey,
    visitIndex,
  );
  if (regionalPlan === undefined) return undefined;
  const raw = evaluateProgressiveBiomeBeforeClamp(
    catalog,
    createBiomeAddress(sideRoom.routeKey, sideRoom.biomeKey),
    regionalPlan,
    completeBiomeCount(evaluation, sideRoom.routeKey, sideRoom.biomeKey),
    progressiveSeed(evaluation, sideRoom.routeKey, sideRoom.biomeKey),
  );
  return raw !== null &&
    raw.blockedAt !== undefined &&
    semanticAddressKey(raw.blockedAt) === semanticAddressKey(sideRoom)
    ? raw
    : undefined;
}

function findingOwnsOccurrence(finding: SemanticFinding, occurrenceId: OccurrenceId): boolean {
  return 'occurrenceId' in finding.origin && finding.origin.occurrenceId === occurrenceId;
}

function findingOwnsLocalGroup(finding: SemanticFinding, group: LocalChildGroupAddress): boolean {
  return (
    (finding.origin.kind === 'localChild' || finding.origin.kind === 'localReward') &&
    finding.origin.occurrenceId === group.occurrenceId &&
    finding.origin.groupKey === group.groupKey
  );
}

function hubSideSupport(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  sideRoom: LocalChildAddress,
  biome: CandidateBiomeEvaluation | undefined,
): HubSideRoomGenerationSupportEntry | undefined {
  const support = biome?.roomGeneration.hub.sideRoomGenerations.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(sideRoom),
  );
  if (support !== undefined) return support;
  const repair = hubRegionRepairForSideRoom(catalog, project, evaluation, sideRoom, biome);
  return repair?.roomGeneration.hub.sideRoomGenerations.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(sideRoom),
  );
}

function candidateHubDecision(
  biome: CandidateBiomeEvaluation | undefined,
): CanonicalHubDecision | undefined {
  const decisions =
    biome === undefined
      ? undefined
      : 'snapshot' in biome
        ? biome.snapshot.decisions
        : biome.materializedPrefix.decisions;
  return decisions?.find((decision): decision is CanonicalHubDecision => decision.kind === 'hub');
}

/** Bound a visit to the Hub prefix reached before the first blocking owner. */
function progressiveHubVisitReached(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  visit: HubVisitAddress,
): boolean {
  const biome = candidateBiome(catalog, project, evaluation, visit.routeKey, visit.biomeKey);
  if (candidateBlockedAt(biome) === undefined) return true;
  const hub = candidateHubDecision(biome);
  return (
    hub?.visits.some(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(visit),
    ) ?? false
  );
}

/** Bound a local group to the entered local prefix of its reached Hub visit. */
function progressiveHubLocalGroupReached(
  group: LocalChildGroupAddress,
  biome: CandidateBiomeEvaluation | undefined,
): boolean {
  if (candidateBlockedAt(biome) === undefined) return true;
  const hub = candidateHubDecision(biome);
  return (
    hub?.visits.some((visit) =>
      visit.localSlots.some(
        (slot) =>
          slot.origin.occurrenceId === group.occurrenceId && slot.groupKey === group.groupKey,
      ),
    ) ?? false
  );
}

export function evaluateHubSlotCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: HubSlotCandidateQuery,
): HubSlotCandidateEvaluation {
  if (typeof query.open !== 'boolean') {
    throw new CandidateEvaluationContractError('Hub slot candidate open must be a boolean');
  }
  const state = candidateHubState(
    catalog,
    project,
    query.slot.routeKey,
    query.slot.biomeKey,
    query.slot.hubKey,
  );
  if (state === undefined) {
    return unavailableForBiome(
      evaluation,
      query.slot.routeKey,
      query.slot.biomeKey,
      query.slot,
      'afterTargetGeneration',
    );
  }
  if (!state.descriptor.slots.some((slot) => slot.slotKey === query.slot.hubSlotKey)) {
    throw new CandidateEvaluationContractError(`unknown Hub slot ${query.slot.hubSlotKey}`);
  }
  const current = state.decision.openTargets.find(
    (target) => target.hubSlotKey === query.slot.hubSlotKey,
  );
  const closesReferencedSlot =
    !query.open &&
    current !== undefined &&
    state.decision.visitOrder.includes(query.slot.hubSlotKey);
  if (query.open && current === undefined) {
    if (typeof query.occurrenceId !== 'string' || query.occurrenceId.trim().length === 0) {
      throw new CandidateEvaluationContractError(
        'Hub slot candidate occurrenceId must be non-blank',
      );
    }
    if (
      state.topology.occurrences.some(
        (occurrence) => occurrence.occurrenceId === query.occurrenceId,
      )
    ) {
      throw new CandidateEvaluationContractError(
        `Hub slot candidate occurrence ${query.occurrenceId} already exists`,
      );
    }
  }
  const findings = hubCandidateFindings(query, state);
  const openSlotKeys = Object.freeze(
    state.descriptor.slots.flatMap((slot) =>
      state.decision.openTargets.some((target) => target.hubSlotKey === slot.slotKey)
        ? [slot.slotKey]
        : [],
    ),
  );
  return Object.freeze({
    kind: 'hubSlot',
    result: Object.freeze({
      candidateOpen: query.open,
      currentlyOpen: current !== undefined,
      openSlotKeys,
      minimumOpenCount: state.descriptor.openCount.min,
      maximumOpenCount: state.descriptor.openCount.max,
      referencedVisitIndexes: Object.freeze(
        state.decision.visitOrder.flatMap((slotKey, index) =>
          slotKey === query.slot.hubSlotKey ? [index + 1] : [],
        ),
      ),
      findings,
      selectedPossible: !closesReferencedSlot && findings.length === 0,
    }),
  });
}

export function evaluateHubVisitCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: HubVisitCandidateQuery,
): HubVisitCandidateEvaluation {
  if (!progressiveHubVisitReached(catalog, project, evaluation, query.visit)) {
    return coverageUnavailable(evaluation, query.visit, 'afterTargetGeneration');
  }
  const state = candidateHubState(
    catalog,
    project,
    query.visit.routeKey,
    query.visit.biomeKey,
    query.visit.hubKey,
  );
  if (state === undefined) {
    return unavailableForBiome(
      evaluation,
      query.visit.routeKey,
      query.visit.biomeKey,
      query.visit,
      'afterTargetGeneration',
    );
  }
  if (!state.descriptor.slots.some((slot) => slot.slotKey === query.hubSlotKey)) {
    throw new CandidateEvaluationContractError(`unknown Hub slot ${query.hubSlotKey}`);
  }
  if (query.visit.visitIndex > state.descriptor.requiredVisits) {
    throw new CandidateEvaluationContractError(
      `Hub visit ${query.visit.visitIndex} exceeds ${state.descriptor.requiredVisits} visits`,
    );
  }
  const visitIndex = query.visit.visitIndex - 1;
  const currentHubSlotKey = state.decision.visitOrder[visitIndex];
  if (
    currentHubSlotKey === undefined &&
    query.visit.visitIndex !== state.decision.visitOrder.length + 1
  ) {
    return unreachableTarget(query.visit);
  }
  const openHubSlotKeys = Object.freeze(
    state.descriptor.slots.flatMap((slot) =>
      state.decision.openTargets.some((target) => target.hubSlotKey === slot.slotKey)
        ? [slot.slotKey]
        : [],
    ),
  );
  const occupiedVisitIndexes = Object.freeze(
    state.decision.visitOrder.flatMap((slotKey, index) =>
      slotKey === query.hubSlotKey ? [index + 1] : [],
    ),
  );
  const structurallyPossible =
    openHubSlotKeys.includes(query.hubSlotKey) &&
    occupiedVisitIndexes.every((index) => index === query.visit.visitIndex);
  const command =
    currentHubSlotKey === undefined
      ? ({ kind: 'AppendHubVisit', visit: query.visit, hubSlotKey: query.hubSlotKey } as const)
      : ({ kind: 'ReplaceHubVisit', visit: query.visit, hubSlotKey: query.hubSlotKey } as const);
  const proposal = structurallyPossible
    ? hubCandidateProposal(catalog, project, command)
    : undefined;
  const targetOccurrenceId = proposal?.routes
    .find((route) => route.routeKey === query.visit.routeKey)
    ?.biomes.find((biome) => biome.biomeKey === query.visit.biomeKey)
    ?.topology?.decisions.find(
      (decision): decision is HubDecision =>
        decision.kind === 'hub' && decision.hubKey === query.visit.hubKey,
    )
    ?.openTargets.find((target) => target.hubSlotKey === query.hubSlotKey)?.occurrenceId;
  const regional =
    proposal === undefined || targetOccurrenceId === undefined
      ? undefined
      : hubRegionEvaluation(
          catalog,
          proposal,
          evaluation,
          query.visit.routeKey,
          query.visit.biomeKey,
          query.visit.hubKey,
          query.visit.visitIndex,
        );
  const findings = Object.freeze(
    targetOccurrenceId === undefined
      ? []
      : (regional?.findings ?? []).filter((finding) =>
          findingOwnsOccurrence(finding, targetOccurrenceId),
        ),
  );
  return Object.freeze({
    kind: 'hubVisit',
    result: Object.freeze({
      candidateHubSlotKey: query.hubSlotKey,
      openHubSlotKeys,
      occupiedVisitIndexes,
      findings,
      // Downstream room-local work is feedback, not a reason to reject an
      // otherwise distinct open Hub slot from authored visit order.
      selectedPossible: structurallyPossible && proposal !== undefined,
    }),
  });
}

export function evaluateSideRoomGenerationCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: SideRoomGenerationCandidateQuery,
): SideRoomGenerationCandidateEvaluation {
  const localGroup: LocalChildGroupAddress = Object.freeze({
    kind: 'localChildGroup',
    routeKey: query.sideRoom.routeKey,
    biomeKey: query.sideRoom.biomeKey,
    occurrenceId: query.sideRoom.occurrenceId,
    groupKey: query.sideRoom.groupKey,
  });
  const biome = candidateBiome(
    catalog,
    project,
    evaluation,
    query.sideRoom.routeKey,
    query.sideRoom.biomeKey,
  );
  const baseline = hubSideSupport(catalog, project, evaluation, query.sideRoom, biome);
  if (!progressiveHubLocalGroupReached(localGroup, biome) && baseline === undefined) {
    return coverageUnavailable(evaluation, query.sideRoom, 'afterTargetGeneration');
  }
  const plan = planFor(project, query.sideRoom.routeKey, query.sideRoom.biomeKey);
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === query.sideRoom.occurrenceId,
  );
  if (occurrence?.state.kind !== 'ephyraCombat') {
    return unavailableForBiome(
      evaluation,
      query.sideRoom.routeKey,
      query.sideRoom.biomeKey,
      query.sideRoom,
      'afterTargetGeneration',
    );
  }
  const room = catalog.rooms.byKey[occurrence.gameName];
  const group = room?.localChildren.find((candidate) => candidate.key === query.sideRoom.groupKey);
  const sideState = occurrence.state;
  const sideRoom = sideState.sideRooms[query.sideRoom.slotKey];
  if (group?.kind !== 'fixedRoomSlots' || sideRoom === undefined) {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(query.sideRoom)} has no declared Ephyra side-room state`,
    );
  }
  if (query.generation !== 'generated' && query.generation !== 'notGenerated') {
    throw new CandidateEvaluationContractError(
      `unknown side-room generation ${String(query.generation)}`,
    );
  }
  if (baseline === undefined) {
    return coverageUnavailable(evaluation, query.sideRoom, 'afterTargetGeneration');
  }
  const structurallyPossible = query.generation === 'generated' || sideRoom.enteredOrdinal === null;
  const proposal =
    structurallyPossible && sideRoom.generation !== query.generation
      ? hubCandidateProposal(catalog, project, {
          kind: 'ReplaceSideRoomGeneration',
          sideRoom: query.sideRoom,
          generation: query.generation,
        })
      : structurallyPossible
        ? project
        : undefined;
  const regional =
    proposal === undefined
      ? undefined
      : (() => {
          const descriptor = catalog.biomeLayouts.byKey[plan.biomeKey]?.progression;
          if (descriptor?.kind !== 'hub') {
            throw new CandidateEvaluationContractError(
              `${plan.biomeKey} has no Hub candidate domain`,
            );
          }
          return hubRegionEvaluation(
            catalog,
            proposal,
            evaluation,
            query.sideRoom.routeKey,
            query.sideRoom.biomeKey,
            descriptor.hubKey,
            baseline.visitIndex,
          );
        })();
  const findings = Object.freeze(
    (regional?.findings ?? []).filter(
      (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(query.sideRoom),
    ),
  );
  return Object.freeze({
    kind: 'sideRoomGeneration',
    result: Object.freeze({
      candidateGeneration: query.generation,
      enteredOrdinal: sideRoom.enteredOrdinal,
      generatedBefore: baseline.generatedBefore,
      requiredGeneratedCount: baseline.requiredGeneratedCount,
      supportOutcomes: baseline.supportOutcomes,
      findings,
      selectedPossible:
        structurallyPossible &&
        baseline.supportOutcomes.includes(query.generation) &&
        findings.length === 0,
    }),
  });
}

export function evaluateSideRoomEntryOrderCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: SideRoomEntryOrderCandidateQuery,
): SideRoomEntryOrderCandidateEvaluation {
  const biome = candidateBiome(
    catalog,
    project,
    evaluation,
    query.group.routeKey,
    query.group.biomeKey,
  );
  if (!progressiveHubLocalGroupReached(query.group, biome)) {
    return coverageUnavailable(evaluation, query.group, 'afterRoomLifecycle');
  }
  const plan = planFor(project, query.group.routeKey, query.group.biomeKey);
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === query.group.occurrenceId,
  );
  if (occurrence?.state.kind !== 'ephyraCombat') {
    return unavailableForBiome(
      evaluation,
      query.group.routeKey,
      query.group.biomeKey,
      query.group,
      'afterRoomLifecycle',
    );
  }
  const sideState = occurrence.state;
  const room = catalog.rooms.byKey[occurrence.gameName];
  const group = room?.localChildren.find((candidate) => candidate.key === query.group.groupKey);
  if (group?.kind !== 'fixedRoomSlots') {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(query.group)} has no declared Ephyra side-room group`,
    );
  }
  if (new Set(query.enteredSlotKeys).size !== query.enteredSlotKeys.length) {
    throw new CandidateEvaluationContractError('side-room entry order must contain distinct slots');
  }
  const generatedSlotKeys = Object.freeze(
    group.slots.flatMap((slot) =>
      sideState.sideRooms[slot.slotKey]?.generation === 'generated' ? [slot.slotKey] : [],
    ),
  );
  let includesUngeneratedSlot = false;
  for (const slotKey of query.enteredSlotKeys) {
    if (!group.slots.some((slot) => slot.slotKey === slotKey)) {
      throw new CandidateEvaluationContractError(`unknown side-room slot ${slotKey}`);
    }
    if (sideState.sideRooms[slotKey]?.generation !== 'generated') includesUngeneratedSlot = true;
  }
  if (includesUngeneratedSlot) {
    return Object.freeze({
      kind: 'sideRoomEntryOrder',
      result: Object.freeze({
        candidateEnteredSlotKeys: Object.freeze([...query.enteredSlotKeys]),
        generatedSlotKeys,
        findings: Object.freeze([]),
        selectedPossible: false,
      }),
    });
  }
  const descriptor = catalog.biomeLayouts.byKey[plan.biomeKey]?.progression;
  if (descriptor?.kind !== 'hub') {
    throw new CandidateEvaluationContractError(`${plan.biomeKey} has no Hub candidate domain`);
  }
  const hub = candidateHubState(
    catalog,
    project,
    query.group.routeKey,
    query.group.biomeKey,
    descriptor.hubKey,
  );
  const hubSlotKey = hub?.decision.openTargets.find(
    (target) => target.occurrenceId === query.group.occurrenceId,
  )?.hubSlotKey;
  const visitIndex =
    hubSlotKey === undefined ? undefined : (hub?.decision.visitOrder.indexOf(hubSlotKey) ?? -1);
  if (hub === undefined || visitIndex === undefined || visitIndex < 0) {
    return coverageUnavailable(evaluation, query.group, 'afterRoomLifecycle');
  }
  const proposal = hubCandidateProposal(catalog, project, {
    kind: 'ReplaceSideRoomEntryOrder',
    group: query.group,
    enteredSlotKeys: query.enteredSlotKeys,
  });
  const regional =
    proposal === undefined
      ? undefined
      : hubRegionEvaluation(
          catalog,
          proposal,
          evaluation,
          query.group.routeKey,
          query.group.biomeKey,
          hub.descriptor.hubKey,
          visitIndex + 1,
        );
  const findings = Object.freeze(
    (regional?.findings ?? []).filter((finding) => findingOwnsLocalGroup(finding, query.group)),
  );
  return Object.freeze({
    kind: 'sideRoomEntryOrder',
    result: Object.freeze({
      candidateEnteredSlotKeys: Object.freeze([...query.enteredSlotKeys]),
      generatedSlotKeys,
      findings,
      selectedPossible: proposal !== undefined && findings.length === 0,
    }),
  });
}
