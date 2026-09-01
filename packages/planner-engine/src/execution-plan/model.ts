import type { ProjectEvaluationAssembly } from '../simulation/evaluation-products';

/** The single room-session execution artifact supported by the app compiler. */
export const EXECUTION_PLAN_FORMAT = 'run-planner-execution' as const;
export const EXECUTION_PROTOCOL_VERSION = 10 as const;
export const EXECUTION_CATALOG_VERSION = '0.53.0-chaos-return-batches' as const;

export type ExecutionRunStateCount =
  | { readonly kind: 'exact'; readonly count: number }
  | { readonly kind: 'range'; readonly min: number; readonly max: number };

export type ExecutionTraitSlot = 'Melee' | 'Secondary' | 'Ranged' | 'Rush' | 'Mana' | 'Spell';
export type ExecutionTraitOptionKey = 'option1' | 'option2' | 'option3';
export type ExecutionWellGenerationKey =
  'initial:healing' | 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill';
/** Closed normalized effects that can be resolved from one Well offer. */
export type ExecutionWellEffect =
  | 'neutral'
  | 'spark'
  | 'yarn'
  | 'hymn'
  | 'discount'
  | 'emptySlot'
  | 'extended'
  | 'twist'
  | 'lastStand';
/** Retained Well effects that must identify their exact later consumer. */
export type ExecutionWellRetainedEffect = 'extended' | 'yarn' | 'hymn';
/** Closed lifecycle windows copied from the engine's Room Action authority. */
export type ExecutionLifecycleWindow =
  | { readonly kind: 'standard'; readonly phase: 'beforeCombat' | 'afterCombat' }
  | { readonly kind: 'encounterEnd'; readonly phaseKey: string }
  | { readonly kind: 'postOutgoing' };

/** Diagnostic evidence only. It is never a lifecycle or transaction cursor. */
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
    readonly slots: readonly { readonly slot: ExecutionTraitSlot; readonly traitKey?: string }[];
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
  readonly chaos: {
    readonly active: readonly {
      readonly curseKey: string;
      readonly blessingKey: string;
      readonly rarity: string;
      readonly clock: 'encounters' | 'locations' | 'godBoonScreens';
      readonly remaining: number;
    }[];
    readonly matured: readonly { readonly blessingKey: string; readonly rarity: string }[];
  };
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
    readonly talentKeys: readonly string[];
    readonly closed: boolean;
    readonly bankedPathPoints: number;
    readonly investedPathPoints: number;
  };
  readonly artificer: { readonly usedCount: number; readonly remainingCount: number } | null;
}

export interface ExecutionReward {
  readonly rewardType: string;
  readonly producerLifecycleKey: string;
  readonly resolvedStoreKey?: string;
  readonly source?: string;
  readonly spurnedSource?: string;
  readonly acquisitionEnabled?: boolean;
}

export type ExecutionTraitOffer =
  | {
      readonly kind: 'fallbackGold';
      readonly giver: string;
    }
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

export type ExecutionAcquisitionDisposition = 'normal' | 'timePiece' | 'artificer';

export interface ExecutionAcquisitionRole {
  readonly role: string;
  readonly disposition: ExecutionAcquisitionDisposition;
  readonly producer?: {
    readonly kind: 'seaStarDuplicate' | 'artificerReplacement' | 'echoLastReward';
    readonly sourceOwner: string;
    readonly sourceRole: string;
  };
  readonly lifecyclePoint: string;
  readonly kind: string;
  readonly gameName: string;
  readonly settlement?: { readonly site: string; readonly entry: string };
  readonly traitOffer?: ExecutionTraitOffer;
  readonly levelResolution?: ExecutionLevelResolution;
}

export interface ExecutionKeepsakeEquipResults {
  readonly jeweledPom?: { readonly traitKey: string; readonly rarity?: string };
  readonly experimentalHammer?:
    { readonly kind: 'selected'; readonly traitKey: string } | { readonly kind: 'exhausted' };
  readonly transcendentEmbryo?: { readonly blessingKey: string };
}

export interface ExecutionStartingKeepsake {
  readonly keepsakeKey: string;
  readonly equipResults?: ExecutionKeepsakeEquipResults;
}

