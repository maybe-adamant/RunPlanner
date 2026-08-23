import {
  semanticAddressKey,
  type EncounterPhaseAddress,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import {
  encounterBindingsBySlot,
  encounterSetForBinding,
} from '../../authored-project/room-state/encounters';
import { projectRoomPreparationCheckpoint } from '../history/facts';
import type { HistoryStateView } from '../history/model';
import type { CanonicalAuthoredRoom, CanonicalLocalVisitRoom } from '../materialization';
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
import { resolveEncounterPhases } from './resolve';
import type { Catalog } from '../../catalog-schema';
import type { FigLeafPhaseCandidateSupport } from '../rewards/model';
import { assessGorgonCandidate, type GorgonLifecycleStatus } from '../keepsakes';
import type { GorgonPhaseCandidateSupport } from '../rewards/model';

/** Private capability from the exact simulation assembly. */
export interface EncounterCandidateArtifacts {
  readonly at: (origin: EncounterPhaseAddress) => EncounterPhaseCandidateSupport | undefined;
  readonly statusAt: (origin: EncounterPhaseAddress) => EncounterPhaseSequenceStatus | undefined;
  /** Exact reached/pending Gorgon control capability for this phase. */
  readonly gorgonAt: (origin: EncounterPhaseAddress) => GorgonPhaseCandidateSupport | undefined;
  /**
   * A top-level room's exact preparation checkpoint, retained for structural
   * authoring candidates that materialize a different encounter envelope.
   */
  readonly roomAt: (origin: OccurrenceAddress) => EncounterRoomCandidateCapability | undefined;
  readonly figLeafAt: (origin: EncounterPhaseAddress) => FigLeafPhaseCandidateSupport | undefined;
  /** Exact sequential P setup support for one eligible two-position room. */
  readonly pSequenceAt: (
    origin: OccurrenceAddress,
  ) => PEncounterSequenceCandidateSupport | undefined;
}

/**
 * The P editor's authoring domain. The second choice is evaluated only after
 * the proposed first selection has extended the room's preparation record.
 */
export interface PEncounterSequenceCandidateSupport {
  readonly owner: OccurrenceAddress;
  readonly firstPosition: {
    readonly origin: EncounterPhaseAddress;
    readonly declaredEncounterKeys: readonly string[];
    readonly selectedEncounterKey: string;
  };
  readonly terminalPosition: {
    readonly origin: EncounterPhaseAddress;
    readonly declaredEncounterKeys: readonly string[];
    readonly selectedEncounterKey: string;
  };
  readonly first: EncounterPhaseCandidateSupport;
  readonly terminalFor: (
    firstEncounterKey: string,
  ) =>
    | { readonly kind: 'terminated' }
    | { readonly kind: 'available'; readonly support: EncounterPhaseCandidateSupport }
    | { readonly kind: 'blocked' };
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
  rooms: readonly (CanonicalAuthoredRoom | CanonicalLocalVisitRoom)[],
  views: ReadonlyMap<string, HistoryStateView>,
  boundary?: EncounterCandidateBoundary,
  figLeafCandidates: readonly FigLeafPhaseCandidateSupport[] = [],
  gorgonStatus: GorgonLifecycleStatus | undefined = undefined,
  gorgonPhaseCandidates: readonly GorgonPhaseCandidateSupport[] = [],
): EncounterCandidateEvaluation & { readonly findingRegions: readonly FindingRegionEntry[] } {
  const entries = new Map<string, EncounterPhaseCandidateSupport>();
  const statuses = new Map<string, EncounterPhaseSequenceStatus>();
  const roomsByOwner = new Map<string, EncounterRoomCandidateCapability>();
  const pSequences = new Map<string, PEncounterSequenceCandidateSupport>();
  const findings: SemanticFinding[] = [];
  const findingChronologies = new Map<string, HistoryFindingChronology>();
  for (const room of rooms) {
    if (!room.entered) continue;
    const context = candidateContext(room, views, boundary);
    if (context === undefined) continue;
    const preparedSource = prepareRoomEncounterPhases(catalog, room, context);
    const gorgonEffect = catalog.keepsakes.values.find(
      (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
    )?.effect;
    const naturalEncounterKey =
      gorgonEffect?.kind === 'gorgonAmulet' ? gorgonEffect.naturalEncounterKey : undefined;
    const prepared =
      gorgonStatus === 'consumed'
        ? Object.freeze({
            ...preparedSource,
            candidates: Object.freeze(
              preparedSource.candidates.map((candidate) =>
                !assessGorgonCandidate({
                  status: 'consumed',
                  naturalAthena:
                    naturalEncounterKey !== undefined &&
                    candidate.candidateEncounterKeys.includes(naturalEncounterKey),
                  gorgonEligible: false,
                }).naturalPossible
                  ? Object.freeze({
                      ...candidate,
                      candidateEncounterKeys: Object.freeze(
                        candidate.candidateEncounterKeys.filter(
                          (key) => key !== naturalEncounterKey,
                        ),
                      ),
                      selectedPossible:
                        candidate.selectedEncounterKey === naturalEncounterKey
                          ? false
                          : candidate.selectedPossible,
                    })
                  : candidate,
              ),
            ),
          })
        : preparedSource;
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
    if (
      room.encounterEnvelopeKey === 'PEncounter' &&
      room.encounterPhases[0]?.slotKey === 'Intro' &&
      room.encounterPhases[1]?.slotKey === 'Combat'
    ) {
      const first = prepared.candidates.find((candidate) => candidate.origin.phaseKey === 'Intro');
      if (first !== undefined) {
        const declaration = catalog.rooms.byKey[room.gameName];
        if (declaration === undefined) {
          throw new Error(`P encounter candidate lost declaration ${room.gameName}`);
        }
        const bindings = encounterBindingsBySlot(catalog, declaration, declaration.gameName);
        const introBinding = bindings.get('Intro');
        const combatBinding = bindings.get('Combat');
        if (introBinding?.kind !== 'set' || combatBinding?.kind !== 'set') {
          throw new Error(`${room.gameName} P encounter positions must be pooled`);
        }
        const introOrigin = first.origin;
        const combatOrigin = Object.freeze({ ...first.origin, phaseKey: 'Combat' });
        const roomKey = semanticAddressKey(room.origin);
        pSequences.set(
          roomKey,
          Object.freeze({
            first,
            owner: room.origin,
            firstPosition: Object.freeze({
              origin: introOrigin,
              declaredEncounterKeys: encounterSetForBinding(
                catalog,
                introBinding,
                declaration.gameName,
              ).encounterDefinitionKeys,
              selectedEncounterKey: room.encounters.encounterKeyByPhase.Intro!,
            }),
            terminalPosition: Object.freeze({
              origin: combatOrigin,
              declaredEncounterKeys: encounterSetForBinding(
                catalog,
                combatBinding,
                declaration.gameName,
              ).encounterDefinitionKeys,
              selectedEncounterKey: room.encounters.encounterKeyByPhase.Combat!,
            }),
            terminalFor: (firstEncounterKey: string) => {
              if (
                catalog.encounterDefinitions.byKey[firstEncounterKey]?.sequenceEffect?.kind ===
                'terminateSuffix'
              ) {
                return Object.freeze({ kind: 'terminated' as const });
              }
              const replacement = Object.freeze({
                ...room.encounters,
                encounterKeyByPhase: Object.freeze({
                  ...room.encounters.encounterKeyByPhase,
                  Intro: firstEncounterKey,
                }),
              });
              const phases = resolveEncounterPhases(
                catalog,
                declaration,
                replacement,
                ['Intro', 'Combat'],
                declaration.gameName,
              );
              const next = prepareRoomEncounterPhases(
                catalog,
                Object.freeze({ ...room, encounters: replacement, encounterPhases: phases }),
                context,
              );
              const support = next.candidates.find(
                (candidate) => candidate.origin.phaseKey === 'Combat',
              );
              return support === undefined
                ? Object.freeze({ kind: 'blocked' as const })
                : Object.freeze({ kind: 'available' as const, support });
            },
          }),
        );
      }
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
  const privatePSequences = new Map(pSequences);
  const privateGorgon = new Map(
    gorgonPhaseCandidates.map((candidate) => [semanticAddressKey(candidate.origin), candidate]),
  );
  const gorgonSupport = new Map<string, GorgonPhaseCandidateSupport>();
  for (const [key, support] of entries) {
    const exact = privateGorgon.get(key);
    if (exact === undefined) continue;
    gorgonSupport.set(
      key,
      Object.freeze({
        origin: exact.origin,
        supported:
          catalog.encounterDefinitions.byKey[support.selectedEncounterKey]?.hostsGorgon === true &&
          exact.supported,
        ...(exact.rarity === undefined ? {} : { rarity: exact.rarity }),
      }),
    );
  }
  return Object.freeze({
    artifacts: Object.freeze({
      at: (origin: EncounterPhaseAddress) => privateEntries.get(semanticAddressKey(origin)),
      statusAt: (origin: EncounterPhaseAddress) => privateStatuses.get(semanticAddressKey(origin)),
      gorgonAt: (origin: EncounterPhaseAddress) => gorgonSupport.get(semanticAddressKey(origin)),
      roomAt: (origin: OccurrenceAddress) => privateRooms.get(semanticAddressKey(origin)),
      figLeafAt: (origin: EncounterPhaseAddress) => privateFigLeaf.get(semanticAddressKey(origin)),
      pSequenceAt: (origin: OccurrenceAddress) => privatePSequences.get(semanticAddressKey(origin)),
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
  rooms: readonly (CanonicalAuthoredRoom | CanonicalLocalVisitRoom)[],
  views: ReadonlyMap<string, HistoryStateView>,
  boundary?: EncounterCandidateBoundary,
): EncounterCandidateEvaluation {
  const evaluation = evaluateEncounterCandidatesInternal(catalog, rooms, views, boundary);
  return Object.freeze({ artifacts: evaluation.artifacts, findings: evaluation.findings });
}
