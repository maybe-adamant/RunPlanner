import type { SemanticAddress } from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';
import type {
  RoomActionBounds,
  RoomEventGraph,
} from '../../authored-project/room-actions/event-graph';
import type {
  RoomActionDependency,
  RoomActionParticipation,
} from '../../authored-project/room-actions/domain';
import type {
  RoomActionOrderIssue,
  RoomActionPlacementBlocker,
} from '../../authored-project/room-actions/order-assessment';
import type { PlannerTimelineFacts } from '../timeline-facts';

export type {
  RoomActionContribution,
  RoomActionDependency,
  RoomActionParticipation,
} from '../../authored-project/room-actions/domain';
export type {
  RoomActionBounds,
  RoomEventPoint,
} from '../../authored-project/room-actions/event-graph';

export type RoomActionRosterIssue = RoomActionOrderIssue;

/** A row's contact as the editor names it. */
export type RoomActionRowLabel =
  | { readonly kind: 'beforeCombat' | 'afterCombat' | 'fields' | 'afterDoorsOpen' }
  | {
      readonly kind: 'afterEncounterEnd';
      readonly phaseKey: string;
      /** The phase whose wheel's choice waits on this row. */
      readonly beforeWheelChoicePhaseKey?: string;
    }
  | WheelContact;

/**
 * At a Ship wheel phase's gate, from its wheel's roll (also a gate row whose
 * phase the room no longer plays), or after its fight.
 */
export interface WheelContact {
  readonly kind: 'beforeWheelPhase' | 'beforeWheelChoice' | 'afterWheelPhase';
  readonly wheelKey: string;
  readonly phaseKey?: string;
}

export function isWheelContact(contact: RoomActionContact): contact is WheelContact {
  return (
    contact.kind === 'beforeWheelPhase' ||
    contact.kind === 'beforeWheelChoice' ||
    contact.kind === 'afterWheelPhase'
  );
}

/**
 * Where a row's item meets the room's events, classified once from its bounds.
 * `phaseKey` is the phase the row belongs to: a wheel phase's rows to it, an
 * encounter end's to that phase or to the next one when its wheel waits on
 * them, rows before combat to their phase and every other to the last; absent
 * when the room plays no phase or no longer plays the one it names.
 */
export type RoomActionContact =
  /** Usable once the doors open or the exits are ready, or after the room's combat. */
  | { readonly kind: 'afterDoorsOpen' | 'afterCombat'; readonly phaseKey?: string }
  /** Before a phase's Combat, which its use starts. */
  | { readonly kind: 'beforeCombat'; readonly phaseKey?: string }
  | WheelContact
  /** Spawned by an encounter's end effects. */
  | {
      readonly kind: 'afterEncounterEnd';
      readonly endedPhaseKey: string;
      readonly phaseKey?: string;
    }
  /**
   * In a Fields room: spawned by a cage's end effects or a fight's end
   * (`endedPhaseKey`), or standing from the room's entry.
   */
  | { readonly kind: 'fields'; readonly endedPhaseKey?: string; readonly phaseKey?: string };

export interface RoomActionRow {
  readonly reference: RoomActionReference;
  readonly key: string;
  readonly owner: SemanticAddress;
  readonly participation: RoomActionParticipation;
  /** Active mandatory work constrained to encounter progression or only room completion. */
  readonly requiredScope?: 'phase' | 'room';
  /** Where the row may stand, in the room's graph events. */
  readonly bounds: RoomActionBounds;
  readonly contact: RoomActionContact;
  /** The contact as the editor names it; presentation only. */
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
   * first retained action that opens later, after its dependencies.
   */
  readonly canonical?: true;
  readonly blockers: readonly RoomActionPlacementBlocker[];
}

export interface RoomActionRoster {
  readonly eventGraph: RoomEventGraph;
  readonly rows: readonly RoomActionRow[];
  readonly issues: readonly RoomActionRosterIssue[];
  readonly proposals: readonly RoomActionProposal[];
  /** Structural planner facts; reward transitions add their exact relations. */
  readonly timelineFacts?: PlannerTimelineFacts;
  readonly valid: boolean;
}
