import type { OccurrenceAddress } from '../../authored-project/addresses';
import type { ResolvedEncounterPhase } from '../encounters';
import type { RoomActionReference } from '../../authored-project/model';
import { roomActionKey } from '../../authored-project/room-actions';
import type { RoomActionRoster, RoomActionRow } from './model';

/**
 * The fixed, semantic seams that make one entered room legible to the editor.
 * These are derived lifecycle facts; they are not authored actions.
 */
export type RoomLifecycleBoundary =
  | { readonly kind: 'roomEntered'; readonly key: 'roomEntered' }
  | { readonly kind: 'encounterStart'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'encounterEnd'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'nextPhase'; readonly key: string; readonly wheelKey: string }
  | { readonly kind: 'outgoingGeneration'; readonly key: 'outgoingGeneration' }
  | { readonly kind: 'cleanup'; readonly key: 'cleanup' };

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
    };

type RoomLifecycleBoundaryEntry = Extract<
  RoomLifecycleTimelineEntry,
  { readonly kind: 'boundary' }
>;

export interface RoomLifecycleTimeline {
  readonly owner: OccurrenceAddress;
  readonly entries: readonly RoomLifecycleTimelineEntry[];
  readonly boundaries: readonly RoomLifecycleBoundary[];
  /** Retained unranked/stale action rows remain available to a repair surface. */
  readonly repairRows: readonly RoomActionRow[];
}

export interface RoomLifecycleTimelineInput {
  readonly owner: OccurrenceAddress;
  readonly lifecycleProfileKey: string;
  readonly encounterPhases: readonly ResolvedEncounterPhase[];
  readonly roomActionRoster: RoomActionRoster;
}

function checkpointRank(roster: RoomActionRoster, key: string): number {
  return roster.checkpoints.find((checkpoint) => checkpoint.checkpointKey === key)?.afterRank ?? 0;
}

function actionRank(roster: RoomActionRoster, reference: RoomActionReference): number | undefined {
  const key = roomActionKey(reference);
  const row = roster.rows.find((candidate) => candidate.key === key);
  return row?.rank ?? undefined;
}

function addBoundary(
  boundaries: RoomLifecycleBoundaryEntry[],
  boundary: RoomLifecycleBoundary,
  rank: number,
  placement: 'before' | 'after',
): void {
  boundaries.push(Object.freeze({ kind: 'boundary', boundary, rank, placement }));
}

