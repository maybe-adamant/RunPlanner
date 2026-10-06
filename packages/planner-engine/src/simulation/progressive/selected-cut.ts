import {
  createBiomeAddress,
  createHubFountainAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type EncounterPhaseAddress,
  type NemesisRandomEventAddress,
  type OccurrenceAddress,
  type SemanticAddress,
  type TargetAddress,
} from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import { createAssessmentIssue } from '../assessment-issue';
import type { EncounterCandidateArtifacts } from '../encounters/candidates';
import { createBiomeCandidateArtifacts } from '../evaluation/candidate-artifacts';
import {
  assessmentRepairOwner,
  type FindingRegionEntry,
  type HistoryFindingChronology,
} from '../finding-regions';
import type { OrdinaryBatchGenerationAssessment } from '../generation/model';
import { biomeHistoryThrough, type BiomeHistoryPrefix, type HistoryEvent } from '../history';
import { roomOverviewOperationCount } from '../lifecycle';
import {
  BiomeMaterializationContractError,
  selectedBatchContinuation,
  type CanonicalAdditionalContinuation,
  type CanonicalAuthoredRoom,
  type CanonicalBatch,
  type CanonicalDecision,
  type CanonicalHubDecision,
  type CanonicalHubRoom,
  type CanonicalTarget,
  type MaterializedBiomePrefix,
  type MaterializedExitDecisionFrontier,
  type MaterializedHubVisitFrontier,
} from '../materialization';
import type { SemanticFinding } from '../model';
import type { BiomeRewardEvaluationAssembly } from '../rewards/biome/publication';
import {
  compareOwnerLocations,
  findingLocation,
  findingsAtRegion,
  locateFinding,
  mergedFindings,
  roomActionOwns,
  type LocatedFinding,
  type ProgressiveBiomeSelectedProducts,
} from './finding-location';
import type { BiomeGenerationValidation, ProgressiveBiomeEvaluationAssembly } from './products';

type AuthoredPrefix = MaterializedBiomePrefix & {
  readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
};

/** The room whose lifecycle the selected attempt stops in, with its structural place. */
type CutOwner =
  /** Before the opening room is prepared. */
  | { readonly kind: 'start' }
  | { readonly kind: 'entry'; readonly room: CanonicalAuthoredRoom }
  | {
      readonly kind: 'continuation';
      readonly room: CanonicalAuthoredRoom;
      readonly incomingIndex: number;
      readonly incoming: CanonicalBatch;
    }
  | { readonly kind: 'fixed'; readonly room: CanonicalAuthoredRoom; readonly linkIndex: number }
  | {
      readonly kind: 'hub';
      readonly room: CanonicalHubRoom;
      readonly decisionIndex: number;
      readonly hub: CanonicalHubDecision;
    }
  | {
      readonly kind: 'hubVisit';
      readonly room: CanonicalAuthoredRoom;
      readonly decisionIndex: number;
      readonly hub: CanonicalHubDecision;
      readonly visitIndex: number;
    };

/** Where the selected attempt is published through. */
interface SelectedCut {
  readonly owner: CutOwner;
  /** Whether the stop lies in the owner's Timeline, doors opening or exit work. */
  readonly timeline: boolean;
  /** The reward walk's cut: the blocking contact, or the end of a stopped Overview. */
  readonly cut: HistoryFindingChronology;
  /** The last selected history event reached before the blocking product. */
  readonly through: number;
}

const key = semanticAddressKey;

type LifecycleEvent = Extract<HistoryEvent, { readonly operationIndex: number }>;

function lifecycleEvent(event: HistoryEvent): event is LifecycleEvent {
  return 'operationIndex' in event;
}

function arrival(event: HistoryEvent): boolean {
  return event.kind === 'roomEntered' || event.kind === 'roomRestored';
}

/** Every decision with its index, including the frontier's partial batch. */
function decisionEntries(
  prefix: MaterializedBiomePrefix,
): readonly { readonly decision: CanonicalDecision; readonly index: number }[] {
  const partial =
    prefix.frontier?.kind === 'exitDecision' ? prefix.frontier.partialBatch : undefined;
  return [
    ...prefix.decisions.map((decision, index) => ({ decision, index })),
    ...(partial === undefined ? [] : [{ decision: partial, index: prefix.decisions.length }]),
  ];
}

