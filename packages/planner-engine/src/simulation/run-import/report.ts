import type { ProjectCommand, SemanticAddress } from '../../authored-project';

/** Why an imported value is not the record's own exact answer. */
export type RunImportReason =
  /** The record does not hold the fact the decision needs. */
  | 'notInRecord'
  /** The engine refused the observed value. */
  | 'refused'
  /** No generated customization replays the observed waves. */
  | 'inverseMismatch'
  /** The importer does not yet read this area of the record. */
  | 'unsupportedArea'
  /** The record holds the fact, but its mapping onto the plan rests on a stated assumption. */
  | 'assumption'
  /** No answer or guess settled this question; the plan ends before it. */
  | 'stopped';

export type RunImportArea =
  | 'loadout'
  | 'route'
  | 'doors'
  | 'hub'
  | 'reward'
  | 'encounter'
  | 'traitOffer'
  | 'conversion'
  | 'roomActionOrder'
  | 'shop'
  | 'well'
  | 'pool'
  | 'anvil'
  | 'embryo'
  | 'pathOfStars'
  | 'chaosGate'
  | 'rack'
  | 'fountain'
  | 'wheel'
  | 'fields'
  | 'npc'
  | 'menace'
  | 'dream'
  | 'other';

/** One record room visit: its `rooms` index and the visit ordinal of its occurrence. */
export interface RunImportRecordLocation {
  readonly roomIndex: number;
  readonly visit: number;
  /** The recorded door the entry concerns, by native door id. */
  readonly door?: number;
}

export interface RunImportReportEntry {
  readonly area: RunImportArea;
  readonly reason: RunImportReason;
  /** The semantic owner of the decision; absent for a route-wide area. */
  readonly address?: SemanticAddress;
  /** The command the importer applied in place of the record's answer, if any. */
  readonly applied?: ProjectCommand;
  readonly record?: RunImportRecordLocation;
}

export interface RunImportReport {
  readonly entries: readonly RunImportReportEntry[];
}

/** The decision no answer or guess could settle, by its finding code; the plan ends before it. */
export interface RunImportStop {
  readonly area: RunImportArea;
  readonly code: string;
  readonly address?: SemanticAddress;
  readonly record?: RunImportRecordLocation;
}
