import { semanticAddressKey } from '../../authored-project/addresses';
import type { HubBiomePlan, ProjectDocument } from '../../authored-project/model';
import type { Catalog, HubBiomeLayout } from '../../catalog-schema';
import type { SemanticFinding } from '../model';
import type { HubBiomeProjectEvaluation } from '../project';
import { evaluateHubBiome } from '../project';
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
  locateIndexedHubPlan,
  locateIndexedOccurrence,
  observeCandidateBiomeReplay,
  unavailableCandidate,
  type CandidateHubBiomeEvaluation,
  type PreparedCandidateContext,
} from './context';

function requireHubCandidateLayout(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: ProjectCandidateQuery,
): { readonly layout: HubBiomeLayout; readonly plan: HubBiomePlan } {
  const plan = locateIndexedHubPlan(context, query);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout?.kind !== 'HubBiome' || plan.biomeKey !== 'N') {
    failCandidate(query, `${plan.biomeKey} has no supported Hub candidate domain`);
  }
  if (plan.topology === null) {
    failCandidate(query, 'Hub topology has not been started');
  }
  return { layout, plan };
}

function hubSlotProposal(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: HubSlotCandidateQuery,
  plan: HubBiomePlan,
  layout: HubBiomeLayout,
  baseline: CandidateHubBiomeEvaluation,
  open: boolean,
): HubBiomeProjectEvaluation | undefined {
  const topology = plan.topology!;
  const currentlyOpen = topology.openTargets.some(
    (target) => target.hubSlotKey === query.slot.hubSlotKey,
  );
  if (open === currentlyOpen) {
    return baseline;
  }
  if (
    (open && topology.openTargets.length >= layout.hub.openCount.max) ||
    (!open && topology.visitOrder.includes(query.slot.hubSlotKey))
  ) {
    return undefined;
  }
  const proposal = applyCandidateCommand(
    catalog,
    project,
    query,
    open
      ? { kind: 'OpenHubSlot', slot: query.slot, occurrenceId: query.occurrenceId }
      : { kind: 'CloseHubSlot', slot: query.slot },
  );
  observeCandidateBiomeReplay(context, query, 'hubBiome');
  return evaluateHubBiome(catalog, query.slot.routeKey, locateHubBiomePlan(proposal, query));
}

function hubSlotFindings(
  query: HubSlotCandidateQuery,
  evaluation: HubBiomeProjectEvaluation | undefined,
) {
  if (evaluation === undefined) {
    return Object.freeze([]);
  }
  return Object.freeze(
    evaluation.authoring === 'incomplete'
      ? evaluation.findings.filter(
          (finding) =>
            finding.code === 'hubOpenSetIncomplete' ||
            (finding.code === 'hubOpenSlotUnavailable' &&
              semanticAddressKey(finding.origin) === semanticAddressKey(query.slot)),
        )
      : evaluation.roomGeneration.findings.filter(
          (finding) =>
            finding.code === 'hubOpenSlotUnavailable' &&
            semanticAddressKey(finding.origin) === semanticAddressKey(query.slot),
        ),
  );
}

