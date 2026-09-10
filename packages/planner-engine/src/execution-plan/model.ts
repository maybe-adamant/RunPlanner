import type { ProjectEvaluationAssembly } from '../simulation/evaluation-products';
import type { ResourceExecutionPolicy, ResourcePointDisposition } from '../simulation/resources';
import type { TraitElement } from '../catalog-schema';
import type {
  PendingKeepsakeEffects,
  RoomExitConformanceFactKind,
} from '../simulation/rewards/run-state-conformance';

/** The single room-session execution artifact supported by the app compiler. */
export const EXECUTION_PLAN_FORMAT = 'run-planner-execution' as const;
export const EXECUTION_PROTOCOL_VERSION = 35 as const;
export const EXECUTION_CATALOG_VERSION = '0.55.0-anvil-of-fates' as const;
export type ExecutionBiomeKey = 'F' | 'G' | 'H' | 'I' | 'N' | 'O' | 'P' | 'Q';

export type ExecutionRunStateCount =
  | { readonly kind: 'exact'; readonly count: number }
  | { readonly kind: 'range'; readonly min: number; readonly max: number };

export type ExecutionTraitSlot = 'Melee' | 'Secondary' | 'Ranged' | 'Rush' | 'Mana' | 'Spell';
export type ExecutionTraitOptionKey = 'option1' | 'option2' | 'option3';
export type ExecutionWellGenerationKey =
  'initial:healing' | 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill';
export type ExecutionHermesShrineGenerationKey =
  'initial:first' | 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill';
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
/** Closed lifecycle windows copied from the engine's Room Action authority. */
export type ExecutionLifecycleWindow =
  | { readonly kind: 'standard'; readonly phase: 'beforeCombat' | 'afterCombat' }
  | { readonly kind: 'bossDefeated'; readonly phaseKey: string }
  | { readonly kind: 'encounterEnd'; readonly phaseKey: string }
  | { readonly kind: 'shipPreCombat'; readonly wheelKey: string }
  | { readonly kind: 'shipPostCombat'; readonly wheelKey: string }
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
    readonly elements: Readonly<Record<TraitElement, number>>;
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
  readonly retainedEffects: {
    readonly echoShopDuplicateStatus: 'pending' | 'consumed' | null;
    readonly keepsakes: PendingKeepsakeEffects;
    readonly steadyGrowth: readonly {
      readonly traitKey: string;
      readonly progress: number;
      readonly interval: number;
    }[];
    readonly hermesShrineDeliveries: readonly {
      readonly sourceKey: string;
      readonly sourceOccurrenceId: string;
      readonly generationKey: string;
      readonly rewardType: string;
      readonly remainingUses: number;
      readonly rushed: boolean;
      readonly dueOccurrenceId?: string;
      readonly dueSequence?: number;
    }[];
    readonly stygianWell: {
      readonly sparkUses: number;
      readonly yarnUses: number;
      readonly hymnUses: number;
      readonly discountUses: readonly number[];
      readonly emptySlotUses: readonly number[];
      readonly extendedUses: number;
    };
  };
}

export type ExecutionRoomExitConformanceFactKind = RoomExitConformanceFactKind;

export interface ExecutionRoomExitConformance {
  /**
   * Each kind selects the corresponding expected value from the occurrence's
   * beforeRoomExit Run State frame. Values are not duplicated on the wire.
   */
  readonly facts: readonly { readonly kind: ExecutionRoomExitConformanceFactKind }[];
}

export interface ExecutionReward {
  readonly rewardType: string;
  readonly producerLifecycleKey: string;
  readonly resolvedStoreKey?: string;
  readonly source?: string;
  readonly spurnedSource?: string;
  readonly acquisitionEnabled?: boolean;
}

/** Exact layout inputs consumed by native Mourning Fields setup. */
export interface ExecutionFieldsLayout {
  readonly entryPair: {
    readonly startPointId: number;
    readonly endPointId: number;
  };
  readonly cagePoints: readonly {
    readonly slotKey: string;
    readonly pointId: number;
  }[];
  readonly optionalRewards: readonly {
    readonly slotKey: string;
    readonly pointId: number;
    readonly reward: ExecutionReward;
  }[];
  readonly nemesisPointId?: number;
}

