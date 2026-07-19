import type {
  EnteredRewardStoreHistoryPolicy,
  EncounterPhaseKind,
  RequirementExpression,
  RoomForce,
  RoomCaps,
  RoomCounterEffects,
  RoomKind,
  RoomTemplateKey,
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
  readonly targetMode: 'fixedBoss' | 'generated';
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
  readonly biomeStepKey: string;
  readonly kind: RoomKind;
  readonly templateKey: RoomTemplateKey;
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
}

export interface RawLinearBiomeLayoutDeclaration {
  readonly biomeStepKey: string;
  readonly kind: 'LinearBiome';
  readonly start: {
    readonly mode: 'fixed' | 'oneOf';
    readonly roomGameNames: readonly string[];
  };
  readonly continuation: {
    readonly defaultBatchRuleKey: 'Standard';
    readonly rewardStorePolicy: {
      readonly kind: 'authoredBaseStore';
      readonly storeKeys: readonly string[];
      readonly defaultStoreKey: string;
    };
    readonly batchStateDefault: null;
  };
  readonly terminal: {
    readonly roomGameName: string;
    readonly transitionRuleKey: 'PrebossEntry';
    readonly exitPolicy: { readonly kind: 'allExitsTerminal' };
  };
  readonly bounds: {
    readonly maxBatches: number;
    readonly maxTargets: number;
  };
}

export interface RawCatalogInput {
  readonly version: string;
  readonly routes: readonly RouteDeclaration[];
  readonly rewardKernel: RawRewardKernelInput;
  readonly encounterProfiles: readonly RawEncounterProfileDeclaration[];
  readonly rooms: readonly RawRoomDeclaration[];
  readonly biomeLayouts: readonly RawLinearBiomeLayoutDeclaration[];
}
