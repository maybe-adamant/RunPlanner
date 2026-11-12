import type {
  SteadyGrowthOutcomeAddress,
  TranscendentEmbryoOutcomeAddress,
  OccurrenceAddress,
} from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';
import {
  cagePhase,
  roomActionOpeningPoint,
  roomEventActive,
  roomEventPlaces,
  scopeRoomEventGraph,
  type RoomEvent,
  type RoomEventGraph,
  type RoomEventGraphPhase,
} from '../../authored-project/room-actions/event-graph';
import { roomActionKey } from '../../authored-project/room-actions/state';
import { semanticAddressKey } from '../../authored-project/addresses';
import { doorsReadyAfterRank } from './assemble';
import type { RoomActionRoster, RoomActionRow } from './model';

/** A Timeline boundary: one event of the room's graph. */
export type RoomLifecycleBoundary = RoomEvent;

export type RoomLifecycleTimelineEntry =
  | {
      readonly kind: 'boundary';
      readonly boundary: RoomLifecycleBoundary;
      /** The ranked action position at which the seam is rendered. */
      readonly rank: number;
      readonly placement: 'before' | 'after';
    }
  | {
      readonly kind: 'action';
      readonly action: RoomActionRow;
      readonly rank: number;
      /** Engine-owned phase grouping for multi-encounter room workbenches. */
      readonly phaseKey?: string;
    }
  | {
      readonly kind: 'automaticEffect';
      readonly effect: 'steadyGrowth' | 'transcendentEmbryo';
      readonly address: SteadyGrowthOutcomeAddress | TranscendentEmbryoOutcomeAddress;
      readonly boundary: Extract<RoomLifecycleBoundary, { readonly kind: 'encounterEnd' }>;
      readonly rank: number;
      readonly phaseKey: string;
    };

type RoomLifecycleBoundaryEntry = Extract<
  RoomLifecycleTimelineEntry,
  { readonly kind: 'boundary' }
>;

export interface RoomLifecycleTimeline {
  readonly owner: OccurrenceAddress;
  readonly graph: RoomEventGraph;
  readonly entries: readonly RoomLifecycleTimelineEntry[];
  readonly boundaries: readonly RoomLifecycleBoundary[];
  /** The doors open after this many ranked rows: the slot of Doors open. */
  readonly doorsAfterRank: number;
  /** Retained unranked/stale action rows remain available to a repair surface. */
  readonly repairRows: readonly RoomActionRow[];
}

export interface RoomLifecycleTimelineInput {
  readonly owner: OccurrenceAddress;
  readonly roomActionRoster: RoomActionRoster;
}

function appendAutomaticTimelineEffects(
  timeline: RoomLifecycleTimeline,
  effects: readonly Extract<RoomLifecycleTimelineEntry, { readonly kind: 'automaticEffect' }>[],
): RoomLifecycleTimeline {
  if (effects.length === 0) return timeline;
  type AutomaticEffect = Extract<RoomLifecycleTimelineEntry, { readonly kind: 'automaticEffect' }>;
  const byPhase = new Map<string, AutomaticEffect[]>();
  const allEffects = [
    ...timeline.entries.filter(
      (entry): entry is AutomaticEffect => entry.kind === 'automaticEffect',
    ),
    ...effects,
  ];
  for (const effect of allEffects) {
    const key = effect.phaseKey;
    const current = byPhase.get(key) ?? [];
    current.push(effect);
    byPhase.set(key, current);
  }
  const order = (effect: AutomaticEffect) => (effect.effect === 'steadyGrowth' ? 0 : 1);
  const shipPostCombatActionIndexByPhase = new Map<string, number>();
  let latestEncounterEndPhaseKey: string | undefined;
  timeline.entries.forEach((entry, index) => {
    if (entry.kind === 'boundary' && entry.boundary.kind === 'encounterEnd') {
      latestEncounterEndPhaseKey = entry.boundary.phaseKey;
      return;
    }
    if (
      entry.kind === 'action' &&
      entry.action.participation === 'required' &&
      entry.action.contact.kind === 'afterWheelPhase'
    ) {
      if (latestEncounterEndPhaseKey !== undefined)
        shipPostCombatActionIndexByPhase.set(latestEncounterEndPhaseKey, index);
    }
  });
  const entries: RoomLifecycleTimelineEntry[] = [];
  for (const [index, entry] of timeline.entries.entries()) {
    const boundary = entry.kind === 'boundary' ? entry.boundary : undefined;
    if (boundary?.kind === 'encounterEnd') {
      entries.push(entry);
      if (!shipPostCombatActionIndexByPhase.has(boundary.phaseKey)) {
        for (const effect of (byPhase.get(boundary.phaseKey) ?? []).sort(
          (left, right) => order(left) - order(right),
        ))
          entries.push(effect);
      }
      continue;
    }
    if (entry.kind === 'automaticEffect') continue;
    entries.push(entry);
    const phaseKey = [...shipPostCombatActionIndexByPhase.entries()].find(
      ([, actionIndex]) => actionIndex === index,
    )?.[0];
    if (phaseKey !== undefined)
      for (const effect of (byPhase.get(phaseKey) ?? []).sort(
        (left, right) => order(left) - order(right),
      ))
        entries.push(effect);
  }
  return Object.freeze({ ...timeline, entries: Object.freeze(entries) });
}

