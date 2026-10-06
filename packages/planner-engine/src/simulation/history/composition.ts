import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import type { BiomeTransitionCounterReset, Catalog } from '../../catalog-schema';
import { createBiomeAddress, type BiomeAddress } from '../../authored-project/addresses';
import { executeRoomLifecycle, type RoomLifecycleEvent } from '../lifecycle';
import { prepareRoomEncounterPhases, type EncounterAuthoringRoom } from '../encounters/preparation';
import {
  encounterResolutionContext,
  resolveMaterializedEncounterPhase,
  resolveMaterializedEncounterPhases,
} from '../encounters/resolve';
import type { CanonicalFixedRoomLink } from '../materialization';
import { foldHistoryEvents } from './fold';
import { foldBiomeHistoryPrefixEvents } from './fold';
import { projectRoomPreparationCheckpoint, projectRouteEncounterKeyCounts } from './facts';
import {
  createRoomLifecycleInput,
  lacksEnteredStoreProvenance,
  type CanonicalLifecycleRoom,
} from './lifecycleInput';
import type {
  CanonicalBiomeHistory,
  HistoryCounters,
  HistoryEvent,
  HistoryStateView,
  BiomeHistoryPrefix,
} from './model';
import type { ResolvedEncounterPhase } from '../encounters/model';
import { assessFigLeafSkip } from '../encounters/fig-leaf';
import { targetRewardGenerationCheckpoint } from '../encounters/generation-preparation';
import { resolveEntryRoom } from '../../authored-project/room-state/entry-resolution';
import { assessAetosAppearance } from '../encounters/aetos';

export interface FigLeafLifecycleState {
  readonly remainingUses: number;
  readonly activatedThisBiome: boolean;
}

type EnvelopeHistoryEvent = Extract<
  HistoryEvent,
  | { readonly kind: 'biomeCompleted' }
  | { readonly kind: 'biomeCounterReset' }
  | { readonly kind: 'biomeStarted' }
>;
type SegmentHistoryEvent = Exclude<HistoryEvent, EnvelopeHistoryEvent>;
type HistoryEventData<Event extends HistoryEvent = HistoryEvent> = Event extends HistoryEvent
  ? Omit<Event, 'sequence'>
  : never;
type SegmentHistoryEventData = HistoryEventData<SegmentHistoryEvent>;

interface EventBuilder {
  readonly events: HistoryEvent[];
  readonly sequenceBase: number;
  readonly seed?: HistoryStateView;
  readonly validateEncounterResolution: boolean;
  readonly pendingSpellDrop: boolean;
  readonly allSpellInvested: boolean;
  readonly effectiveShadowRank: number;
  readonly routePosition: ResolvedRoutePosition;
  readonly figLeafState?: {
    remainingUses: number;
    activatedThisBiome: boolean;
    biomeStart: boolean;
  };
}

export interface HistorySegmentWriter {
  append(event: SegmentHistoryEventData): void;
  current(): HistoryStateView;
  rewardGeneration(origin: CanonicalLifecycleRoom['origin']): HistoryStateView | undefined;
  readonly validatesEncounterResolution: boolean;
  readonly pendingSpellDrop: boolean;
  readonly allSpellInvested: boolean;
  readonly effectiveShadowRank: number;
  readonly routePosition: ResolvedRoutePosition;
  resolveFigLeafEncounterPhases(
    room: CanonicalLifecycleRoom,
    phases: readonly ResolvedEncounterPhase[],
  ): readonly ResolvedEncounterPhase[];
}

export type EncounterValidatedBiomeHistory =
  | { readonly kind: 'complete'; readonly history: CanonicalBiomeHistory }
  | {
      readonly kind: 'rewardBlocked';
      readonly history: BiomeHistoryPrefix;
      readonly blockedAt: import('../../authored-project/addresses').SemanticAddress;
    };