export interface ExecutionOverview {
  readonly incomingReward?: ExecutionReward;
  readonly encounterPhases: readonly {
    readonly slotKey: string;
    readonly encounterKey: string;
    readonly kind: string;
  }[];
  readonly requiredObjects: readonly string[];
  readonly shop?: {
    readonly profileKey: string;
    readonly offers: readonly {
      readonly offerKey: string;
      readonly optionKey: string;
      readonly rewardType: string;
      readonly source?: string;
      readonly spurnedSource?: string;
    }[];
    readonly travelDealRefill?: {
      readonly sourceOfferKey: string;
      readonly slotIndex: number;
      readonly optionKey: string;
      readonly reward: ExecutionReward;
    };
  };
  readonly stygianWell?: {
    readonly interacted: boolean;
    readonly offers?: readonly {
      readonly generationKey:
        'initial:healing' | 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill';
      readonly offerKey: string;
      readonly twistResultKey?: string;
    }[];
  };
  readonly purgingPool?: {
    readonly interacted: boolean;
    readonly traits?: readonly {
      readonly slotKey: 'left' | 'middle' | 'right';
      readonly traitKey: string | null;
    }[];
  };
  readonly keepsakeRack?: { readonly keepsakeKey: string };
  readonly fountain?: { readonly aromaticPhialTarget?: string };
  readonly resources?: readonly {
    readonly acquisitionRole: string;
    readonly grantedTraitKey: string;
    readonly contributions: Readonly<Record<string, number>>;
  }[];
  /** Chaos gates and Zagreus Contract exits are room features, not normal doors. */
  readonly additional?: readonly {
    readonly kind: 'chaos' | 'zagreusContract';
    readonly owner: string;
    readonly room: { readonly id: string; readonly biomeKey: string; readonly gameName: string };
    readonly ixionOrigin?: {
      readonly sourceBiomeKey: string;
      readonly sourceOccurrenceId: string;
      readonly generationKey: string;
    };
  }[];
}

/** The closed G Anomaly capture-point product, including authored provenance. */
export interface ExecutionAnomalyReplacement {
  readonly replacedRoomGameName: string;
  readonly success: boolean;
}

export type ExecutionTimelineTransaction =
  | {
      readonly kind: 'acquisition';
      readonly owner: string;
      readonly sourceOwner: string;
      readonly reward: ExecutionReward;
      readonly producerLifecycleKey: string;
      readonly roles: readonly ExecutionAcquisitionRole[];
      readonly window: ExecutionLifecycleWindow;
    }
  | {
      readonly kind: 'encounterInteraction';
      readonly owner: string;
      readonly phaseKey: string;
      readonly resolution?:
        | { readonly kind: 'traitOffer'; readonly offer: ExecutionTraitOffer }
        | {
            readonly kind: 'nemesisRandomEvent';
            readonly outcome:
              | { readonly kind: 'freeItem' }
              | {
                  readonly kind: 'goldTrade' | 'damageTrade';
                  readonly response: 'accept' | 'decline';
                }
              | {
                  readonly kind: 'traitTrade';
                  readonly traitKey: string;
                  readonly response: 'accept' | 'decline';
                }
              | { readonly kind: 'damageContest'; readonly result: 'success' | 'failure' };
          };
      readonly window: ExecutionLifecycleWindow;
    }
  | {
      readonly kind: 'automatic';
      readonly owner: string;
      readonly effect: 'steadyGrowth' | 'transcendentEmbryo';
      readonly phaseKey: string;
      readonly source: string;
      readonly target: string;
      readonly rarity?: string;
      readonly window: ExecutionLifecycleWindow;
    }
  | {
      readonly kind: 'shopPurchase';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly offerKey: string;
      readonly rewardType: string;
      readonly sourceOwner: string;
      readonly reward: ExecutionReward;
      readonly producerLifecycleKey: string;
      readonly roles: readonly ExecutionAcquisitionRole[];
    }
  | {
      readonly kind: 'wellPurchase';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly offerKey: string;
      readonly generationKey: ExecutionWellGenerationKey;
      readonly effect: ExecutionWellEffect;
      readonly extendedDirectPurchase: boolean;
      readonly twistResultKey?: string;
    }
  | {
      readonly kind: 'poolSale';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly slotKey: string;
      readonly traitKey: string;
    }
  | {
      readonly kind: 'keepsakeChange';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly keepsakeKey: string;
      readonly equipResults?: ExecutionKeepsakeEquipResults;
    }
  | {
      readonly kind: 'fountainUse';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly aromaticPhialTarget?: string;
    };

