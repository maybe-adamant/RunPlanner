import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createHubOpenSetAddress,
  semanticAddressKey,
  type HubDecisionAddress,
  type HubSlotAddress,
  type LocalVisitSlotAddress,
  type LocalVisitOrderAddress,
} from '../../authored-project/addresses';
import {
  applyProjectCommand,
  ProjectCommandContractError,
} from '../../authored-project/commands/dispatch';
import type {
  HubDecision,
  LocalVisitDecision,
  OccurrenceId,
  ProjectDocument,
} from '../../authored-project/model';
import {
  evaluateHubOpenSetConstraints,
  type HubSideRoomGenerationSupportEntry,
} from '../generation';
import type { CanonicalHubDecision } from '../materialization';
import type { SemanticFinding } from '../model';
import type { ProjectEvaluation } from '../evaluation-products';
import {
  evaluateProgressiveBiome,
  evaluateProgressiveBiomeBeforeClamp,
} from '../progressive/biome';
import { ownsOccurrence } from '../progressive/finding-location';
import { effectiveRouteResourcePlacements } from '../resources';
import {
  coverageUnavailable,
  unavailableForBiome,
  type CandidateContextUnavailable,
} from './availability';
import { CandidateEvaluationContractError } from './contract';
import {
  candidateBiome,
  candidateBlockedAt,
  completeBiomeCount,
  planFor,
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
  readonly localOccurrenceIdsBySlot: Readonly<Record<string, OccurrenceId>>;
}

export interface HubVisitOrderCandidateQuery {
  readonly kind: 'hubVisitOrder';
  readonly hub: HubDecisionAddress;
  readonly hubSlotKeys: readonly string[];
}

export interface SideRoomGenerationCandidateQuery {
  readonly kind: 'sideRoomGeneration';
  readonly sideRoom: LocalVisitSlotAddress;
  readonly generation: 'generated' | 'notGenerated';
}