/** Stops history composition before an entered lifecycle whose producer has
 * not been authored. Reward evaluation owns the unresolved frontier and its
 * finding; history must retain only the exact pre-leaf prefix. */
class RewardAuthorshipBlocked extends Error {
  constructor(readonly blockedAt: import('../../authored-project/addresses').SemanticAddress) {
    super('reward authorship blocks room lifecycle');
    this.name = 'RewardAuthorshipBlocked';
  }
}

export interface RoomLifecycleCompositionOptions {
  readonly prepare?: (events: readonly RoomLifecycleEvent[]) => void;
  readonly beforeEvent?: (writer: HistorySegmentWriter, event: RoomLifecycleEvent) => void;
  readonly afterEvent?: (writer: HistorySegmentWriter, event: RoomLifecycleEvent) => void;
  readonly outgoing?: (writer: HistorySegmentWriter, parent: CanonicalLifecycleRoom) => void;
  readonly stopAfterOutgoing?: boolean;
  /** Continue only through this real post-outgoing lifecycle point, then stop traversal. */
  readonly continueThroughAcquisitionPoint?: string;
  /**
   * A frontier room without an explicit acquisition-point operation may still
   * own post-outgoing Room Actions. Retain those actions without committing or
   * exiting the room, which still depends on the unresolved door selection.
   */
  readonly continueThroughPostOutgoingActions?: boolean;
}

interface BiomeHistoryEnvelopeOptions<
  Entry,
  Predecessor,
  CompletionPredecessor extends CanonicalLifecycleRoom,
> {
  readonly catalog: Catalog;
  readonly routeKey: string;
  readonly routePosition: ResolvedRoutePosition;
  readonly biomeKey: string;
  readonly initialCounters: HistoryCounters;
  readonly seed?: HistoryStateView;
  readonly validateEncounterResolution?: boolean;
  readonly figLeafState?: FigLeafLifecycleState;
  readonly pendingSpellDrop?: boolean;
  readonly allSpellInvested?: boolean;
  readonly effectiveShadowRank?: number;
  readonly fixedRoomLinks: readonly CanonicalFixedRoomLink[];
  readonly transitionEffects: readonly BiomeTransitionCounterReset[];
  readonly composeEntry: (writer: HistorySegmentWriter) => Entry;
  readonly composeBody: (writer: HistorySegmentWriter, entry: Entry) => Predecessor;
  readonly composeCompletionPredecessor: (
    writer: HistorySegmentWriter,
    predecessor: Predecessor,
  ) => CompletionPredecessor;
  readonly fail: (detail: string) => never;
}

function appendEnvelope(
  builder: EventBuilder,
  event: HistoryEventData<EnvelopeHistoryEvent>,
): void {
  builder.events.push(
    Object.freeze({
      ...event,
      sequence: builder.sequenceBase + builder.events.length + 1,
    }) as EnvelopeHistoryEvent,
  );
}

