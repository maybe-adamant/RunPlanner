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
  prepareRoomEncounterPhases,
  type EncounterAuthoringRoom,
  type EncounterPhaseCandidateSupport,
  type PreparedEncounterPhases,
} from './preparation';
import type { ResolvedEncounterPhase } from './model';
import type { Catalog } from '../../catalog-schema';

/** Private capability from the exact simulation assembly. */
export interface EncounterCandidateArtifacts {
  readonly at: (origin: EncounterPhaseAddress) => EncounterPhaseCandidateSupport | undefined;
  /**
   * A top-level room's exact preparation checkpoint, retained for structural
   * authoring candidates that materialize a different encounter envelope.
   */
  readonly roomAt: (origin: OccurrenceAddress) => EncounterRoomCandidateCapability | undefined;
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
   * The last canonical checkpoint available to a structurally retained room
   * without its own preparation view. It never fabricates a later lifecycle,
   * counter, or reward effect.
   */
  readonly fallback: HistoryStateView;
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
  return boundary.fallback;
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
 * prefix may retain later authored controls: those rooms use only its final
 * canonical checkpoint, while an encounter-blocked owner restarts from its
 * exact predecessor checkpoint. Neither case fabricates lifecycle effects.
 */
export function evaluateEncounterCandidates(
  catalog: Catalog,
  rooms: readonly (CanonicalAuthoredRoom | CanonicalLocalChildRoom)[],
  views: ReadonlyMap<string, HistoryStateView>,
  boundary?: EncounterCandidateBoundary,
): EncounterCandidateEvaluation {
  const entries = new Map<string, EncounterPhaseCandidateSupport>();
  const roomsByOwner = new Map<string, EncounterRoomCandidateCapability>();
  const findings: SemanticFinding[] = [];
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
    findings.push(...prepared.findings);
  }
  const privateEntries = new Map(entries);
  const privateRooms = new Map(roomsByOwner);
  return Object.freeze({
    artifacts: Object.freeze({
      at: (origin: EncounterPhaseAddress) => privateEntries.get(semanticAddressKey(origin)),
      roomAt: (origin: OccurrenceAddress) => privateRooms.get(semanticAddressKey(origin)),
    }),
    findings: Object.freeze(findings),
  });
}
