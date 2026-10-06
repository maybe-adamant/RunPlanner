import {
  createBiomeAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type EncounterPhaseAddress,
  type NemesisRandomEventAddress,
  type OccurrenceAddress,
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
  selectedBatchContinuationRoom,
  type CanonicalAuthoredRoom,
  type CanonicalBatch,
  type MaterializedBiomePrefix,
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
import { exitFrontier } from './prefix';
import type { BiomeGenerationValidation, ProgressiveBiomeEvaluationAssembly } from './products';

type AuthoredPrefix = MaterializedBiomePrefix & {
  readonly entryRoom: NonNullable<MaterializedBiomePrefix['entryRoom']>;
};

/**
 * A block inside an entered ordinary room after its Overview: in its
 * Timeline, at its doors opening or in its exit work.
 */
interface RoomTimelineBlock {
  readonly room: CanonicalAuthoredRoom;
  readonly incomingIndex: number;
  readonly incoming: CanonicalBatch;
  readonly cut: HistoryFindingChronology;
  /** The last selected history event reached before the blocking product. */
  readonly through: number;
}

const key = semanticAddressKey;

function roomTimelineBlock(
  catalog: Catalog,
  prefix: MaterializedBiomePrefix,
  history: BiomeHistoryPrefix,
  located: LocatedFinding,
): RoomTimelineBlock | undefined {
  if (located.historySequence === undefined || located.historyBoundary === undefined)
    return undefined;
  if (
    located.fixedRoomIndex !== undefined ||
    located.hubBoardTargetIndex !== undefined ||
    located.hubVisitIndex !== undefined ||
    located.hubFountainPrecedingVisitCount !== undefined
  )
    return undefined;
  const cut: HistoryFindingChronology = Object.freeze({
    kind: 'history',
    sequence: located.historySequence,
    boundary: located.historyBoundary,
  });
  const before = history.events.filter((event) => event.sequence < cut.sequence);
  const arrival = before.findLast(
    (event) => event.kind === 'roomEntered' || event.kind === 'roomRestored',
  );
  if (arrival?.kind !== 'roomEntered' || arrival.origin.kind !== 'occurrence') return undefined;
  const roomKey = key(arrival.origin);
  if (before.some((event) => event.kind === 'roomExited' && key(event.origin) === roomKey))
    return undefined;
  // The opening room, fixed rooms and Hub-owned continuations keep their own lifecycles.
  const incomingIndex = prefix.decisions.findIndex(
    (decision) =>
      decision.kind === 'batch' &&
      decision.parent.origin.kind === 'occurrence' &&
      key(selectedBatchContinuationRoom(decision).origin) === roomKey,
  );
  const incoming = prefix.decisions[incomingIndex];
  if (incoming?.kind !== 'batch') return undefined;
  const outgoing = prefix.decisions[incomingIndex + 1];
  if (outgoing !== undefined && outgoing.kind !== 'batch') return undefined;
  const room = selectedBatchContinuationRoom(incoming);
  const profile = catalog.roomLifecycleProfiles.byKey[room.lifecycleProfileKey];
  if (profile === undefined)
    throw new BiomeMaterializationContractError(
      `${room.gameName} has unknown lifecycle profile ${room.lifecycleProfileKey}`,
    );
  const overviewEnd = roomOverviewOperationCount(profile);
  const timelineStart = history.events.find(
    (event): event is Extract<HistoryEvent, { readonly operationIndex: number }> =>
      'operationIndex' in event &&
      key(event.origin) === roomKey &&
      event.operationIndex >= overviewEnd,
  );
  // A block before the first Timeline event belongs to the room's Overview.
  if (timelineStart === undefined || cut.sequence < timelineStart.sequence) return undefined;
  // Door offers share one offer-time store, so an offer block makes the whole
  // doors opening its blocking product; a generation block stops at its door.
  const opening = history.events.find(
    (event) => event.kind === 'outgoingGenerationCheckpoint' && key(event.origin) === roomKey,
  )?.sequence;
  const opened = history.rooms
    .find((candidate) => key(candidate.origin) === roomKey)
    ?.targetGenerations.at(-1)?.after.sequence;
  const blocking: HistoryFindingChronology =
    located.aggregate === 'reward' &&
    opening !== undefined &&
    opened !== undefined &&
    cut.sequence > opening &&
    cut.sequence <= opened
      ? Object.freeze({ kind: 'history', sequence: opened, boundary: 'after' })
      : cut;
  return Object.freeze({
    room,
    incomingIndex,
    incoming,
    cut: blocking,
    through: blocking.boundary === 'after' ? blocking.sequence : blocking.sequence - 1,
  });
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

/** The reached structure: the room entered, and its doors as created by the cut. */
function timelineAssessmentPrefix(
  prefix: AuthoredPrefix,
  history: BiomeHistoryPrefix,
  block: RoomTimelineBlock,
): AuthoredPrefix {
  const roomKey = key(block.room.origin);
  const doorsOpened = history.events.some(
    (event) =>
      event.kind === 'outgoingGenerationCheckpoint' &&
      key(event.origin) === roomKey &&
      event.sequence <= block.through,
  );
  const outgoingIndex = block.incomingIndex + 1;
  const outgoing =
    prefix.decisions[outgoingIndex] ??
    (prefix.frontier?.kind === 'exitDecision' ? prefix.frontier.partialBatch : undefined);
  if (doorsOpened && outgoing?.kind === 'batch' && key(outgoing.parent.origin) === roomKey)
    return Object.freeze({
      ...prefix,
      fixedRoomLinks: Object.freeze([]),
      decisions: Object.freeze(prefix.decisions.slice(0, outgoingIndex)),
      frontier: exitFrontier(
        outgoing,
        outgoing.targets.filter((target) => createdThrough(history, target.origin, block.through)),
      ),
    });
  if (doorsOpened && prefix.frontier?.kind === 'exitDecision' && outgoing === undefined)
    return Object.freeze({
      ...prefix,
      fixedRoomLinks: Object.freeze([]),
      decisions: Object.freeze(prefix.decisions.slice(0, outgoingIndex)),
    });
  return Object.freeze({
    ...prefix,
    fixedRoomLinks: Object.freeze([]),
    decisions: Object.freeze(prefix.decisions.slice(0, block.incomingIndex)),
    frontier: exitFrontier(
      block.incoming,
      block.incoming.targets,
      block.incoming.additional,
      true,
      'timeline',
    ),
  });
}

/**
 * The Timeline rows the blocking region owns, whether or not a row carries a
 * finding: every row that settles an owner of the region.
 */
function blockingRowKeys(
  block: RoomTimelineBlock,
  regionKey: string,
  findingRegions: readonly FindingRegionEntry[],
): readonly string[] {
  const owners = findingRegions.flatMap((entry) =>
    entry.atomicRegion !== regionKey
      ? []
      : [entry.finding.origin, ...(entry.repairOwner === undefined ? [] : [entry.repairOwner])],
  );
  return Object.freeze(
    block.room.roomLifecycleTimeline.entries.flatMap((entry) =>
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
  block: RoomTimelineBlock,
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
  block: RoomTimelineBlock,
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
 * Publishes the selected attempt through the start of a room's blocking
 * product. Nothing is evaluated again: history, the reward walk, door
 * generation and encounter support are all cut at the one chronology
 * position, and the blocking product keeps what its own contact reached.
 */
export function publishRoomTimelineBlock(
  catalog: Catalog,
  authoredPrefix: AuthoredPrefix,
  selected: ProgressiveBiomeSelectedProducts,
  located: LocatedFinding,
): ProgressiveBiomeEvaluationAssembly | undefined {
  const block = roomTimelineBlock(catalog, authoredPrefix, selected.history, located);
  if (block === undefined) return undefined;
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
      assessmentPrefix: timelineAssessmentPrefix(authoredPrefix, selected.history, block),
      findings: mergedFindings(evaluation, regionFindings),
      blockedAt: located.finding.origin,
      issue,
      blockedKind: issue.kind,
      blockedRegionKey: located.regionKey,
      blockedLocation: findingLocation(located),
      roomTimeline: Object.freeze({
        room: block.room.origin,
        blockingRowKeys: blockingRowKeys(block, located.regionKey, selected.findingRegions),
      }),
    }),
    candidateArtifacts,
  });
}