function cutOwner(prefix: AuthoredPrefix, roomKey: string | undefined): CutOwner {
  if (roomKey === undefined) return Object.freeze({ kind: 'start' });
  if (key(prefix.entryRoom.origin) === roomKey)
    return Object.freeze({ kind: 'entry', room: prefix.entryRoom });
  const linkIndex = (prefix.fixedRoomLinks ?? []).findIndex(
    (link) => key(link.target.origin) === roomKey,
  );
  const link = prefix.fixedRoomLinks?.[linkIndex];
  if (link !== undefined) return Object.freeze({ kind: 'fixed', room: link.target, linkIndex });
  for (const { decision, index } of decisionEntries(prefix)) {
    if (decision.kind === 'batch') {
      const selected = selectedBatchContinuation(decision);
      const room =
        selected === undefined
          ? undefined
          : selected.kind === 'normal'
            ? selected.target.room
            : selected.continuation.room;
      if (room !== undefined && key(room.origin) === roomKey)
        return Object.freeze({
          kind: 'continuation',
          room,
          incomingIndex: index,
          incoming: decision,
        });
      continue;
    }
    if (key(decision.room.origin) === roomKey)
      return Object.freeze({
        kind: 'hub',
        room: decision.room,
        decisionIndex: index,
        hub: decision,
      });
    for (const [visitIndex, visit] of decision.visits.entries()) {
      const room = [visit.target.room, ...visit.enteredLocalRooms].find(
        (candidate) => key(candidate.origin) === roomKey,
      );
      if (room !== undefined)
        return Object.freeze({
          kind: 'hubVisit',
          room,
          decisionIndex: index,
          hub: decision,
          visitIndex,
        });
    }
  }
  throw new BiomeMaterializationContractError(`selected history room ${roomKey} has no owner`);
}

/**
 * The end of the doors-opening run containing a contact: a room's door
 * generations since its latest arrival. Door offers share one offer-time
 * store, so the whole run is one blocking product.
 */
function doorsOpenedAfter(
  history: BiomeHistoryPrefix,
  roomKey: string,
  sequence: number,
): number | undefined {
  const opening = history.events.findLast(
    (event) =>
      event.kind === 'outgoingGenerationCheckpoint' &&
      key(event.origin) === roomKey &&
      event.sequence < sequence,
  )?.sequence;
  if (opening === undefined) return undefined;
  const runStart = Math.max(
    opening,
    history.events.findLast((event) => arrival(event) && event.sequence < sequence)?.sequence ??
      opening,
  );
  const runEnd =
    history.events.find((event) => arrival(event) && event.sequence > runStart)?.sequence ??
    Number.POSITIVE_INFINITY;
  const opened = (
    history.rooms.find((room) => key(room.origin) === roomKey)?.targetGenerations ?? []
  )
    .filter(
      (generation) =>
        generation.roomCreationSequence > runStart && generation.roomCreationSequence < runEnd,
    )
    .at(-1)?.after.sequence;
  return opened !== undefined && sequence <= opened ? opened : undefined;
}

/** A block's chronology position; an unpositioned block is a broken engine contract. */
function blockPosition(located: LocatedFinding): HistoryFindingChronology {
  if (located.historySequence === undefined || located.historyBoundary === undefined)
    throw new BiomeMaterializationContractError(
      `blocking ${located.finding.code} at ${key(located.finding.origin)} has no chronology position`,
    );
  return Object.freeze({
    kind: 'history',
    sequence: located.historySequence,
    boundary: located.historyBoundary,
  });
}

/**
 * The selected attempt's stop for a block. A block in a room's
 * Overview stops after the whole Overview, its entry and the continuations
 * created on entry; a later block stops at its blocking product.
 */