/** Exact native result of the authored Anvil of Fates purchase. */
export interface ExecutionAnvilResult {
  readonly kind: 'anvilOfFates';
  readonly removedTraitKey: string | null;
  readonly addedTraitKeys: readonly [string, string];
}

/**
 * The planner's one source-independent Travel Deal replacement product.
 *
 * The replacement has different native coordinates for each carrier, so the
 * union preserves those coordinates instead of flattening them into a
 * source-specific pseudo-purchase.  `ExecutionTimelineTransaction.owner` is
 * the single refill-realization owner; `source` and `replacement` describe
 * only the native position/generation and expected replacement payload.
 */
export type ExecutionTravelDealRefill =
  | {
      readonly carrier: 'worldShop';
      readonly source: {
        readonly owner: string;
        readonly offerKey: string;
      };
      readonly replacement: {
        readonly slotIndex: number;
        readonly groupIndex: number;
        readonly optionKey: string;
        readonly reward: ExecutionReward;
      };
    }
  | {
      readonly carrier: 'stygianWell';
      readonly source: {
        readonly owner: string;
        readonly generationKey: Exclude<ExecutionWellGenerationKey, 'travelDealRefill'>;
      };
      readonly replacement: {
        readonly generationKey: 'travelDealRefill';
        readonly offerKey: string;
        readonly effect: ExecutionWellEffect;
        readonly twistResultKey?: string;
      };
    }
  | {
      readonly carrier: 'hermesShrine';
      readonly source: {
        readonly generationKey: Exclude<ExecutionHermesShrineGenerationKey, 'travelDealRefill'>;
        readonly slotIndex: 1 | 2 | 3;
      };
      readonly replacement: {
        readonly generationKey: 'travelDealRefill';
        readonly slotIndex: 1 | 2 | 3;
        readonly optionKey: string;
        readonly rewardType: string;
        readonly deliverySourceKey?: string;
        readonly purchase?: {
          readonly roomDelay: 2 | 3 | 4 | 5 | 6 | 7 | 8;
          readonly rushed: boolean;
        };
      };
    };

/** The one free pedestal item spawned by an Infernal Contract. */
export interface ExecutionInfernalContract {
  readonly sourceOwner: string;
  readonly rewardType: string;
}

/** The exact direct grants produced inside All Together's native acquisition. */
export interface ExecutionAllTogetherResult {
  readonly earth: string | null;
  readonly fire: string | null;
  readonly air: string | null;
  readonly water: string | null;
}

/** The exact native result of a selected Circe trait. */
export type ExecutionCirceResolution =
  | { readonly kind: 'activateArcana'; readonly arcanaKeys: readonly string[] }
  | { readonly kind: 'promoteArcana'; readonly arcanaKeys: readonly string[] }
  | { readonly kind: 'disableFear'; readonly vowKey: string };

/** Concave Stone's one native post-selection roll and optional residual row. */
export type ExecutionConcaveStoneResult =
  | { readonly kind: 'noProc' }
  | { readonly kind: 'proc'; readonly optionKey: ExecutionTraitOptionKey };

/** Frozen generated composition of the selected Spell's native talent tree. */
export interface ExecutionHexTree {
  readonly layoutKey: string;
  readonly rareTalentKeys: readonly string[];
  readonly epicTalentKeys: readonly string[];
  readonly godSent?: {
    readonly olympianTalentKey: string;
    readonly lineageTalentKey: string;
  };
}

