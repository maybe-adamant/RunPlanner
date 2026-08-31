import type { OccurrenceAddress } from '../authored-project/addresses';
import type { ProjectEvaluationAssembly } from '../simulation/evaluation-products';

/** The only execution artifact currently supported by the app compiler. */
export const EXECUTION_PLAN_FORMAT = 'run-planner-execution' as const;
export const EXECUTION_PROTOCOL_VERSION = 5 as const;
export const EXECUTION_CATALOG_VERSION = '0.52.0-boss-preboss-variants' as const;

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
  /** Published Chaos state is diagnostic only; the runtime never advances its clocks. */
  readonly chaos: {
    readonly active: readonly {
      readonly curseKey: string;
      readonly blessingKey: string;
      readonly rarity: string;
      readonly clock: 'encounters' | 'locations' | 'godBoonScreens';
      readonly remaining: number;
    }[];
    readonly matured: readonly {
      readonly blessingKey: string;
      readonly rarity: string;
    }[];
  };
  /** Gate D's bounded observable keepsake facts; it is not a second keepsake model. */
  readonly keepsakes: {
    readonly currentKey: string;
    readonly usedKeys: readonly string[];
    readonly blockedKeys: readonly string[];
    readonly fatedStatus: 'Unknown' | 'Fated' | 'Unfated';
  };
  readonly rewardPriorities: readonly string[];
  readonly hexProgress: {
    readonly spellTraitKey?: string;
    readonly layoutKey?: string;
    /** Exact installed Rare/Epic nodes, observable from the slotted spell talent list. */
    readonly talentKeys: readonly string[];
    readonly closed: boolean;
    readonly bankedPathPoints: number;
    readonly investedPathPoints: number;
  };
  /** Null when Artificer is not active; no planner chronology is serialized. */
  readonly artificer: { readonly usedCount: number; readonly remainingCount: number } | null;
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
  /** World-Shop identity only. CanonicalShopOffer has no producer lifecycle. */
  readonly shop?: {
    readonly profileKey: string;
    readonly offers: readonly {
      readonly offerKey: string;
      readonly optionKey: string;
      readonly rewardType: string;
      readonly source?: string;
      readonly spurnedSource?: string;
    }[];
    /** The first paid World-Shop slot may be replaced by Travel Deal. */
    readonly travelDealRefill?: {
      readonly sourceOfferKey: string;
      readonly slotIndex: number;
      readonly optionKey: string;
      readonly reward: ExecutionReward;
    };
  };
  /** The complete entered Well inventory, including selected nested results. */
  readonly stygianWell?: {
    readonly offers: readonly {
      readonly generationKey:
        'initial:healing' | 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill';
      readonly offerKey: string;
      readonly twistResultKey?: string;
    }[];
  };
  readonly purgingPool?: {
    readonly traits: readonly {
      readonly slotKey: 'left' | 'middle' | 'right';
      readonly traitKey: string | null;
    }[];
  };
  readonly keepsakeRack?: { readonly keepsakeKey: string };
  readonly fountain?: { readonly aromaticPhialTarget?: string };
  /** Successful automatic resource collection settled at this room's exit. */
  readonly resources?: readonly {
    readonly acquisitionRole: string;
    readonly grantedTraitKey: string;
    readonly contributions: Readonly<Record<string, number>>;
  }[];
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
    }
  | {
      /** Three native pairs; only the selected pair's blessing and operands are modeled. */
      readonly kind: 'chaos';
      readonly giver: 'Chaos';
      readonly curseOptions: readonly {
        readonly curseKey: string;
        readonly requirementCount: number;
      }[];
      readonly selected: ExecutionTraitOptionKey;
      readonly selectedCurseValues: Readonly<Record<string, number>>;
      readonly blessingKey: string;
      readonly rarity: string;
      readonly blessingValues: Readonly<Record<string, number>>;
    };

export interface ExecutionLevelResolution {
  readonly offeredTargets: readonly string[];
  readonly selectedTarget: string | null;
  readonly levelCount: number;
}

/** Exact already-settled pickup conversion; runtime must not reassess it. */
export type ExecutionAcquisitionDisposition = 'normal' | 'timePiece' | 'artificer';

export interface ExecutionAcquisitionRole {
  readonly role: string;
  readonly disposition: ExecutionAcquisitionDisposition;
  /** Closed producer identity for a generated nested pickup. */
  readonly producer?: {
    readonly kind: 'seaStarDuplicate' | 'artificerReplacement' | 'echoLastReward';
    readonly sourceOwner: string;
    readonly sourceRole: string;
  };
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

export interface ExecutionKeepsakeEquipResults {
  readonly jeweledPom?: { readonly traitKey: string; readonly rarity?: string };
  readonly experimentalHammer?:
    { readonly kind: 'selected'; readonly traitKey: string } | { readonly kind: 'exhausted' };
  readonly transcendentEmbryo?: { readonly blessingKey: string };
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
    }
  | {
      readonly id: string;
      readonly kind: 'purgingPoolSale';
      readonly owner: string;
      readonly slotKey: 'left' | 'middle' | 'right';
      readonly traitKey: string;
    }
  | {
      readonly id: string;
      readonly kind: 'stygianWellPurchase';
      readonly owner: string;
      readonly generationKey:
        'initial:healing' | 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill';
      readonly offerKey: string;
      readonly twistResultKey?: string;
    }
  | {
      readonly id: string;
      readonly kind: 'worldShopPurchase';
      readonly owner: string;
      readonly offerKey: string;
      readonly rewardType: string;
    }
  | {
      readonly id: string;
      readonly kind: 'keepsakeRackChange';
      readonly owner: string;
      readonly keepsakeKey: string;
      readonly equipResults?: ExecutionKeepsakeEquipResults;
    }
  | {
      readonly id: string;
      readonly kind: 'fountainUse';
      readonly owner: string;
      readonly aromaticPhialTarget?: string;
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

export interface ExecutionAdditionalExit {
  readonly kind: 'chaos' | 'zagreusContract';
  readonly key: 'chaos' | 'zagreusContract';
  /** Stable additional-exit address; it is not a normal physical target. */
  readonly owner: string;
  readonly room: { readonly id: string; readonly biomeKey: string; readonly gameName: string };
  readonly picked: boolean;
  /** Present only for topology generated by an Ixion purchase. */
  readonly ixionOrigin?: {
    readonly sourceBiomeKey: string;
    readonly sourceOccurrenceId: string;
    readonly generationKey: string;
  };
}

export type ExecutionOutgoing =
  | {
      readonly owner: string;
      readonly kind: 'batch';
      readonly targets: readonly ExecutionOutgoingTarget[];
      /** Entry-time sibling continuations, kept distinct from physical doors. */
      readonly additional: readonly ExecutionAdditionalExit[];
      /** Exactly one continuation is selected: this physical exit or `selectedAdditionalKey`. */
      readonly selectedExitKey?: string;
      /** Additional exits remain distinct from physical door targets. */
      readonly selectedAdditionalKey?: 'chaos' | 'zagreusContract';
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
