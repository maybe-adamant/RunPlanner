import type { Catalog, HubDecisionDescriptor } from '../../catalog-schema';
import {
  createBiomeAddress,
  createHubOpenSetAddress,
  createHubSlotAddress,
  semanticAddressKey,
} from '../../authored-project/addresses';
import type {
  CanonicalAuthoredRoom,
  CanonicalBiome,
  CanonicalHubDecision,
  CanonicalHubVisit,
  MaterializedBiomePrefix,
} from '../materialization';
import type {
  BiomeHistoryPrefix,
  CanonicalBiomeHistory,
  ProgressiveRoomHistoryViews,
} from '../history';
import type { FindingEvidence, SemanticFinding } from '../model';
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
    decision.room.gameName !== layout.progression.roomGameName
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
  visit: CanonicalHubVisit,
  views: ReadonlyMap<string, ProgressiveRoomHistoryViews>,
  findings: SemanticFinding[],
): readonly HubSideRoomGenerationSupportEntry[] {
  const view = views.get(semanticAddressKey(visit.target.room.origin));
  const generatedBefore = view?.preOutgoing?.ledgers.counters.numSubRoomsSpawned;
  if (generatedBefore === undefined) {
    fail(`Hub visit ${visit.visitIndex} has no side-generation history context`);
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
    if (slot.generation === 'generated') generated += 1;
    return entry;
  });
  if (view?.outgoingGeneration?.ledgers.counters.numSubRoomsSpawned !== generated) {
    fail(`Hub visit ${visit.visitIndex} side-generation history diverges from authored state`);
  }
  return Object.freeze(entries);
}

export function evaluateHubDecisionGeneration(
  catalog: Catalog,
  snapshot: HubGenerationSnapshot,
  history: HubGenerationHistory,
): HubRoomGenerationValidation {
  const resolved = requireHubDecision(catalog, snapshot);
  if (resolved === null) {
    return Object.freeze({
      biomeKey: snapshot.biomeKey,
      validity: 'valid',
      openSlotConstraints: Object.freeze([]),
      sideRoomGenerations: Object.freeze([]),
      findings: Object.freeze([]),
    });
  }
  const { descriptor, decision } = resolved;
  assertBoardIdentity(descriptor, decision, snapshot.kind === 'biome');
  if (snapshot.kind === 'biome' && decision.visits.length !== descriptor.requiredVisits) {
    fail(`${descriptor.hubKey} requires exactly ${descriptor.requiredVisits} visits`);
  }
  const visited = new Set<string>();
  for (const [index, visit] of decision.visits.entries()) {
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
  const views = roomViews(history);
  const sideRoomGenerations = Object.freeze(
    decision.visits.flatMap((visit) => validateVisit(descriptor, visit, views, findings)),
  );
  return Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: findings.length === 0 ? 'valid' : 'invalid',
    openSlotConstraints: openSet.entries,
    sideRoomGenerations,
    findings: Object.freeze(findings),
  });
}
