import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import type { CountedRewardBinding } from '../../../reward-kernel/bindings';
import type {
  AnomalyReplacementProvenance,
  AuthoredAdditionalExit,
  OccurrenceId,
} from '../../model';
import { type RoomOccurrenceRole } from '../../room-state/declaration';
import { expectNonBlankString, failProjectDocument } from '../../validation';

export interface RawOccurrence {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  readonly anomalyReplacement: unknown;
  readonly hasAnomalyReplacement: boolean;
  readonly state: unknown;
  readonly encounters: unknown;
  readonly roomActions: unknown;
  readonly additionalExits: unknown;
  readonly acquisitionSites: unknown;
  readonly hasAcquisitionSites: boolean;
  readonly hermesShrine?: unknown;
  readonly hasHermesShrine?: boolean;
  readonly stygianWell?: unknown;
  readonly hasStygianWell?: boolean;
  readonly fountainRarityResult?: unknown;
  readonly hasFountainRarityResult?: boolean;
  readonly purgingPool?: unknown;
  readonly hasPurgingPool?: boolean;
  readonly keepsakeRack?: unknown;
  readonly hasKeepsakeRack?: boolean;
  readonly figurineArcanaKeysByPhase?: unknown;
  readonly hasFigurineArcanaKeysByPhase?: boolean;
  readonly path: string;
}

export interface OccurrenceOwner {
  readonly gameName: string;
  readonly role: RoomOccurrenceRole;
  readonly entryActive: boolean;
  readonly anomalyReplacement?: AnomalyReplacementProvenance;
  readonly rememberedCountedBinding?: CountedRewardBinding;
  readonly path: string;
}

export interface RawDecision {
  readonly value: Record<string, unknown>;
  readonly path: string;
}

export function occurrenceId(value: unknown, path: string): OccurrenceId {
  return expectNonBlankString(value, path) as OccurrenceId;
}

export function requireKnownRoom(occurrence: RawOccurrence, catalog: Catalog): RoomDeclaration {
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) {
    failProjectDocument(`${occurrence.path}.gameName`, `unknown room ${occurrence.gameName}`);
  }
  if (room.mode.kind !== 'authored') {
    failProjectDocument(`${occurrence.path}.gameName`, `${occurrence.gameName} is layout-derived`);
  }
  return room;
}

export function requireHostRoom(
  occurrence: RawOccurrence,
  catalog: Catalog,
  biomeKey: string,
): RoomDeclaration {
  const room = requireKnownRoom(occurrence, catalog);
  if (room.roomSetKey !== biomeKey) {
    failProjectDocument(
      `${occurrence.path}.gameName`,
      `${occurrence.gameName} belongs to ${room.roomSetKey}`,
    );
  }
  return room;
}

export type AdditionalExitsFor = (
  occurrenceId: OccurrenceId,
  diagnosticPath: string,
) => readonly AuthoredAdditionalExit[];