function selectedCut(
  catalog: Catalog,
  prefix: AuthoredPrefix,
  history: BiomeHistoryPrefix,
  located: LocatedFinding,
): SelectedCut {
  const position = blockPosition(located);
  const event = history.events.find((candidate) => candidate.sequence === position.sequence);
  // A lifecycle contact belongs to its room; any other to the room the run is in,
  // including a restore the contact follows.
  const room =
    event !== undefined && lifecycleEvent(event)
      ? event
      : history.events.findLast(
          (candidate) =>
            arrival(candidate) &&
            (candidate.sequence < position.sequence ||
              (candidate.sequence === position.sequence && position.boundary !== 'before')),
        );
  const roomKey = room === undefined ? undefined : key(room.origin);
  const owner = cutOwner(prefix, roomKey);
  const atPosition = Object.freeze({
    owner,
    timeline: true,
    cut: position,
    through: position.boundary === 'after' ? position.sequence : position.sequence - 1,
  });
  // A block at the biome start keeps the start itself, before any room exists.
  if (owner.kind === 'start' || roomKey === undefined)
    return Object.freeze({
      ...atPosition,
      through: Math.max(
        atPosition.through,
        history.events.find((candidate) => candidate.kind === 'biomeStarted')?.sequence ??
          atPosition.through,
      ),
    });
  const profile = catalog.roomLifecycleProfiles.byKey[owner.room.lifecycleProfileKey];
  if (profile === undefined)
    throw new BiomeMaterializationContractError(
      `${owner.room.gameName} has unknown lifecycle profile ${owner.room.lifecycleProfileKey}`,
    );
  const overviewEnd = roomOverviewOperationCount(profile);
  const roomEvents = history.events.filter(
    (candidate): candidate is LifecycleEvent =>
      lifecycleEvent(candidate) && key(candidate.origin) === roomKey,
  );
  const timelineStart = roomEvents.find((candidate) => candidate.operationIndex >= overviewEnd);
  if (timelineStart === undefined || position.sequence < timelineStart.sequence) {
    const overviewEnded = Math.max(
      position.sequence,
      roomEvents.findLast((candidate) => candidate.operationIndex < overviewEnd)?.sequence ??
        position.sequence,
    );
    const next = history.events.find(
      (candidate) => candidate.sequence > overviewEnded && lifecycleEvent(candidate),
    );
    const through = (next?.sequence ?? (history.events.at(-1)?.sequence ?? overviewEnded) + 1) - 1;
    return Object.freeze({
      owner,
      timeline: false,
      cut: Object.freeze({ kind: 'history', sequence: through, boundary: 'after' }),
      through,
    });
  }
  const opened =
    located.aggregate === 'reward'
      ? doorsOpenedAfter(history, roomKey, position.sequence)
      : undefined;
  if (opened === undefined) return atPosition;
  return Object.freeze({
    owner,
    timeline: true,
    cut: Object.freeze({ kind: 'history', sequence: opened, boundary: 'after' }),
    through: opened,
  });
}

/** Whether a room is created through a sequence. */
function roomCreatedThrough(
  history: BiomeHistoryPrefix,
  room: SemanticAddress,
  sequence: number,
): boolean {
  return history.events.some(
    (event) =>
      event.kind === 'roomCreated' && event.sequence <= sequence && key(event.origin) === key(room),
  );
}

function eventThrough(
  history: BiomeHistoryPrefix,
  sequence: number,
  matches: (event: HistoryEvent) => boolean,
): boolean {
  return history.events.some((event) => event.sequence <= sequence && matches(event));
}

/**
 * Whether a door's room is created through a sequence: the published history
 * holds the doors created before the blocking contact, while door assessments
 * and capabilities also reach the door that contact creates.
 */
function createdThrough(
  history: BiomeHistoryPrefix,
  target: TargetAddress,
  sequence: number,
): boolean {
  const created = history.rooms
    .flatMap((room) => room.targetGenerations)
    .find((generation) => key(generation.targetOrigin) === key(target))?.roomCreationSequence;
  return created !== undefined && created <= sequence;
}

/**
 * Whether a door's assessment is reached by the blocking contact: a created
 * door with its creation, an unauthored slot with its source's last door.
 */
function doorReached(
  history: BiomeHistoryPrefix,
  target: TargetAddress,
  sequence: number,
): boolean {
  const generations = history.rooms.flatMap((room) => room.targetGenerations);
  if (generations.some((generation) => key(generation.targetOrigin) === key(target)))
    return createdThrough(history, target, sequence);
  if (target.source.kind !== 'occurrence') return false;
  const source = key(
    createOccurrenceAddress(
      createBiomeAddress(target.routeKey, target.biomeKey),
      target.source.occurrenceId,
    ),
  );
  // An unauthored slot is assessed once its source has generated every authored door.
  const opened =
    history.rooms.find((room) => key(room.origin) === source)?.targetGenerations.at(-1)?.after
      .sequence ??
    history.events.find(
      (event) => event.kind === 'outgoingGenerationCheckpoint' && key(event.origin) === source,
    )?.sequence;
  return opened !== undefined && opened <= sequence;
}

/**
 * The reached structure of an entered room: its incoming batch, and once its
 * doors open, its outgoing batch with the doors created by the cut.
 */