function boundaryPriority(boundary: RoomLifecycleBoundary): number {
  switch (boundary.kind) {
    case 'roomEntered':
      return 0;
    case 'encounterStart':
      return 15;
    case 'encounterEnd':
      return 5;
    case 'nextPhase':
      return 10;
    case 'outgoingGeneration':
      return 40;
    case 'cleanup':
      return 50;
  }
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

/**
 * Assemble the player-facing lifecycle seams from existing declaration phases
 * and the existing RoomActionRoster. This function does not assess candidates,
 * recalculate dependencies, or mutate the authored order.
 */
export function assembleRoomLifecycleTimeline(
  input: RoomLifecycleTimelineInput,
): RoomLifecycleTimeline {
  const { encounterPhases, roomActionRoster: roster } = input;
  const entries: RoomLifecycleTimelineEntry[] = [];
  const boundaries: RoomLifecycleBoundaryEntry[] = [];
  const rankedRows = roster.rows
    .filter((row) => row.rank !== null && !row.stale)
    .sort((left, right) => left.rank! - right.rank!);
  const finalRank = rankedRows.reduce((rank, row) => Math.max(rank, row.rank!), 0);

  addBoundary(boundaries, Object.freeze({ kind: 'roomEntered', key: 'roomEntered' }), 0, 'before');

  const profile = input.lifecycleProfileKey;
  const activePhases = encounterPhases.filter((phase) => phase.kind !== 'nonCombat');
  const rowsForPhase = (phase: ResolvedEncounterPhase): readonly RoomActionRow[] =>
    rankedRows.filter((row) => {
      if (phase.rewardAttachment?.kind === 'rewardWheel') {
        return (
          (row.window.kind === 'shipPreCombat' || row.window.kind === 'shipPostCombat') &&
          row.window.wheelKey === phase.rewardAttachment.key
        );
      }
      if (profile === 'FieldsCombatRoom' && phase.rewardAttachment?.kind === 'localReward') {
        return row.window.kind === 'fields' && row.window.phaseKey === phase.slotKey;
      }
      return row.window.kind === 'standard';
    });
  const shipPhaseKeyForAction = (row: RoomActionRow): string | undefined => {
    if (profile !== 'ShipCombatRoom') return undefined;
    if (row.window.kind === 'shipPostCombat') {
      const wheelKey = row.window.wheelKey;
      return activePhases.find(
        (phase) =>
          phase.rewardAttachment?.kind === 'rewardWheel' && phase.rewardAttachment.key === wheelKey,
      )?.slotKey;
    }
    if (row.window.kind === 'shipPreCombat') {
      const wheelKey = row.window.wheelKey;
      const targetIndex = activePhases.findIndex(
        (phase) =>
          phase.rewardAttachment?.kind === 'rewardWheel' && phase.rewardAttachment.key === wheelKey,
      );
      return targetIndex > 0 ? activePhases[targetIndex - 1]?.slotKey : undefined;
    }
    return undefined;
  };

  const addPhaseBoundaries = (phase: ResolvedEncounterPhase): void => {
    const wheel =
      phase.rewardAttachment?.kind === 'rewardWheel' ? phase.rewardAttachment : undefined;
    const cage =
      profile === 'FieldsCombatRoom' && phase.rewardAttachment?.kind === 'localReward'
        ? Object.freeze({ kind: 'completeFieldsCage' as const, phaseKey: phase.slotKey })
        : undefined;
    const choose =
      wheel === undefined
        ? undefined
        : Object.freeze({ kind: 'chooseRewardWheel' as const, wheelKey: wheel.key });
    const lastPreCombatRank =
      cage === undefined && choose === undefined
        ? lastRank(
            rankedRows,
            (row) => row.window.kind === 'standard' && row.window.phase === 'beforeCombat',
          )
        : undefined;
    const startRank =
      cage === undefined
        ? choose === undefined
          ? (lastPreCombatRank ?? 0)
          : (actionRank(roster, choose) ?? 0)
        : (actionRank(roster, cage) ?? 0);
    const startPlacement =
      cage !== undefined
        ? 'before'
        : choose !== undefined || lastPreCombatRank !== undefined
          ? 'after'
          : 'before';
    addBoundary(
      boundaries,
      Object.freeze({
        kind: 'encounterStart',
        key: `encounterStart:${phase.slotKey}`,
        phaseKey: phase.slotKey,
      }),
      startRank,
      startPlacement,
    );

    // Fields' grouped cage action is the complete activation-through-combat
    // atomic span. Do not use reward rows to widen that span.
    if (cage !== undefined) {
      const cageRank = actionRank(roster, cage) ?? 0;
      addBoundary(
        boundaries,
        Object.freeze({
          kind: 'encounterEnd',
          key: `encounterEnd:${phase.slotKey}`,
          phaseKey: phase.slotKey,
        }),
        cageRank,
        'after',
      );
      return;
    }
    const phaseRows = rowsForPhase(phase);
    const firstPostCombatRank =
      wheel === undefined
        ? firstRank(
            phaseRows,
            (row) => row.window.kind === 'standard' && row.window.phase === 'afterCombat',
          )
        : firstRank(phaseRows, (row) => row.window.kind === 'shipPostCombat');
    const endRank =
      firstPostCombatRank ??
      actionRank(
        roster,
        choose ?? Object.freeze({ kind: 'interactEncounter', phaseKey: phase.slotKey }),
      ) ??
      lastRank(phaseRows, () => true) ??
      0;
    const endPlacement = firstPostCombatRank === undefined ? 'after' : 'before';
    addBoundary(
      boundaries,
      Object.freeze({
        kind: 'encounterEnd',
        key: `encounterEnd:${phase.slotKey}`,
        phaseKey: phase.slotKey,
      }),
      endRank,
      endPlacement,
    );
  };

  if (profile === 'FieldsCombatRoom') {
    const cagePhases = activePhases.filter(
      (phase) => phase.rewardAttachment?.kind === 'localReward',
    );
    const rankedCages = cagePhases
      .flatMap((phase) => {
        const rank = actionRank(roster, { kind: 'completeFieldsCage', phaseKey: phase.slotKey });
        return rank === undefined ? [] : [{ phase, rank }];
      })
      .sort((left, right) => {
        return left.rank - right.rank;
      });
    rankedCages.forEach(({ phase }) => addPhaseBoundaries(phase));
  } else {
    activePhases.forEach((phase) => addPhaseBoundaries(phase));
    activePhases.forEach((phase, index) => {
      const wheel =
        phase.rewardAttachment?.kind === 'rewardWheel' ? phase.rewardAttachment : undefined;
      if (wheel === undefined || index === 0) return;
      const previousWheel = activePhases[index - 1]?.rewardAttachment;
      addBoundary(
        boundaries,
        Object.freeze({
          kind: 'nextPhase',
          key: `nextPhase:${wheel.key}`,
          wheelKey: wheel.key,
        }),
        previousWheel?.kind === 'rewardWheel'
          ? checkpointRank(roster, `nextPhaseUsable:${previousWheel.key}`)
          : (actionRank(
              roster,
              Object.freeze({ kind: 'chooseRewardWheel' as const, wheelKey: wheel.key }),
            ) ?? 0),
        previousWheel?.kind === 'rewardWheel' ? 'after' : 'before',
      );
    });
  }

  const hasOutgoing = roster.checkpoints.some(
    (checkpoint) => checkpoint.checkpointKey === 'outgoingGeneration',
  );
  const fieldsCageRanks =
    profile === 'FieldsCombatRoom'
      ? activePhases
          .filter((phase) => phase.rewardAttachment?.kind === 'localReward')
          .map((phase) =>
            actionRank(roster, { kind: 'completeFieldsCage', phaseKey: phase.slotKey }),
          )
          .filter((rank): rank is number => rank !== undefined)
      : [];
  const fieldsCleanupRank = fieldsCageRanks.length === 0 ? undefined : Math.max(...fieldsCageRanks);
  if (hasOutgoing) {
    addBoundary(
      boundaries,
      Object.freeze({ kind: 'outgoingGeneration', key: 'outgoingGeneration' }),
      checkpointRank(roster, 'outgoingGeneration'),
      'after',
    );
    if (fieldsCleanupRank === undefined) {
      addBoundary(
        boundaries,
        Object.freeze({ kind: 'cleanup', key: 'cleanup' }),
        checkpointRank(roster, 'outgoingGeneration'),
        'after',
      );
    }
  }
  if (fieldsCleanupRank !== undefined) {
    addBoundary(
      boundaries,
      Object.freeze({ kind: 'cleanup', key: 'cleanup' }),
      fieldsCleanupRank,
      'after',
    );
  } else if (!hasOutgoing) {
    addBoundary(boundaries, Object.freeze({ kind: 'cleanup', key: 'cleanup' }), finalRank, 'after');
  }

  const boundaryEntries = boundaries.sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    if (left.placement !== right.placement) return left.placement === 'before' ? -1 : 1;
    if (profile === 'FieldsCombatRoom') {
      if (left.boundary.kind === 'cleanup' && right.boundary.kind === 'outgoingGeneration') {
        return -1;
      }
      if (left.boundary.kind === 'outgoingGeneration' && right.boundary.kind === 'cleanup') {
        return 1;
      }
    }
    return boundaryPriority(left.boundary) - boundaryPriority(right.boundary);
  });
  const boundaryByRank = new Map<number, RoomLifecycleBoundaryEntry[]>();
  for (const entry of boundaryEntries) {
    const at = boundaryByRank.get(entry.rank) ?? [];
    at.push(entry);
    boundaryByRank.set(entry.rank, at);
  }
  for (const row of rankedRows) {
    const rank = row.rank!;
    const phaseKey = shipPhaseKeyForAction(row);
    for (const boundary of boundaryByRank.get(rank) ?? []) {
      if (boundary.placement === 'before') entries.push(boundary);
    }
    entries.push(
      Object.freeze({
        kind: 'action' as const,
        action: row,
        rank,
        ...(phaseKey === undefined ? {} : { phaseKey }),
      }),
    );
    for (const boundary of boundaryByRank.get(rank) ?? []) {
      if (boundary.placement === 'after') entries.push(boundary);
    }
  }
  for (const boundary of boundaryEntries) {
    if (boundary.rank === 0 || boundary.rank > rankedRows.length) {
      if (boundary.rank === 0 || !entries.includes(boundary)) entries.push(boundary);
    }
  }
  entries.sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    if (left.kind !== right.kind) {
      if (left.kind === 'boundary' && right.kind === 'action') {
        return left.placement === 'before' ? -1 : 1;
      }
      if (left.kind === 'action' && right.kind === 'boundary') {
        return right.placement === 'before' ? 1 : -1;
      }
    }
    if (left.kind === 'boundary' && right.kind === 'boundary') {
      if (left.placement !== right.placement) return left.placement === 'before' ? -1 : 1;
      if (profile === 'FieldsCombatRoom') {
        if (left.boundary.kind === 'cleanup' && right.boundary.kind === 'outgoingGeneration') {
          return -1;
        }
        if (left.boundary.kind === 'outgoingGeneration' && right.boundary.kind === 'cleanup') {
          return 1;
        }
      }
      return boundaryPriority(left.boundary) - boundaryPriority(right.boundary);
    }
    return 0;
  });

  return Object.freeze({
    owner: input.owner,
    entries: Object.freeze(entries),
    boundaries: Object.freeze(
      boundaryEntries
        .map((entry) => (entry.kind === 'boundary' ? entry.boundary : null))
        .filter((entry): entry is RoomLifecycleBoundary => entry !== null),
    ),
    repairRows: Object.freeze(roster.rows.filter((row) => row.rank === null || row.stale)),
  });
}
