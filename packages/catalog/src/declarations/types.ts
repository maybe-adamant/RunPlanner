import type {
  AuthoredFieldDescriptor,
  CompletionDescriptor,
  EnteredRewardStoreHistoryPolicy,
  EncounterPhaseKind,
  EntryDescriptor,
  ExitCompatibilityPolicy,
  ExitTypeDeclaration,
  GeneratedBatchPolicy,
  HubOpenSlotConstraint,
  HubRewardLookupDescriptor,
  HubSideRoomGenerationPolicy,
  HubSlotDescriptor,
  HubTargetCompletionDescriptor,
  LinearStartDescriptor,
  LinearProgressionPolicy,
  RequirementExpression,
  RewardStorePolicy,
  RoomForce,
  RoomCaps,
  RoomCounterEffects,
  RoomKind,
  RoomMode,
  RoomLifecycleOperation,
  RoomLifecycleProducerPolicy,
  RoomStructuralTag,
  RequiredRoomObjectDescriptor,
  SourceRewardStorePolicyOverride,
  TerminalPolicy,
  BiomeDeclaration,
  RouteDeclaration,
} from '@run-planner/core';
import type { RawRewardKernelInput } from '../rewardKernel/types';

export interface RawEncounterPhaseDeclaration {
  readonly key: string;
  readonly kind: EncounterPhaseKind;
  readonly countsEncounterDepth: boolean;
  readonly baselineEncounterKey?: string;
  readonly presence?: {
    readonly kind: 'authoredOptional';
    readonly decisionPoint: 'prepareRoom';
    readonly requirement: RequirementExpression;
    readonly defaultActive: boolean;
  };
  readonly offerPoint?: {
    readonly kind: 'rewardWheel';
    readonly key: string;
    readonly reward: RawCountedRewardBinding;
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
  };
}

export interface RawEncounterProfileDeclaration {
  readonly key: string;
  readonly phases: readonly RawEncounterPhaseDeclaration[];
}

export interface RawRoomLifecycleProfileDeclaration {
  readonly key: string;
  readonly encounterProfileKeys: readonly string[];
  readonly producer: RoomLifecycleProducerPolicy;
  readonly operations: readonly RoomLifecycleOperation[];
}

export interface RawCountedRewardBinding {
  readonly kind: 'countedChoice';
  readonly storeKeys: readonly string[];
  readonly eligibleRewardTypes: readonly string[];
  readonly ineligibleRewardTypes: readonly string[];
  readonly defaultRewardTypesByStore?: Readonly<Record<string, string>>;
  readonly producerLifecycleKey: string;
}

export interface RawFixedRewardBinding {
  readonly kind: 'fixed';
  readonly rewardType: string;
  readonly producerLifecycleKey: string;
}

export interface RawNoneRewardBinding {
  readonly kind: 'none';
}

export interface RawShopRewardBinding {
  readonly kind: 'shop';
  readonly rewardType: 'Shop';
  readonly shopProfileKey: string;
  readonly producerLifecycleKey: string;
  readonly additionalOptionRequirements?: Readonly<Record<string, RequirementExpression>>;
}

export type RawRewardProducerBinding =
  RawCountedRewardBinding | RawFixedRewardBinding | RawNoneRewardBinding | RawShopRewardBinding;

export type RawLocalChildDescriptor =
  | {
      readonly key: string;
      readonly kind: 'boundedRewardSlots';
      readonly slotKeys: readonly string[];
      readonly rawCapacity: number;
      readonly maxActiveSlots: number;
      readonly reward: RawCountedRewardBinding;
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

export interface RawRoomExitDeclaration {
  readonly index: number;
  readonly type: string;
}

export interface RawForkedPrebossEntryPolicy {
  readonly kind: 'shopThenFillRemainingExits';
  readonly freeReward: RawCountedRewardBinding;
  readonly maxFreeRewards: number;
}

export interface RawRoomDeclaration {
  readonly gameName: string;
  readonly label: string;
  readonly biomeKey: string;
  readonly kind: RoomKind;
  readonly mode: RoomMode;
  readonly structuralTags: readonly RoomStructuralTag[];
  readonly exits: readonly RawRoomExitDeclaration[];
  readonly incomingReward: RawRewardProducerBinding;
  readonly entryOfferPolicy?: RawForkedPrebossEntryPolicy;
  readonly forcedRewardStoreKey?: string;
  readonly individualRewardStoreKey?: string;
  readonly enteredRewardStoreHistory: EnteredRewardStoreHistoryPolicy;
  readonly encounterProfileKey: string;
  readonly counters: RoomCounterEffects;
  readonly caps: RoomCaps;
  readonly eligibility?: RequirementExpression;
  readonly force?: RoomForce;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly localChildren?: readonly RawLocalChildDescriptor[];
}

export interface RawLinearBiomeLayoutDeclaration {
  readonly biomeKey: string;
  readonly kind: 'LinearBiome';
  readonly start: LinearStartDescriptor;
  readonly entries?: readonly EntryDescriptor[];
  readonly continuation: {
    readonly progressionPolicy: LinearProgressionPolicy;
    readonly batchPolicy: GeneratedBatchPolicy;
    readonly rewardStorePolicy: RewardStorePolicy;
    readonly rewardStoreOverrides?: readonly SourceRewardStorePolicyOverride[];
  };
  readonly terminal: TerminalPolicy;
  readonly completion: CompletionDescriptor;
  readonly fields?: readonly AuthoredFieldDescriptor[];
  readonly bounds: {
    readonly maxBatches: number;
    readonly maxTargets: number;
  };
}

export interface RawHubBiomeLayoutDeclaration {
  readonly biomeKey: string;
  readonly kind: 'HubBiome';
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
    readonly fields?: readonly AuthoredFieldDescriptor[];
  };
  readonly terminal: TerminalPolicy;
  readonly completion: CompletionDescriptor;
  readonly fields?: readonly AuthoredFieldDescriptor[];
}

export type RawBiomeLayoutDeclaration =
  RawHubBiomeLayoutDeclaration | RawLinearBiomeLayoutDeclaration;

export interface RawCatalogInput {
  readonly version: string;
  readonly biomes: readonly BiomeDeclaration[];
  readonly routes: readonly RouteDeclaration[];
  readonly rewardKernel: RawRewardKernelInput;
  readonly encounterProfiles: readonly RawEncounterProfileDeclaration[];
  readonly roomLifecycleProfiles: readonly RawRoomLifecycleProfileDeclaration[];
  readonly exitCompatibilityPolicies: readonly ExitCompatibilityPolicy[];
  readonly exitTypes: readonly ExitTypeDeclaration[];
  readonly rooms: readonly RawRoomDeclaration[];
  readonly biomeLayouts: readonly RawBiomeLayoutDeclaration[];
}