function roomPrefix(
  prefix: AuthoredPrefix,
  history: BiomeHistoryPrefix,
  through: number,
  room: CanonicalAuthoredRoom,
  incomingIndex: number,
  incoming: CanonicalBatch | undefined,
): AuthoredPrefix {
  const { frontier, ...structure } = prefix;
  const roomKey = key(room.origin);
  const doorsOpened = eventThrough(
    history,
    through,
    (event) => event.kind === 'outgoingGenerationCheckpoint' && key(event.origin) === roomKey,
  );
  const outgoingIndex = incomingIndex + 1;
  // A Preboss leaves through its fixed Boss link: it is reached, the Boss is not.
  if ((prefix.fixedRoomLinks ?? []).some((link) => key(link.source.origin) === roomKey))
    return Object.freeze({
      ...structure,
      fixedRoomLinks: Object.freeze([]),
      decisions: Object.freeze(prefix.decisions.slice(0, outgoingIndex)),
    });
  const outgoing =
    prefix.decisions[outgoingIndex] ??
    (frontier?.kind === 'exitDecision' ? frontier.partialBatch : undefined);
  if (doorsOpened && outgoing?.kind === 'batch' && key(outgoing.parent.origin) === roomKey)
    return Object.freeze({
      ...structure,
      fixedRoomLinks: Object.freeze([]),
      decisions: Object.freeze(prefix.decisions.slice(0, outgoingIndex)),
      frontier: exitFrontier(
        outgoing,
        outgoing.targets.filter((target) => createdThrough(history, target.origin, through)),
      ),
    });
  // A PreHub's doors create the Hub room; its board is generated once the Hub is entered.
  if (doorsOpened && outgoing?.kind === 'hub' && key(outgoing.source.origin) === roomKey)
    return Object.freeze({
      ...structure,
      fixedRoomLinks: Object.freeze([]),
      decisions: Object.freeze(prefix.decisions.slice(0, outgoingIndex)),
      frontier: Object.freeze({ kind: 'hubBoard', origin: outgoing.origin }),
    });
  if (doorsOpened && frontier?.kind === 'exitDecision' && outgoing === undefined)
    return Object.freeze({
      ...prefix,
      fixedRoomLinks: Object.freeze([]),
      decisions: Object.freeze(prefix.decisions.slice(0, outgoingIndex)),
    });
  if (incoming === undefined)
    return Object.freeze({
      ...structure,
      fixedRoomLinks: Object.freeze([]),
      decisions: Object.freeze([]),
    });
  return Object.freeze({
    ...structure,
    fixedRoomLinks: Object.freeze([]),
    decisions: Object.freeze(prefix.decisions.slice(0, incomingIndex)),
    frontier: exitFrontier(incoming, incoming.targets, incoming.additional),
  });
}

/** A Hub visit as reached by the cut: its target, its side doors and entered side rooms. */
function hubVisitPrefix(
  prefix: AuthoredPrefix,
  history: BiomeHistoryPrefix,
  through: number,
  owner: Extract<CutOwner, { readonly kind: 'hubVisit' }>,
): AuthoredPrefix {
  const visit = owner.hub.visits[owner.visitIndex]!;
  const entered = (room: CanonicalAuthoredRoom) =>
    eventThrough(
      history,
      through,
      (event) => event.kind === 'roomEntered' && key(event.origin) === key(room.origin),
    );
  const sideDoorsOpened = eventThrough(
    history,
    through,
    (event) =>
      event.kind === 'outgoingGenerationCheckpoint' &&
      key(event.origin) === key(visit.target.room.origin),
  );
  const enteredLocalRooms = visit.enteredLocalRooms.filter(entered);
  const enteredKeys = new Set(enteredLocalRooms.map((room) => key(room.origin)));
  const localSlots = sideDoorsOpened
    ? visit.localSlots
        .filter((slot) => roomCreatedThrough(history, slot.origin, through))
        .map((slot) =>
          slot.entered && !enteredKeys.has(key(slot.origin))
            ? Object.freeze({ ...slot, entered: false })
            : slot,
        )
    : [];
  const frontier: MaterializedHubVisitFrontier = Object.freeze({
    kind: 'hubVisit',
    origin: visit.origin,
    phase:
      enteredLocalRooms.length > 0
        ? 'localRoomLifecycle'
        : sideDoorsOpened
          ? 'sideGeneration'
          : 'targetLifecycle',
    target: visit.target,
    localSlots: Object.freeze(localSlots),
    enteredLocalRooms: Object.freeze(
      enteredLocalRooms.map(
        (room) => localSlots.find((slot) => key(slot.origin) === key(room.origin)) ?? room,
      ),
    ),
    parentRestores: Object.freeze(
      visit.parentRestores.filter((restore) =>
        eventThrough(
          history,
          through,
          (event) => event.kind === 'roomRestored' && key(event.after) === key(restore.after),
        ),
      ),
    ),
  });
  return Object.freeze({
    ...prefix,
    fixedRoomLinks: Object.freeze([]),
    decisions: Object.freeze([
      ...prefix.decisions.slice(0, owner.decisionIndex),
      Object.freeze({
        ...owner.hub,
        visits: Object.freeze(owner.hub.visits.slice(0, owner.visitIndex)),
      }),
    ]),
    frontier,
  });
}

