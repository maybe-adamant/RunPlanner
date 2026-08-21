import type { SemanticAddress } from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';
import type {
  RoomActionCheckpointContribution,
  RoomActionContribution,
  RoomActionDependency,
  RoomActionParticipation,
  RoomActionWindow,
  RoomLifecycleStructure,
} from '../../authored-project/room-action-domain';

export type {
  RoomActionCheckpointContribution,
  RoomActionContribution,
  RoomActionDependency,
  RoomActionParticipation,
  RoomActionWindow,
} from '../../authored-project/room-action-domain';

export type RoomActionRosterContribution =
  RoomActionContribution | RoomActionCheckpointContribution;

export type RoomActionRosterIssue =
  | { readonly kind: 'stale'; readonly reference: RoomActionReference }
  | { readonly kind: 'unrankedRequired'; readonly reference: RoomActionReference }
  | {
      readonly kind: 'dependency';
      readonly reference: RoomActionReference;
      readonly detail: string;
    }
  | { readonly kind: 'window'; readonly reference: RoomActionReference; readonly detail: string };

export interface RoomActionRow {
  readonly reference: RoomActionReference;
  readonly key: string;
  readonly owner: SemanticAddress;
  readonly participation: RoomActionParticipation;
  readonly window: RoomActionWindow;
  readonly dependencies: readonly RoomActionDependency[];
  readonly rank: number | null;
  readonly stale: boolean;
  readonly executable: boolean;
}

export interface RoomActionProposal {
  readonly kind: 'insert' | 'move' | 'remove';
  readonly reference: RoomActionReference;
  readonly fromIndex?: number;
  readonly toIndex?: number;
  readonly order: readonly RoomActionReference[];
  readonly structurallyAuthorable: boolean;
}

export interface RoomActionCheckpoint {
  readonly checkpointKey: string;
  readonly label: string;
  readonly window: RoomActionWindow;
  /** Number of authored rows that precede this derived checkpoint. */
  readonly afterRank: number;
}

export interface RoomActionRoster {
  readonly lifecycleStructure: RoomLifecycleStructure;
  readonly rows: readonly RoomActionRow[];
  readonly checkpoints: readonly RoomActionCheckpoint[];
  readonly issues: readonly RoomActionRosterIssue[];
  readonly proposals: readonly RoomActionProposal[];
  readonly valid: boolean;
}