export function evaluateHubSlotCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: HubSlotCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as HubSlotCandidateQuery;
  const baseline = locateCandidateHub(context, stableQuery);
  if (isCandidateContextUnavailable(baseline)) {
    return unavailableCandidate(stableQuery, baseline);
  }
  const { layout, plan } = requireHubCandidateLayout(catalog, context, stableQuery);
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
  const selectedEvaluation = hubSlotProposal(
    catalog,
    project,
    context,
    stableQuery,
    plan,
    layout,
    baseline,
    stableQuery.open,
  );
  const findings = hubSlotFindings(stableQuery, selectedEvaluation);
  const selectedPossible = selectedEvaluation !== undefined && findings.length === 0;
  const oppositeEvaluation = hubSlotProposal(
    catalog,
    project,
    context,
    stableQuery,
    plan,
    layout,
    baseline,
    !stableQuery.open,
  );
  const oppositePossible =
    oppositeEvaluation !== undefined &&
    hubSlotFindings(stableQuery, oppositeEvaluation).length === 0;
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: selectedPossible ? (oppositePossible ? 'possible' : 'forced') : 'impossible',
    findings,
    evidence: Object.freeze({
      candidateOpen: stableQuery.open,
      currentlyOpen,
      openSlotKeys: Object.freeze(topology.openTargets.map((target) => target.hubSlotKey)),
      minimumOpenCount: layout.hub.openCount.min,
      maximumOpenCount: layout.hub.openCount.max,
      referencedVisitIndexes,
      relevantFindingCodes: Object.freeze(findings.map((finding) => finding.code)),
    }),
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
  const { layout, plan } = requireHubCandidateLayout(catalog, context, stableQuery);
  if (!layout.hub.slots.some((slot) => slot.slotKey === stableQuery.hubSlotKey)) {
    failCandidate(stableQuery, `unknown Hub slot ${stableQuery.hubSlotKey}`);
  }
  const topology = plan.topology!;
  const visitIndex = stableQuery.visit.visitIndex - 1;
  const current = topology.visitOrder[visitIndex];
  if (current === undefined) {
    failCandidate(stableQuery, `unknown Hub visit ${stableQuery.visit.visitIndex}`);
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
  const openHubSlotKeys = Object.freeze(topology.openTargets.map((target) => target.hubSlotKey));
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
    observeCandidateBiomeReplay(context, stableQuery, 'hubBiome');
    const evaluation = evaluateHubBiome(
      catalog,
      stableQuery.visit.routeKey,
      locateHubBiomePlan(proposal, stableQuery),
    );
    findings = Object.freeze(
      'roomGeneration' in evaluation
        ? [...evaluation.roomGeneration.findings, ...evaluation.rewards.findings].filter(
            (finding) => finding.code !== 'hubOpenSlotUnavailable',
          )
        : [],
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
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: SideRoomEntryOrderCandidateQuery | SideRoomGenerationCandidateQuery,
) {
  const { layout, plan } = requireHubCandidateLayout(catalog, context, query);
  const address = query.kind === 'sideRoomEntryOrder' ? query.group : query.sideRoom;
  const occurrence = locateIndexedOccurrence(context, query, address.occurrenceId).occurrence;
  if (occurrence.state.kind !== 'ephyraCombat') {
    failCandidate(query, 'semantic owner is not an Ephyra combat room');
  }
  const room = catalog.rooms.byKey[occurrence.gameName];
  const group = room?.localChildren.find((candidate) => candidate.key === address.groupKey);
  if (group?.kind !== 'fixedRoomSlots') {
    failCandidate(query, `unknown local child group ${address.groupKey}`);
  }
  return { layout, plan, occurrence, state: occurrence.state, group };
}

export function evaluateSideRoomGenerationCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: SideRoomGenerationCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as SideRoomGenerationCandidateQuery;
  const baseline = locateCandidateHub(context, stableQuery);
  if (isCandidateContextUnavailable(baseline)) {
    return unavailableCandidate(stableQuery, baseline);
  }
  const { state, group } = requireSideRoomState(catalog, context, stableQuery);
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
    observeCandidateBiomeReplay(context, stableQuery, 'hubBiome');
    const evaluation = evaluateHubBiome(
      catalog,
      stableQuery.sideRoom.routeKey,
      locateHubBiomePlan(proposal, stableQuery),
    );
    if (!('roomGeneration' in evaluation)) {
      return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, baseline));
    }
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
  const { state, group } = requireSideRoomState(catalog, context, stableQuery);
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
  observeCandidateBiomeReplay(context, stableQuery, 'hubBiome');
  const evaluation = evaluateHubBiome(
    catalog,
    stableQuery.group.routeKey,
    locateHubBiomePlan(proposal, stableQuery),
  );
  const findings = Object.freeze(
    'roomGeneration' in evaluation
      ? [...evaluation.roomGeneration.findings, ...evaluation.rewards.findings].filter(
          (finding) =>
            finding.code !== 'hubOpenSlotUnavailable' &&
            finding.code !== 'sideRoomGenerationUnavailable',
        )
      : [],
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
