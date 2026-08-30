import type { OccurrenceAddress } from '../authored-project/addresses';
import type { ProjectEvaluationAssembly } from '../simulation/evaluation-products';

/** The only execution artifact currently supported by the app compiler. */
export const EXECUTION_PLAN_FORMAT = 'run-planner-execution' as const;
export const EXECUTION_PROTOCOL_VERSION = 2 as const;
export const EXECUTION_CATALOG_VERSION = '0.51.0-biome-i-encounter-profiles' as const;

export type ExecutionRunStateCount =
  | { readonly kind: 'exact'; readonly count: number }
  | { readonly kind: 'range'; readonly min: number; readonly max: number };

export interface ExecutionRunStateDiagnostic {
  readonly owner: string;
  readonly checkpoint: 'roomEntered' | 'beforeRoomExit';
  readonly counters: {
    readonly biomeDepthCache: number;
    readonly biomeEncounterDepth: number;
    readonly routeEncounterDepth: number;
    readonly roomHistoryOrdinal: number;
  };
  readonly bags: readonly {
    readonly storeKey: string;
    readonly remaining: ExecutionRunStateCount;
  }[];
}

export interface ExecutionReward {
  readonly rewardType: string;
  readonly producerLifecycleKey: string;
  readonly resolvedStoreKey?: string;
  readonly source?: string;
  readonly spurnedSource?: string;
}

export interface ExecutionRoomContents {
  readonly incomingReward?: ExecutionReward;
  readonly encounterPhases: readonly {
    readonly slotKey: string;
    readonly encounterKey: string;
    readonly kind: string;
  }[];
  readonly requiredObjects: readonly string[];
}

export interface ExecutionTraceStep {
  readonly id: string;
  readonly kind: 'roomEntered' | 'beforeRoomExit';
  readonly checkpoint: 'roomEntered' | 'beforeRoomExit';
  readonly owner: string;
  /** Gate B entered rooms always carry both required checkpoint snapshots. */
  readonly runState: ExecutionRunStateDiagnostic;
}

export interface ExecutionOutgoingTarget {
  readonly exitKey: string;
  readonly index: number;
  readonly type: string;
  readonly room: {
    readonly id: string;
    readonly biomeKey: string;
    readonly gameName: string;
  };
  readonly picked: boolean;
}

export type ExecutionOutgoing =
  | {
      readonly owner: string;
      readonly kind: 'batch';
      readonly targets: readonly ExecutionOutgoingTarget[];
      /** The compiled outgoing batch always has exactly one selected target. */
      readonly selectedExitKey: string;
      /** The reward store resolved for this completed door batch, when observed. */
      readonly resolvedSharedRewardStoreKey?: string;
    }
  | {
      readonly owner: string;
      readonly kind: 'fixed';
      readonly target: {
        readonly id: string;
        readonly biomeKey: string;
        readonly gameName: string;
      };
    }
  | { readonly owner: string; readonly kind: 'terminal' };

export interface ExecutionRoom {
  readonly id: string;
  readonly owner: string;
  readonly biomeKey: string;
  readonly gameName: string;
  readonly kind: string;
  readonly entered: boolean;
  readonly contents: ExecutionRoomContents;
  readonly trace: readonly ExecutionTraceStep[];
  readonly outgoing: ExecutionOutgoing;
}

export interface ExecutionPlan {
  readonly format: typeof EXECUTION_PLAN_FORMAT;
  readonly protocolVersion: typeof EXECUTION_PROTOCOL_VERSION;
  readonly catalogVersion: string;
  readonly projectId: string;
  readonly planFingerprint: string;
  readonly routeKey: 'Underworld';
  readonly extent: {
    readonly kind: 'configuredPrefix';
    readonly biomeKeys: readonly ['F'] | readonly ['F', 'G'];
    readonly terminalBiomeKey: 'F' | 'G';
  };
  readonly rooms: readonly ExecutionRoom[];
}

export interface ExecutionCompilerInput {
  readonly assembly: ProjectEvaluationAssembly;
}

export interface ExecutionCompilerError extends Error {
  readonly code:
    | 'notEligible'
    | 'unsupportedRoute'
    | 'unsupportedExtent'
    | 'openingMissing'
    | 'openingRewardMissing'
    | 'openingBatchMissing'
    | 'openingSelectionMissing'
    | 'runStateMissing';
}

/** Kept as a type-only witness for compiler consumers that need the source. */
export type ExecutionOccurrenceOwner = OccurrenceAddress;
