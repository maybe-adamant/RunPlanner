import type {
  CountedRewardBinding,
  EnteredRewardStoreHistoryPolicy,
  RewardProducerBinding,
} from '../reward-kernel/bindings';
import type { RewardKernelCatalog } from '../reward-kernel/model';
import type { CounterAxis, RequirementExpression } from '../requirements/model';
import type { ProducerLifecyclePointKey } from '../reward-kernel/model';

export interface CatalogCollection<T> {
  readonly values: readonly T[];
  readonly byKey: Readonly<Record<string, T>>;
}

export interface BiomeDeclaration {
  readonly key: string;
  readonly label: string;
}

export interface RouteDeclaration {
  readonly key: string;
  readonly label: string;
  readonly biomeKeys: readonly string[];
}

export type EncounterPhaseKind = 'boss' | 'combat' | 'miniboss' | 'nonCombat' | 'story';

export interface EncounterPhasePresence {
  readonly kind: 'authoredOptional';
  readonly decisionPoint: 'prepareRoom';
  readonly requirement: RequirementExpression;
  readonly defaultActive: boolean;
}

export interface RewardWheelOfferPoint {
  readonly kind: 'rewardWheel';
  readonly key: string;
  readonly reward: CountedRewardBinding;
  readonly defaultStoreKey: string;
  readonly offerKeys: readonly string[];
  readonly offerCount: {
    readonly min: number;
    readonly max: number;
    readonly defaultValue: number;
  };
  readonly picked: 'exactlyOne';
  readonly offerTiming: 'encounterStart';
  readonly acquisitionTiming: 'postCombat';
}

export interface EncounterPhase {
  readonly key: string;
  readonly kind: EncounterPhaseKind;
  readonly countsEncounterDepth: boolean;
  readonly baselineEncounterKey?: string;
  readonly presence?: EncounterPhasePresence;
  readonly offerPoint?: RewardWheelOfferPoint;
}

export interface EncounterProfile {
  readonly key: string;
  readonly phases: readonly EncounterPhase[];
}

export type RoomLifecycleEffectKind =
  | 'advanceEncounterDepth'
  | 'advanceRoomCounters'
  | 'recordAppearance'
  | 'recordCommit'
  | 'recordEncounterCompletion'
  | 'recordEncounterStart'
  | 'recordEnteredRewardStore'
  | 'recordExit'
  | 'recordOfferPoint'
  | 'recordPhaseOfferAcquisition'
  | 'recordPhaseOfferPoint'
  | 'recordOutgoingGeneration'
  | 'recordPreparation'
  | 'recordProducerPoint'
  | 'recordRequiredObjectCompletions'
  | 'recordRequiredObjectSpawns'
  | 'recordShopPurchases';

export interface OnlyEncounterPhaseSelector {
  readonly kind: 'only';
}

export type EncounterPhaseSelector = OnlyEncounterPhaseSelector;

interface RoomLifecycleOperationBase {
  readonly effects: readonly RoomLifecycleEffectKind[];
}

export type RoomLifecycleOperation =
  | (RoomLifecycleOperationBase & { readonly kind: 'prepareRoom' })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'materializeOfferPoint';
      readonly offerPoint: string;
    })
  | (RoomLifecycleOperationBase & { readonly kind: 'enterRoom' })
  | (RoomLifecycleOperationBase & { readonly kind: 'spawnRequiredObjects' })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'startEncounter';
      readonly encounter: EncounterPhaseSelector;
    })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'completeEncounter';
      readonly encounter: EncounterPhaseSelector;
    })
  | (RoomLifecycleOperationBase & { readonly kind: 'completeRequiredObjects' })
  | (RoomLifecycleOperationBase & { readonly kind: 'runEncounterSequence' })
  | (RoomLifecycleOperationBase & { readonly kind: 'runRewardEncounterSequence' })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'advanceProducer';
      readonly point: ProducerLifecyclePointKey;
    })
  | (RoomLifecycleOperationBase & { readonly kind: 'generateOutgoingBatch' })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'applyShopPurchases';
      readonly offerPoint: string;
    })
  | (RoomLifecycleOperationBase & { readonly kind: 'commitRoom' })
  | (RoomLifecycleOperationBase & { readonly kind: 'exitRoom' });

export type RoomLifecycleProducerPolicy =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'required';
      readonly lifecycleProfileKeys: readonly string[];
    };