function segmentWriter(builder: EventBuilder): HistorySegmentWriter {
  return Object.freeze({
    append(event: SegmentHistoryEventData): void {
      builder.events.push(
        Object.freeze({
          ...event,
          sequence: builder.sequenceBase + builder.events.length + 1,
        }) as SegmentHistoryEvent,
      );
    },
    current(): HistoryStateView {
      return foldBiomeHistoryPrefixEvents(builder.events, builder.seed).current;
    },
    rewardGeneration(origin: CanonicalLifecycleRoom['origin']): HistoryStateView | undefined {
      return targetRewardGenerationCheckpoint(
        foldBiomeHistoryPrefixEvents(builder.events, builder.seed).rooms,
        origin,
      );
    },
    validatesEncounterResolution: builder.validateEncounterResolution,
    pendingSpellDrop: builder.pendingSpellDrop,
    allSpellInvested: builder.allSpellInvested,
    effectiveShadowRank: builder.effectiveShadowRank,
    routePosition: builder.routePosition,
    resolveFigLeafEncounterPhases(
      _room: CanonicalLifecycleRoom,
      phases: readonly ResolvedEncounterPhase[],
    ) {
      const state = builder.figLeafState;
      if (state === undefined) {
        return builder.validateEncounterResolution
          ? Object.freeze(
              phases.map((phase) =>
                phase.figLeafSkip ? Object.freeze({ ...phase, figLeafSkip: false }) : phase,
              ),
            )
          : phases;
      }
      let selected = false;
      const envelopeBlocked = phases.some((candidate) => candidate.blocksFigLeaf);
      const resolved = phases.map((phase, index) => {
        const assessment = assessFigLeafSkip({
          selected: phase.figLeafSkip,
          canEncounterSkip: phase.canEncounterSkip,
          biomeStart: state.biomeStart,
          blockedByEnvelope: envelopeBlocked,
          nonLeadingCascadePhase: phase.skipEndEncounterEffects === true && index !== 0,
          remainingUses: state.remainingUses,
          activatedThisBiome: state.activatedThisBiome,
          selectionAlreadyResolved: selected,
        });
        if (assessment.legal) {
          selected = true;
          state.remainingUses -= 1;
          state.activatedThisBiome = true;
        }
        return Object.freeze({ ...phase, figLeafSkip: assessment.legal });
      });
      state.biomeStart = false;
      return Object.freeze(resolved);
    },
  });
}

function appendLifecycleEvent(
  writer: HistorySegmentWriter,
  event: RoomLifecycleEvent,
  fail: (detail: string) => never,
): void {
  const { sequence: localSequence, ...data } = event;
  if (localSequence <= 0) {
    fail('room fragment has an invalid local sequence');
  }
  writer.append(data);
}

export function appendStandaloneRoomCreated(
  writer: HistorySegmentWriter,
  room: CanonicalLifecycleRoom,
  source: 'biomeEntry' | 'layoutCompletion',
): void {
  writer.append({
    kind: 'roomCreated',
    origin: room.origin,
    gameName: room.gameName,
    encounterEnvelopeKey: room.encounterEnvelopeKey,
    source,
    picked: true,
  });
}

