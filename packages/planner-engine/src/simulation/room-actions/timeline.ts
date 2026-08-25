import type {
  SteadyGrowthOutcomeAddress,
  OccurrenceAddress,
} from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';
import type {
  RoomLifecycleStructure,
  RoomLifecycleStructurePhase,
  RoomLifecycleStructurePoint,
} from '../../authored-project/room-action-domain';
import { scopeRoomLifecycleStructure } from '../../authored-project/room-action-domain';
import { roomActionKey } from '../../authored-project/room-actions';
import { semanticAddressKey } from '../../authored-project/addresses';
import type { RoomActionRoster, RoomActionRow } from './model';

export type RoomLifecycleBoundary =
  | Exclude<
      RoomLifecycleStructurePoint,
      { readonly kind: 'nextPhase' } | { readonly kind: 'outgoingGeneration' }
    >
  | {
      readonly kind: 'nextPhase';
      readonly key: string;
      readonly wheelKey: string;
    };

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
      readonly effect: 'steadyGrowth';
      readonly address: SteadyGrowthOutcomeAddress;
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
  readonly structure: RoomLifecycleStructure;
  readonly entries: readonly RoomLifecycleTimelineEntry[];
  readonly boundaries: readonly RoomLifecycleBoundary[];
  /** Retained unranked/stale action rows remain available to a repair surface. */
  readonly repairRows: readonly RoomActionRow[];
}

export interface RoomLifecycleTimelineInput {
  readonly owner: OccurrenceAddress;
  readonly roomActionRoster: RoomActionRoster;
}

/**
 * Add reached Steady Growth checkpoints to the engine-owned room timeline.
 * The effect is fixed immediately after its phase's encounter end; consumers
 * only adapt the resulting entry into their presentation contract.
 */
export function appendSteadyGrowthTimelineEffects(
  timeline: RoomLifecycleTimeline,
  outcomes: readonly SteadyGrowthOutcomeAddress[],
): RoomLifecycleTimeline {
  const owned = outcomes.filter(
    (outcome) => semanticAddressKey(outcome.owner) === semanticAddressKey(timeline.owner),
  );
  if (owned.length === 0) return timeline;
  const entries: RoomLifecycleTimelineEntry[] = [];
  for (const entry of timeline.entries) {
    entries.push(entry);
    if (entry.kind !== 'boundary' || entry.boundary.kind !== 'encounterEnd') continue;
    for (const outcome of owned) {
      if (outcome.phaseKey !== entry.boundary.phaseKey) continue;
      entries.push(
        Object.freeze({
          kind: 'automaticEffect' as const,
          effect: 'steadyGrowth' as const,
          address: outcome,
          boundary: entry.boundary,
          phaseKey: outcome.phaseKey,
          rank: entry.rank,
        }),
      );
    }
  }
  return Object.freeze({ ...timeline, entries: Object.freeze(entries) });
}