/** A reached automatic outcome at the encounter end where its cycle landed. */
export interface LandedTimelineOutcome<Address> {
  readonly address: Address;
  readonly owner: OccurrenceAddress;
  readonly phaseKey: string;
}

/**
 * Add reached Steady Growth checkpoints to the engine-owned room timeline.
 * The effect is fixed at its phase's end-effects checkpoint, after required
 * ship post-combat work where present. Consumers render that engine order.
 */
export function appendSteadyGrowthTimelineEffects(
  timeline: RoomLifecycleTimeline,
  outcomes: readonly LandedTimelineOutcome<SteadyGrowthOutcomeAddress>[],
): RoomLifecycleTimeline {
  const owned = outcomes.filter(
    (outcome) => semanticAddressKey(outcome.owner) === semanticAddressKey(timeline.owner),
  );
  if (owned.length === 0) return timeline;
  const effects = owned.flatMap((outcome) => {
    const boundary = timeline.entries.find(
      (entry) =>
        entry.kind === 'boundary' &&
        entry.boundary.kind === 'encounterEnd' &&
        entry.boundary.phaseKey === outcome.phaseKey,
    );
    return boundary?.kind === 'boundary' && boundary.boundary.kind === 'encounterEnd'
      ? [
          Object.freeze({
            kind: 'automaticEffect' as const,
            effect: 'steadyGrowth' as const,
            address: outcome.address,
            boundary: boundary.boundary,
            phaseKey: outcome.phaseKey,
            rank: boundary.rank,
          }),
        ]
      : [];
  });
  return appendAutomaticTimelineEffects(timeline, effects);
}

/**
 * Add reached Transcendent Embryo checkpoints at their owning phase's end
 * effects. The checkpoint is automatic and remains outside the room
 * action order, just like Steady Growth.
 */
export function appendTranscendentEmbryoTimelineEffects(
  timeline: RoomLifecycleTimeline,
  outcomes: readonly LandedTimelineOutcome<TranscendentEmbryoOutcomeAddress>[],
): RoomLifecycleTimeline {
  const owned = outcomes.filter(
    (outcome) => semanticAddressKey(outcome.owner) === semanticAddressKey(timeline.owner),
  );
  if (owned.length === 0) return timeline;
  const effects = owned.flatMap((outcome) => {
    const boundary = timeline.entries.find(
      (entry) =>
        entry.kind === 'boundary' &&
        entry.boundary.kind === 'encounterEnd' &&
        entry.boundary.phaseKey === outcome.phaseKey,
    );
    return boundary?.kind === 'boundary' && boundary.boundary.kind === 'encounterEnd'
      ? [
          Object.freeze({
            kind: 'automaticEffect' as const,
            effect: 'transcendentEmbryo' as const,
            address: outcome.address,
            boundary: boundary.boundary,
            phaseKey: outcome.phaseKey,
            rank: boundary.rank,
          }),
        ]
      : [];
  });
  return appendAutomaticTimelineEffects(timeline, effects);
}

function actionRank(roster: RoomActionRoster, reference: RoomActionReference): number | undefined {
  const key = roomActionKey(reference);
  return roster.rows.find((candidate) => candidate.key === key)?.rank ?? undefined;
}

function firstRank(
  rows: readonly RoomActionRow[],
  predicate: (row: RoomActionRow) => boolean,
): number | undefined {
  return rows.find(predicate)?.rank ?? undefined;
}

function lastRank(
  rows: readonly RoomActionRow[],
  predicate: (row: RoomActionRow) => boolean,
): number | undefined {
  const matches = rows.filter(predicate);
  return matches.length === 0 ? undefined : (matches[matches.length - 1]!.rank ?? undefined);
}

