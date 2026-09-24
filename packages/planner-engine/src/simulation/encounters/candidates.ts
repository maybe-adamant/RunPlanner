import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import {
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  type EncounterPhaseAddress,
  type NemesisRandomEventAddress,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import { projectRoomPreparationCheckpoint } from '../history/facts';
import type { HistoryEvent, HistoryStateView, ProgressiveRoomHistoryViews } from '../history/model';
import {
  targetRewardGeneration,
  targetRewardGenerationCheckpoint,
  type GeneratedEncounterCandidateCapability,
} from './generation-preparation';
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
import type { MaterializedEncounterPhase } from './model';
import type { Catalog } from '../../catalog-schema';
import type { FigLeafPhaseCandidateSupport, TargetRewardHistoryCheckpoint } from '../rewards/model';
import type { RunStateSnapshot } from '../rewards/run-state';
import { attestEffectiveHordesRank } from '../arcana-fear';
import { assessGorgonCandidate } from '../keepsakes/encounter-effects';
import { type GorgonLifecycleStatus } from '../keepsakes/state';
import type { GorgonPhaseCandidateSupport } from '../rewards/model';
import type { NemesisRandomEventCandidateSupport } from '../rewards/model';

/** Private capability from the exact simulation assembly. */
export interface EncounterCandidateArtifacts {
  readonly generationAt: (
    origin: EncounterPhaseAddress,
  ) => GeneratedEncounterCandidateCapability | undefined;
  readonly at: (origin: EncounterPhaseAddress) => EncounterPhaseCandidateSupport | undefined;
  readonly statusAt: (origin: EncounterPhaseAddress) => EncounterPhaseSequenceStatus | undefined;
  /** Exact reached/pending Gorgon control capability for this phase. */
  readonly gorgonAt: (origin: EncounterPhaseAddress) => GorgonPhaseCandidateSupport | undefined;
  /** Exact branch-correlated Nemesis event capability at its interaction owner. */
  readonly nemesisAt: (
    origin: NemesisRandomEventAddress,
  ) => NemesisRandomEventCandidateSupport | undefined;
  /**
   * A top-level room's exact preparation checkpoint, retained for structural
   * authoring candidates that materialize a different encounter envelope.
   */
  readonly roomAt: (origin: OccurrenceAddress) => EncounterRoomCandidateCapability | undefined;
  readonly figLeafAt: (origin: EncounterPhaseAddress) => FigLeafPhaseCandidateSupport | undefined;
}

export function createEmptyEncounterCandidateArtifacts(): EncounterCandidateArtifacts {
  return Object.freeze({
    generationAt: () => undefined,
    at: () => undefined,
    statusAt: () => undefined,
    gorgonAt: () => undefined,
    nemesisAt: () => undefined,
    roomAt: () => undefined,
    figLeafAt: () => undefined,
  });
}

/**
 * Opaque room-local preparation capability from one exact simulation. The
 * caller supplies only a resolved replacement envelope; the captured room
 * identity and predecessor checkpoint stay private to the encounter layer.
 */
export interface EncounterRoomCandidateCapability {
  readonly prepare: (phases: readonly MaterializedEncounterPhase[]) => PreparedEncounterPhases;
}

export interface EncounterCandidateEvaluation {
  readonly artifacts: EncounterCandidateArtifacts;
  readonly findings: readonly SemanticFinding[];
  /** Data product, not a candidate capability: exact selected generated operands after reward settlement. */
  readonly resolvedGenerated: readonly {
    readonly origin: EncounterPhaseAddress;
    readonly customization: NonNullable<
      import('./model').ResolvedEncounterPhase['generatedCustomization']
    >;
  }[];
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
  routePosition: ResolvedRoutePosition,
  boundary?: EncounterCandidateBoundary,
  figLeafCandidates: readonly FigLeafPhaseCandidateSupport[] = [],
  gorgonStatus: GorgonLifecycleStatus | undefined = undefined,
  gorgonPhaseCandidates: readonly GorgonPhaseCandidateSupport[] = [],
  nemesisRandomEventCandidates: readonly NemesisRandomEventCandidateSupport[] = [],
  historyEvents: readonly HistoryEvent[] = [],
  historyRooms: readonly ProgressiveRoomHistoryViews[] = [],
  runStateSnapshots: readonly RunStateSnapshot[] = [],
  rewardHistory: readonly TargetRewardHistoryCheckpoint[] = [],
): EncounterCandidateEvaluation & { readonly findingRegions: readonly FindingRegionEntry[] } {
  const entries = new Map<string, EncounterPhaseCandidateSupport>();
  const generation = new Map<string, GeneratedEncounterCandidateCapability>();
  const resolvedGenerated: EncounterCandidateEvaluation['resolvedGenerated'][number][] = [];
  const statuses = new Map<string, EncounterPhaseSequenceStatus>();
  const roomsByOwner = new Map<string, EncounterRoomCandidateCapability>();
  const findings: SemanticFinding[] = [];
  const findingChronologies = new Map<string, HistoryFindingChronology>();
  const runStateByOwner = new Map(
    runStateSnapshots.map((snapshot) => [semanticAddressKey(snapshot.owner), snapshot]),
  );
  const rewardHistoryByOrigin = new Map(
    rewardHistory.map((checkpoint) => [semanticAddressKey(checkpoint.origin), checkpoint]),
  );
  for (const room of rooms) {
    if (!room.entered) continue;
    const context = candidateContext(room, views, boundary);
    if (context === undefined) continue;
    const preparationState = {
      rewardGeneration: targetRewardGenerationCheckpoint(historyRooms, room.origin),
      hordesRankAt: (
        selection: import('../../catalog-schema').GeneratedEncounterSelection,
        origin: EncounterPhaseAddress,
      ) => {
        if (selection.preparation === 'rewardGeneration') {
          const generation = targetRewardGeneration(historyRooms, room.origin);
          const checkpoint =
            generation === undefined
              ? undefined
              : rewardHistoryByOrigin.get(semanticAddressKey(generation.targetOrigin));
          return checkpoint === undefined
            ? undefined
            : attestEffectiveHordesRank(checkpoint.states);
        }
        const owner =
          room.lifecycleProfileKey === 'ShipCombatRoom'
            ? createRoomRunStateCheckpointAddress(room.origin, {
                kind: 'beforeEncounterStart',
                phaseKey: origin.phaseKey,
              })
            : createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' });
        const snapshot = runStateByOwner.get(semanticAddressKey(owner));
        return snapshot === undefined
          ? undefined
          : (snapshot.effectiveHordesRank ?? attestEffectiveHordesRank([snapshot]));
      },
      fangsRankAt: (origin: EncounterPhaseAddress) => {
        const owner =
          room.lifecycleProfileKey === 'ShipCombatRoom'
            ? createRoomRunStateCheckpointAddress(room.origin, {
                kind: 'beforeEncounterStart',
                phaseKey: origin.phaseKey,
              })
            : createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' });
        const snapshot = runStateByOwner.get(semanticAddressKey(owner));
        return snapshot === undefined
          ? undefined
          : (snapshot.arcanaFear.fear.effectiveRanks.EnemyEliteShrineUpgrade ?? 0);
      },
    };
    const preparedSource = prepareRoomEncounterPhases(
      catalog,
      room,
      routePosition,
      context,
      preparationState,
    );
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
                      exclusions: Object.freeze([
                        ...candidate.exclusions,
                        ...(naturalEncounterKey !== undefined &&
                        (candidate.candidateEncounterKeys.includes(naturalEncounterKey) ||
                          candidate.exclusions.some(
                            (entry) => entry.encounterKey === naturalEncounterKey,
                          ))
                          ? [
                              Object.freeze({
                                encounterKey: naturalEncounterKey,
                                kind: 'gorgonConsumed' as const,
                              }),
                            ]
                          : []),
                      ]),
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
          prepare: (phases: readonly MaterializedEncounterPhase[]): PreparedEncounterPhases =>
            prepareRoomEncounterPhases(
              catalog,
              Object.freeze({ ...room, encounterPhases: phases }),
              routePosition,
              context,
              preparationState,
            ),
        }),
      );
    }
    for (const support of prepared.candidates) {
      const key = semanticAddressKey(support.origin);
      if (entries.has(key)) throw new Error(`duplicate encounter candidate ${key}`);
      entries.set(key, support);
    }
    for (const capability of prepared.generation)
      generation.set(semanticAddressKey(capability.origin), capability);
    for (const capability of prepared.generation) {
      const phase = prepared.validPrefix.find(
        (entry) => entry.slotKey === capability.origin.phaseKey,
      );
      if (phase?.generatedCustomization !== undefined)
        resolvedGenerated.push(
          Object.freeze({ origin: capability.origin, customization: phase.generatedCustomization }),
        );
    }
    for (const entry of prepared.statuses) {
      const key = semanticAddressKey(entry.origin);
      if (statuses.has(key)) throw new Error(`duplicate encounter phase status ${key}`);
      const started = historyEvents.find(
        (event) =>
          event.kind === 'encounterStarted' &&
          semanticAddressKey(event.origin) === semanticAddressKey(room.origin) &&
          event.phaseKey === entry.origin.phaseKey,
      );
      statuses.set(
        key,
        entry.status.kind === 'active' && started?.kind === 'encounterStarted'
          ? Object.freeze({ ...entry.status, execution: started.execution })
          : entry.status,
      );
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
  const privateGorgon = new Map(
    gorgonPhaseCandidates.map((candidate) => [semanticAddressKey(candidate.origin), candidate]),
  );
  const privateNemesis = new Map(
    nemesisRandomEventCandidates.map((candidate) => [
      semanticAddressKey(candidate.origin),
      candidate,
    ]),
  );
  const gorgonSupport = new Map<string, GorgonPhaseCandidateSupport>();
  for (const key of entries.keys()) {
    const exact = privateGorgon.get(key);
    if (exact === undefined) continue;
    gorgonSupport.set(
      key,
      Object.freeze({
        origin: exact.origin,
        supported: exact.supported,
        ...(exact.rarity === undefined ? {} : { rarity: exact.rarity }),
      }),
    );
  }
  return Object.freeze({
    artifacts: Object.freeze({
      generationAt: (origin: EncounterPhaseAddress) => generation.get(semanticAddressKey(origin)),
      at: (origin: EncounterPhaseAddress) => privateEntries.get(semanticAddressKey(origin)),
      statusAt: (origin: EncounterPhaseAddress) => privateStatuses.get(semanticAddressKey(origin)),
      gorgonAt: (origin: EncounterPhaseAddress) => gorgonSupport.get(semanticAddressKey(origin)),
      nemesisAt: (origin: NemesisRandomEventAddress) =>
        privateNemesis.get(semanticAddressKey(origin)),
      roomAt: (origin: OccurrenceAddress) => privateRooms.get(semanticAddressKey(origin)),
      figLeafAt: (origin: EncounterPhaseAddress) => privateFigLeaf.get(semanticAddressKey(origin)),
    }),
    findings: Object.freeze(findings),
    resolvedGenerated: Object.freeze(resolvedGenerated),
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
  routePosition: ResolvedRoutePosition,
  boundary?: EncounterCandidateBoundary,
): EncounterCandidateEvaluation {
  const evaluation = evaluateEncounterCandidatesInternal(
    catalog,
    rooms,
    views,
    routePosition,
    boundary,
  );
  return Object.freeze({
    artifacts: evaluation.artifacts,
    findings: evaluation.findings,
    resolvedGenerated: evaluation.resolvedGenerated,
  });
}
