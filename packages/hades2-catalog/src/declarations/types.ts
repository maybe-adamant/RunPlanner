import type {
  AuthoredFieldDescriptor,
  CompletionDescriptor,
  CompletedHubExitDescriptor,
  EncounterPhaseKind,
  ExitCompatibilityPolicy,
  ExitTypeDeclaration,
  GeneratedProgressionPolicy,
  HubDecisionDescriptor,
  NormalDoorBatchPolicy,
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
  BiomeDeclaration,
  RouteDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { EnteredRewardStoreHistoryPolicy } from '@run-planner/engine/reward-kernel';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type { RawRewardKernelInput } from './rewards/types';

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

export type RawPrebossBatchPolicy =
  | {
      readonly kind: 'takeOverNormalDoors';
      readonly remainingOffers:
        | { readonly kind: 'none' }
        | { readonly kind: 'counted'; readonly reward: RawCountedRewardBinding };
    }
  | { readonly kind: 'retainNormalPeers' };

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

export interface RawRoomDeclaration {
  readonly gameName: string;
  readonly label: string;
  readonly biomeKey: string;
  readonly kind: RoomKind;
  readonly mode: RoomMode;
  readonly structuralTags: readonly RoomStructuralTag[];
  readonly exits: readonly RawRoomExitDeclaration[];
  readonly incomingReward: RawRewardProducerBinding;
  readonly prebossBatchPolicy?: RawPrebossBatchPolicy;
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

export interface RawGeneratedProgressionDeclaration {
  readonly kind: 'generated';
  readonly progressionPolicy: GeneratedProgressionPolicy;
  readonly batchPolicy: NormalDoorBatchPolicy;
  readonly rewardStorePolicy: RewardStorePolicy;
  readonly rewardStoreOverrides?: readonly SourceRewardStorePolicyOverride[];
  readonly bounds: {
    readonly maxBatches: number;
    readonly maxTargets: number;
  };
}

export interface RawCompletedHubExitDeclaration extends Omit<
  CompletedHubExitDescriptor,
  'physicalExit'
> {
  readonly physicalExit: {
    readonly index: number;
    readonly type: string;
  };
}

export interface RawHubDecisionDeclaration extends Omit<
  HubDecisionDescriptor,
  'fields' | 'completedExit'
> {
  readonly fields?: readonly AuthoredFieldDescriptor[];
  readonly completedExit: RawCompletedHubExitDeclaration;
}

export type RawProgressionDeclaration =
  RawGeneratedProgressionDeclaration | RawHubDecisionDeclaration;

export interface RawBiomeLayoutDeclaration {
  readonly biomeKey: string;
  readonly initialCounters: {
    readonly biomeDepthCache: number;
    readonly biomeEncounterDepth: number;
  };
  readonly start:
    | {
        readonly kind: 'authoredChoice';
        readonly roomGameNames: readonly [string, ...string[]];
      }
    | { readonly kind: 'fixedAuthored'; readonly roomGameName: string };
  readonly progression: RawProgressionDeclaration;
  readonly completion: CompletionDescriptor;
  readonly fields?: readonly AuthoredFieldDescriptor[];
}

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