export function appendRoomLifecycle(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  room: CanonicalLifecycleRoom,
  fail: (detail: string) => never,
  options: RoomLifecycleCompositionOptions = {},
): void {
  if (!room.entered) {
    fail(`unentered room cannot execute a lifecycle`);
  }
  if ('unresolvedIncomingReward' in room && room.unresolvedIncomingReward !== undefined) {
    throw new RewardAuthorshipBlocked(room.unresolvedIncomingReward.origin);
  }
  const authoringRoom: EncounterAuthoringRoom | undefined =
    room.kind === 'authored' ? room : undefined;
  const beforeEncounterPreparation = writer.validatesEncounterResolution
    ? writer.current()
    : undefined;
  const encounterPreparation =
    writer.validatesEncounterResolution && authoringRoom !== undefined
      ? prepareRoomEncounterPhases(
          catalog,
          authoringRoom,
          writer.routePosition,
          projectRoomPreparationCheckpoint(beforeEncounterPreparation!),
          {
            pendingSpellDrop: writer.pendingSpellDrop,
            allSpellInvested: writer.allSpellInvested,
            effectiveShadowRank: writer.effectiveShadowRank,
            ...(authoringRoom.incomingReward?.offer.rewardType === 'Devotion'
              ? { rewardGeneration: writer.rewardGeneration(authoringRoom.origin) }
              : {}),
          },
        )
      : undefined;
  const rawDeclaration = catalog.rooms.byKey[room.gameName];
  if (rawDeclaration === undefined) fail(`unknown canonical room ${room.gameName}`);
  const declaration = resolveEntryRoom(
    catalog,
    rawDeclaration,
    writer.routePosition,
    room.kind === 'authored' && room.entry,
  ).declaration;
  const encounterPhases =
    encounterPreparation?.recordedPhases ??
    (() => {
      const routeKey = writer.routePosition.routeKey;
      const context =
        room.kind === 'authored'
          ? encounterResolutionContext(room, declaration, routeKey)
          : Object.freeze({ kind: 'noReward' as const, routeKey });
      const phases = room.encounterPhases.map((phase) =>
        resolveMaterializedEncounterPhase(catalog, declaration, phase, context),
      );
      // Only depth-dependent identities need the fold in the unvalidated history pass.
      if (phases.every((phase) => phase !== undefined)) return Object.freeze(phases);
      return resolveMaterializedEncounterPhases(catalog, declaration, room.encounterPhases, {
        ...context,
        reached: Object.freeze({
          biomeEncounterDepth: writer.current().ledgers.counters.biomeEncounterDepth,
          routeEncounterKeyCounts: projectRouteEncounterKeyCounts(writer.current(), routeKey),
        }),
      });
    })();
  const effectiveEncounterPhases = writer.resolveFigLeafEncounterPhases(room, encounterPhases);
  const fragment = executeRoomLifecycle(
    catalog,
    createRoomLifecycleInput(room, effectiveEncounterPhases, declaration),
  );
  options.prepare?.(fragment.events);
  let projectedOutgoing = false;
  let reachedOutgoing = false;
  for (const sourceEvent of fragment.events) {
    const event =
      sourceEvent.kind === 'encounterStarted'
        ? (() => {
            const phase = effectiveEncounterPhases.find(
              (candidate) => candidate.slotKey === sourceEvent.phaseKey,
            )!;
            if (phase.aetosWaves === undefined && phase.aetosWave === undefined) return sourceEvent;
            const prior = writer
              .current()
              .ledgers.encounterStarts.some(
                (entry) =>
                  entry.origin.routeKey === room.origin.routeKey &&
                  entry.origin.biomeKey === room.origin.biomeKey &&
                  entry.aetosWave !== undefined,
              );
            return Object.freeze({
              ...sourceEvent,
              aetos: assessAetosAppearance(
                phase,
                declaration.structuralTags.includes('Outdoor'),
                sourceEvent.execution === 'skippedByFigLeaf',
                prior,
              ),
            });
          })()
        : sourceEvent;
    if (
      options.stopAfterOutgoing &&
      options.continueThroughPostOutgoingActions === true &&
      event.kind === 'roomCommitted'
    ) {
      return;
    }
    options.beforeEvent?.(writer, event);
    appendLifecycleEvent(writer, event, fail);
    options.afterEvent?.(writer, event);
    if (event.kind === 'outgoingGenerationCheckpoint') {
      reachedOutgoing = true;
      if ((options.outgoing === undefined && !options.stopAfterOutgoing) || projectedOutgoing) {
        fail(`${room.gameName} has no unique canonical outgoing projection`);
      }
      options.outgoing?.(writer, room);
      projectedOutgoing = options.outgoing !== undefined;
      if (
        options.stopAfterOutgoing &&
        options.continueThroughAcquisitionPoint === undefined &&
        options.continueThroughPostOutgoingActions !== true
      ) {
        return;
      }
    }
    if (
      options.stopAfterOutgoing &&
      event.kind === 'acquisitionPointReached' &&
      event.point === options.continueThroughAcquisitionPoint
    ) {
      return;
    }
  }
  if (fragment.blockedAt !== undefined) {
    throw new RewardAuthorshipBlocked(fragment.blockedAt);
  }
  if (options.stopAfterOutgoing && !reachedOutgoing) {
    fail(`${room.gameName} has no outgoing checkpoint for prefix composition`);
  }
  if ((options.outgoing !== undefined) !== projectedOutgoing) {
    fail(`${room.gameName} canonical outgoing projection does not match its lifecycle`);
  }
}