export interface RoomLifecycleProfile {
  readonly key: string;
  readonly encounterProfileKeys: readonly string[];
  readonly producer: RoomLifecycleProducerPolicy;
  readonly operations: readonly RoomLifecycleOperation[];
}

export type RoomKind =
  | 'Boss'
  | 'Combat'
  | 'Devotion'
  | 'Hub'
  | 'Intro'
  | 'Miniboss'
  | 'Opening'
  | 'PreHub'
  | 'PostBoss'
  | 'Preboss'
  | 'Reprieve'
  | 'Shop'
  | 'Story';

export type RoomTemplateKey =
  | 'Devotion'
  | 'EphyraCombat'
  | 'EphyraSideRoom'
  | 'FixedIntro'
  | 'FixedOpening'
  | 'FixedPreHub'
  | 'FieldsCombat'
  | 'ClockworkCombat'
  | 'ForkedPreboss'
  | 'Fountain'
  | 'Miniboss'
  | 'RewardlessCombat'
  | 'Shop'
  | 'ShopPreboss'
  | 'ShipCombat'
  | 'StandardCombat'
  | 'Story';

export type DerivedRoomClassification = 'completion' | 'fixedEntry' | 'hub';

export type RoomMode =
  | { readonly kind: 'authored'; readonly templateKey: RoomTemplateKey }
  | { readonly kind: 'derived'; readonly classification: DerivedRoomClassification };

export type RoomStructuralTag = 'Indoor' | 'Outdoor';

export type ExitCompatibilityPolicy =
  | { readonly key: string; readonly kind: 'unconstrained' }
  | {
      readonly key: string;
      readonly kind: 'targetHasTag';
      readonly targetTag: RoomStructuralTag;
    }
  | {
      readonly key: string;
      readonly kind: 'sourceTagRequiresTargetTag';
      readonly sourceTag: RoomStructuralTag;
      readonly targetTag: RoomStructuralTag;
    };

export interface ExitTypeDeclaration {
  readonly key: string;
  readonly compatibilityPolicyKey: string;
}

export interface RoomExit {
  readonly index: number;
  readonly type: string;
  readonly compatibilityPolicyKey: string;
}

export interface RoomCounterEffects {
  readonly biomeDepthCache: number;
  readonly roomHistoryOrdinal: number;
}

export interface RoomCaps {
  readonly maxAppearancesThisBiome?: number;
  readonly maxCreationsThisRun?: number;
  readonly maxCreationsPerRoom?: number;
}

export interface RequiredRoomObjectDescriptor {
  readonly key: 'SoulPylon';
  readonly spawnTiming: 'roomEntry';
  readonly completionRequirement: 'destroyBeforeExit';
}

export type RoomForce =
  | {
      readonly kind: 'depthWindow';
      readonly axis: CounterAxis;
      readonly start: number;
      readonly deadline: number;
    }
  | { readonly kind: 'requirement'; readonly requirement: RequirementExpression }
  | { readonly kind: 'always' };

export interface ForkedPrebossEntryPolicy {
  readonly kind: 'shopThenFillRemainingExits';
  readonly freeReward: CountedRewardBinding;
  readonly maxFreeRewards: number;
}

export interface RoomDeclaration {
  readonly gameName: string;
  readonly label: string;
  readonly biomeKey: string;
  readonly kind: RoomKind;
  readonly mode: RoomMode;
  readonly structuralTags: readonly RoomStructuralTag[];
  readonly exits: readonly RoomExit[];
  readonly incomingReward: RewardProducerBinding;
  readonly entryOfferPolicy?: ForkedPrebossEntryPolicy;
  readonly forcedRewardStoreKey?: string;
  readonly individualRewardStoreKey?: string;
  readonly enteredRewardStoreHistory: EnteredRewardStoreHistoryPolicy;
  readonly encounterProfileKey: string;
  readonly counters: RoomCounterEffects;
  readonly caps: RoomCaps;
  readonly eligibility?: RequirementExpression;
  readonly force?: RoomForce;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly localChildren: readonly LocalChildDescriptor[];
}

export type AuthoredFieldInitialization<T> =
  { readonly kind: 'required' } | { readonly kind: 'defaulted'; readonly value: T };

export type AuthoredFieldDescriptor =
  | {
      readonly key: string;
      readonly kind: 'boolean';
      readonly initialization: AuthoredFieldInitialization<boolean>;
    }
  | {
      readonly key: string;
      readonly kind: 'boundedInteger';
      readonly min: number;
      readonly max: number;
      readonly initialization: AuthoredFieldInitialization<number>;
    }
  | {
      readonly key: string;
      readonly kind: 'enum';
      readonly values: readonly string[];
      readonly initialization: AuthoredFieldInitialization<string>;
    };