/** Echo's exact native Boon Boon Boon menu beneath one selected outer row. */
export interface ExecutionEchoLastRunBoonOffer {
  readonly options: readonly {
    readonly giver: string;
    readonly key: string;
    readonly rarity: string;
    /** Exact native provider recorded by SelectEchoBoon, when declaration-owned. */
    readonly lootHistorySource?: string;
    readonly targetTraitKey?: string;
    readonly naturalSelectionTargets?: readonly string[];
    readonly allTogetherResult?: ExecutionAllTogetherResult;
  }[];
  readonly selected: ExecutionTraitOptionKey;
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
        /** Native row rarity before Calling Card/provider rarification. */
        readonly baseRarity?: string;
        readonly rarity?: string;
        readonly effectiveLevel?: number;
        /** Complete declaration-owned direct grant result for a selected All Together option. */
        readonly allTogetherResult?: ExecutionAllTogetherResult;
        /** Ordered successful increments produced inside Natural Selection's native distribution. */
        readonly naturalSelectionTargets?: readonly string[];
        /** Exact equipped target selected by this trait's native acquisition effect. */
        readonly targetTraitKey?: string;
        /** Frozen Concave Stone disposition owned by this selected source option. */
        readonly concaveStoneResult?: ExecutionConcaveStoneResult;
        /** Exact Arcana/Fear mutation selected by a Circe trait. */
        readonly circeResolution?: ExecutionCirceResolution;
        /** Exact Rank-I Hammer selected by Icarus's native Latest Model mutation. */
        readonly icarusHammerTarget?: string;
        /** Exact greatest-level target selected by Echo's native Pom effect. */
        readonly echoPomTarget?: string | null;
        /** Exact mixed-provider rows opened by Echo's native Boon replay. */
        readonly echoLastRunBoon?: ExecutionEchoLastRunBoonOffer;
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
      /** Present only for a selected ordinary SpellDrop offer. */
      readonly hexTree?: ExecutionHexTree;
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

/** Published acquisition roles are all intended materializations.
 *
 * Time Piece is intentionally absent: the planner consumes that acquisition
 * during simulation and publication omits it.  The aggregate of intended
 * acquisitions plus room-exit keepsake conformance proves the authored room
 * outcome without a second runtime adapter or exact source-identity claim.
 */
export type ExecutionAcquisitionDisposition = 'normal' | 'artificer';

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
  /**
   * The exact Sea Star result at this free, normal, duplicate-capable source.
   * A produced duplicate deliberately omits this field, preventing recursion.
   */
  readonly seaStarResult?: { readonly kind: 'proc' | 'noProc' };
  /**
   * Source-owned Artificer materialization proof used when its generated
   * child was consumed by Time Piece and therefore has no transaction of its
   * own.  This is intentionally only the native replacement identity and
   * reward steering payload; it is not a second acquisition node.
   */
  readonly replacement?: {
    readonly reward: ExecutionReward;
    readonly gameName: string;
  };
  readonly settlement?: { readonly site: string; readonly entry: string };
  readonly traitOffer?: ExecutionTraitOffer;
  readonly levelResolution?: ExecutionLevelResolution;
}

export type ExecutionExperimentalHammerEquipResult =
  { readonly kind: 'selected'; readonly traitKey: string } | { readonly kind: 'exhausted' };

export interface ExecutionTranscendentEmbryoEquipResult {
  readonly blessingKey: string;
  readonly blessingValues: Readonly<Record<string, number>>;
}

export interface ExecutionKeepsakeEquipResults {
  readonly jeweledPom?: {
    readonly traitKey: string;
    readonly rarity?: string;
  };
  readonly experimentalHammer?: ExecutionExperimentalHammerEquipResult;
  readonly transcendentEmbryo?: ExecutionTranscendentEmbryoEquipResult;
}

/** Closed wire product for Gift Gift Gift's immediate volatile replay. */
export type ExecutionVolatileKeepsakeEquipResults =
  | {
      readonly experimentalHammer: ExecutionExperimentalHammerEquipResult;
      readonly transcendentEmbryo?: never;
    }
  | {
      readonly experimentalHammer?: never;
      readonly transcendentEmbryo: ExecutionTranscendentEmbryoEquipResult;
    };

export interface ExecutionStartingKeepsake {
  readonly keepsakeKey: string;
  readonly equipResults?: ExecutionKeepsakeEquipResults;
}

