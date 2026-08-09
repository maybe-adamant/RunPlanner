import type { Catalog, HubDecisionDescriptor } from '../../catalog-schema';
import {
  createBiomeAddress,
  createHubOpenSetAddress,
  createHubSlotAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type {
  CanonicalAuthoredRoom,
  CanonicalBiome,
  CanonicalHubDecision,
  CanonicalHubVisit,
  MaterializedBiomePrefix,
  MaterializedHubVisitFrontier,
} from '../materialization';
import type {
  BiomeHistoryPrefix,
  CanonicalBiomeHistory,
  ProgressiveRoomHistoryViews,
} from '../history';
import type { FindingEvidence, SemanticFinding } from '../model';
import {
  findingRegion,
  ownerRegion,
  type FindingRegionEntry,
  type FindingChronology,
} from '../finding-regions';
import type {
  HubOpenSlotConstraintSupportEntry,
  HubRoomGenerationValidation,
  HubSideRoomGenerationSupportEntry,
  SideRoomGenerationOutcome,
} from './model';

export class HubDecisionGenerationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'HubDecisionGenerationContractError';
  }
}

export type HubGenerationSnapshot =
  CanonicalBiome | (MaterializedBiomePrefix & { readonly entryRoom: CanonicalAuthoredRoom });
export type HubGenerationHistory = CanonicalBiomeHistory | BiomeHistoryPrefix;

interface HubGenerationValidationWithRegions extends HubRoomGenerationValidation {
  readonly findingRegions: readonly FindingRegionEntry[];
}

/**
 * The active Hub visit frontier is intentionally smaller than a completed
 * CanonicalHubVisit: it has not acquired a return restore yet. Generation
 * validation only needs the visit's physical target and local-slot envelope,
 * so keep that checkpoint product independent of completion-only topology.
 */
type HubVisitGenerationShape = Pick<
  CanonicalHubVisit,
  'origin' | 'visitIndex' | 'target' | 'localSlots' | 'enteredLocalRooms'
>;

