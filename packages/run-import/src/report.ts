import type { ProjectCommand, SemanticAddress } from '@run-planner/engine/authored-project';

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
  | 'stopped'
  /** The plan's run state differs from the state the game saved on entering the room. */
  | 'mismatch'
  /** The engine's settlement faulted at this owner while applying an answer; the answer is kept. */
  | 'engineFault';

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
  | 'resource'
  | 'npc'
  | 'menace'
  | 'reroll'
  | 'dream'
  | 'traits'
  | 'keepsake'
  | 'stores'
  | 'denial'
  | 'chaos'
  | 'forfeit'
  | 'elements'
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
  /** Other commands the record fits as well as `applied` but that leave another run state. */
  readonly alternatives?: readonly ProjectCommand[];
  readonly record?: RunImportRecordLocation;
  /** What a `mismatch` entry found. */
  readonly mismatch?: RunImportMismatch;
}

/** One run-state value the game saved and the plan's simulation holds otherwise. */
export interface RunImportMismatch {
  /** The game's name of the value: a trait, store, item, element or counter. */
  readonly field: string;
  /** The saved value. */
  readonly expected: string;
  /** The simulated value. */
  readonly actual: string;
}

/**
 * Where the imported plan ends: after the last fully settled record room
 * before the run's death or abandonment, or before the room whose next entry
 * save the plan's state differs from.
 */
export interface RunImportEnd {
  readonly cause: 'death' | 'abandoned' | 'entryMismatch';
  /** The end room, judged at its next entry save like any other. */
  readonly record: RunImportRecordLocation;
}

export interface RunImportReport {
  readonly entries: readonly RunImportReportEntry[];
  /** Present when the plan ends before the record's last room or at a death. */
  readonly end?: RunImportEnd;
  /** Each record room, in order, judged at its next entry save; a stored report may lack it. */
  readonly rooms?: readonly RunImportRoomAcceptance[];
}

/**
 * A record room judged at its next entry save: `accepted` when the plan holds
 * every compared value the save holds, `mismatch` when it does not, and
 * `unchecked` when no plan state compares the save.
 */
export type RunImportRoomAcceptance =
  | {
      readonly roomIndex: number;
      readonly verdict: 'accepted' | 'mismatch';
      /** Differences the room began or changed. */
      readonly introduced: readonly RunImportRoomDifference[];
      /** Differences an earlier room left that persist unchanged through this one. */
      readonly carried: readonly RunImportRoomDifference[];
      readonly unchecked: readonly RunImportUncheckedFamily[];
      /** The verdict when the walk first reached the next save, where later authoring changed it. */
      readonly whenReached?: 'accepted' | 'mismatch';
    }
  | {
      readonly roomIndex: number;
      readonly verdict: 'unchecked';
      readonly reason: RunImportRoomUncheckedReason;
    };

export type RunImportRoomUncheckedReason =
  /** The record carries no entry saves. */
  | 'noEntrySaves'
  /** The run's last room has no next entry save. */
  | 'lastRoom'
  /** The plan ends before the room. */
  | 'stopped'
  /** The plan's evaluation did not reach the next save's moment. */
  | 'unreached'
  /** The room is a restored visit, whose departure captures no state. */
  | 'restoredDeparture';

/** One fact family an entry save holds that no plan state at its moment compares. */
export interface RunImportUncheckedFamily {
  readonly family: 'elements';
  readonly reason:
    /**
     * Element grants follow the room's exit; a Hub stay, a restored room or a
     * Ship room publishes no entry state after them.
     */
    | 'noEntrySnapshot'
    /** The plan's evaluation did not reach the entered room. */
    | 'unreached';
}

/** One run-state value a room's next entry save and the plan disagree on. */
export interface RunImportRoomDifference extends RunImportMismatch {
  readonly area: RunImportArea;
  /** The area, and for a trait whether it is `traits.missing`, `traits.extra`, `traits.rarity` or `traits.level`. */
  readonly family: string;
}

/**
 * Where the plan ends: the decision no answer could settle, by its finding
 * code, or (`entryMismatch`) the room whose next entry save the plan's state
 * differs from, after which the run's state is unknown.
 */
export interface RunImportStop {
  readonly area: RunImportArea;
  readonly code: string;
  readonly address?: SemanticAddress;
  readonly record?: RunImportRecordLocation;
  /** An `entryMismatch` stop's difference families, as its room's acceptance names them. */
  readonly families?: readonly string[];
}