/**
 * The persistent Hub as reached by the cut: its fountain use, its board with
 * the visits completed before it, or its Handoff doors.
 */
function hubPrefix(
  prefix: AuthoredPrefix,
  history: BiomeHistoryPrefix,
  through: number,
  owner: Extract<CutOwner, { readonly kind: 'hub' }>,
  located: LocatedFinding,
): AuthoredPrefix {
  const { hub, decisionIndex } = owner;
  const withVisits = (decision: CanonicalHubDecision, count: number) =>
    Object.freeze([
      ...prefix.decisions.slice(0, decisionIndex),
      Object.freeze({ ...decision, visits: Object.freeze(hub.visits.slice(0, count)) }),
    ]);
  if (located.hubFountainPrecedingVisitCount !== undefined) {
    const { fountain, ...withoutFountain } = hub;
    void fountain;
    return Object.freeze({
      ...prefix,
      fixedRoomLinks: Object.freeze([]),
      decisions: withVisits(withoutFountain, located.hubFountainPrecedingVisitCount),
      frontier: Object.freeze({
        kind: 'hubFountain',
        origin: createHubFountainAddress(
          createBiomeAddress(hub.origin.routeKey, hub.origin.biomeKey),
          hub.origin.hubKey,
        ),
      }),
    });
  }
  const handoff =
    prefix.decisions[decisionIndex + 1] ??
    (prefix.frontier?.kind === 'exitDecision' ? prefix.frontier.partialBatch : undefined);
  const handoffTargets =
    handoff?.kind === 'batch' && key(handoff.parent.origin) === key(hub.room.origin)
      ? handoff.targets.filter((target) => createdThrough(history, target.origin, through))
      : [];
  if (handoff?.kind === 'batch' && handoffTargets.length > 0)
    return Object.freeze({
      ...prefix,
      fixedRoomLinks: Object.freeze([]),
      decisions: Object.freeze(prefix.decisions.slice(0, decisionIndex + 1)),
      frontier: exitFrontier(handoff, handoffTargets),
    });
  const completedVisits = hub.visits.filter((visit) =>
    eventThrough(
      history,
      through,
      (event) => event.kind === 'roomRestored' && key(event.after) === key(visit.origin),
    ),
  ).length;
  return Object.freeze({
    ...prefix,
    fixedRoomLinks: Object.freeze([]),
    decisions: withVisits(hub, completedVisits),
    frontier: Object.freeze({ kind: 'hubBoard', origin: hub.origin }),
  });
}

/** The reached structure through the cut. */
function assessmentPrefix(
  prefix: AuthoredPrefix,
  history: BiomeHistoryPrefix,
  selected: SelectedCut,
  located: LocatedFinding,
): AuthoredPrefix {
  const { owner, through } = selected;
  switch (owner.kind) {
    case 'start': {
      const { frontier, ...structure } = prefix;
      void frontier;
      return Object.freeze({
        ...structure,
        fixedRoomLinks: Object.freeze([]),
        decisions: Object.freeze([]),
      });
    }
    case 'entry':
      return roomPrefix(prefix, history, through, owner.room, -1, undefined);
    case 'continuation':
      return roomPrefix(prefix, history, through, owner.room, owner.incomingIndex, owner.incoming);
    case 'fixed':
      return Object.freeze({
        ...prefix,
        fixedRoomLinks: Object.freeze((prefix.fixedRoomLinks ?? []).slice(0, owner.linkIndex + 1)),
      });
    case 'hub':
      return hubPrefix(prefix, history, through, owner, located);
    case 'hubVisit':
      return hubVisitPrefix(prefix, history, through, owner);
  }
}

