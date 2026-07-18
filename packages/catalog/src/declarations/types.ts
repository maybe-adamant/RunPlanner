import type {
  EncounterPhaseKind,
  RequirementExpression,
  RewardPayload,
  RoomForce,
  RoomCaps,
  RoomCounterEffects,
  RoomKind,
  RoomTemplateKey,
  RouteDeclaration,
} from '@run-planner/core';

export type RawPayloadDomainDeclaration =
  | {
      readonly key: string;
      readonly kind: 'oneOf';
      readonly values: readonly string[];
    }
  | {
      readonly key: string;
      readonly kind: 'distinctPair';
      readonly valueDomain: string;
    };

export interface RawRewardPrimitiveDeclaration {
  readonly gameName: string;
  readonly label: string;
  readonly acquiredAs?: string;
  readonly payloadDomain?: string;
  readonly defaultPayload?: RewardPayload;
}

export interface RawRewardStoreEntryDeclaration {
  readonly rewardType: string;
  readonly requirement?: RequirementExpression;
}

export interface RawRewardStoreDeclaration {
  readonly key: string;
  readonly defaultRewardType: string;
  readonly refill: 'appendWhenNoEligibleEntry';
  readonly entries: readonly RawRewardStoreEntryDeclaration[];
}

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
  readonly defaultStoreKey?: string;
  readonly eligibleRewardTypes: readonly string[];
  readonly ineligibleRewardTypes: readonly string[];
}

export interface RawFixedRewardBinding {
  readonly kind: 'fixed';
  readonly rewardType: string;
}

export interface RawNoneRewardBinding {
  readonly kind: 'none';
}

export interface RawShopRewardBinding {
  readonly kind: 'shop';
  readonly shopProfileKey: string;
}

export type RawRewardProducerBinding =
  RawCountedRewardBinding | RawFixedRewardBinding | RawNoneRewardBinding | RawShopRewardBinding;

export interface RawShopOptionSetDeclaration {
  readonly key: string;
  readonly rewardTypes: readonly string[];
}

export interface RawShopSlotDeclaration {
  readonly key: string;
  readonly label: string;
  readonly optionSetKey: string;
  readonly defaultRewardType: string;
}

export interface RawShopProfileDeclaration {
  readonly key: string;
  readonly slots: readonly RawShopSlotDeclaration[];
}

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
  readonly rewardPayloadDomains: readonly RawPayloadDomainDeclaration[];
  readonly rewardPrimitives: readonly RawRewardPrimitiveDeclaration[];
  readonly rewardStores: readonly RawRewardStoreDeclaration[];
  readonly shopOptionSets: readonly RawShopOptionSetDeclaration[];
  readonly shopProfiles: readonly RawShopProfileDeclaration[];
  readonly encounterProfiles: readonly RawEncounterProfileDeclaration[];
  readonly rooms: readonly RawRoomDeclaration[];
  readonly biomeLayouts: readonly RawLinearBiomeLayoutDeclaration[];
}
