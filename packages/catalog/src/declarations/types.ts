import type {
  AuthoredFieldDescriptor,
  CompletionDescriptor,
  EnteredRewardStoreHistoryPolicy,
  EncounterPhaseKind,
  EntryDescriptor,
  ExitCompatibilityPolicy,
  ExitTypeDeclaration,
  GeneratedBatchPolicy,
  HubSlotDescriptor,
  LocalChildDescriptor,
  LinearStartDescriptor,
  LinearProgressionPolicy,
  RequirementExpression,
  RewardStorePolicy,
  RoomForce,
  RoomCaps,
  RoomCounterEffects,
  RoomKind,
  RoomMode,
  RoomStructuralTag,
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
}

export interface RawEncounterProfileDeclaration {
  readonly key: string;
  readonly phases: readonly RawEncounterPhaseDeclaration[];
}

export interface RawCountedRewardBinding {
  readonly kind: 'countedChoice';
  readonly storeKeys: readonly string[];
  readonly eligibleRewardTypes: readonly string[];
  readonly ineligibleRewardTypes: readonly string[];
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
}

export type RawRewardProducerBinding =
  RawCountedRewardBinding | RawFixedRewardBinding | RawNoneRewardBinding | RawShopRewardBinding;

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
  readonly localChildren?: readonly LocalChildDescriptor[];
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
    readonly requiredVisits: number;
    readonly restoreRoomGameName: string;
    readonly rewardStorePolicy: RewardStorePolicy;
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
  readonly exitCompatibilityPolicies: readonly ExitCompatibilityPolicy[];
  readonly exitTypes: readonly ExitTypeDeclaration[];
  readonly rooms: readonly RawRoomDeclaration[];
  readonly biomeLayouts: readonly RawBiomeLayoutDeclaration[];
}