interface BiomeHistoryPrefixOptions {
  readonly routeKey: string;
  readonly routePosition: ResolvedRoutePosition;
  readonly biomeKey: string;
  readonly initialCounters: HistoryCounters;
  readonly seed?: HistoryStateView;
  readonly validateEncounterResolution?: boolean;
  readonly figLeafState?: FigLeafLifecycleState;
  readonly pendingSpellDrop?: boolean;
  readonly allSpellInvested?: boolean;
  readonly effectiveShadowRank?: number;
  readonly compose: (writer: HistorySegmentWriter) => void;
}

function composeBiomeHistoryPrefixResult({
  routeKey,
  routePosition,
  biomeKey,
  initialCounters,
  seed,
  validateEncounterResolution = false,
  figLeafState,
  pendingSpellDrop = false,
  allSpellInvested = false,
  effectiveShadowRank = 0,
  compose,
}: BiomeHistoryPrefixOptions): BiomeHistoryPrefix {
  const builder: EventBuilder = {
    events: [],
    sequenceBase: seed?.sequence ?? 0,
    ...(seed === undefined ? {} : { seed }),
    validateEncounterResolution,
    pendingSpellDrop,
    allSpellInvested,
    effectiveShadowRank,
    routePosition,
    ...(figLeafState === undefined
      ? {}
      : {
          figLeafState: {
            remainingUses: figLeafState.remainingUses,
            activatedThisBiome: figLeafState.activatedThisBiome,
            biomeStart: true,
          },
        }),
  };
  appendEnvelope(builder, {
    kind: 'biomeStarted',
    origin: createBiomeAddress(routeKey, biomeKey),
    counters: Object.freeze({ ...initialCounters }),
  });
  try {
    compose(segmentWriter(builder));
  } catch (error) {
    if (!(error instanceof RewardAuthorshipBlocked)) throw error;
  }
  return foldBiomeHistoryPrefixEvents(builder.events, seed);
}

export function composeBiomeHistoryPrefix({
  routeKey,
  routePosition,
  biomeKey,
  initialCounters,
  seed,
  compose,
}: Omit<BiomeHistoryPrefixOptions, 'validateEncounterResolution'>): BiomeHistoryPrefix {
  return composeBiomeHistoryPrefixResult({
    routeKey,
    routePosition,
    biomeKey,
    initialCounters,
    ...(seed === undefined ? {} : { seed }),
    validateEncounterResolution: false,
    compose,
  });
}

export function composeBiomeHistoryPrefixWithEncounterValidation(
  options: Omit<BiomeHistoryPrefixOptions, 'validateEncounterResolution'>,
): BiomeHistoryPrefix {
  return composeBiomeHistoryPrefixResult({
    ...options,
    validateEncounterResolution: true,
  });
}

export function appendFixedRoomLinks(
  writer: HistorySegmentWriter,
  catalog: Catalog,
  biome: BiomeAddress,
  predecessor: CanonicalLifecycleRoom,
  fixedRoomLinks: readonly CanonicalFixedRoomLink[],
  fail: (detail: string) => never,
): void {
  if (
    predecessor.origin.routeKey !== biome.routeKey ||
    predecessor.origin.biomeKey !== biome.biomeKey ||
    !predecessor.entered
  ) {
    fail('completion composer did not return the entered Preboss for this biome');
  }
  if (predecessor.kind !== 'authored') fail('fixed completion links require an authored Preboss');
  let source = predecessor;
  for (const link of fixedRoomLinks) {
    if (link.source.occurrenceId !== source.origin.occurrenceId) {
      fail('fixed completion link does not follow its predecessor');
    }
    // An unresolved boss door terminates the composed prefix at the Preboss,
    // exactly where the completeness verdict terminates. Folding on would hit
    // the provenance invariant, which every consumer that composes a prefix
    // without first consulting completeness — resource authoring, notably —
    // would surface as a hard error instead of the repairable
    // `batchRewardStoreMissing` finding the boss-door contract promises.
    const targetDeclaration = catalog.rooms.byKey[link.target.gameName];
    if (
      targetDeclaration !== undefined &&
      lacksEnteredStoreProvenance(link.target, targetDeclaration)
    ) {
      return;
    }
    appendStandaloneRoomCreated(writer, link.target, 'layoutCompletion');
    appendRoomLifecycle(writer, catalog, link.target, fail);
    source = link.target;
  }
}

