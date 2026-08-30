import type { OccurrenceAddress } from '../authored-project/addresses';
import type { ProjectEvaluationAssembly } from '../simulation/evaluation-products';

/** The only execution artifact currently supported by the app compiler. */
export const EXECUTION_PLAN_FORMAT = 'run-planner-execution' as const;
export const EXECUTION_PROTOCOL_VERSION = 1 as const;
export const EXECUTION_CATALOG_VERSION = '0.51.0-biome-i-encounter-profiles' as const;

export interface ExecutionReward {
  readonly rewardType: string;
  readonly producerLifecycleKey: string;
  readonly resolvedStoreKey?: string;
  readonly source?: string;
}

export interface ExecutionRoomContents {
  readonly incomingReward: ExecutionReward;
}

export interface ExecutionTraceStep {
  readonly id: string;
  readonly kind: 'roomEntered';
  readonly checkpoint: 'roomEntered';
  readonly owner: string;
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

export interface ExecutionOutgoing {
  readonly owner: string;
  readonly targets: readonly ExecutionOutgoingTarget[];
  /** The compiled outgoing batch always has exactly one selected target. */
  readonly selectedExitKey: string;
}

export interface ExecutionRoom {
  readonly id: string;
  readonly owner: string;
  readonly biomeKey: string;
  readonly gameName: string;
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
    readonly biomeKeys: readonly ['F'];
    readonly terminalBiomeKey: 'F';
  };
  readonly rooms: readonly [ExecutionRoom];
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
    | 'openingSelectionMissing';
}

/** Kept as a type-only witness for compiler consumers that need the source. */
export type ExecutionOccurrenceOwner = OccurrenceAddress;
