import type { Catalog } from '../../catalog-schema';
import {
  createOccurrenceId,
  type AuthoredRewardState,
  type OccurrenceId,
  type ProjectDocument,
  type RoomOccurrence,
  type SemanticAddress,
} from '../../authored-project';
import type { RunRecord } from '../../run-record/model';
import type { RunImportRecordLocation } from './report';
import { recordRoomBiomeKeys } from './vocabulary';

/**
 * Deterministic occurrence identities for the record's rooms. An entered room
 * is `<biome>-r<index>` of its first visit; a Hub biome's restored room keeps
 * that identity on every later visit. An offered room never entered is
 * `<biome>-r<source index>-d<door id>`.
 */
export class RecordOccurrences {
  readonly biomeOfRoom: readonly string[];
  private readonly occurrenceOfRoom: OccurrenceId[];
  private readonly roomsOfOccurrence = new Map<string, number[]>();
  private readonly offeredDoors = new Map<
    string,
    { readonly roomIndex: number; readonly door: number }
  >();
  private readonly chaosRooms: ReadonlySet<string>;

  constructor(
    catalog: Catalog,
    private readonly record: RunRecord,
  ) {
    this.biomeOfRoom = recordRoomBiomeKeys(catalog, record);
    this.chaosRooms = new Set(
      catalog.rooms.values
        .filter((room) => room.roomSetKey === 'Chaos')
        .map((room) => room.gameName),
    );
    const firstVisit = new Map<string, OccurrenceId>();
    this.occurrenceOfRoom = record.rooms.map((room, index) => {
      const biomeKey = this.biomeOfRoom[index]!;
      const restores = catalog.biomeLayouts.byKey[biomeKey]?.progression.kind === 'hub';
      const key = `${biomeKey}|${room.name}`;
      const id =
        (restores ? firstVisit.get(key) : undefined) ?? createOccurrenceId(`${biomeKey}-r${index}`);
      if (!firstVisit.has(key)) firstVisit.set(key, id);
      const visits = this.roomsOfOccurrence.get(id) ?? [];
      visits.push(index);
      this.roomsOfOccurrence.set(id, visits);
      return id;
    });
  }

  /**
   * Adopts the identities the engine gives the rooms it creates itself: each
   * later biome's start and the fixed Boss and PostBoss links.
   */
  bindEngineOccurrences(project: ProjectDocument): void {
    for (const biome of project.route.biomes) {
      const topology = biome.topology;
      if (topology === undefined || topology === null) continue;
      const first = this.biomeOfRoom.indexOf(biome.biomeKey);
      if (first >= 0) this.bind(first, topology.startOccurrenceId);
      // A Chaos gate Ixion opened is the engine's own occurrence.
      for (const occurrence of topology.occurrences)
        for (const exit of occurrence.additionalExits) {
          if (exit.kind !== 'chaos') continue;
          for (const index of this.visitsOf(occurrence.occurrenceId)) {
            const next = this.record.rooms[index + 1];
            if (next !== undefined && this.chaosRooms.has(next.name))
              this.bind(index + 1, exit.occurrenceId);
          }
        }
      for (const link of topology.fixedRoomLinks) {
        const target = topology.occurrences.find(
          (occurrence) => occurrence.occurrenceId === link.targetOccurrenceId,
        );
        for (const index of this.visitsOf(link.sourceOccurrenceId)) {
          if (this.record.rooms[index + 1]?.name === target?.gameName)
            this.bind(index + 1, link.targetOccurrenceId);
        }
      }
    }
  }

  /** Counts binding changes, so callers can tell when record visits moved. */
  bindings = 0;

  private bind(roomIndex: number, occurrenceId: OccurrenceId): void {
    const previous = this.occurrenceOfRoom[roomIndex]!;
    if (previous === occurrenceId) return;
    this.bindings += 1;
    this.roomsOfOccurrence.delete(previous);
    this.occurrenceOfRoom[roomIndex] = occurrenceId;
    const visits = this.roomsOfOccurrence.get(occurrenceId) ?? [];
    if (!visits.includes(roomIndex)) visits.push(roomIndex);
    visits.sort((left, right) => left - right);
    this.roomsOfOccurrence.set(occurrenceId, visits);
  }

  occurrenceOf(roomIndex: number): OccurrenceId {
    return this.occurrenceOfRoom[roomIndex]!;
  }

  /** Record room indices of every visit to the occurrence, in order. */
  visitsOf(occurrenceId: string): readonly number[] {
    return this.roomsOfOccurrence.get(occurrenceId) ?? [];
  }

  /** The occurrence of a room a source visit offered but did not enter. */
  offeredOccurrence(sourceIndex: number, doorId: number): OccurrenceId {
    const id = createOccurrenceId(`${this.biomeOfRoom[sourceIndex]}-r${sourceIndex}-d${doorId}`);
    this.offeredDoors.set(id, { roomIndex: sourceIndex, door: doorId });
    return id;
  }

  /** The source visit and door of an offered occurrence this table created. */
  offeredDoor(
    occurrenceId: string,
  ): { readonly roomIndex: number; readonly door: number } | undefined {
    return this.offeredDoors.get(occurrenceId);
  }

  /** The record room an occurrence id names, entered or offered. */
  roomIndexOfOccurrence(occurrenceId: string): number | undefined {
    return (
      this.roomsOfOccurrence.get(occurrenceId)?.[0] ??
      this.offeredDoors.get(occurrenceId)?.roomIndex
    );
  }

  /** The record visit an address concerns: its occurrence, or the source of its decision. */
  locationOf(address: SemanticAddress): RunImportRecordLocation | undefined {
    const occurrenceId = occurrenceIdOf(address);
    if (occurrenceId === undefined) return undefined;
    const visits = this.roomsOfOccurrence.get(occurrenceId);
    if (visits !== undefined) return { roomIndex: visits[0]!, visit: 0 };
    const roomIndex = this.roomIndexOfOccurrence(occurrenceId);
    return roomIndex === undefined ? undefined : { roomIndex, visit: 0 };
  }
}

/** The occurrence an address belongs to, through its owner or decision source. */
export function occurrenceIdOf(address: SemanticAddress): string | undefined {
  const value = address as unknown as Record<string, unknown>;
  if (typeof value['occurrenceId'] === 'string') return value['occurrenceId'];
  if (typeof value['sourceOccurrenceId'] === 'string') return value['sourceOccurrenceId'];
  for (const field of ['source', 'owner', 'occurrence', 'phase', 'trait', 'site', 'entry']) {
    const nested = value[field];
    if (typeof nested === 'object' && nested !== null) {
      const id = occurrenceIdOf(nested as SemanticAddress);
      if (id !== undefined) return id;
    }
  }
  return undefined;
}

/** The authored occurrence a biome topology holds. */
export function authoredOccurrence(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
): RoomOccurrence | undefined {
  return project.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
}

/** The reward a room's door delivers: its last reroll's, else its first draw. */
export function deliveredIncomingReward(
  occurrence: RoomOccurrence,
): AuthoredRewardState | null | undefined {
  if (occurrence.rerolledIncomingReward !== undefined) return occurrence.rerolledIncomingReward;
  return 'reward' in occurrence.state ? occurrence.state.reward : undefined;
}

/** The reward a Fields cage delivers: its last reroll's, else its first draw. */
export function deliveredCageReward(
  occurrence: RoomOccurrence,
  slotKey: string,
): AuthoredRewardState | null | undefined {
  const state = occurrence.state;
  if (state.kind !== 'fieldsCombat') return undefined;
  return state.rerolledCages?.[slotKey] ?? state.cages[slotKey];
}
