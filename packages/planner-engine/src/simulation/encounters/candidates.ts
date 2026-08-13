import {
  semanticAddressKey,
  type EncounterPhaseAddress,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import { projectRoomPreparationCheckpoint } from '../history/facts';
import type { HistoryStateView } from '../history/model';
import type { CanonicalAuthoredRoom, CanonicalLocalChildRoom } from '../materialization';
import type { SemanticFinding } from '../model';
import {
  findingRegion,
  type FindingRegionEntry,
  type HistoryFindingChronology,
} from '../finding-regions';
import {
  prepareRoomEncounterPhases,
  type EncounterAuthoringRoom,
  type EncounterPhaseCandidateSupport,
  type EncounterPhaseSequenceStatus,
  type PreparedEncounterPhases,
} from './preparation';
import type { ResolvedEncounterPhase } from './model';
import type { Catalog } from '../../catalog-schema';
import type { FigLeafPhaseCandidateSupport } from '../rewards/model';

/** Private capability from the exact simulation assembly. */
export interface EncounterCandidateArtifacts {
  readonly at: (origin: EncounterPhaseAddress) => EncounterPhaseCandidateSupport | undefined;
  readonly statusAt: (origin: EncounterPhaseAddress) => EncounterPhaseSequenceStatus | undefined;
  /**
   * A top-level room's exact preparation checkpoint, retained for structural
   * authoring candidates that materialize a different encounter envelope.
   */
  readonly roomAt: (origin: OccurrenceAddress) => EncounterRoomCandidateCapability | undefined;
  readonly figLeafAt: (origin: EncounterPhaseAddress) => FigLeafPhaseCandidateSupport | undefined;
}

/**
 * Opaque room-local preparation capability from one exact simulation. The
 * caller supplies only a resolved replacement envelope; the captured room
 * identity and predecessor checkpoint stay private to the encounter layer.
 */
export interface EncounterRoomCandidateCapability {
  readonly prepare: (phases: readonly ResolvedEncounterPhase[]) => PreparedEncounterPhases;
}

export interface EncounterCandidateEvaluation {
  readonly artifacts: EncounterCandidateArtifacts;
  readonly findings: readonly SemanticFinding[];
}

export interface EncounterCandidateBoundary {
  /**
   * An encounter block has one more precise owner checkpoint: the failed
   * room itself must evaluate from before its valid record-only prefix.
   */
  readonly blocked?: {
    readonly room: EncounterAuthoringRoom;
    readonly before: HistoryStateView;
  };
}

function candidateContext(
  room: EncounterAuthoringRoom,
  views: ReadonlyMap<string, HistoryStateView>,
  boundary: EncounterCandidateBoundary | undefined,
): HistoryStateView | undefined {
  const key = semanticAddressKey(room.origin);
  const canonical = views.get(key);
  if (canonical !== undefined) return canonical;
  if (boundary === undefined) return undefined;
  if (boundary.blocked !== undefined && key === semanticAddressKey(boundary.blocked.room.origin)) {
    return projectRoomPreparationCheckpoint(boundary.blocked.before);
  }
  return undefined;
}

function hasExactCandidateContext(
  room: EncounterAuthoringRoom,
  views: ReadonlyMap<string, HistoryStateView>,
  boundary: EncounterCandidateBoundary | undefined,
): boolean {
  const key = semanticAddressKey(room.origin);
  return (
    views.has(key) ||
    (boundary?.blocked !== undefined && key === semanticAddressKey(boundary.blocked.room.origin))
  );
}

/**
 * Projects candidate support for every structurally active editable phase.
 * Canonically entered rooms use their own preparation checkpoint. A bounded
 * prefix exposes only rooms with exact preparation checkpoints. An
 * encounter-blocked owner restarts from its exact predecessor checkpoint;
 * later authored rooms remain unavailable until their own checkpoint exists.
 */
export function evaluateEncounterCandidatesInternal(
  catalog: Catalog,
  rooms: readonly (CanonicalAuthoredRoom | CanonicalLocalChildRoom)[],
  views: ReadonlyMap<string, HistoryStateView>,
  boundary?: EncounterCandidateBoundary,
  figLeafCandidates: readonly FigLeafPhaseCandidateSupport[] = [],
): EncounterCandidateEvaluation & { readonly findingRegions: readonly FindingRegionEntry[] } {
  const entries = new Map<string, EncounterPhaseCandidateSupport>();
  const statuses = new Map<string, EncounterPhaseSequenceStatus>();
  const roomsByOwner = new Map<string, EncounterRoomCandidateCapability>();
  const findings: SemanticFinding[] = [];
  const findingChronologies = new Map<string, HistoryFindingChronology>();
  for (const room of rooms) {
    if (!room.entered) continue;
    const context = candidateContext(room, views, boundary);
    if (context === undefined) continue;
    const prepared = prepareRoomEncounterPhases(catalog, room, context);
    if (room.kind === 'authored' && hasExactCandidateContext(room, views, boundary)) {
      const roomKey = semanticAddressKey(room.origin);
      if (roomsByOwner.has(roomKey)) {
        throw new Error(`duplicate encounter room candidate ${roomKey}`);
      }
      roomsByOwner.set(
        roomKey,
        Object.freeze({
          prepare: (phases: readonly ResolvedEncounterPhase[]): PreparedEncounterPhases =>
            prepareRoomEncounterPhases(
              catalog,
              Object.freeze({ ...room, encounterPhases: phases }),
              context,
            ),
        }),
      );
    }
    for (const support of prepared.candidates) {
      const key = semanticAddressKey(support.origin);
      if (entries.has(key)) throw new Error(`duplicate encounter candidate ${key}`);
      entries.set(key, support);
    }
    for (const entry of prepared.statuses) {
      const key = semanticAddressKey(entry.origin);
      if (statuses.has(key)) throw new Error(`duplicate encounter phase status ${key}`);
      statuses.set(key, entry.status);
    }
    findings.push(...prepared.findings);
    prepared.findings.forEach((finding) => {
      // Finding regions are produced here while the exact room-preparation
      // checkpoint is still available; do not infer this lifecycle position
      // later from encounter finding codes.
      findingChronologies.set(
        semanticAddressKey(finding.origin),
        Object.freeze({ kind: 'history', sequence: context.sequence, boundary: 'at' }),
      );
    });
  }
  const privateEntries = new Map(entries);
  const privateStatuses = new Map(statuses);
  const privateRooms = new Map(roomsByOwner);
  const privateFigLeaf = new Map(
    figLeafCandidates.map((candidate) => [semanticAddressKey(candidate.origin), candidate]),
  );
  return Object.freeze({
    artifacts: Object.freeze({
      at: (origin: EncounterPhaseAddress) => privateEntries.get(semanticAddressKey(origin)),
      statusAt: (origin: EncounterPhaseAddress) => privateStatuses.get(semanticAddressKey(origin)),
      roomAt: (origin: OccurrenceAddress) => privateRooms.get(semanticAddressKey(origin)),
      figLeafAt: (origin: EncounterPhaseAddress) => privateFigLeaf.get(semanticAddressKey(origin)),
    }),
    findings: Object.freeze(findings),
    findingRegions: Object.freeze(
      findings.map((finding) => {
        const chronology = findingChronologies.get(semanticAddressKey(finding.origin));
        return findingRegion(finding, undefined, chronology, 'encounter');
      }),
    ),
  });
}

export function evaluateEncounterCandidates(
  catalog: Catalog,
  rooms: readonly (CanonicalAuthoredRoom | CanonicalLocalChildRoom)[],
  views: ReadonlyMap<string, HistoryStateView>,
  boundary?: EncounterCandidateBoundary,
): EncounterCandidateEvaluation {
  const evaluation = evaluateEncounterCandidatesInternal(catalog, rooms, views, boundary);
  return Object.freeze({ artifacts: evaluation.artifacts, findings: evaluation.findings });
}
