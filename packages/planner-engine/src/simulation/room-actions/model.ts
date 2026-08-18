import type { SemanticAddress } from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';

export type RoomActionParticipation = 'required' | 'optional';

export type RoomActionWindow =
  | { readonly kind: 'standard'; readonly phase: 'beforeCombat' | 'afterCombat' }
  | { readonly kind: 'postOutgoing' }
  | { readonly kind: 'fields'; readonly phaseKey?: string }
  | { readonly kind: 'shipPreCombat'; readonly wheelKey: string }
  | { readonly kind: 'shipPostCombat'; readonly wheelKey: string };

export type RoomActionDependency =
  | { readonly kind: 'afterAction'; readonly action: RoomActionReference }
  | { readonly kind: 'afterCheckpoint'; readonly checkpointKey: string }
  | { readonly kind: 'beforeCheckpoint'; readonly checkpointKey: string };

export interface RoomActionContribution {
  readonly kind: 'action';
  readonly reference: RoomActionReference;
  readonly owner: SemanticAddress;
  readonly participation: RoomActionParticipation;
  readonly window: RoomActionWindow;
  readonly dependencies: readonly RoomActionDependency[];
}

export interface RoomActionCheckpointContribution {
  readonly kind: 'checkpoint';
  readonly checkpointKey: string;
  readonly label: string;
  readonly window: RoomActionWindow;
}

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
  readonly rows: readonly RoomActionRow[];
  readonly checkpoints: readonly RoomActionCheckpoint[];
  readonly issues: readonly RoomActionRosterIssue[];
  readonly proposals: readonly RoomActionProposal[];
  readonly valid: boolean;
}
