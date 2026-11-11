import type { SemanticAddress } from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';
import type {
  RoomActionWindow,
  RoomEventGraph,
} from '../../authored-project/room-actions/event-graph';
import type {
  RoomActionCheckpointContribution,
  RoomActionContribution,
  RoomActionDependency,
  RoomActionParticipation,
} from '../../authored-project/room-actions/domain';
import type {
  RoomActionOrderIssue,
  RoomActionPlacementBlocker,
} from '../../authored-project/room-actions/order-assessment';
import type { PlannerTimelineFacts } from '../timeline-facts';

export type {
  RoomActionCheckpointContribution,
  RoomActionContribution,
  RoomActionDependency,
  RoomActionParticipation,
} from '../../authored-project/room-actions/domain';
export type { RoomActionWindow } from '../../authored-project/room-actions/event-graph';

export type RoomActionRosterContribution =
  RoomActionContribution | RoomActionCheckpointContribution;

export type RoomActionRosterIssue = RoomActionOrderIssue;

/**
 * When a row's item may be used, named by the room's phases: before or after
 * the room's combat, after an encounter's end (and, when the next phase's wheel
 * waits on what it spawns, before that wheel's choice), during a Fields room,
 * after the doors open, or before, at the choice of, or after a wheel phase.
 */
export type RoomActionRowLabel =
  | { readonly kind: 'beforeCombat' | 'afterCombat' | 'fields' | 'afterDoorsOpen' }
  | {
      readonly kind: 'afterEncounterEnd';
      readonly phaseKey: string;
      /** The phase whose wheel's choice waits on this row. */
      readonly beforeWheelChoicePhaseKey?: string;
    }
  | {
      readonly kind: 'beforeWheelPhase' | 'beforeWheelChoice' | 'afterWheelPhase';
      readonly wheelKey: string;
      /** The phase the wheel belongs to; absent when the room no longer plays it. */
      readonly phaseKey?: string;
    };

export interface RoomActionRow {
  readonly reference: RoomActionReference;
  readonly key: string;
  readonly owner: SemanticAddress;
  readonly participation: RoomActionParticipation;
  /** Active mandatory work constrained to encounter progression or only room completion. */
  readonly requiredScope?: 'phase' | 'room';
  readonly window: RoomActionWindow;
  /**
   * The event-graph phase the row belongs to: a wheel phase's rows to it, an
   * encounter end's to that phase, or to the next one when its wheel waits on
   * them, rows before combat to the first phase and every other to the last.
   * Absent when the room plays no phase or no longer plays the one it names.
   */
  readonly phaseKey?: string;
  readonly label: RoomActionRowLabel;
  readonly dependencies: readonly RoomActionDependency[];
  readonly rank: number | null;
  readonly placementAssessment?: import('../../authored-project/generated-pickup-placement').GeneratedPickupPlacementAssessment;
  /**
   * What created an acquisition-entry pickup, active, stale or retained, when the
   * engine can name it; absent for every other action.
   */
  readonly sourceFamily?: import('../../authored-project/acquisition/entry-source-family').AcquisitionEntrySourceFamily;
  readonly stale: boolean;
  /**
   * A ranked row placed for an item whose content has since changed: never
   * executed, carrying a finding, its item unplaced until settlement removes it.
   */
  readonly itemReplaced?: true;
  /** For a row on a replaced item: the reference placing the item it holds now. */
  readonly itemReference?: RoomActionReference;
  readonly executable: boolean;
}

export interface RoomActionProposal {
  readonly kind: 'insert' | 'move' | 'remove' | 'unplace';
  readonly reference: RoomActionReference;
  readonly fromIndex?: number;
  readonly toIndex?: number;
  /**
   * For a move, where it lands in the current order: the index of the action it
   * lands in front of, or the order's length when it lands last.
   */
  readonly anchorIndex?: number;
  readonly order: readonly RoomActionReference[];
  readonly structurallyAuthorable: boolean;
  /**
   * The insertion a required action takes when no position is chosen: before the
   * first retained action with a later window, after its dependencies.
   */
  readonly canonical?: true;
  readonly blockers: readonly RoomActionPlacementBlocker[];
}

export interface RoomActionCheckpoint {
  readonly checkpointKey: string;
  readonly label: string;
  readonly window: RoomActionWindow;
  /** Number of authored rows that precede this derived checkpoint. */
  readonly afterRank: number;
}

export interface RoomActionRoster {
  readonly eventGraph: RoomEventGraph;
  readonly rows: readonly RoomActionRow[];
  readonly checkpoints: readonly RoomActionCheckpoint[];
  readonly issues: readonly RoomActionRosterIssue[];
  readonly proposals: readonly RoomActionProposal[];
  /** Structural planner facts; reward transitions add their exact relations. */
  readonly timelineFacts?: PlannerTimelineFacts;
  readonly valid: boolean;
}
