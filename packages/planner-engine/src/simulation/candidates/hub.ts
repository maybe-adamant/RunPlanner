import {
  createBiomeAddress,
  createHubOpenSetAddress,
  semanticAddressKey,
} from '../../authored-project/addresses';
import type { HubBiomePlan, ProjectDocument } from '../../authored-project/model';
import type { Catalog, HubBiomeLayout } from '../../catalog-schema';
import { evaluateHubOpenSetConstraints } from '../generation';
import type { SemanticFinding } from '../model';
import { evaluateProgressiveHubBiome } from '../progressive/hub';
import type {
  HubSlotCandidateQuery,
  HubVisitCandidateQuery,
  ProjectCandidateEvaluation,
  ProjectCandidateQuery,
  SideRoomEntryOrderCandidateQuery,
  SideRoomGenerationCandidateQuery,
} from './model';

import {
  applyCandidateCommand,
  coverageNotReached,
  failCandidate,
  immutableQuery,
  isCandidateContextUnavailable,
  locateCandidateHub,
  locateHubBiomePlan,
  observeCandidateRegionReplay,
  queryAddress,
  unavailableCandidate,
  type PreparedHubBoardCandidateContext,
  type PreparedHubLocalCandidateContext,
  type PreparedHubVisitCandidateContext,
  type PreparedCandidateContext,
} from './context';

function requireHubBoardContext(
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): PreparedHubBoardCandidateContext {
  const address = queryAddress(query);
  const prepared = context.index.hubBoardsByOwner.get(
    semanticAddressKey(
      createHubOpenSetAddress(createBiomeAddress(address.routeKey, address.biomeKey)),
    ),
  );
  if (prepared === undefined) {
    failCandidate(query, `${address.biomeKey} has no prepared Hub candidate domain`);
  }
  return prepared;
}

function requireHubVisitContext(
  context: PreparedCandidateContext,
  query: HubVisitCandidateQuery,
): PreparedHubVisitCandidateContext {
  const prepared = context.index.hubVisitsByOwner.get(semanticAddressKey(query.visit));
  if (prepared === undefined) {
    failCandidate(query, `unknown Hub visit ${query.visit.visitIndex}`);
  }
  return prepared;
}

function hubOpenSetFinding(
  query: HubSlotCandidateQuery,
  layout: HubBiomeLayout,
  actualCount: number,
): SemanticFinding {
  return Object.freeze({
    code: 'hubOpenSetIncomplete',
    severity: 'error',
    phase: 'completeness',
    origin: createHubOpenSetAddress(createBiomeAddress(query.slot.routeKey, query.slot.biomeKey)),
    evidence: Object.freeze({
      actualCount,
      minimumCount: layout.hub.openCount.min,
      maximumCount: layout.hub.openCount.max,
    }),
  });
}