function checkpointRank(roster: RoomActionRoster, key: string): number | undefined {
  return roster.checkpoints.find((checkpoint) => checkpoint.checkpointKey === key)?.afterRank;
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

type VisibleRoomLifecycleStructurePoint = Exclude<
  RoomLifecycleStructurePoint,
  { readonly kind: 'outgoingGeneration' }
>;

function publicBoundary(point: VisibleRoomLifecycleStructurePoint): RoomLifecycleBoundary {
  if (point.kind !== 'nextPhase') return point;
  return Object.freeze({ kind: point.kind, key: point.key, wheelKey: point.wheelKey });
}

function boundaryEntry(
  point: VisibleRoomLifecycleStructurePoint,
  rank: number,
  placement: 'before' | 'after',
): RoomLifecycleBoundaryEntry {
  return Object.freeze({
    kind: 'boundary',
    boundary: publicBoundary(point),
    rank,
    placement,
  });
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
  const structure = roster.lifecycleStructure;
  const entries: RoomLifecycleTimelineEntry[] = [];
  const rankedRows = roster.rows
    .filter((row) => row.rank !== null && !row.stale)
    .sort((left, right) => left.rank! - right.rank!);
  const finalRank = rankedRows.reduce((rank, row) => Math.max(rank, row.rank!), 0);
  const phaseByKey = new Map(structure.phases.map((phase) => [phase.phaseKey, phase]));

  const rowsForPhase = (phase: RoomLifecycleStructurePhase): readonly RoomActionRow[] =>
    rankedRows.filter((row) => {
      if (phase.rewardWheelKey !== undefined) {
        return (
          (row.window.kind === 'shipPreCombat' || row.window.kind === 'shipPostCombat') &&
          row.window.wheelKey === phase.rewardWheelKey
        );
      }
      if (structure.profileKey === 'FieldsCombatRoom') {
        return row.window.kind === 'fields' && row.window.phaseKey === phase.phaseKey;
      }
      return row.window.kind === 'standard';
    });

  const shipPhaseKeyForAction = (row: RoomActionRow): string | undefined => {
    if (structure.profileKey !== 'ShipCombatRoom') return undefined;
    if (row.window.kind === 'shipPostCombat') {
      const wheelKey = row.window.wheelKey;
      return structure.phases.find((phase) => phase.rewardWheelKey === wheelKey)?.phaseKey;
    }
    if (row.window.kind === 'shipPreCombat') {
      const wheelKey = row.window.wheelKey;
      const targetIndex = structure.phases.findIndex((phase) => phase.rewardWheelKey === wheelKey);
      return targetIndex > 0 ? structure.phases[targetIndex - 1]?.phaseKey : undefined;
    }
    return undefined;
  };

  const desiredBoundary = (
    point: VisibleRoomLifecycleStructurePoint,
  ): RoomLifecycleBoundaryEntry => {
    switch (point.kind) {
      case 'roomEntered':
        return boundaryEntry(point, 0, 'before');
      case 'encounterStart': {
        const phase = phaseByKey.get(point.phaseKey);
        if (phase === undefined) throw new Error(`unknown lifecycle phase ${point.phaseKey}`);
        const cage =
          structure.profileKey === 'FieldsCombatRoom'
            ? Object.freeze({ kind: 'completeFieldsCage' as const, phaseKey: phase.phaseKey })
            : undefined;
        const choose =
          phase.rewardWheelKey === undefined
            ? undefined
            : Object.freeze({
                kind: 'chooseRewardWheel' as const,
                wheelKey: phase.rewardWheelKey,
              });
        const lastPreCombatRank =
          cage === undefined && choose === undefined
            ? lastRank(
                rankedRows,
                (row) => row.window.kind === 'standard' && row.window.phase === 'beforeCombat',
              )
            : undefined;
        const rank =
          cage !== undefined
            ? (actionRank(roster, cage) ?? 0)
            : choose !== undefined
              ? (actionRank(roster, choose) ?? 0)
              : (lastPreCombatRank ?? 0);
        return boundaryEntry(
          point,
          rank,
          cage !== undefined
            ? 'before'
            : choose !== undefined || lastPreCombatRank !== undefined
              ? 'after'
              : 'before',
        );
      }
      case 'bossDefeated':
        return boundaryEntry(point, lastRank(rankedRows, () => true) ?? 0, 'after');
      case 'encounterEnd': {
        const phase = phaseByKey.get(point.phaseKey);
        if (phase === undefined) throw new Error(`unknown lifecycle phase ${point.phaseKey}`);
        if (structure.profileKey === 'FieldsCombatRoom') {
          return boundaryEntry(
            point,
            actionRank(roster, {
              kind: 'completeFieldsCage',
              phaseKey: phase.phaseKey,
            }) ?? 0,
            'after',
          );
        }
        const phaseRows = rowsForPhase(phase);
        const firstPostCombatRank =
          phase.rewardWheelKey === undefined
            ? firstRank(
                phaseRows,
                (row) => row.window.kind === 'standard' && row.window.phase === 'afterCombat',
              )
            : firstRank(phaseRows, (row) => row.window.kind === 'shipPostCombat');
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
      case 'nextPhase':
        return point.previousWheelKey === undefined
          ? boundaryEntry(
              point,
              actionRank(roster, {
                kind: 'chooseRewardWheel',
                wheelKey: point.wheelKey,
              }) ?? 0,
              'before',
            )
          : boundaryEntry(
              point,
              checkpointRank(roster, `nextPhaseUsable:${point.previousWheelKey}`) ?? 0,
              'after',
            );
      case 'cleanup':
        return boundaryEntry(point, checkpointRank(roster, 'exitUsable') ?? finalRank, 'after');
    }
  };

  let precedingSlot = 0;
  const boundaryEntries = structure.points
    .filter(
      (point): point is VisibleRoomLifecycleStructurePoint => point.kind !== 'outgoingGeneration',
    )
    .map((point) => {
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
    structure,
    entries: Object.freeze(entries),
    boundaries: Object.freeze(boundaryEntries.map(({ entry }) => entry.boundary)),
    repairRows: Object.freeze(roster.rows.filter((row) => row.rank === null || row.stale)),
  });
}

/** Apply an engine-assessed active phase prefix without reconstructing the skeleton in a consumer. */
export function scopeRoomLifecycleTimeline(
  timeline: RoomLifecycleTimeline,
  activePhaseKeys: readonly string[],
): RoomLifecycleTimeline {
  const structure = scopeRoomLifecycleStructure(timeline.structure, activePhaseKeys);
  if (structure === timeline.structure) return timeline;
  const active = new Set(structure.activeEncounterSlotKeys);
  const activeWheelKeys = new Set(
    structure.phases.flatMap((phase) =>
      phase.rewardWheelKey === undefined ? [] : [phase.rewardWheelKey],
    ),
  );
  const boundaryActive = (boundary: RoomLifecycleBoundary): boolean => {
    switch (boundary.kind) {
      case 'encounterStart':
      case 'bossDefeated':
      case 'encounterEnd':
        return active.has(boundary.phaseKey);
      case 'nextPhase':
        return activeWheelKeys.has(boundary.wheelKey);
      case 'roomEntered':
      case 'cleanup':
        return true;
    }
  };
  const entries = timeline.entries.filter(
    (entry) =>
      (entry.kind === 'boundary' && boundaryActive(entry.boundary)) ||
      (entry.kind === 'action' && (entry.phaseKey === undefined || active.has(entry.phaseKey))) ||
      (entry.kind === 'automaticEffect' && active.has(entry.phaseKey)),
  );
  return Object.freeze({
    owner: timeline.owner,
    structure,
    entries: Object.freeze(entries),
    boundaries: Object.freeze(timeline.boundaries.filter(boundaryActive)),
    repairRows: timeline.repairRows,
  });
}