/** Exact player-selected configuration checked before the first room session arms. */
export interface ExecutionStartingLoadout {
  readonly weaponKey: string;
  readonly aspectKey: string;
  readonly arcana: readonly {
    readonly key: string;
    readonly origin: 'manual' | 'automatic';
    readonly rarity: 'Common' | 'Rare' | 'Epic' | 'Heroic';
  }[];
  readonly fear: {
    readonly configuredRanks: Readonly<Record<string, number>>;
    readonly effectiveRanks: Readonly<Record<string, number>>;
  };
  /** Present only for Aspect of Selene's native linked-spell initialization. */
  readonly startingHex?: {
    readonly spellTraitKey: 'SpellMoonBeamTrait';
    readonly layoutKey: string;
    readonly rareTalentKeys: readonly string[];
    readonly epicTalentKeys: readonly string[];
    readonly godSent?: {
      readonly olympianTalentKey: string;
      readonly lineageTalentKey: string;
    };
  };
}

export interface ExecutionOverview {
  /** Persistent N Hub board, published on the selected occurrence that reaches the Hub. */
  readonly hub?: {
    readonly room: { readonly gameName: string };
    readonly slots: readonly {
      readonly slotKey: string;
      readonly physicalDoorId: number;
      readonly room: { readonly id: string; readonly biomeKey: string; readonly gameName: string };
      readonly reward: ExecutionReward;
    }[];
    readonly finalHandoff: {
      readonly id: string;
      readonly biomeKey: string;
      readonly gameName: string;
    };
  };
  /** Complete declared N side-door state for a visited main room. */
  readonly localSlots?: readonly {
    readonly slotKey: string;
    readonly physicalDoorId: number;
    readonly generation: 'generated' | 'notGenerated';
    readonly room?: { readonly id: string; readonly biomeKey: string; readonly gameName: string };
    readonly reward?: ExecutionReward;
  }[];
  readonly incomingReward?: ExecutionReward;
  /** Preserve the room's native required reward without treating it as a simulated acquisition. */
  readonly effectNeutralRequiredReward?: true;
  /** Native Encounter carriers intentionally omitted from simulated phases. */
  readonly unmodeledEncounterKeys?: readonly string[];
  readonly encounterPhases: readonly {
    readonly slotKey: string;
    readonly encounterKey: string;
    readonly kind: string;
    /** Native Fig Leaf decision for this exact eligible phase, when supported. */
    readonly figLeafSkip?: boolean;
  }[];
  /** Exact active ShipCombat wheel materialization for each encounter phase. */
  readonly rewardWheels?: readonly {
    readonly wheelKey: string;
    readonly phaseKey: string;
    /** Semantic owner of the encounter phase carrying this wheel. */
    readonly phaseOwner: string;
    readonly offerCount: number;
    readonly storeKey: string;
    readonly offers: readonly {
      readonly offerKey: string;
      readonly reward: ExecutionReward;
    }[];
    readonly pickedOfferKey: string;
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
    readonly infernalContract?: ExecutionInfernalContract;
  };
  /** Complete native SurfaceShop inventory and authored delivery dispositions. */
  readonly hermesShrine?: {
    readonly offers: readonly {
      readonly generationKey: Exclude<ExecutionHermesShrineGenerationKey, 'travelDealRefill'>;
      /** Native StoreData option identity. */
      readonly optionKey: string;
      readonly rewardType: string;
      /** One-based native SurfaceShop button/StoreOptions index. */
      readonly slotIndex: 1 | 2 | 3;
      /** Exact delivery entry key carried through native pending-item copies. */
      readonly deliverySourceKey?: string;
      readonly purchase?: {
        readonly roomDelay: 2 | 3 | 4 | 5 | 6 | 7 | 8;
        readonly rushed: boolean;
      };
    }[];
  };
  readonly stygianWell?: {
    readonly interacted: boolean;
    readonly offers?: readonly {
      readonly generationKey: 'initial:healing' | 'initial:secondLeft' | 'initial:secondRight';
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
  readonly keepsakeRack?: { readonly keepsakeKey?: string };
  readonly fountain?: { readonly aromaticPhialTarget?: string };
  /** Selected Fields entry/layout facts; cage identities stay on door targets. */
  readonly fields?: ExecutionFieldsLayout;
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

export type ExecutionResourcePolicy = ResourceExecutionPolicy;
export type ExecutionResourcePointDisposition = ResourcePointDisposition;

/** The closed G Anomaly capture-point product, including authored provenance. */
export interface ExecutionAnomalyReplacement {
  readonly replacedRoomGameName: string;
  readonly success: boolean;
}

export type ExecutionTimelineTransaction =
  | {
      /** The player's exact wheel choice; native selection remains authoritative. */
      readonly kind: 'chooseRewardWheel';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly wheelKey: string;
      readonly pickedOfferKey: string;
    }
  | {
      readonly kind: 'acquisition';
      readonly owner: string;
      readonly sourceOwner: string;
      readonly reward: ExecutionReward;
      readonly producerLifecycleKey: string;
      readonly roles: readonly ExecutionAcquisitionRole[];
      /** Exact source occurrence/generation identity, unique across same-host deliveries. */
      readonly hermesShrineSourceKey?: string;
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
              | {
                  readonly kind: 'freeItem';
                  /** Exact native consumable constrained when Nemesis creates the world pickup. */
                  readonly itemGameName: string;
                }
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
      readonly effect: 'steadyGrowth';
      readonly phaseKey: string;
      readonly source: string;
      readonly target: string;
      readonly rarity?: string;
      readonly window: ExecutionLifecycleWindow;
    }
  | {
      readonly kind: 'automatic';
      readonly owner: string;
      readonly effect: 'transcendentEmbryo';
      readonly phaseKey: string;
      readonly source: string;
      readonly target: string;
      readonly rarity: string;
      readonly blessingValues: Readonly<Record<string, number>>;
      readonly window: ExecutionLifecycleWindow;
    }
  | {
      readonly kind: 'automatic';
      readonly owner: string;
      readonly effect: 'judgment' | 'crystalFigurine';
      readonly phaseKey: string;
      readonly arcanaKeys: readonly string[];
      readonly rarity: string;
      readonly window: ExecutionLifecycleWindow;
    }
  | {
      /** The source-independent result of an accepted direct/item-effect use. */
      readonly kind: 'itemEffect';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly itemKey: string;
      readonly effect: ExecutionWellEffect;
      readonly extended: boolean;
    }
  | {
      /** A native transformation, such as Anvil or Stygian Well Twist. */
      readonly kind: 'transformation';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly transformation:
        | ExecutionAnvilResult
        | {
            readonly kind: 'stygianWellTwist';
            readonly sourceItemKey: string;
            readonly resultItemKey: string;
          };
    }
  | {
      /** The exact dynamic replacement created by Travel Deal. */
      readonly kind: 'travelDealRefill';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly refill: ExecutionTravelDealRefill;
    }
  | {
      readonly kind: 'keepsakeChange';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly keepsakeKey: string;
      readonly equipResults?: ExecutionKeepsakeEquipResults;
    }
  | {
      /** Gift Gift Gift's one-shot volatile replay at the succeeding biome start. */
      readonly kind: 'keepsakeReplay';
      readonly owner: string;
      readonly window: ExecutionLifecycleWindow;
      readonly keepsakeKey: string;
      readonly equipResults: ExecutionVolatileKeepsakeEquipResults;
    }
  | {
      readonly kind: 'fountainUse';
      readonly owner: string;
      readonly interactionKey: 'fountain';
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

export interface ExecutionTimeline {
  readonly transactions: readonly ExecutionTimelineTransaction[];
  readonly dependencies: readonly ExecutionTimelineDependency[];
  readonly obligations: readonly ExecutionTimelineObligation[];
}

export interface ExecutionDoorTarget {
  readonly exitKey: string;
  readonly index: number;
  readonly room: { readonly id: string; readonly biomeKey: string; readonly gameName: string };
  readonly reward?: ExecutionReward;
  /** Ordered cage rewards generated on this Fields target, including previews. */
  readonly cageRewards?: readonly ExecutionReward[];
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
  readonly biomeKey: ExecutionBiomeKey;
  readonly gameName: string;
  readonly kind: string;
  /** Selected canonical Postboss entry at which a fresh process may resynchronize. */
  readonly resumeBoundary?: 'postbossEntry';
  /** Published only for the G Anomaly occurrence; ordinary target replacement stays in Doors/topology. */
  readonly anomaly?: ExecutionAnomalyReplacement;
  readonly overview: ExecutionOverview;
  readonly timeline: ExecutionTimeline;
  readonly doors: ExecutionDoors;
  readonly roomExitConformance?: ExecutionRoomExitConformance;
  readonly diagnostics?: {
    readonly roomEntered?: ExecutionRunStateDiagnostic;
    readonly beforeRoomExit?: ExecutionRunStateDiagnostic;
  };
}

export type ExecutionRouteKey = 'Underworld' | 'Surface';

export type ExecutionConfiguredExtent =
  | {
      readonly kind: 'configuredPrefix';
      readonly biomeKeys: readonly ['F'];
      readonly terminalBiomeKey: 'F';
    }
  | {
      readonly kind: 'configuredPrefix';
      readonly biomeKeys: readonly ['F', 'G'];
      readonly terminalBiomeKey: 'G';
    }
  | {
      readonly kind: 'configuredPrefix';
      readonly biomeKeys: readonly ['F', 'G', 'H'];
      readonly terminalBiomeKey: 'H';
    }
  | {
      readonly kind: 'configuredPrefix';
      readonly biomeKeys: readonly ['F', 'G', 'H', 'I'];
      readonly terminalBiomeKey: 'I';
    }
  | {
      readonly kind: 'configuredPrefix';
      readonly biomeKeys: readonly ['N'];
      readonly terminalBiomeKey: 'N';
    }
  | {
      readonly kind: 'configuredPrefix';
      readonly biomeKeys: readonly ['N', 'O'];
      readonly terminalBiomeKey: 'O';
    }
  | {
      readonly kind: 'configuredPrefix';
      readonly biomeKeys: readonly ['N', 'O', 'P'];
      readonly terminalBiomeKey: 'P';
    }
  | {
      readonly kind: 'configuredPrefix';
      readonly biomeKeys: readonly ['N', 'O', 'P', 'Q'];
      readonly terminalBiomeKey: 'Q';
    };

export interface ExecutionPlan {
  readonly format: typeof EXECUTION_PLAN_FORMAT;
  readonly protocolVersion: typeof EXECUTION_PROTOCOL_VERSION;
  readonly catalogVersion: string;
  readonly projectId: string;
  readonly planFingerprint: string;
  readonly routeKey: ExecutionRouteKey;
  readonly startingLoadout: ExecutionStartingLoadout;
  readonly startingKeepsake: ExecutionStartingKeepsake;
  readonly extent: ExecutionConfiguredExtent;
  /** Complete occurrence records; selectedOccurrenceIds is the route cursor. */
  readonly selectedOccurrenceIds: readonly string[];
  /** Engine-owned physical resource-point policy for each selected occurrence. */
  readonly resources: ExecutionResourcePolicy;
  readonly occurrences: readonly ExecutionOccurrence[];
}

/** Explicit engine-owned product assembled only at publication time. */
export interface ExecutionSemanticProduct {
  readonly catalogVersion: string;
  readonly projectId: string;
  readonly routeKey: ExecutionRouteKey;
  readonly startingLoadout: ExecutionStartingLoadout;
  readonly startingKeepsake: ExecutionStartingKeepsake;
  readonly extent: ExecutionPlan['extent'];
  readonly selectedOccurrenceIds: readonly string[];
  readonly resources: ExecutionResourcePolicy;
  readonly occurrences: readonly ExecutionOccurrence[];
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