/** A blocking product's batch frontier: the doors generated so far. */
function exitFrontier(
  decision: CanonicalBatch,
  targets: readonly CanonicalTarget[] = [],
  additional: readonly CanonicalAdditionalContinuation[] = decision.additional,
): MaterializedExitDecisionFrontier {
  const partialBatch =
    targets.length > 0
      ? Object.freeze({ ...decision, targets: Object.freeze([...targets]) })
      : undefined;
  return Object.freeze({
    kind: 'exitDecision',
    origin: decision.origin,
    parent: decision.parent,
    targets: Object.freeze([...targets]),
    additional,
    ...(partialBatch === undefined ? {} : { partialBatch, batchState: partialBatch.batchState }),
    selectedExitKey: decision.selectedExitKey,
    selectedOrigin: decision.selectedOrigin,
  });
}

/**
 * The Timeline rows the blocking region owns, whether or not a row carries a
 * finding: every row that settles an owner of the region.
 */
function blockingRowKeys(
  room: CanonicalAuthoredRoom,
  regionKey: string,
  findingRegions: readonly FindingRegionEntry[],
): readonly string[] {
  const owners = findingRegions.flatMap((entry) =>
    entry.atomicRegion !== regionKey
      ? []
      : [entry.finding.origin, ...(entry.repairOwner === undefined ? [] : [entry.repairOwner])],
  );
  return Object.freeze(
    room.roomLifecycleTimeline.entries.flatMap((entry) =>
      entry.kind === 'action' && owners.some((owner) => roomActionOwns(entry.action, owner))
        ? [entry.action.key]
        : [],
    ),
  );
}

/**
 * Ordinary door batches as generated before the cut: a batch whose doors
 * opened keeps every target created by the blocking contact.
 */
function generationThrough(
  selected: BiomeGenerationValidation,
  selectedHistory: BiomeHistoryPrefix,
  cutHistory: BiomeHistoryPrefix,
  block: SelectedCut,
  located: LocatedFinding,
  prefix: AuthoredPrefix,
  findingRegions: readonly FindingRegionEntry[],
): BiomeGenerationValidation {
  const opened = new Set(
    cutHistory.events.flatMap((event) =>
      event.kind === 'outgoingGenerationCheckpoint' ? [key(event.origin)] : [],
    ),
  );
  const parents = new Map(
    prefix.decisions.flatMap((decision) =>
      decision.kind === 'batch' ? [[key(decision.origin), key(decision.parent.origin)]] : [],
    ),
  );
  if (prefix.frontier?.kind === 'exitDecision')
    parents.set(key(prefix.frontier.origin), key(prefix.frontier.parent.origin));
  const ordinaryBatches = selected.ordinary.ordinaryBatches.flatMap(
    (batch): OrdinaryBatchGenerationAssessment[] => {
      const parent = parents.get(key(batch.origin));
      if (parent === undefined || !opened.has(parent)) return [];
      const targets = batch.targets.filter((target) =>
        doorReached(selectedHistory, target.origin, block.cut.sequence),
      );
      return [
        targets.length === batch.targets.length
          ? batch
          : Object.freeze({ ...batch, targets: Object.freeze(targets) }),
      ];
    },
  );
  const reached = (finding: SemanticFinding): boolean => {
    const entry = findingRegions.find((candidate) => candidate.finding === finding);
    const location =
      entry === undefined
        ? undefined
        : locateFinding(prefix, finding, entry.atomicRegion, entry.chronology, entry.aggregate);
    if (location === undefined) return false;
    if (location.regionKey === located.regionKey) return true;
    return location.historySequence === undefined || location.historyBoundary === undefined
      ? compareOwnerLocations(location, located) <= 0
      : compareOwnerLocations(location, {
          ...located,
          historySequence: block.cut.sequence,
          historyBoundary: block.cut.boundary,
        }) <= 0;
  };
  const reachedRooms = new Set(cutHistory.rooms.map((room) => key(room.origin)));
  const phaseRoom = (origin: EncounterPhaseAddress) =>
    key(
      createOccurrenceAddress(
        createBiomeAddress(origin.routeKey, origin.biomeKey),
        origin.owner.occurrenceId,
      ),
    );
  const ordinaryFindings = selected.ordinary.findings.filter(reached);
  const hubFindings = selected.hub.findings.filter(reached);
  const encounterFindings = selected.findings.filter(
    (finding) =>
      !selected.ordinary.findings.includes(finding) &&
      !selected.hub.findings.includes(finding) &&
      reached(finding),
  );
  const findings = Object.freeze([...ordinaryFindings, ...hubFindings, ...encounterFindings]);
  return Object.freeze({
    validity: findings.length === 0 ? 'valid' : 'invalid',
    ordinary: Object.freeze({
      ...selected.ordinary,
      validity: ordinaryFindings.length === 0 ? 'valid' : 'invalid',
      ordinaryBatches: Object.freeze(ordinaryBatches),
      findings: Object.freeze(ordinaryFindings),
    }),
    hub: Object.freeze({
      ...selected.hub,
      validity: hubFindings.length === 0 ? 'valid' : 'invalid',
      // The board is assessed once generated, a visit's side doors once they all exist.
      openSlotConstraints: cutHistory.events.some(
        (event) => event.kind === 'roomCreated' && event.source === 'hubTarget',
      )
        ? selected.hub.openSlotConstraints
        : Object.freeze([]),
      sideRoomGenerations: Object.freeze(
        selected.hub.sideRoomGenerations.filter(
          (entry) =>
            cutHistory.rooms.find(
              (room) =>
                room.origin.kind === 'occurrence' &&
                room.origin.occurrenceId === entry.origin.sourceOccurrenceId,
            )?.outgoingGeneration !== undefined,
        ),
      ),
      findings: Object.freeze(hubFindings),
    }),
    resolvedGenerated: Object.freeze(
      selected.resolvedGenerated.filter((entry) => reachedRooms.has(phaseRoom(entry.origin))),
    ),
    findings,
  });
}