function composeBiomeHistoryEnvelopeResult<
  Entry,
  Predecessor,
  CompletionPredecessor extends CanonicalLifecycleRoom,
>({
  catalog,
  routeKey,
  routePosition,
  biomeKey,
  initialCounters,
  seed,
  validateEncounterResolution = false,
  figLeafState,
  pendingSpellDrop = false,
  allSpellInvested = false,
  effectiveShadowRank = 0,
  fixedRoomLinks,
  transitionEffects,
  composeEntry,
  composeBody,
  composeCompletionPredecessor,
  fail,
}: BiomeHistoryEnvelopeOptions<
  Entry,
  Predecessor,
  CompletionPredecessor
>): EncounterValidatedBiomeHistory {
  const biome = createBiomeAddress(routeKey, biomeKey);
  const builder: EventBuilder = {
    events: [],
    sequenceBase: seed?.sequence ?? 0,
    ...(seed === undefined ? {} : { seed }),
    validateEncounterResolution,
    pendingSpellDrop,
    allSpellInvested,
    effectiveShadowRank,
    routePosition,
    ...(figLeafState === undefined
      ? {}
      : {
          figLeafState: {
            remainingUses: figLeafState.remainingUses,
            activatedThisBiome: figLeafState.activatedThisBiome,
            biomeStart: true,
          },
        }),
  };
  const writer = segmentWriter(builder);
  appendEnvelope(builder, {
    kind: 'biomeStarted',
    origin: biome,
    counters: Object.freeze({ ...initialCounters }),
  });
  try {
    const entry = composeEntry(writer);
    const predecessor = composeBody(writer, entry);
    const completionPredecessor = composeCompletionPredecessor(writer, predecessor);
    appendFixedRoomLinks(writer, catalog, biome, completionPredecessor, fixedRoomLinks, fail);
    appendEnvelope(builder, { kind: 'biomeCompleted', origin: biome });
    for (const effect of transitionEffects) {
      appendEnvelope(builder, {
        kind: 'biomeCounterReset',
        origin: biome,
        axis: effect.axis,
        value: 0,
      });
    }
  } catch (error) {
    if (error instanceof RewardAuthorshipBlocked) {
      return Object.freeze({
        kind: 'rewardBlocked',
        history: foldBiomeHistoryPrefixEvents(builder.events, seed),
        blockedAt: error.blockedAt,
      });
    }
    throw error;
  }
  return Object.freeze({ kind: 'complete', history: foldHistoryEvents(builder.events, seed) });
}

export function composeBiomeHistoryEnvelope<
  Entry,
  Predecessor,
  CompletionPredecessor extends CanonicalLifecycleRoom,
>(
  options: Omit<
    BiomeHistoryEnvelopeOptions<Entry, Predecessor, CompletionPredecessor>,
    'validateEncounterResolution'
  >,
): CanonicalBiomeHistory {
  const result = composeBiomeHistoryEnvelopeResult({
    ...options,
    validateEncounterResolution: false,
  });
  if (result.kind !== 'complete') {
    throw new Error('ordinary biome composition unexpectedly encountered encounter validation');
  }
  return result.history;
}

export function composeBiomeHistoryEnvelopeWithEncounterValidation<
  Entry,
  Predecessor,
  CompletionPredecessor extends CanonicalLifecycleRoom,
>(
  options: Omit<
    BiomeHistoryEnvelopeOptions<Entry, Predecessor, CompletionPredecessor>,
    'validateEncounterResolution'
  >,
): EncounterValidatedBiomeHistory {
  return composeBiomeHistoryEnvelopeResult({
    ...options,
    validateEncounterResolution: true,
  });
}
