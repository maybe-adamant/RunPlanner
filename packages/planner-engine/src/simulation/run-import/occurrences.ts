import type { Catalog } from '../../catalog-schema';
import {
  createOccurrenceId,
  type OccurrenceId,
  type ProjectDocument,
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

  constructor(
    catalog: Catalog,
    private readonly record: RunRecord,
  ) {
    this.biomeOfRoom = recordRoomBiomeKeys(catalog, record);
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

  private bind(roomIndex: number, occurrenceId: OccurrenceId): void {
    const previous = this.occurrenceOfRoom[roomIndex]!;
    if (previous === occurrenceId) return;
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
    return createOccurrenceId(`${this.biomeOfRoom[sourceIndex]}-r${sourceIndex}-d${doorId}`);
  }

  /** The record room an occurrence id names, entered or offered. */
  roomIndexOfOccurrence(occurrenceId: string): number | undefined {
    const visits = this.roomsOfOccurrence.get(occurrenceId);
    if (visits !== undefined) return visits[0];
    const match = /-r(\d+)-d\d+$/.exec(occurrenceId);
    return match === null ? undefined : Number(match[1]);
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