function hubSlotOutcome(
  query: HubSlotCandidateQuery,
  context: PreparedHubBoardCandidateContext,
  open: boolean,
): { readonly findings: readonly SemanticFinding[] } | undefined {
  const { layout, occurrenceIds, openHubSlotKeys, openHubSlotKeySet, visitedHubSlotKeys } = context;
  const currentlyOpen = openHubSlotKeySet.has(query.slot.hubSlotKey);
  if (
    open !== currentlyOpen &&
    ((open && openHubSlotKeys.length >= layout.hub.openCount.max) ||
      (!open && visitedHubSlotKeys.has(query.slot.hubSlotKey)))
  ) {
    return undefined;
  }
  if (open !== currentlyOpen && open) {
    if (typeof query.occurrenceId !== 'string' || query.occurrenceId.trim().length === 0) {
      failCandidate(query, 'occurrenceId must be a non-blank string');
    }
    if (occurrenceIds.has(query.occurrenceId)) {
      failCandidate(query, `occurrence ${query.occurrenceId} already exists`);
    }
  }
  const candidateOpenSlotKeys =
    open === currentlyOpen
      ? openHubSlotKeys
      : open
        ? [...openHubSlotKeys, query.slot.hubSlotKey]
        : openHubSlotKeys.filter((hubSlotKey) => hubSlotKey !== query.slot.hubSlotKey);
  if (
    candidateOpenSlotKeys.length < layout.hub.openCount.min ||
    candidateOpenSlotKeys.length > layout.hub.openCount.max
  ) {
    return Object.freeze({
      findings: Object.freeze([hubOpenSetFinding(query, layout, candidateOpenSlotKeys.length)]),
    });
  }
  const candidateOpenSlotKeySet = new Set(candidateOpenSlotKeys);
  const canonicalOpenSlotKeys = layout.hub.slots.flatMap((slot) =>
    candidateOpenSlotKeySet.has(slot.slotKey) ? [slot.slotKey] : [],
  );
  const constraints = evaluateHubOpenSetConstraints(
    layout,
    createBiomeAddress(query.slot.routeKey, query.slot.biomeKey),
    canonicalOpenSlotKeys,
  );
  return Object.freeze({
    findings: Object.freeze(
      constraints.findings.filter(
        (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(query.slot),
      ),
    ),
  });
}

export function evaluateHubSlotCandidate(
  context: PreparedCandidateContext,
  query: HubSlotCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as HubSlotCandidateQuery;
  if (typeof stableQuery.open !== 'boolean') {
    failCandidate(stableQuery, 'open must be a boolean');
  }
  const baseline = locateCandidateHub(context, stableQuery);
  if (isCandidateContextUnavailable(baseline)) {
    return unavailableCandidate(stableQuery, baseline);
  }
  const boardContext = requireHubBoardContext(context, stableQuery);
  const { layout, plan, openHubSlotKeys } = boardContext;
  const slot = layout.hub.slots.find(
    (candidate) => candidate.slotKey === stableQuery.slot.hubSlotKey,
  );
  if (slot === undefined) {
    failCandidate(stableQuery, `unknown Hub slot ${stableQuery.slot.hubSlotKey}`);
  }
  if (baseline.authoring === 'incomplete' && baseline.materializedPrefix.hubBoard === undefined) {
    return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, baseline));
  }
  const topology = plan.topology!;
  const current = topology.openTargets.find(
    (target) => target.hubSlotKey === stableQuery.slot.hubSlotKey,
  );
  const currentlyOpen = current !== undefined;
  const referencedVisitIndexes = Object.freeze(
    topology.visitOrder.flatMap((hubSlotKey, index) =>
      hubSlotKey === stableQuery.slot.hubSlotKey ? [index + 1] : [],
    ),
  );
  const selectedEvaluation = hubSlotOutcome(stableQuery, boardContext, stableQuery.open);
  const findings = selectedEvaluation?.findings ?? Object.freeze([]);
  const selectedPossible = selectedEvaluation !== undefined && findings.length === 0;
  const oppositeEvaluation = hubSlotOutcome(stableQuery, boardContext, !stableQuery.open);
  const oppositePossible =
    oppositeEvaluation !== undefined && oppositeEvaluation.findings.length === 0;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: selectedPossible ? (oppositePossible ? 'possible' : 'forced') : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateOpen: stableQuery.open,
      currentlyOpen,
      openSlotKeys: openHubSlotKeys,
      minimumOpenCount: layout.hub.openCount.min,
      maximumOpenCount: layout.hub.openCount.max,
      referencedVisitIndexes,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

function evaluateHubVisitRegion(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query:
    HubVisitCandidateQuery | SideRoomEntryOrderCandidateQuery | SideRoomGenerationCandidateQuery,
  proposal: ProjectDocument,
  visitIndex: number,
) {
  const plan = locateHubBiomePlan(proposal, query);
  const topology = plan.topology;
  if (topology === null) {
    return failCandidate(query, 'Hub region lost its topology');
  }
  const regionalPlan: HubBiomePlan = Object.freeze({
    ...plan,
    topology: Object.freeze({
      ...topology,
      visitOrder: Object.freeze(topology.visitOrder.slice(0, visitIndex)),
    }),
  });
  const biome = createBiomeAddress(
    query.kind === 'hubVisit'
      ? query.visit.routeKey
      : query.kind === 'sideRoomEntryOrder'
        ? query.group.routeKey
        : query.sideRoom.routeKey,
    query.kind === 'hubVisit'
      ? query.visit.biomeKey
      : query.kind === 'sideRoomEntryOrder'
        ? query.group.biomeKey
        : query.sideRoom.biomeKey,
  );
  const evaluation = evaluateProgressiveHubBiome(catalog, biome, regionalPlan);
  const prefix = evaluation?.materializedPrefix;
  if (evaluation === null || prefix?.hubBoard === undefined) {
    return failCandidate(query, `Hub visit ${visitIndex} has no regional materialization`);
  }
  observeCandidateRegionReplay(context, query, query.kind === 'hubVisit' ? 'hubVisit' : 'hubLocal');
  return Object.freeze({
    roomGeneration: evaluation.roomGeneration,
    rewards: evaluation.rewards,
  });
}

