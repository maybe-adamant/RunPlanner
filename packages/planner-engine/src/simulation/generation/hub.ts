import type { Catalog, HubBiomeLayout } from '../../catalog';
import {
  createBiomeAddress,
  createHubSlotAddress,
  semanticAddressKey,
} from '../../project/addresses';
import type { CanonicalHubHistory, RoomHistoryViews } from '../history';
import type { CanonicalHubBiome, CanonicalHubVisit } from '../materialization';
import type { FindingEvidence, SemanticFinding } from '../model';
import type {
  HubOpenSlotConstraintSupportEntry,
  HubRoomGenerationValidation,
  HubSideRoomGenerationSupportEntry,
  SideRoomGenerationOutcome,
} from './model';

export class HubRoomGenerationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'HubRoomGenerationContractError';
  }
}

function fail(detail: string): never {
  throw new HubRoomGenerationContractError(detail);
}

function finding(
  code: 'hubOpenSlotUnavailable' | 'sideRoomGenerationUnavailable',
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

function requireHubLayout(
  catalog: Catalog,
  snapshot: CanonicalHubBiome,
  history: CanonicalHubHistory,
): HubBiomeLayout {
  const route = catalog.routes.byKey[snapshot.routeKey];
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (
    snapshot.routeKey !== history.routeKey ||
    snapshot.biomeKey !== history.biomeKey ||
    route === undefined ||
    route.biomeKeys[0] !== snapshot.biomeKey ||
    layout?.kind !== 'HubBiome' ||
    layout.hub.roomGameName !== snapshot.hubBoard.room.gameName ||
    layout.terminal.kind !== 'fixedAuthoredSlot' ||
    layout.terminal.roomGameName !== snapshot.terminalEntry.gameName
  ) {
    fail(`catalog cannot validate canonical ${snapshot.biomeKey} Hub generation`);
  }
  return layout;
}

function roomViews(history: CanonicalHubHistory): ReadonlyMap<string, RoomHistoryViews> {
  return new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function assertFixedBoard(
  layout: HubBiomeLayout,
  snapshot: CanonicalHubBiome,
  history: CanonicalHubHistory,
): void {
  if (
    snapshot.hubBoard.targets.length < layout.hub.openCount.min ||
    snapshot.hubBoard.targets.length > layout.hub.openCount.max
  ) {
    fail(`${snapshot.biomeKey} selected validation requires a complete Hub open set`);
  }
  const slots = new Map(layout.hub.slots.map((slot) => [slot.slotKey, slot]));
  const openKeys = new Set(snapshot.hubBoard.targets.map((target) => target.hubSlotKey));
  const expectedSlotKeys = layout.hub.slots
    .filter((slot) => openKeys.has(slot.slotKey))
    .map((slot) => slot.slotKey);
  if (
    expectedSlotKeys.some(
      (slotKey, index) => snapshot.hubBoard.targets[index]?.hubSlotKey !== slotKey,
    )
  ) {
    fail(`${snapshot.biomeKey} Hub board is not in normalized physical order`);
  }
  const creationEvents = history.ledgers.roomCreations.filter(
    (event) => event.source === 'hubTarget',
  );
  if (creationEvents.length !== snapshot.hubBoard.targets.length) {
    fail(`${snapshot.biomeKey} Hub history does not create the complete physical board once`);
  }
  snapshot.hubBoard.targets.forEach((target, index) => {
    const slot = slots.get(target.hubSlotKey);
    const creation = creationEvents[index];
    if (
      slot === undefined ||
      semanticAddressKey(target.origin) !==
        semanticAddressKey(
          createHubSlotAddress(
            createBiomeAddress(snapshot.routeKey, snapshot.biomeKey),
            slot.slotKey,
          ),
        ) ||
      target.room.gameName !== slot.roomGameName ||
      target.physicalDoorId !== slot.physicalDoorId ||
      creation === undefined ||
      semanticAddressKey(creation.targetOrigin) !== semanticAddressKey(target.origin) ||
      semanticAddressKey(creation.origin) !== semanticAddressKey(target.room.origin) ||
      creation.gameName !== target.room.gameName ||
      creation.generationIndex !== index + 1 ||
      creation.generationCount !== snapshot.hubBoard.targets.length
    ) {
      fail(`${target.hubSlotKey} does not match its fixed Hub slot and physical creation`);
    }
  });
}

function validateOpenSlotConstraints(
  snapshot: CanonicalHubBiome,
  layout: HubBiomeLayout,
  findings: SemanticFinding[],
): readonly HubOpenSlotConstraintSupportEntry[] {
  const openKeys = new Set(snapshot.hubBoard.targets.map((target) => target.hubSlotKey));
  return Object.freeze(
    layout.hub.openSlotConstraints.map((constraint, constraintIndex) => {
      const constrainedOpen = constraint.slotKeys.filter((slotKey) => openKeys.has(slotKey));
      const selectedPossible = constrainedOpen.length <= constraint.max;
      const entry: HubOpenSlotConstraintSupportEntry = Object.freeze({
        origin: snapshot.hubBoard.origin,
        constraintIndex,
        constrainedSlotKeys: constraint.slotKeys,
        openSlotKeys: Object.freeze(constrainedOpen),
        maximumOpenCount: constraint.max,
        selectedPossible,
      });
      if (!selectedPossible) {
        for (const target of snapshot.hubBoard.targets) {
          if (!constrainedOpen.includes(target.hubSlotKey)) {
            continue;
          }
          findings.push(
            finding('hubOpenSlotUnavailable', target.origin, {
              constraintIndex,
              constrainedSlotKeys: constraint.slotKeys,
              openSlotKeys: entry.openSlotKeys,
              maximumOpenCount: constraint.max,
              actualOpenCount: constrainedOpen.length,
            }),
          );
        }
      }
      return entry;
    }),
  );
}

function requiredGeneratedCount(layout: HubBiomeLayout, visitIndex: number): number {
  const ratio = layout.hub.sideRoomGeneration.minimumPerVisit;
  return Math.ceil((visitIndex * ratio.numerator) / ratio.denominator);
}

function assertVisitIdentity(
  layout: HubBiomeLayout,
  snapshot: CanonicalHubBiome,
  history: CanonicalHubHistory,
): void {
  if (snapshot.visits.length !== layout.hub.requiredVisits) {
    fail(`${snapshot.biomeKey} selected validation requires ${layout.hub.requiredVisits} visits`);
  }
  const visitedSlots = new Set<string>();
  const spawnKeys = new Set(
    history.ledgers.requiredObjectSpawns.map((entry) => semanticAddressKey(entry.origin)),
  );
  const completionKeys = new Set(
    history.ledgers.requiredObjectCompletions.map((entry) => semanticAddressKey(entry.origin)),
  );
  const hubRestores = history.ledgers.roomRestores.filter(
    (restore) => restore.restoreKind === 'hub',
  );
  snapshot.visits.forEach((visit, index) => {
    const roomKey = semanticAddressKey(visit.target.room.origin);
    if (
      visit.visitIndex !== index + 1 ||
      visit.origin.visitIndex !== visit.visitIndex ||
      visitedSlots.has(visit.target.hubSlotKey) ||
      !snapshot.hubBoard.targets.includes(visit.target) ||
      visit.target.room.requiredObjects?.length !== 1 ||
      visit.target.room.requiredObjects[0]?.key !== layout.hub.targetCompletion.objectKey ||
      !spawnKeys.has(roomKey) ||
      !completionKeys.has(roomKey) ||
      semanticAddressKey(visit.hubRestore.after) !== semanticAddressKey(visit.origin) ||
      semanticAddressKey(visit.hubRestore.room.origin) !==
        semanticAddressKey(snapshot.hubBoard.room.origin) ||
      hubRestores[index] === undefined ||
      semanticAddressKey(hubRestores[index].after) !== semanticAddressKey(visit.origin) ||
      semanticAddressKey(hubRestores[index].origin) !==
        semanticAddressKey(snapshot.hubBoard.room.origin)
    ) {
      fail(
        `Hub visit ${visit.visitIndex} does not preserve its target, pylon, and restore contract`,
      );
    }
    visitedSlots.add(visit.target.hubSlotKey);
  });
  if (
    history.ledgers.requiredObjectSpawns.length !== layout.hub.requiredVisits ||
    history.ledgers.requiredObjectCompletions.length !== layout.hub.requiredVisits ||
    spawnKeys.size !== layout.hub.requiredVisits ||
    completionKeys.size !== layout.hub.requiredVisits ||
    hubRestores.length !== layout.hub.requiredVisits ||
    history.biomeCompletion.ledgers.counters.soulPylonsSpawned !== layout.hub.requiredVisits ||
    history.biomeCompletion.ledgers.counters.soulPylonsCompleted !== layout.hub.requiredVisits
  ) {
    fail(`${snapshot.biomeKey} history does not close exactly one pylon and Hub restore per visit`);
  }
  const expectedParentRestores = snapshot.visits.flatMap((visit) => visit.parentRestores);
  const actualParentRestores = history.ledgers.roomRestores.filter(
    (restore) => restore.restoreKind === 'parent',
  );
  if (
    expectedParentRestores.length !== actualParentRestores.length ||
    expectedParentRestores.some((restore, index) => {
      const actual = actualParentRestores[index];
      return (
        actual === undefined ||
        semanticAddressKey(actual.origin) !== semanticAddressKey(restore.room.origin) ||
        semanticAddressKey(actual.after) !== semanticAddressKey(restore.after)
      );
    })
  ) {
    fail(`${snapshot.biomeKey} history does not preserve ordered parent restores`);
  }
}

function assertLocalEntryOrder(visit: CanonicalHubVisit): void {
  const entered = [...visit.localSlots]
    .filter((slot) => slot.enteredOrdinal !== null)
    .sort((left, right) => left.enteredOrdinal! - right.enteredOrdinal!);
  if (
    entered.length !== visit.enteredLocalRooms.length ||
    visit.parentRestores.length !== entered.length
  ) {
    fail(`Hub visit ${visit.visitIndex} has inconsistent side entry and restore counts`);
  }
  entered.forEach((slot, index) => {
    const projected = visit.enteredLocalRooms[index];
    const restore = visit.parentRestores[index];
    if (
      slot.generation !== 'generated' ||
      slot.enteredOrdinal !== index + 1 ||
      projected !== slot ||
      restore === undefined ||
      semanticAddressKey(restore.after) !== semanticAddressKey(slot.origin) ||
      semanticAddressKey(restore.room.origin) !== semanticAddressKey(visit.target.room.origin)
    ) {
      fail(`Hub visit ${visit.visitIndex} has invalid side-room entered ordinals or restores`);
    }
  });
}

function validateVisitSidePressure(
  layout: HubBiomeLayout,
  visit: CanonicalHubVisit,
  views: ReadonlyMap<string, RoomHistoryViews>,
  findings: SemanticFinding[],
): readonly HubSideRoomGenerationSupportEntry[] {
  assertLocalEntryOrder(visit);
  const view = views.get(semanticAddressKey(visit.target.room.origin));
  const generatedBeforeVisit = view?.preOutgoing?.ledgers.counters.numSubRoomsSpawned;
  if (generatedBeforeVisit === undefined) {
    fail(`Hub visit ${visit.visitIndex} has no side-generation history context`);
  }
  let generated = generatedBeforeVisit;
  const required = requiredGeneratedCount(layout, visit.visitIndex);
  const orderedSlots = [...visit.localSlots].sort(
    (left, right) => left.availabilityRank - right.availabilityRank,
  );
  const entries = orderedSlots.map((slot, index): HubSideRoomGenerationSupportEntry => {
    if (slot.availabilityRank !== index + 1) {
      fail(`Hub visit ${visit.visitIndex} has non-contiguous side availability ranks`);
    }
    const supportOutcomes: readonly SideRoomGenerationOutcome[] = Object.freeze(
      generated < required ? ['generated'] : ['generated', 'notGenerated'],
    );
    const selectedPossible = supportOutcomes.includes(slot.generation);
    const entry = Object.freeze({
      origin: slot.origin,
      visitIndex: visit.visitIndex,
      availabilityRank: slot.availabilityRank,
      generatedBefore: generated,
      requiredGeneratedCount: required,
      selectedOutcome: slot.generation,
      supportOutcomes,
      selectedPossible,
    });
    if (!selectedPossible) {
      findings.push(
        finding('sideRoomGenerationUnavailable', slot.origin, {
          visitIndex: visit.visitIndex,
          availabilityRank: slot.availabilityRank,
          generatedBefore: generated,
          requiredGeneratedCount: required,
          selectedOutcome: slot.generation,
          supportOutcomes,
        }),
      );
    }
    if (slot.generation === 'generated') {
      generated += 1;
    }
    return entry;
  });
  const generatedAfterVisit = view?.outgoingGeneration?.ledgers.counters.numSubRoomsSpawned;
  if (generatedAfterVisit !== generated) {
    fail(`Hub visit ${visit.visitIndex} side-generation history does not match authored outcomes`);
  }
  return Object.freeze(entries);
}

function assertTerminalCompletion(
  layout: HubBiomeLayout,
  snapshot: CanonicalHubBiome,
  history: CanonicalHubHistory,
): void {
  const expected = [
    layout.terminal.roomGameName,
    ...layout.completion.rooms.map((room) => room.roomGameName),
  ];
  const terminalAndCompletion = history.ledgers.roomCreations
    .filter((event) => event.source === 'layoutTerminal' || event.source === 'layoutCompletion')
    .map((event) => event.gameName);
  if (
    !snapshot.terminalEntry.entered ||
    snapshot.completionRooms.length !== layout.completion.rooms.length ||
    expected.length !== terminalAndCompletion.length ||
    expected.some((gameName, index) => terminalAndCompletion[index] !== gameName) ||
    !history.events.some(
      (event) =>
        event.kind === 'biomeCompleted' &&
        semanticAddressKey(event.origin) ===
          semanticAddressKey(createBiomeAddress(snapshot.routeKey, snapshot.biomeKey)),
    )
  ) {
    fail(`${snapshot.biomeKey} history does not contain its fixed terminal completion`);
  }
}

export function evaluateHubRoomGeneration(
  catalog: Catalog,
  snapshot: CanonicalHubBiome,
  history: CanonicalHubHistory,
): HubRoomGenerationValidation {
  const layout = requireHubLayout(catalog, snapshot, history);
  assertFixedBoard(layout, snapshot, history);
  assertVisitIdentity(layout, snapshot, history);
  assertTerminalCompletion(layout, snapshot, history);
  const findings: SemanticFinding[] = [];
  const openSlotConstraints = validateOpenSlotConstraints(snapshot, layout, findings);
  const views = roomViews(history);
  const sideRoomGenerations = Object.freeze(
    snapshot.visits.flatMap((visit) => validateVisitSidePressure(layout, visit, views, findings)),
  );
  return Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: findings.length === 0 ? 'valid' : 'invalid',
    openSlotConstraints,
    sideRoomGenerations,
    findings: Object.freeze(findings),
  });
}

export function evaluateNRoomGeneration(
  catalog: Catalog,
  snapshot: CanonicalHubBiome,
  history: CanonicalHubHistory,
): HubRoomGenerationValidation {
  if (snapshot.biomeKey !== 'N' || history.biomeKey !== 'N') {
    fail('N room generation requires biome N');
  }
  return evaluateHubRoomGeneration(catalog, snapshot, history);
}
