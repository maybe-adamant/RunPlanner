import { semanticAddressKey } from '../../authored-project/addresses';
import type { HubBiomePlan, ProjectDocument } from '../../authored-project/model';
import type { Catalog, HubBiomeLayout } from '../../catalog-schema';
import type { CompleteHubProjectEvaluation, HubBiomeProjectEvaluation } from '../project';
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
  failCandidate,
  immutableQuery,
  locateCandidateHub,
  locateHubBiomePlan,
  type PreparedCandidateContext,
} from './context';

function requireHubCandidateLayout(
  catalog: Catalog,
  project: ProjectDocument,
  query: ProjectCandidateQuery,
): { readonly layout: HubBiomeLayout; readonly plan: HubBiomePlan } {
  const plan = locateHubBiomePlan(project, query);
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
  query: HubSlotCandidateQuery,
  plan: HubBiomePlan,
  layout: HubBiomeLayout,
  baseline: CompleteHubProjectEvaluation,
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
      ? evaluation.findings.filter((finding) => finding.code === 'hubOpenSetIncomplete')
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
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
  const { layout, plan } = requireHubCandidateLayout(catalog, project, stableQuery);
  const slot = layout.hub.slots.find(
    (candidate) => candidate.slotKey === stableQuery.slot.hubSlotKey,
  );
  if (slot === undefined) {
    failCandidate(stableQuery, `unknown Hub slot ${stableQuery.slot.hubSlotKey}`);
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
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
  const { layout, plan } = requireHubCandidateLayout(catalog, project, stableQuery);
  if (!layout.hub.slots.some((slot) => slot.slotKey === stableQuery.hubSlotKey)) {
    failCandidate(stableQuery, `unknown Hub slot ${stableQuery.hubSlotKey}`);
  }
  const topology = plan.topology!;
  const visitIndex = stableQuery.visit.visitIndex - 1;
  const current = topology.visitOrder[visitIndex];
  if (current === undefined) {
    failCandidate(stableQuery, `unknown Hub visit ${stableQuery.visit.visitIndex}`);
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
  let findings = Object.freeze([]) as CompleteHubProjectEvaluation['findings'];
  if (structurallyPossible) {
    const proposal =
      current === stableQuery.hubSlotKey
        ? project
        : applyCandidateCommand(catalog, project, stableQuery, {
            kind: 'ReplaceHubVisit',
            visit: stableQuery.visit,
            hubSlotKey: stableQuery.hubSlotKey,
          });
    const evaluation = evaluateHubBiome(
      catalog,
      stableQuery.visit.routeKey,
      locateHubBiomePlan(proposal, stableQuery),
    );
    if (evaluation.authoring === 'incomplete') {
      failCandidate(stableQuery, 'Hub visit proposal made a complete biome incomplete');
    }
    findings = Object.freeze(
      evaluation.findings.filter((finding) => finding.code !== 'hubOpenSlotUnavailable'),
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
  project: ProjectDocument,
  query: SideRoomEntryOrderCandidateQuery | SideRoomGenerationCandidateQuery,
) {
  const { layout, plan } = requireHubCandidateLayout(catalog, project, query);
  const address = query.kind === 'sideRoomEntryOrder' ? query.group : query.sideRoom;
  const occurrence = plan.topology!.occurrences.find(
    (candidate) => candidate.occurrenceId === address.occurrenceId,
  );
  if (occurrence?.state.kind !== 'ephyraCombat') {
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
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
  const { state, group } = requireSideRoomState(catalog, project, stableQuery);
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
    failCandidate(stableQuery, 'side room has no selected generation support entry');
  }
  const structurallyPossible =
    stableQuery.generation === 'generated' || sideRoom.enteredOrdinal === null;
  let selected = baselineEntry;
  let findings = Object.freeze([]) as CompleteHubProjectEvaluation['findings'];
  if (structurallyPossible) {
    const proposal =
      sideRoom.generation === stableQuery.generation
        ? project
        : applyCandidateCommand(catalog, project, stableQuery, {
            kind: 'ReplaceSideRoomGeneration',
            sideRoom: stableQuery.sideRoom,
            generation: stableQuery.generation,
          });
    const evaluation = evaluateHubBiome(
      catalog,
      stableQuery.sideRoom.routeKey,
      locateHubBiomePlan(proposal, stableQuery),
    );
    if (evaluation.authoring === 'incomplete') {
      failCandidate(stableQuery, 'side-generation proposal made a complete biome incomplete');
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
  if (typeof baseline === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: baseline });
  }
  const { state, group } = requireSideRoomState(catalog, project, stableQuery);
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
  const evaluation = evaluateHubBiome(
    catalog,
    stableQuery.group.routeKey,
    locateHubBiomePlan(proposal, stableQuery),
  );
  if (evaluation.authoring === 'incomplete') {
    failCandidate(stableQuery, 'side-entry proposal made a complete biome incomplete');
  }
  const findings = Object.freeze(
    evaluation.findings.filter(
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
