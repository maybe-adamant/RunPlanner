import type { OccurrenceAddress } from '../authored-project/addresses';
import type { ProjectEvaluationAssembly } from '../simulation/evaluation-products';

/** The only execution artifact currently supported by the app compiler. */
export const EXECUTION_PLAN_FORMAT = 'run-planner-execution' as const;
export const EXECUTION_PROTOCOL_VERSION = 3 as const;
export const EXECUTION_CATALOG_VERSION = '0.51.0-biome-i-encounter-profiles' as const;

export type ExecutionRunStateCount =
  | { readonly kind: 'exact'; readonly count: number }
  | { readonly kind: 'range'; readonly min: number; readonly max: number };

export type ExecutionTraitSlot = 'Melee' | 'Secondary' | 'Ranged' | 'Rush' | 'Mana' | 'Spell';
export type ExecutionTraitOptionKey = 'option1' | 'option2' | 'option3';

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
  readonly godPool: {
    readonly acquiredSourceKeys: readonly string[];
    readonly effectiveSourceKeys: readonly string[];
    readonly capNarrowed: boolean;
  };
  readonly traits: {
    readonly equipped: readonly {
      readonly traitKey: string;
      readonly rarity?: string;
      readonly level?: number;
      readonly hammerRank?: 'RankI' | 'RankII';
    }[];
    readonly slots: readonly {
      readonly slot: ExecutionTraitSlot;
      readonly traitKey?: string;
    }[];
    readonly elements: Readonly<Record<string, number>>;
    readonly godRarityCounts: Readonly<Record<string, number>>;
    readonly upgradableCount: number;
    readonly bannedTraitKeys: readonly string[];
  };
  readonly arcana: {
    readonly active: readonly {
      readonly key: string;
      readonly origin: 'manual' | 'automatic' | 'temporary';
      readonly rarity: 'Common' | 'Rare' | 'Epic' | 'Heroic';
    }[];
  };
  readonly vows: {
    readonly configuredRanks: Readonly<Record<string, number>>;
    readonly effectiveRanks: Readonly<Record<string, number>>;
    readonly disabledKeys: readonly string[];
  };
  readonly forfeit: 'inactive' | 'available' | 'consumed';
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

export type ExecutionTraitOffer =
  | { readonly kind: 'fallbackGold'; readonly giver: string }
  | {
      readonly kind: 'traits';
      readonly giver: string;
      readonly options: readonly {
        readonly key: string;
        readonly rarity?: string;
        readonly effectiveLevel?: number;
        readonly replacement?: {
          readonly slot: string;
          readonly replacedTraitKey: string;
          readonly oldRarity: string;
          readonly newTraitKey: string;
          readonly requiredRarity: string;
          readonly levelBonus?: number;
        };
      }[];
      readonly selected: ExecutionTraitOptionKey;
      readonly rejected?: ExecutionTraitOptionKey;
      readonly runtimeFallback?: string;
    };

export interface ExecutionLevelResolution {
  readonly offeredTargets: readonly string[];
  readonly selectedTarget: string | null;
  readonly levelCount: number;
}

export interface ExecutionAcquisitionRole {
  readonly role: string;
  readonly lifecyclePoint: string;
  readonly kind: string;
  readonly gameName: string;
  readonly settlement?: {
    readonly site: string;
    readonly entry: string;
  };
  readonly traitOffer?: ExecutionTraitOffer;
  readonly levelResolution?: ExecutionLevelResolution;
}

export type ExecutionTraceStep =
  | {
      readonly id: string;
      readonly kind: 'roomEntered' | 'beforeRoomExit';
      readonly owner: string;
      readonly runState: ExecutionRunStateDiagnostic;
    }
  | {
      readonly id: string;
      readonly kind: 'cleanup';
      readonly owner: string;
    }
  | {
      readonly id: string;
      readonly kind: 'encounterStart';
      readonly owner: string;
      readonly phase: string;
      readonly encounter: string;
      readonly encounterKind: string;
    }
  | {
      readonly id: string;
      readonly kind: 'encounterEnd';
      readonly owner: string;
      readonly phase: string;
      readonly endEffectsExpected: boolean;
    }
  | {
      readonly id: string;
      readonly kind: 'acquireReward';
      readonly owner: string;
      readonly sourceOwner: string;
      readonly reward: ExecutionReward;
      readonly producerLifecycleKey: string;
      readonly roles: readonly ExecutionAcquisitionRole[];
    }
  | {
      readonly id: string;
      readonly kind: 'encounterInteraction';
      readonly owner: string;
      readonly phaseKey: string;
    }
  | {
      readonly id: string;
      readonly kind: 'steadyGrowth';
      readonly owner: string;
      readonly phase: string;
      readonly source: string;
      readonly target: string;
    }
  | {
      readonly id: string;
      readonly kind: 'transcendentEmbryo';
      readonly owner: string;
      readonly phase: string;
      readonly source: string;
      readonly target: string;
      readonly rarity: string;
    };

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
    | 'runStateMissing'
    | 'executionCoverageMissing';
}

/** Kept as a type-only witness for compiler consumers that need the source. */
export type ExecutionOccurrenceOwner = OccurrenceAddress;