export interface ExecutionTimelineDependency {
  readonly owner: string;
  readonly afterOwner: string;
}

export interface ExecutionTimelineObligation {
  readonly owner: string;
  readonly checkpoint: 'roomEntered' | 'outgoingGeneration' | 'exitUsable' | 'roomExit';
}

export interface ExecutionTimelineStream {
  readonly key: string;
  readonly owners: readonly string[];
}

export interface ExecutionWellRetainedEffectCorrelation {
  readonly producerOwner: string;
  readonly effect: ExecutionWellRetainedEffect;
  readonly consumerOwner: string;
}

export interface ExecutionTimeline {
  readonly transactions: readonly ExecutionTimelineTransaction[];
  readonly dependencies: readonly ExecutionTimelineDependency[];
  readonly obligations: readonly ExecutionTimelineObligation[];
  readonly streams: readonly ExecutionTimelineStream[];
}

export interface ExecutionDoorTarget {
  readonly exitKey: string;
  readonly index: number;
  readonly room: { readonly id: string; readonly biomeKey: string; readonly gameName: string };
  readonly reward?: ExecutionReward;
}

export type ExecutionDoors =
  | {
      readonly kind: 'batch';
      readonly owner: string;
      readonly targets: readonly ExecutionDoorTarget[];
      readonly resolvedSharedRewardStoreKey?: string;
    }
  | {
      readonly kind: 'fixed';
      readonly owner: string;
      readonly target: {
        readonly id: string;
        readonly biomeKey: string;
        readonly gameName: string;
      };
    }
  | { readonly kind: 'terminal'; readonly owner: string };

export interface ExecutionOccurrence {
  readonly id: string;
  readonly owner: string;
  readonly biomeKey: string;
  readonly gameName: string;
  readonly kind: string;
  /** Published only for the G Anomaly occurrence; ordinary target replacement stays in Doors/topology. */
  readonly anomaly?: ExecutionAnomalyReplacement;
  readonly overview: ExecutionOverview;
  readonly timeline: ExecutionTimeline;
  readonly doors: ExecutionDoors;
  readonly diagnostics?: {
    readonly roomEntered?: ExecutionRunStateDiagnostic;
    readonly beforeRoomExit?: ExecutionRunStateDiagnostic;
  };
}

export interface ExecutionPlan {
  readonly format: typeof EXECUTION_PLAN_FORMAT;
  readonly protocolVersion: typeof EXECUTION_PROTOCOL_VERSION;
  readonly catalogVersion: string;
  readonly projectId: string;
  readonly planFingerprint: string;
  readonly routeKey: 'Underworld';
  readonly startingKeepsake: ExecutionStartingKeepsake;
  readonly extent: {
    readonly kind: 'configuredPrefix';
    readonly biomeKeys: readonly ['F'] | readonly ['F', 'G'];
    readonly terminalBiomeKey: 'F' | 'G';
  };
  /** Complete occurrence records; selectedOccurrenceIds is the route cursor. */
  readonly selectedOccurrenceIds: readonly string[];
  readonly occurrences: readonly ExecutionOccurrence[];
  readonly wellRetainedEffects: readonly ExecutionWellRetainedEffectCorrelation[];
}

/** Explicit engine-owned product assembled only at publication time. */
export interface ExecutionSemanticProduct {
  readonly catalogVersion: string;
  readonly projectId: string;
  readonly routeKey: 'Underworld';
  readonly startingKeepsake: ExecutionStartingKeepsake;
  readonly extent: ExecutionPlan['extent'];
  readonly selectedOccurrenceIds: readonly string[];
  readonly occurrences: readonly ExecutionOccurrence[];
  readonly wellRetainedEffects: readonly ExecutionWellRetainedEffectCorrelation[];
}

export interface ExecutionAssemblerInput {
  readonly assembly: ProjectEvaluationAssembly;
}

export interface ExecutionCompilerInput {
  readonly product: ExecutionSemanticProduct;
}

export interface ExecutionCompilerError extends Error {
  readonly code:
    | 'notEligible'
    | 'unsupportedRoute'
    | 'unsupportedExtent'
    | 'openingMissing'
    | 'openingSelectionMissing'
    | 'executionCoverageMissing';
}