/**
 * Encounter support through the cut: a phase's identity and composition are
 * reached with its room's Overview, its phase-start assessment once it starts
 * at or before the blocking contact, and its execution only before it.
 */
function encountersThrough(
  selected: EncounterCandidateArtifacts,
  selectedHistory: BiomeHistoryPrefix,
  cutHistory: BiomeHistoryPrefix,
  block: SelectedCut,
  rewards: BiomeRewardEvaluationAssembly,
): EncounterCandidateArtifacts {
  const rooms = new Set(cutHistory.rooms.map((room) => key(room.origin)));
  const room = (origin: EncounterPhaseAddress) =>
    key(
      createOccurrenceAddress(
        createBiomeAddress(origin.routeKey, origin.biomeKey),
        origin.owner.occurrenceId,
      ),
    );
  const prepared = (origin: EncounterPhaseAddress) => rooms.has(room(origin));
  const startedAt = (origin: EncounterPhaseAddress) =>
    selectedHistory.events.find(
      (event) =>
        event.kind === 'encounterStarted' &&
        key(event.origin) === room(origin) &&
        event.phaseKey === origin.phaseKey,
    )?.sequence;
  const figLeaf = new Set(
    rewards.simulation.figLeafPhaseCandidates.map((candidate) => key(candidate.origin)),
  );
  const gorgon = new Set(
    rewards.simulation.gorgonPhaseCandidates.map((candidate) => key(candidate.origin)),
  );
  const nemesis = new Map(
    rewards.simulation.nemesisRandomEventCandidates.map((candidate) => [
      key(candidate.origin),
      candidate,
    ]),
  );
  return Object.freeze({
    generationAt: (origin: EncounterPhaseAddress) =>
      prepared(origin) ? selected.generationAt(origin) : undefined,
    rosterAt: (origin: EncounterPhaseAddress) =>
      prepared(origin) ? selected.rosterAt(origin) : undefined,
    at: (origin: EncounterPhaseAddress) => (prepared(origin) ? selected.at(origin) : undefined),
    preparedAt: (origin: EncounterPhaseAddress) =>
      prepared(origin) ? selected.preparedAt(origin) : undefined,
    roomAt: (origin: OccurrenceAddress) =>
      rooms.has(key(origin)) ? selected.roomAt(origin) : undefined,
    statusAt: (origin: EncounterPhaseAddress) => {
      if (!prepared(origin)) return undefined;
      const status = selected.statusAt(origin);
      const started = startedAt(origin);
      if (status?.kind !== 'active' || (started !== undefined && started <= block.through))
        return status;
      return Object.freeze({
        kind: 'active' as const,
        ...(status.aetos === undefined || started !== block.cut.sequence
          ? {}
          : { aetos: status.aetos }),
        ...(status.encounterDefinitionKey === undefined
          ? {}
          : { encounterDefinitionKey: status.encounterDefinitionKey }),
      });
    },
    figLeafAt: (origin: EncounterPhaseAddress) =>
      figLeaf.has(key(origin)) ? selected.figLeafAt(origin) : undefined,
    // A phase blocked at its own start keeps its Fig Leaf support, not its Gorgon support.
    gorgonAt: (origin: EncounterPhaseAddress) => {
      const started = startedAt(origin);
      return gorgon.has(key(origin)) && started !== undefined && started <= block.through
        ? selected.gorgonAt(origin)
        : undefined;
    },
    nemesisAt: (origin: NemesisRandomEventAddress) => nemesis.get(key(origin)),
  });
}