export type LocalChildDescriptor =
  | {
      readonly key: string;
      readonly kind: 'boundedRewardSlots';
      readonly slotKeys: readonly string[];
      readonly rawCapacity: number;
      readonly maxActiveSlots: number;
      readonly reward: CountedRewardBinding;
      readonly fields: readonly AuthoredFieldDescriptor[];
    }
  | {
      readonly key: string;
      readonly kind: 'fixedRoomSlots';
      readonly slots: readonly {
        readonly slotKey: string;
        readonly roomGameName: string;
        readonly physicalDoorId: number;
        readonly availabilityRank: number;
      }[];
      readonly rewardGeneration: 'jointUnordered';
      readonly fields: readonly AuthoredFieldDescriptor[];
    };

export type FixedEntryDescriptor = {
  readonly kind: 'fixedEntry';
  readonly role: string;
  readonly roomGameName: string;
};

export type FixedAuthoredSlotDescriptor = {
  readonly kind: 'fixedAuthoredSlot';
  readonly slotKey: string;
  readonly roomGameName: string;
};

export type EntryDescriptor = FixedEntryDescriptor | FixedAuthoredSlotDescriptor;

export type LinearStartDescriptor =
  | {
      readonly kind: 'authoredStart';
      readonly mode: 'fixed' | 'oneOf';
      readonly roomGameNames: readonly string[];
    }
  | FixedEntryDescriptor;

export type RewardStorePolicy =
  | {
      readonly kind: 'authoredBaseStore';
      readonly storeKeys: readonly string[];
      readonly targetMetaRewardsRatio: number;
      readonly targetMetaRewardsAdjustSpeed: number;
    }
  | {
      readonly kind: 'sourceOfferPoint';
      readonly selector: SourceOfferPointSelector;
    }
  | { readonly kind: 'none' };

export type SourceOfferPointSelector = 'lastActiveWheel';

export interface SourceRewardStorePolicyOverride {
  readonly sourceEncounterProfileKey: string;
  readonly policy: RewardStorePolicy;
}

export interface StagedCandidatePoolDescriptor {
  readonly key: string;
  readonly roomGameNames: readonly string[];
}

export type LinearProgressionPolicy =
  | { readonly kind: 'eligibilityDriven' }
  | { readonly kind: 'fixedCount'; readonly continuationCount: number }
  | {
      readonly kind: 'staged';
      readonly stages: readonly StagedCandidatePoolDescriptor[];
    };

export type GeneratedBatchPolicy =
  | {
      readonly kind: 'standard';
      readonly fields: readonly AuthoredFieldDescriptor[];
    }
  | {
      readonly kind: 'fields';
      readonly fields: readonly AuthoredFieldDescriptor[];
      readonly minDoorCageRewards: number;
      readonly maxDoorCageRewards: number;
      readonly maxDoorCageCeiling: number;
      readonly maxOutcomeSupport: {
        readonly optionalBiomeDepths: readonly number[];
        readonly requiredBiomeDepths: readonly number[];
      };
    }
  | {
      readonly kind: 'clockwork';
      readonly initialGoalCount: number;
      readonly fields: readonly AuthoredFieldDescriptor[];
    };

export type TerminalPolicy =
  | {
      readonly kind: 'forkedTransition';
      readonly roomGameName: string;
      readonly exitPolicy: { readonly kind: 'allExitsTerminal' };
    }
  | {
      readonly kind: 'directTransition';
      readonly roomGameName: string;
    }
  | {
      readonly kind: 'fixedAuthoredSlot';
      readonly slotKey: string;
      readonly roomGameName: string;
    }
  | {
      readonly kind: 'generatedTarget';
      readonly roomGameName: string;
      readonly closesBiomeWhenPicked: true;
    };

export interface CompletionRoomDescriptor {
  readonly role: 'boss' | 'postboss';
  readonly roomGameName: string;
}

export type BiomeTransitionCounterAxis = 'biomeDepthCache' | 'biomeEncounterDepth';

export interface BiomeTransitionCounterReset {
  readonly kind: 'resetCounter';
  readonly axis: BiomeTransitionCounterAxis;
}