function fail(detail: string): never {
  throw new HubDecisionGenerationContractError(detail);
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

function requireHubDecision(
  catalog: Catalog,
  snapshot: HubGenerationSnapshot,
): { readonly descriptor: HubDecisionDescriptor; readonly decision: CanonicalHubDecision } | null {
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (layout === undefined) fail(`${snapshot.biomeKey} has no catalog layout`);
  if (layout.progression.kind !== 'hub') return null;
  const decision = snapshot.decisions.find(
    (candidate): candidate is CanonicalHubDecision => candidate.kind === 'hub',
  );
  if (decision === undefined) {
    if (snapshot.kind === 'biome') fail(`${snapshot.biomeKey} selected spine has no Hub decision`);
    return null;
  }
  if (
    decision.origin.hubKey !== layout.progression.hubKey ||
    decision.room.gameName !== layout.progression.terminal.roomGameName
  ) {
    fail(`${snapshot.biomeKey} Hub decision does not match its catalog declaration`);
  }
  return Object.freeze({ descriptor: layout.progression, decision });
}

export function evaluateHubOpenSetConstraints(
  descriptor: HubDecisionDescriptor,
  biome: ReturnType<typeof createBiomeAddress>,
  openSlotKeys: readonly string[],
): {
  readonly entries: readonly HubOpenSlotConstraintSupportEntry[];
  readonly findings: readonly SemanticFinding[];
} {
  const openKeys = new Set(openSlotKeys);
  const findings: SemanticFinding[] = [];
  const entries = Object.freeze(
    descriptor.openSlotConstraints.map((constraint, constraintIndex) => {
      const constrainedOpen = constraint.slotKeys.filter((slotKey) => openKeys.has(slotKey));
      const selectedPossible = constrainedOpen.length <= constraint.max;
      const entry: HubOpenSlotConstraintSupportEntry = Object.freeze({
        origin: createHubOpenSetAddress(biome, descriptor.hubKey),
        constraintIndex,
        constrainedSlotKeys: constraint.slotKeys,
        openSlotKeys: Object.freeze(constrainedOpen),
        maximumOpenCount: constraint.max,
        selectedPossible,
      });
      if (!selectedPossible) {
        for (const hubSlotKey of constrainedOpen) {
          findings.push(
            finding(
              'hubOpenSlotUnavailable',
              createHubSlotAddress(biome, descriptor.hubKey, hubSlotKey),
              {
                constraintIndex,
                constrainedSlotKeys: constraint.slotKeys,
                openSlotKeys: entry.openSlotKeys,
                maximumOpenCount: constraint.max,
                actualOpenCount: constrainedOpen.length,
              },
            ),
          );
        }
      }
      return entry;
    }),
  );
  return Object.freeze({ entries, findings: Object.freeze(findings) });
}

function roomViews(
  history: HubGenerationHistory,
): ReadonlyMap<string, ProgressiveRoomHistoryViews> {
  return new Map(history.rooms.map((room) => [semanticAddressKey(room.origin), room]));
}

function hubBoardChronology(
  history: HubGenerationHistory,
  roomOrigin: SemanticAddress,
): FindingChronology {
  const room = history.rooms.find(
    (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(roomOrigin),
  );
  const sequence = room?.targetGenerations.reduce(
    (latest, target) => Math.max(latest, target.roomCreationSequence),
    -1,
  );
  return sequence === undefined || sequence < 0
    ? { kind: 'hubBoard' }
    : {
        kind: 'hubBoard',
        history: { kind: 'history', sequence, boundary: 'at' },
      };
}

function requiredGeneratedCount(descriptor: HubDecisionDescriptor, visitIndex: number): number {
  const ratio = descriptor.sideRoomGeneration.minimumPerVisit;
  return Math.ceil((visitIndex * ratio.numerator) / ratio.denominator);
}

function assertBoardIdentity(
  descriptor: HubDecisionDescriptor,
  decision: CanonicalHubDecision,
  requireMinimumOpenCount: boolean,
): void {
  const openKeys = new Set(decision.board.targets.map((target) => target.hubSlotKey));
  const expected = descriptor.slots
    .filter((slot) => openKeys.has(slot.slotKey))
    .map((slot) => slot.slotKey);
  if (
    (requireMinimumOpenCount && decision.board.targets.length < descriptor.openCount.min) ||
    decision.board.targets.length > descriptor.openCount.max ||
    expected.some((slotKey, index) => decision.board.targets[index]?.hubSlotKey !== slotKey)
  ) {
    fail(`${descriptor.hubKey} Hub board is not in declaration-owned physical order`);
  }
}

function validateVisit(
  descriptor: HubDecisionDescriptor,
  visit: HubVisitGenerationShape,
  views: ReadonlyMap<string, ProgressiveRoomHistoryViews>,
  findings: SemanticFinding[],
  findingRegions: FindingRegionEntry[],
  activeFrontierPhase?: MaterializedHubVisitFrontier['phase'],
): readonly HubSideRoomGenerationSupportEntry[] {
  // Reaching local lifecycle already proves the visit's outgoing generation
  // checkpoint.  The active frontier must remain available for locating and
  // clamping later local findings, but it must not re-emit an earlier
  // side-generation decision as a competing blocker.
  if (activeFrontierPhase === 'localRoomLifecycle') return Object.freeze([]);
  const view = views.get(semanticAddressKey(visit.target.room.origin));
  const generatedBefore = view?.preOutgoing?.ledgers.counters.numSubRoomsSpawned;
  if (generatedBefore === undefined) {
    // The topology projection may retain a complete Hub board/visit shape while
    // the bounded history has not reached this target's outgoing checkpoint.
    // Leave that later visit unavailable until its own history context exists.
    return Object.freeze([]);
  }
  const required = requiredGeneratedCount(descriptor, visit.visitIndex);
  let generated = generatedBefore;
  const ordered = [...visit.localSlots].sort(
    (left, right) => left.availabilityRank - right.availabilityRank,
  );
  const entries = ordered.map((slot, index): HubSideRoomGenerationSupportEntry => {
    if (slot.availabilityRank !== index + 1) {
      fail(`Hub visit ${visit.visitIndex} has non-contiguous side availability ranks`);
    }
    const supportOutcomes: readonly SideRoomGenerationOutcome[] = Object.freeze(
      generated < required ? ['generated'] : ['generated', 'notGenerated'],
    );
    const selectedPossible = supportOutcomes.includes(slot.generation);
    const entry: HubSideRoomGenerationSupportEntry = Object.freeze({
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
      const value = finding('sideRoomGenerationUnavailable', slot.origin, {
        visitIndex: visit.visitIndex,
        availabilityRank: slot.availabilityRank,
        generatedBefore: generated,
        requiredGeneratedCount: required,
        selectedOutcome: slot.generation,
        supportOutcomes,
      });
      findings.push(value);
      const chronology: FindingChronology = {
        kind: 'hubVisit',
        // Located Hub positions use the physical zero-based decision index;
        // the authored visitIndex itself is one-based.
        visitIndex: visit.visitIndex - 1,
        phase: 'sideGeneration',
      };
      findingRegions.push(
        findingRegion(value, ownerRegion(value.origin), chronology, 'generation'),
      );
    }
    if (slot.generation === 'generated') generated += 1;
    return entry;
  });
  if (
    activeFrontierPhase === undefined &&
    view?.outgoingGeneration?.ledgers.counters.numSubRoomsSpawned !== generated
  ) {
    fail(`Hub visit ${visit.visitIndex} side-generation history diverges from authored state`);
  }
  return Object.freeze(entries);
}

export function evaluateHubDecisionGenerationInternal(
  catalog: Catalog,
  snapshot: HubGenerationSnapshot,
  history: HubGenerationHistory,
): HubGenerationValidationWithRegions {
  const resolved = requireHubDecision(catalog, snapshot);
  if (resolved === null) {
    return Object.freeze({
      biomeKey: snapshot.biomeKey,
      validity: 'valid',
      openSlotConstraints: Object.freeze([]),
      sideRoomGenerations: Object.freeze([]),
      findings: Object.freeze([]),
      findingRegions: Object.freeze([]),
    });
  }
  const { descriptor, decision } = resolved;
  assertBoardIdentity(descriptor, decision, snapshot.kind === 'biome');
  if (snapshot.kind === 'biome' && decision.visits.length !== descriptor.requiredVisits) {
    fail(`${descriptor.hubKey} requires exactly ${descriptor.requiredVisits} visits`);
  }
  const activeFrontier =
    snapshot.kind === 'biomePrefix' &&
    snapshot.frontier?.kind === 'hubVisit' &&
    'target' in snapshot.frontier
      ? snapshot.frontier
      : undefined;
  const visits: readonly HubVisitGenerationShape[] =
    activeFrontier === undefined
      ? decision.visits
      : Object.freeze([
          ...decision.visits,
          Object.freeze({
            origin: activeFrontier.origin,
            visitIndex: activeFrontier.origin.visitIndex,
            target: activeFrontier.target,
            localSlots: activeFrontier.localSlots,
            enteredLocalRooms: activeFrontier.enteredLocalRooms,
          }),
        ]);
  const visited = new Set<string>();
  for (const [index, visit] of visits.entries()) {
    if (
      visit.visitIndex !== index + 1 ||
      visited.has(visit.target.hubSlotKey) ||
      !decision.board.targets.includes(visit.target)
    ) {
      fail(`${descriptor.hubKey} visit ${index + 1} is not a distinct board target`);
    }
    visited.add(visit.target.hubSlotKey);
  }
  const biome = createBiomeAddress(snapshot.routeKey, snapshot.biomeKey);
  const openSet = evaluateHubOpenSetConstraints(
    descriptor,
    biome,
    decision.board.targets.map((target) => target.hubSlotKey),
  );
  const findings: SemanticFinding[] = [...openSet.findings];
  const findingRegions: FindingRegionEntry[] = openSet.findings.map((value) =>
    findingRegion(
      value,
      ownerRegion(openSet.entries[0]?.origin ?? decision.board.origin),
      hubBoardChronology(history, decision.room.origin),
      'generation',
    ),
  );
  const views = roomViews(history);
  const sideRoomGenerations = Object.freeze(
    visits.flatMap((visit) =>
      validateVisit(
        descriptor,
        visit,
        views,
        findings,
        findingRegions,
        activeFrontier?.origin === visit.origin ? activeFrontier.phase : undefined,
      ),
    ),
  );
  const tracked = new Set(findingRegions.map((entry) => entry.finding));
  for (const value of findings) {
    if (!tracked.has(value))
      findingRegions.push(findingRegion(value, ownerRegion(value.origin), undefined, 'generation'));
  }
  return Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: findings.length === 0 ? 'valid' : 'invalid',
    openSlotConstraints: openSet.entries,
    sideRoomGenerations,
    findings: Object.freeze(findings),
    findingRegions: Object.freeze(findingRegions),
  });
}

export function evaluateHubDecisionGeneration(
  catalog: Catalog,
  snapshot: HubGenerationSnapshot,
  history: HubGenerationHistory,
): HubRoomGenerationValidation {
  const validation = evaluateHubDecisionGenerationInternal(catalog, snapshot, history);
  return Object.freeze({
    biomeKey: validation.biomeKey,
    validity: validation.validity,
    openSlotConstraints: validation.openSlotConstraints,
    sideRoomGenerations: validation.sideRoomGenerations,
    findings: validation.findings,
  });
}