/**
 * Publishes the selected attempt through the start of its blocking product,
 * or through a stopped room's Overview. Nothing is evaluated again: history,
 * the reward walk, door generation and encounter support are all cut at the
 * one chronology position, and the blocking product keeps what its own
 * contact reached. An unpositioned block has no cut.
 */
export function publishSelectedCut(
  catalog: Catalog,
  authoredPrefix: AuthoredPrefix,
  selected: ProgressiveBiomeSelectedProducts,
  located: LocatedFinding,
): ProgressiveBiomeEvaluationAssembly {
  const block = selectedCut(catalog, authoredPrefix, selected.history, located);
  const history = biomeHistoryThrough(selected.history, block.through);
  const rewards = selected.rewardsThrough(block.cut, located.finding.origin);
  const roomGeneration = generationThrough(
    selected.roomGeneration,
    selected.history,
    history,
    block,
    located,
    authoredPrefix,
    selected.findingRegions,
  );
  const regionFindings = findingsAtRegion(
    authoredPrefix,
    selected.findingRegions,
    located.regionKey,
  );
  const issue = createAssessmentIssue(
    located.repairOwner ?? assessmentRepairOwner(located.finding.origin),
    located.regionKey,
    regionFindings,
  );
  // Published closures hold only the products they read, not the selected products.
  const selectedHistory = selected.history;
  const selectedRoomTargets = selected.candidateArtifacts.roomTargets;
  const roomTargets = Object.freeze({
    at: (target: TargetAddress) =>
      doorReached(selectedHistory, target, block.cut.sequence)
        ? selectedRoomTargets.at(target)
        : undefined,
  });
  // Chaos and Contract placement is assessed at the source room's entry.
  const entered = new Set(history.rooms.map((room) => key(room.origin)));
  const chaos = selected.candidateArtifacts.chaos;
  const zagreusContracts = selected.candidateArtifacts.zagreusContracts;
  const candidateArtifacts = createBiomeCandidateArtifacts(
    selected.candidateArtifacts.origin,
    roomTargets,
    rewards.producerArtifacts,
    rewards.lifecycleArtifacts,
    encountersThrough(
      selected.candidateArtifacts.encounters,
      selected.history,
      history,
      block,
      rewards,
    ),
    rewards.traitOfferArtifacts,
    rewards.levelResolutionArtifacts,
    rewards.judgmentArcanaArtifacts,
    rewards.keepsakeSelectionArtifacts,
    rewards.keepsakeEquipResultArtifacts,
    rewards.acquisitionConversionArtifacts,
    rewards.derivedAcquisitionEntryArtifacts,
    rewards.steadyGrowthArtifacts,
    rewards.purgingPoolArtifacts,
    rewards.hermesShrineArtifacts,
    rewards.stygianWellArtifacts,
    rewards.fountainRarityArtifacts,
    rewards.figurineArcanaArtifacts,
    rewards.transcendentEmbryoArtifacts,
    Object.freeze({
      at: (occurrence: OccurrenceAddress) =>
        entered.has(key(occurrence)) ? chaos.at(occurrence) : undefined,
    }),
    Object.freeze({
      at: (occurrence: OccurrenceAddress) =>
        entered.has(key(occurrence)) ? zagreusContracts.at(occurrence) : undefined,
    }),
  );
  const evaluation = Object.freeze({
    history,
    rewards: rewards.simulation,
    roomGeneration,
    findings: Object.freeze([]),
  });
  return Object.freeze({
    evaluation: Object.freeze({
      ...evaluation,
      materializedPrefix: authoredPrefix,
      assessmentPrefix: assessmentPrefix(authoredPrefix, selected.history, block, located),
      findings: mergedFindings(evaluation, regionFindings),
      blockedAt: located.finding.origin,
      issue,
      blockedKind: issue.kind,
      blockedRegionKey: located.regionKey,
      blockedLocation: findingLocation(located),
      ...(!block.timeline || block.owner.kind === 'start' || block.owner.kind === 'hub'
        ? {}
        : {
            roomTimeline: Object.freeze({
              room: block.owner.room.origin,
              blockingRowKeys: blockingRowKeys(
                block.owner.room,
                located.regionKey,
                selected.findingRegions,
              ),
            }),
          }),
    }),
    candidateArtifacts,
  });
}