export interface CompletionDescriptor {
  readonly rooms: readonly CompletionRoomDescriptor[];
  readonly transitionEffects: readonly BiomeTransitionCounterReset[];
}

export interface LinearBiomeLayout {
  readonly biomeKey: string;
  readonly kind: 'LinearBiome';
  readonly initialCounters: {
    readonly biomeDepthCache: number;
    readonly biomeEncounterDepth: number;
  };
  readonly start: LinearStartDescriptor;
  readonly entries: readonly EntryDescriptor[];
  readonly continuation: {
    readonly progressionPolicy: LinearProgressionPolicy;
    readonly batchPolicy: GeneratedBatchPolicy;
    readonly rewardStorePolicy: RewardStorePolicy;
    readonly rewardStoreOverrides: readonly SourceRewardStorePolicyOverride[];
  };
  readonly terminal: TerminalPolicy;
  readonly completion: CompletionDescriptor;
  readonly fields: readonly AuthoredFieldDescriptor[];
  readonly bounds: {
    readonly maxBatches: number;
    readonly maxTargets: number;
  };
}

export interface HubSlotDescriptor {
  readonly slotKey: string;
  readonly roomGameName: string;
  readonly physicalDoorId: number;
}

export interface HubOpenSlotConstraint {
  readonly kind: 'maxOpenFromSlots';
  readonly slotKeys: readonly string[];
  readonly max: number;
}

export interface HubRewardLookupDescriptor {
  readonly key: string;
  readonly source: 'allOpenTargetOffers';
}

export interface HubTargetCompletionDescriptor {
  readonly kind: 'requiredRoomObject';
  readonly objectKey: 'SoulPylon';
}

export interface HubSideRoomGenerationPolicy {
  readonly kind: 'visitPressure';
  readonly generatedCountKey: string;
  readonly minimumPerVisit: {
    readonly numerator: number;
    readonly denominator: number;
  };
  readonly remainingSlots: 'optional';
  readonly forcedOrder: 'availabilityRankPrefix';
}

export interface HubBiomeLayout {
  readonly biomeKey: string;
  readonly kind: 'HubBiome';
  readonly initialCounters: {
    readonly biomeDepthCache: number;
    readonly biomeEncounterDepth: number;
  };
  readonly entries: readonly EntryDescriptor[];
  readonly hub: {
    readonly roomGameName: string;
    readonly slots: readonly HubSlotDescriptor[];
    readonly openCount: { readonly min: number; readonly max: number };
    readonly openSlotConstraints: readonly HubOpenSlotConstraint[];
    readonly requiredVisits: number;
    readonly targetCompletion: HubTargetCompletionDescriptor;
    readonly restoreRoomGameName: string;
    readonly rewardStorePolicy: RewardStorePolicy;
    readonly rewardLookup: HubRewardLookupDescriptor;
    readonly sideRoomGeneration: HubSideRoomGenerationPolicy;
    readonly fields: readonly AuthoredFieldDescriptor[];
  };
  readonly terminal: TerminalPolicy;
  readonly completion: CompletionDescriptor;
  readonly fields: readonly AuthoredFieldDescriptor[];
}

export type BiomeLayout = HubBiomeLayout | LinearBiomeLayout;

export interface Catalog {
  readonly version: string;
  readonly biomes: CatalogCollection<BiomeDeclaration>;
  readonly routes: CatalogCollection<RouteDeclaration>;
  readonly rewards: RewardKernelCatalog;
  readonly encounterProfiles: CatalogCollection<EncounterProfile>;
  readonly roomLifecycleProfiles: CatalogCollection<RoomLifecycleProfile>;
  readonly exitCompatibilityPolicies: CatalogCollection<ExitCompatibilityPolicy>;
  readonly exitTypes: CatalogCollection<ExitTypeDeclaration>;
  readonly rooms: CatalogCollection<RoomDeclaration>;
  readonly biomeLayouts: CatalogCollection<BiomeLayout>;
}

export interface CatalogSummary {
  readonly version: string;
  readonly routeCount: number;
  readonly biomeCount: number;
  readonly rewardTypeCount: number;
  readonly roomCount: number;
}

export function summarizeCatalog(catalog: Catalog): CatalogSummary {
  return {
    version: catalog.version,
    routeCount: catalog.routes.values.length,
    biomeCount: catalog.biomes.values.length,
    rewardTypeCount: catalog.rewards.rewardTypes.values.length,
    roomCount: catalog.rooms.values.length,
  };
}