function boundaryEntry(
  point: RoomLifecycleBoundary,
  rank: number,
  placement: 'before' | 'after',
): RoomLifecycleBoundaryEntry {
  return Object.freeze({ kind: 'boundary', boundary: point, rank, placement });
}

/** The graph's events that stand on the Timeline: every event with a marker. */
function timelineEvents(graph: RoomEventGraph): readonly RoomEvent[] {
  return graph.events.filter((event) => !('markers' in event) || event.markers !== 'none');
}

function boundarySlot(entry: RoomLifecycleBoundaryEntry): number {
  return Math.max(0, entry.placement === 'before' ? entry.rank - 1 : entry.rank);
}

/**
 * Populate one profile-owned lifecycle skeleton with the occurrence's exact
 * authored action rows. Ranks choose inter-action slots; they never create or
 * reorder lifecycle points.
 */
export function assembleRoomLifecycleTimeline(
  input: RoomLifecycleTimelineInput,
): RoomLifecycleTimeline {
  const { roomActionRoster: roster } = input;
  const structure = roster.eventGraph;
  const entries: RoomLifecycleTimelineEntry[] = [];
  const rankedRows = roster.rows
    .filter((row) => row.rank !== null && !row.stale)
    .sort((left, right) => left.rank! - right.rank!);
  const finalRank = rankedRows.reduce((rank, row) => Math.max(rank, row.rank!), 0);
  const phaseByKey = new Map(structure.phases.map((phase) => [phase.phaseKey, phase]));
  const finalPhaseKey = structure.phases.at(-1)?.phaseKey;

  /** The row whose press or cage begins a phase's encounter, when a row does. */
  const beginningRow = (phaseKey: string): RoomActionReference | undefined => {
    const begun = structure.events.find(
      (event) => event.kind === 'encounterBegun' && event.phaseKey === phaseKey,
    );
    return begun?.kind === 'encounterBegun' && begun.trigger.kind === 'action'
      ? begun.trigger.action
      : undefined;
  };

  const wheelRow = ({ contact }: RoomActionRow): string | undefined =>
    contact.kind === 'beforeWheelPhase' ||
    contact.kind === 'beforeWheelChoice' ||
    contact.kind === 'afterWheelPhase'
      ? contact.wheelKey
      : undefined;
  const endEffectsRow = (row: RoomActionRow, phaseKey: string): boolean =>
    row.bounds.spawn.kind === 'endEffects' && row.bounds.spawn.phaseKey === phaseKey;

  const rowsForPhase = (phase: RoomEventGraphPhase): readonly RoomActionRow[] =>
    rankedRows.filter((row) => {
      if (phase.rewardWheelKey !== undefined) return wheelRow(row) === phase.rewardWheelKey;
      if (cagePhase(structure, phase.phaseKey))
        return (
          (row.bounds.spawn.kind === 'encounterEnd' &&
            row.bounds.spawn.phaseKey === phase.phaseKey) ||
          endEffectsRow(row, phase.phaseKey)
        );
      return (
        row.contact.kind === 'beforeCombat' ||
        (row.contact.kind === 'afterCombat' && phase.phaseKey === finalPhaseKey) ||
        endEffectsRow(row, phase.phaseKey)
      );
    });

  const firstPostCombatRankForPhase = (phase: RoomEventGraphPhase): number | undefined => {
    const phaseRows = rowsForPhase(phase);
    return phase.rewardWheelKey === undefined
      ? firstRank(
          phaseRows,
          (row) => row.contact.kind === 'afterCombat' || endEffectsRow(row, phase.phaseKey),
        )
      : firstRank(phaseRows, (row) => row.contact.kind === 'afterWheelPhase');
  };

  // A wheel's rerolls, choice and spoils stand in its phase's encounter, begun as its wheels open.
  const shipPhaseKeyForAction = (row: RoomActionRow): string | undefined =>
    wheelRow(row) === undefined ? undefined : row.contact.phaseKey;

  const place = roomEventPlaces(structure);
  const opening = (row: RoomActionRow) => place(roomActionOpeningPoint(row.bounds));

  // The slot of the last boundary placed; boundaries follow the structure's order.
  let precedingSlot = 0;

  /**
   * Where the fight an unplaced cage or wheel choice starts would start: after
   * the executable rows of its window the walk reaches before it, from the
   * last boundary placed, up to the first row of a later window or one it
   * cannot take. Undefined while a required action of an earlier window is
   * missing, since the walk stops there first.
   */
  const unplacedStartRank = (start: RoomActionReference, fromSlot: number): number | undefined => {
    const startRow = roster.rows.find((row) => row.key === roomActionKey(start));
    if (startRow === undefined) return undefined;
    const ordinal = opening(startRow);
    if (
      roster.rows.some(
        (row) =>
          row.rank === null &&
          row.participation === 'required' &&
          !row.stale &&
          opening(row) < ordinal,
      )
    )
      return undefined;
    let rank: number | undefined;
    for (const row of rankedRows) {
      if (row.rank! <= fromSlot) continue;
      if (!row.executable || opening(row) > ordinal) break;
      rank = row.rank!;
    }
    return rank;
  };

  /** Combat: after its gate row, or after the rows that precede an automatic start. */
  const desiredCombat = (
    point: Extract<RoomLifecycleBoundary, { readonly kind: 'encounterStarted' }>,
    begun: Extract<RoomLifecycleBoundary, { readonly kind: 'encounterBegun' }> | undefined,
  ): RoomLifecycleBoundaryEntry => {
    // A cage's or press's row begins its fight, and a wheel's choice or a gate pickup starts it.
    const start =
      (begun?.trigger.kind === 'action' ? begun.trigger.action : undefined) ??
      (point.trigger.kind === 'action' ? point.trigger.action : undefined);
    if (start !== undefined) {
      const placed = actionRank(roster, start);
      if (placed !== undefined) return boundaryEntry(point, placed, 'after');
      const unplaced = unplacedStartRank(start, precedingSlot);
      return unplaced === undefined
        ? boundaryEntry(point, 0, 'before')
        : boundaryEntry(point, unplaced, 'after');
    }
    const lastPreCombatRank = lastRank(rankedRows, (row) => row.contact.kind === 'beforeCombat');
    return lastPreCombatRank === undefined
      ? boundaryEntry(point, 0, 'before')
      : boundaryEntry(point, lastPreCombatRank, 'after');
  };

  const desiredBoundary = (point: RoomLifecycleBoundary): RoomLifecycleBoundaryEntry => {
    switch (point.kind) {
      case 'roomEntered':
        return boundaryEntry(point, 0, 'before');
      case 'encounterBegun': {
        // An encounter no gate separates from its Combat stands where its Combat does.
        const combat = structure.events.find(
          (event): event is Extract<RoomLifecycleBoundary, { readonly kind: 'encounterStarted' }> =>
            event.kind === 'encounterStarted' && event.phaseKey === point.phaseKey,
        );
        if (combat?.trigger.kind === 'automatic') {
          const at = desiredCombat(combat, point);
          return boundaryEntry(point, at.rank, at.placement);
        }
        // A cage's row begins it; otherwise it begins with what came before (room
        // entry, Wheels open, the previous phase's end).
        if (point.trigger.kind === 'action') {
          const placed = actionRank(roster, point.trigger.action);
          if (placed !== undefined) return boundaryEntry(point, placed, 'after');
          const unplaced = unplacedStartRank(point.trigger.action, precedingSlot);
          if (unplaced !== undefined) return boundaryEntry(point, unplaced, 'after');
        }
        return boundaryEntry(point, 0, 'before');
      }
      case 'encounterStarted':
        return desiredCombat(
          point,
          structure.events.find(
            (event): event is Extract<RoomLifecycleBoundary, { readonly kind: 'encounterBegun' }> =>
              event.kind === 'encounterBegun' && event.phaseKey === point.phaseKey,
          ),
        );
      case 'bossDefeated': {
        const phase = phaseByKey.get(point.phaseKey);
        if (phase === undefined) throw new Error(`unknown lifecycle phase ${point.phaseKey}`);
        const firstPostCombatRank = firstPostCombatRankForPhase(phase);
        return boundaryEntry(
          point,
          firstPostCombatRank ?? lastRank(rowsForPhase(phase), () => true) ?? 0,
          firstPostCombatRank === undefined ? 'after' : 'before',
        );
      }
      case 'encounterEnd': {
        // A fight its row begins ends with that row.
        const begunBy = beginningRow(point.phaseKey);
        if (begunBy !== undefined)
          return boundaryEntry(point, actionRank(roster, begunBy) ?? 0, 'after');
        const phase = phaseByKey.get(point.phaseKey);
        if (phase === undefined) throw new Error(`unknown lifecycle phase ${point.phaseKey}`);
        const phaseRows = rowsForPhase(phase);
        const firstPostCombatRank = firstPostCombatRankForPhase(phase);
        const rank =
          firstPostCombatRank ??
          actionRank(
            roster,
            phase.rewardWheelKey === undefined
              ? Object.freeze({ kind: 'interactEncounter', phaseKey: phase.phaseKey })
              : Object.freeze({
                  kind: 'chooseRewardWheel',
                  wheelKey: phase.rewardWheelKey,
                }),
          ) ??
          lastRank(phaseRows, () => true) ??
          0;
        return boundaryEntry(point, rank, firstPostCombatRank === undefined ? 'after' : 'before');
      }
      // The next wheels roll right after the previous phase's end effects; a first
      // phase's wheels open with the room.
      case 'wheelsOpen': {
        if (point.afterPhaseKey === undefined) return boundaryEntry(point, 0, 'after');
        const openedOrdinal = place(
          Object.freeze({ kind: 'endEffects' as const, phaseKey: point.afterPhaseKey }),
        );
        return boundaryEntry(
          point,
          lastRank(
            rankedRows,
            (row) => row.participation === 'required' && opening(row) < openedOrdinal,
          ) ?? 0,
          'after',
        );
      }
      // The doors open right after the row that makes the exits ready: the last
      // required one before them, once every encounter has ended.
      case 'doorsOpened':
        return boundaryEntry(point, doorsReadyAfterRank(roster.rows).afterRank, 'after');
    }
  };

  // A Nemesis random event's events carry no marker, so they hold no Timeline position.
  const boundaryEntries = timelineEvents(structure).map((point) => {
    const desired = desiredBoundary(point);
    const desiredSlot = boundarySlot(desired);
    const slot = Math.max(precedingSlot, desiredSlot);
    precedingSlot = slot;
    return Object.freeze({
      entry:
        slot === desiredSlot
          ? desired
          : Object.freeze({ ...desired, rank: slot, placement: 'after' as const }),
      slot,
    });
  });
  const boundaryBySlot = new Map<number, RoomLifecycleBoundaryEntry[]>();
  for (const { entry, slot } of boundaryEntries) {
    const at = boundaryBySlot.get(slot) ?? [];
    at.push(entry);
    boundaryBySlot.set(slot, at);
  }
  const rowByRank = new Map(rankedRows.map((row) => [row.rank!, row]));
  const finalSlot = Math.max(finalRank, ...boundaryEntries.map(({ slot }) => slot));
  for (let slot = 0; slot <= finalSlot; slot += 1) {
    entries.push(...(boundaryBySlot.get(slot) ?? []));
    const row = rowByRank.get(slot + 1);
    if (row !== undefined) {
      const phaseKey =
        shipPhaseKeyForAction(row) ??
        ('phaseKey' in row.reference ? row.reference.phaseKey : undefined);
      entries.push(
        Object.freeze({
          kind: 'action',
          action: row,
          rank: row.rank!,
          ...(phaseKey === undefined ? {} : { phaseKey }),
        }),
      );
    }
  }

  return Object.freeze({
    owner: input.owner,
    graph: structure,
    entries: Object.freeze(entries),
    boundaries: Object.freeze(boundaryEntries.map(({ entry }) => entry.boundary)),
    doorsAfterRank:
      boundaryEntries.find(({ entry }) => entry.boundary.kind === 'doorsOpened')?.slot ?? 0,
    repairRows: Object.freeze(roster.rows.filter((row) => row.rank === null || row.stale)),
  });
}

/** Apply an engine-assessed active phase prefix without reconstructing the graph in a consumer. */
export function scopeRoomLifecycleTimeline(
  timeline: RoomLifecycleTimeline,
  activePhaseKeys: readonly string[],
): RoomLifecycleTimeline {
  const graph = scopeRoomEventGraph(timeline.graph, activePhaseKeys);
  if (graph === timeline.graph) return timeline;
  const active = new Set(graph.activeEncounterSlotKeys);
  const boundaryActive = (boundary: RoomLifecycleBoundary): boolean =>
    roomEventActive(graph, boundary);
  const entries = timeline.entries.filter(
    (entry) =>
      (entry.kind === 'boundary' && boundaryActive(entry.boundary)) ||
      (entry.kind === 'action' && (entry.phaseKey === undefined || active.has(entry.phaseKey))) ||
      (entry.kind === 'automaticEffect' && active.has(entry.phaseKey)),
  );
  return Object.freeze({
    owner: timeline.owner,
    graph,
    entries: Object.freeze(entries),
    boundaries: Object.freeze(timeline.boundaries.filter(boundaryActive)),
    doorsAfterRank: timeline.doorsAfterRank,
    repairRows: timeline.repairRows,
  });
}