export function evaluateHubVisitCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: HubVisitCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as HubVisitCandidateQuery;
  const baseline = locateCandidateHub(context, stableQuery);
  if (isCandidateContextUnavailable(baseline)) {
    return unavailableCandidate(stableQuery, baseline);
  }
  const { layout, plan, currentHubSlotKey, openHubSlotKeys } = requireHubVisitContext(
    context,
    stableQuery,
  );
  if (!layout.hub.slots.some((slot) => slot.slotKey === stableQuery.hubSlotKey)) {
    failCandidate(stableQuery, `unknown Hub slot ${stableQuery.hubSlotKey}`);
  }
  const topology = plan.topology!;
  const visitIndex = stableQuery.visit.visitIndex - 1;
  const current = topology.visitOrder[visitIndex];
  if (current !== currentHubSlotKey) {
    failCandidate(stableQuery, `Hub visit ${stableQuery.visit.visitIndex} changed identity`);
  }
  const coveredVisits =
    baseline.authoring === 'complete'
      ? baseline.snapshot.visits
      : [
          ...baseline.materializedPrefix.visits,
          ...(baseline.materializedPrefix.frontierVisit === undefined
            ? []
            : [baseline.materializedPrefix.frontierVisit]),
        ];
  const visitCovered = coveredVisits.some(
    (visit) => visit.visitIndex === stableQuery.visit.visitIndex,
  );
  if (!visitCovered) {
    return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, baseline));
  }
  const occupiedVisitIndexes = Object.freeze(
    topology.visitOrder.flatMap((hubSlotKey, index) =>
      hubSlotKey === stableQuery.hubSlotKey ? [index + 1] : [],
    ),
  );
  const structurallyPossible =
    openHubSlotKeys.includes(stableQuery.hubSlotKey) &&
    occupiedVisitIndexes.every((index) => index === stableQuery.visit.visitIndex);
  let findings = Object.freeze([]) as readonly SemanticFinding[];
  if (structurallyPossible) {
    const proposal =
      current === stableQuery.hubSlotKey
        ? project
        : applyCandidateCommand(catalog, project, stableQuery, {
            kind: 'ReplaceHubVisit',
            visit: stableQuery.visit,
            hubSlotKey: stableQuery.hubSlotKey,
          });
    const evaluation = evaluateHubVisitRegion(
      catalog,
      context,
      stableQuery,
      proposal,
      stableQuery.visit.visitIndex,
    );
    findings = Object.freeze(
      [...evaluation.roomGeneration.findings, ...evaluation.rewards.findings].filter(
        (finding) => finding.code !== 'hubOpenSlotUnavailable',
      ),
    );
  }
  const possibleChoices = openHubSlotKeys.filter(
    (hubSlotKey) =>
      hubSlotKey === current || !topology.visitOrder.some((visited) => visited === hubSlotKey),
  );
  const selectedPossible = structurallyPossible && findings.length === 0;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: selectedPossible
      ? possibleChoices.length === 1
        ? 'forced'
        : 'possible'
      : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateHubSlotKey: stableQuery.hubSlotKey,
      openHubSlotKeys,
      occupiedVisitIndexes,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

function requireSideRoomState(
  context: PreparedCandidateContext,
  query: SideRoomEntryOrderCandidateQuery | SideRoomGenerationCandidateQuery,
): PreparedHubLocalCandidateContext & {
  readonly state: Extract<
    PreparedHubLocalCandidateContext['occurrence']['state'],
    {
      readonly kind: 'ephyraCombat';
    }
  >;
} {
  const address = query.kind === 'sideRoomEntryOrder' ? query.group : query.sideRoom;
  const prepared = context.index.hubLocalGroupsByOwner.get(semanticAddressKey(address));
  if (prepared === undefined) {
    failCandidate(query, `unknown local child group ${address.groupKey}`);
  }
  const { occurrence } = prepared;
  if (occurrence.state.kind !== 'ephyraCombat') {
    failCandidate(query, 'semantic owner is not an Ephyra combat room');
  }
  return { ...prepared, state: occurrence.state };
}

export function evaluateSideRoomGenerationCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: SideRoomGenerationCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as SideRoomGenerationCandidateQuery;
  if (stableQuery.generation !== 'generated' && stableQuery.generation !== 'notGenerated') {
    failCandidate(stableQuery, `unknown side-room generation ${String(stableQuery.generation)}`);
  }
  const baseline = locateCandidateHub(context, stableQuery);
  if (isCandidateContextUnavailable(baseline)) {
    return unavailableCandidate(stableQuery, baseline);
  }
  const { state, group, visitIndex } = requireSideRoomState(context, stableQuery);
  if (!group.slots.some((slot) => slot.slotKey === stableQuery.sideRoom.slotKey)) {
    failCandidate(stableQuery, `unknown side-room slot ${stableQuery.sideRoom.slotKey}`);
  }
  const sideRoom = state.sideRooms[stableQuery.sideRoom.slotKey];
  if (sideRoom === undefined) {
    failCandidate(stableQuery, `missing side-room state ${stableQuery.sideRoom.slotKey}`);
  }
  const baselineEntry = baseline.roomGeneration.sideRoomGenerations.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(stableQuery.sideRoom),
  );
  if (baselineEntry === undefined) {
    return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, baseline));
  }
  const structurallyPossible =
    stableQuery.generation === 'generated' || sideRoom.enteredOrdinal === null;
  let selected = baselineEntry;
  let findings = Object.freeze([]) as readonly SemanticFinding[];
  if (structurallyPossible) {
    const proposal =
      sideRoom.generation === stableQuery.generation
        ? project
        : applyCandidateCommand(catalog, project, stableQuery, {
            kind: 'ReplaceSideRoomGeneration',
            sideRoom: stableQuery.sideRoom,
            generation: stableQuery.generation,
          });
    if (baselineEntry.visitIndex !== visitIndex) {
      failCandidate(stableQuery, 'side room changed its owning Hub visit');
    }
    const evaluation = evaluateHubVisitRegion(catalog, context, stableQuery, proposal, visitIndex);
    selected =
      evaluation.roomGeneration.sideRoomGenerations.find(
        (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(stableQuery.sideRoom),
      ) ?? failCandidate(stableQuery, 'side room proposal lost its generation support entry');
    findings = Object.freeze(
      evaluation.roomGeneration.findings.filter(
        (finding) => finding.code === 'sideRoomGenerationUnavailable',
      ),
    );
  }
  const selectedPossible = structurallyPossible && findings.length === 0;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: selectedPossible
      ? selected.supportOutcomes.length === 1
        ? 'forced'
        : 'possible'
      : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateGeneration: stableQuery.generation,
      enteredOrdinal: sideRoom.enteredOrdinal,
      generatedBefore: selected.generatedBefore,
      requiredGeneratedCount: selected.requiredGeneratedCount,
      supportOutcomes: selected.supportOutcomes,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}

export function evaluateSideRoomEntryOrderCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: SideRoomEntryOrderCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as SideRoomEntryOrderCandidateQuery;
  const baseline = locateCandidateHub(context, stableQuery);
  if (isCandidateContextUnavailable(baseline)) {
    return unavailableCandidate(stableQuery, baseline);
  }
  const { state, group, visitIndex } = requireSideRoomState(context, stableQuery);
  const groupCovered = baseline.roomGeneration.sideRoomGenerations.some(
    (entry) =>
      entry.origin.occurrenceId === stableQuery.group.occurrenceId &&
      entry.origin.groupKey === stableQuery.group.groupKey,
  );
  if (!groupCovered) {
    return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, baseline));
  }
  const generatedSlotKeys = Object.freeze(
    group.slots.flatMap((slot) =>
      state.sideRooms[slot.slotKey]?.generation === 'generated' ? [slot.slotKey] : [],
    ),
  );
  const proposal = applyCandidateCommand(catalog, project, stableQuery, {
    kind: 'ReplaceSideRoomEntryOrder',
    group: stableQuery.group,
    enteredSlotKeys: stableQuery.enteredSlotKeys,
  });
  const evaluation = evaluateHubVisitRegion(catalog, context, stableQuery, proposal, visitIndex);
  const findings = Object.freeze(
    [...evaluation.roomGeneration.findings, ...evaluation.rewards.findings].filter(
      (finding) =>
        finding.code !== 'hubOpenSlotUnavailable' &&
        finding.code !== 'sideRoomGenerationUnavailable',
    ),
  );
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: findings.length === 0 ? 'possible' : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateEnteredSlotKeys: stableQuery.enteredSlotKeys,
      generatedSlotKeys,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
  });
}