export interface SideRoomEntryOrderCandidateQuery {
  readonly kind: 'sideRoomEntryOrder';
  readonly group: LocalVisitOrderAddress;
  readonly occurrenceIds: readonly OccurrenceId[];
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

export interface HubVisitOrderCandidateSupport {
  readonly candidateHubSlotKeys: readonly string[];
  readonly openHubSlotKeys: readonly string[];
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedHubVisitOrderCandidate {
  readonly kind: 'hubVisitOrder';
  readonly result: HubVisitOrderCandidateSupport;
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
export type HubVisitOrderCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedHubVisitOrderCandidate;
export type SideRoomGenerationCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedSideRoomGenerationCandidate;
export type SideRoomEntryOrderCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedSideRoomEntryOrderCandidate;

interface CandidateHubState {
  readonly descriptor: Extract<
    Catalog['biomeLayouts']['values'][number]['progression'],
    { readonly kind: 'hub' }
  >;
  readonly plan: ProjectDocument['route']['biomes'][number];
  readonly topology: NonNullable<ProjectDocument['route']['biomes'][number]['topology']>;
  readonly decision: HubDecision;
}

function previousCompleteValidBiome(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
) {
  const route = evaluation.route.routeKey === routeKey ? evaluation.route : undefined;
  const index = route?.biomes.findIndex((candidate) => candidate.biomeKey === biomeKey) ?? -1;
  if (index <= 0 || route === undefined) return undefined;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = route.biomes[cursor];
    if (candidate?.authoring === 'complete' && candidate.validity === 'valid') return candidate;
  }
  return undefined;
}

/** Context for the Hub's bounded authored-alternative replay only. */
function hubAlternativeContext(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
) {
  const route = project.route.routeKey === routeKey ? project.route : undefined;
  if (route === undefined) {
    throw new CandidateEvaluationContractError(`project has no configured ${routeKey} route`);
  }
  const previous = previousCompleteValidBiome(evaluation, routeKey, biomeKey);
  return Object.freeze({
    enteredBiomeCount: completeBiomeCount(evaluation, routeKey, biomeKey),
    loadout: route.loadout,
    resourcePlacements: effectiveRouteResourcePlacements(catalog, route),
    ...(previous === undefined
      ? {}
      : {
          seed: Object.freeze({
            history: previous.history,
            rewardBranches: previous.rewards.branches,
          }),
        }),
  });
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
    hubAlternativeContext(catalog, project, evaluation, routeKey, biomeKey),
  );
}

/**
 * Replays an aggregate Hub proposal before clamping so candidate evidence
 * retains every affected visit and room-local finding, not only the first
 * currently reachable visit.
 */
function hubVisitOrderEvaluation(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
  hubKey: string,
  visitCount: number,
) {
  const regionalPlan = hubRegionalPlan(project, routeKey, biomeKey, hubKey, visitCount);
  if (regionalPlan === undefined) return undefined;
  return evaluateProgressiveBiomeBeforeClamp(
    catalog,
    createBiomeAddress(routeKey, biomeKey),
    regionalPlan,
    hubAlternativeContext(catalog, project, evaluation, routeKey, biomeKey),
  );
}

function findingOwnsHubVisitOrder(
  finding: SemanticFinding,
  occurrenceIds: ReadonlySet<OccurrenceId>,
  visitOrigins: ReadonlySet<string>,
): boolean {
  return (
    visitOrigins.has(semanticAddressKey(finding.origin)) ||
    findingOwnsAnyOccurrence(finding, occurrenceIds) ||
    ('sourceOccurrenceId' in finding.origin && occurrenceIds.has(finding.origin.sourceOccurrenceId))
  );
}

function findingOwnsAnyOccurrence(
  finding: SemanticFinding,
  occurrenceIds: ReadonlySet<OccurrenceId>,
): boolean {
  for (const occurrenceId of occurrenceIds) {
    if (ownsOccurrence(finding.origin, occurrenceId)) return true;
  }
  return false;
}

function findingOwnsLocalGroup(
  finding: SemanticFinding,
  group: LocalVisitOrderAddress,
  localOccurrenceIds: ReadonlySet<OccurrenceId>,
): boolean {
  return (
    (semanticAddressKey(finding.origin) === semanticAddressKey(group) ||
      (finding.origin.kind === 'localVisitSlot' &&
        finding.origin.sourceOccurrenceId === group.sourceOccurrenceId) ||
      findingOwnsAnyOccurrence(finding, localOccurrenceIds)) &&
    ('groupKey' in finding.origin ? finding.origin.groupKey === group.groupKey : true)
  );
}

function hubSideSupport(
  sideRoom: LocalVisitSlotAddress,
  biome: CandidateBiomeEvaluation | undefined,
): HubSideRoomGenerationSupportEntry | undefined {
  return biome?.roomGeneration.hub.sideRoomGenerations.find(
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

/** Bound a local group to the entered local prefix of its reached Hub visit. */
function progressiveHubLocalGroupReached(
  group: LocalVisitOrderAddress,
  biome: CandidateBiomeEvaluation | undefined,
): boolean {
  if (candidateBlockedAt(biome) === undefined) return true;
  const hub = candidateHubDecision(biome);
  return (
    hub?.visits.some((visit) =>
      visit.localSlots.some(
        (slot) =>
          slot.localVisit.origin.sourceOccurrenceId === group.sourceOccurrenceId &&
          slot.localVisit.groupKey === group.groupKey,
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
    const hubSlot = state.descriptor.slots.find((slot) => slot.slotKey === query.slot.hubSlotKey);
    const room = hubSlot === undefined ? undefined : catalog.rooms.byKey[hubSlot.roomGameName];
    const localSlots = room?.localChildren[0];
    const expectedLocalKeys =
      localSlots?.kind === 'fixedRoomSlots' ? localSlots.slots.map((slot) => slot.slotKey) : [];
    const suppliedLocalKeys = Object.keys(query.localOccurrenceIdsBySlot);
    if (
      suppliedLocalKeys.length !== expectedLocalKeys.length ||
      suppliedLocalKeys.some((key) => !expectedLocalKeys.includes(key)) ||
      new Set([query.occurrenceId, ...Object.values(query.localOccurrenceIdsBySlot)]).size !==
        expectedLocalKeys.length + 1
    ) {
      throw new CandidateEvaluationContractError(
        'Hub slot candidate local occurrence identities must match its declaration',
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

export function evaluateHubVisitOrderCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: HubVisitOrderCandidateQuery,
): HubVisitOrderCandidateEvaluation {
  const state = candidateHubState(
    catalog,
    project,
    query.hub.routeKey,
    query.hub.biomeKey,
    query.hub.hubKey,
  );
  if (state === undefined) {
    return unavailableForBiome(
      evaluation,
      query.hub.routeKey,
      query.hub.biomeKey,
      query.hub,
      'afterTargetGeneration',
    );
  }
  if (
    !Array.isArray(query.hubSlotKeys) ||
    !query.hubSlotKeys.every((hubSlotKey) => typeof hubSlotKey === 'string')
  ) {
    throw new CandidateEvaluationContractError('Hub visit order must contain slot keys');
  }
  if (candidateBiome(evaluation, query.hub.routeKey, query.hub.biomeKey) === undefined) {
    return unavailableForBiome(
      evaluation,
      query.hub.routeKey,
      query.hub.biomeKey,
      query.hub,
      'afterTargetGeneration',
    );
  }
  const candidateHubSlotKeys = Object.freeze([...query.hubSlotKeys]);
  const openHubSlotKeys = Object.freeze(
    state.descriptor.slots.flatMap((slot) =>
      state.decision.openTargets.some((target) => target.hubSlotKey === slot.slotKey)
        ? [slot.slotKey]
        : [],
    ),
  );
  const structurallyPossible =
    candidateHubSlotKeys.length <= state.descriptor.requiredVisits &&
    new Set(candidateHubSlotKeys).size === candidateHubSlotKeys.length &&
    candidateHubSlotKeys.every((hubSlotKey) => openHubSlotKeys.includes(hubSlotKey));
  const proposal = structurallyPossible
    ? hubCandidateProposal(catalog, project, {
        kind: 'ReplaceHubVisitOrder',
        hub: query.hub,
        hubSlotKeys: candidateHubSlotKeys,
      })
    : undefined;
  const regional =
    proposal === undefined
      ? undefined
      : hubVisitOrderEvaluation(
          catalog,
          proposal,
          evaluation,
          query.hub.routeKey,
          query.hub.biomeKey,
          query.hub.hubKey,
          candidateHubSlotKeys.length,
        );
  const mainOccurrenceIds = new Set<OccurrenceId>(
    candidateHubSlotKeys.flatMap((hubSlotKey) =>
      state.decision.openTargets
        .filter((target) => target.hubSlotKey === hubSlotKey)
        .map((target) => target.occurrenceId),
    ),
  );
  const occurrenceIds = new Set<OccurrenceId>([
    ...mainOccurrenceIds,
    ...state.topology.decisions.flatMap((decision) =>
      decision.kind === 'localVisit' && mainOccurrenceIds.has(decision.sourceOccurrenceId)
        ? Object.values(decision.targetsBySlot).map((target) => target.occurrenceId)
        : [],
    ),
  ]);
  const visitOrigins = new Set(
    regional?.materializedPrefix.decisions
      .find(
        (decision): decision is CanonicalHubDecision =>
          decision.kind === 'hub' && decision.origin.hubKey === query.hub.hubKey,
      )
      ?.visits.map((visit) => semanticAddressKey(visit.origin)) ?? [],
  );
  const findings = Object.freeze(
    (regional?.findings ?? []).filter((finding) =>
      findingOwnsHubVisitOrder(finding, occurrenceIds, visitOrigins),
    ),
  );
  return Object.freeze({
    kind: 'hubVisitOrder',
    result: Object.freeze({
      candidateHubSlotKeys,
      openHubSlotKeys,
      findings,
      // Downstream room-local work is feedback, not a reason to reject an
      // otherwise distinct open Hub visit order from authorship.
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
  const localGroup: LocalVisitOrderAddress = Object.freeze({
    kind: 'localVisitOrder',
    routeKey: query.sideRoom.routeKey,
    biomeKey: query.sideRoom.biomeKey,
    sourceOccurrenceId: query.sideRoom.sourceOccurrenceId,
    groupKey: query.sideRoom.groupKey,
  });
  const biome = candidateBiome(evaluation, query.sideRoom.routeKey, query.sideRoom.biomeKey);
  const baseline = hubSideSupport(query.sideRoom, biome);
  if (!progressiveHubLocalGroupReached(localGroup, biome) && baseline === undefined) {
    return coverageUnavailable(evaluation, query.sideRoom, 'afterTargetGeneration');
  }
  const plan = planFor(project, query.sideRoom.routeKey, query.sideRoom.biomeKey);
  const localDecision = plan.topology?.decisions.find(
    (candidate): candidate is LocalVisitDecision =>
      candidate.kind === 'localVisit' &&
      candidate.sourceOccurrenceId === query.sideRoom.sourceOccurrenceId &&
      candidate.groupKey === query.sideRoom.groupKey,
  );
  if (localDecision === undefined) {
    return unavailableForBiome(
      evaluation,
      query.sideRoom.routeKey,
      query.sideRoom.biomeKey,
      query.sideRoom,
      'afterTargetGeneration',
    );
  }
  const target = localDecision.targetsBySlot[query.sideRoom.slotKey];
  if (target === undefined) {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(query.sideRoom)} has no declared local visit slot`,
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
  const enteredOrdinal = localDecision.visitOrder.indexOf(target.occurrenceId);
  const structurallyPossible = query.generation === 'generated' || enteredOrdinal < 0;
  const proposal =
    structurallyPossible && target.generation !== query.generation
      ? hubCandidateProposal(catalog, project, {
          kind: 'SetLocalVisitGeneration',
          slot: query.sideRoom,
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
      enteredOrdinal: enteredOrdinal < 0 ? null : enteredOrdinal + 1,
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
  const biome = candidateBiome(evaluation, query.group.routeKey, query.group.biomeKey);
  if (!progressiveHubLocalGroupReached(query.group, biome)) {
    return coverageUnavailable(evaluation, query.group, 'afterRoomLifecycle');
  }
  const plan = planFor(project, query.group.routeKey, query.group.biomeKey);
  const localDecision = plan.topology?.decisions.find(
    (candidate): candidate is LocalVisitDecision =>
      candidate.kind === 'localVisit' &&
      candidate.sourceOccurrenceId === query.group.sourceOccurrenceId &&
      candidate.groupKey === query.group.groupKey,
  );
  const occurrence = plan.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === query.group.sourceOccurrenceId,
  );
  if (occurrence === undefined || localDecision === undefined) {
    return unavailableForBiome(
      evaluation,
      query.group.routeKey,
      query.group.biomeKey,
      query.group,
      'afterRoomLifecycle',
    );
  }
  const room = catalog.rooms.byKey[occurrence.gameName];
  const group = room?.localChildren.find((candidate) => candidate.key === query.group.groupKey);
  if (group?.kind !== 'fixedRoomSlots') {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(query.group)} has no declared Ephyra side-room group`,
    );
  }
  if (new Set(query.occurrenceIds).size !== query.occurrenceIds.length) {
    throw new CandidateEvaluationContractError(
      'local visit order must contain distinct occurrences',
    );
  }
  const generatedSlotKeys = Object.freeze(
    group.slots.flatMap((slot) =>
      localDecision.targetsBySlot[slot.slotKey]?.generation === 'generated' ? [slot.slotKey] : [],
    ),
  );
  let includesUngeneratedSlot = false;
  for (const occurrenceId of query.occurrenceIds) {
    const target = Object.values(localDecision.targetsBySlot).find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    );
    if (target === undefined) {
      throw new CandidateEvaluationContractError(`unknown local occurrence ${occurrenceId}`);
    }
    if (target.generation !== 'generated') includesUngeneratedSlot = true;
  }
  if (includesUngeneratedSlot) {
    return Object.freeze({
      kind: 'sideRoomEntryOrder',
      result: Object.freeze({
        candidateEnteredSlotKeys: Object.freeze(
          query.occurrenceIds.flatMap((occurrenceId) => {
            const entry = Object.entries(localDecision.targetsBySlot).find(
              ([, target]) => target.occurrenceId === occurrenceId,
            );
            return entry === undefined ? [] : [entry[0]];
          }),
        ),
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
    (target) => target.occurrenceId === query.group.sourceOccurrenceId,
  )?.hubSlotKey;
  const visitIndex =
    hubSlotKey === undefined ? undefined : (hub?.decision.visitOrder.indexOf(hubSlotKey) ?? -1);
  if (hub === undefined || visitIndex === undefined || visitIndex < 0) {
    return coverageUnavailable(evaluation, query.group, 'afterRoomLifecycle');
  }
  const proposal = hubCandidateProposal(catalog, project, {
    kind: 'ReplaceLocalVisitOrder',
    order: query.group,
    occurrenceIds: query.occurrenceIds,
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
  const localOccurrenceIds = new Set<OccurrenceId>(
    Object.values(localDecision.targetsBySlot).map((target) => target.occurrenceId),
  );
  const findings = Object.freeze(
    (regional?.findings ?? []).filter((finding) =>
      findingOwnsLocalGroup(finding, query.group, localOccurrenceIds),
    ),
  );
  return Object.freeze({
    kind: 'sideRoomEntryOrder',
    result: Object.freeze({
      candidateEnteredSlotKeys: Object.freeze(
        query.occurrenceIds.flatMap((occurrenceId) => {
          const entry = Object.entries(localDecision.targetsBySlot).find(
            ([, target]) => target.occurrenceId === occurrenceId,
          );
          return entry === undefined ? [] : [entry[0]];
        }),
      ),
      generatedSlotKeys,
      findings,
      selectedPossible: proposal !== undefined && findings.length === 0,
    }),
  });
}
