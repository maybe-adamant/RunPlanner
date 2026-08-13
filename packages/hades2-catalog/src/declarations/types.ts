import type {
  ArcanaActivationRule,
  AuthoredFieldDescriptor,
  CompletionDescriptor,
  CompletedHubExitDescriptor,
  EncounterSlotActivation,
  EncounterPhaseKind,
  ExitCompatibilityPolicy,
  ExitBehavior,
  GeneratedProgressionPolicy,
  HubDecisionDescriptor,
  NormalDoorBatchPolicy,
  OceanusAnomalyReplacementDescriptor,
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
import type { RawTraitCatalogInput } from './traits';

export interface RawKeepsakeDeclaration {
  readonly key: string;
  readonly label: string;
  readonly rank: 'Epic';
  readonly fatedDisposition: 'neutral' | 'enabling' | 'opposing';
  readonly effect?:
    | {
        readonly kind: 'jeweledPom';
        readonly giverKey: string;
        readonly subsequentEligibleTraitLevels: 3;
      }
    | {
        readonly kind: 'experimentalHammer';
        readonly giverKey: string;
        readonly qualifyingEncounterUses: 20;
      }
    | { readonly kind: 'callingCard'; readonly rarificationCharges: 6 }
    | { readonly kind: 'timePiece'; readonly conversionCharges: 4 }
    | { readonly kind: 'figLeaf'; readonly biomeUses: 3 };
}

export interface RawEncounterRewardWheelAttachment {
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
}

export interface RawArcanaCardDeclaration {
  readonly key: string;
  readonly label: string;
  readonly traitKey: string;
  readonly row: number;
  readonly column: number;
  readonly graspCost: number;
  readonly activation:
    | { readonly kind: 'manual' }
    | { readonly kind: 'automatic'; readonly rule: ArcanaActivationRule };
  readonly permanentRank: 3;
  readonly fatedIncompatible?: boolean;
  readonly postBossActivationCounts?: Readonly<{ readonly Epic: number; readonly Heroic: number }>;
}
export interface RawFearVowDeclaration {
  readonly key: string;
  readonly label: string;
  readonly incrementalFear: readonly number[];
  readonly circeRemovable: boolean;
  readonly effect?:
    | { readonly kind: 'banUnselectedTraits'; readonly count: 2 }
    | {
        readonly kind: 'preventOrdinaryRoomAcquisition';
        readonly maximumPerBiome: 1;
        readonly qualifyingRewardTypes: readonly ['Boon', 'HermesUpgrade'];
      };
}

export interface RawEncounterLocalRewardAttachment {
  readonly kind: 'localReward';
  readonly groupKey: string;
  readonly slotKey: string;
}

export interface RawEncounterEnvelopeSlotDeclaration {
  readonly key: string;
  readonly activation: EncounterSlotActivation;
  readonly activationRequirement?: RequirementExpression;
  readonly rewardAttachment?: RawEncounterLocalRewardAttachment | RawEncounterRewardWheelAttachment;
}

export interface RawEncounterEnvelopeDeclaration {
  readonly key: string;
  readonly slots: readonly RawEncounterEnvelopeSlotDeclaration[];
}

export interface RawEncounterDefinitionDeclaration {
  readonly key: string;
  readonly label: string;
  readonly kind: EncounterPhaseKind;
  readonly countsEncounterDepth: boolean;
  readonly canEncounterSkip?: boolean;
  readonly blocksFigLeaf?: boolean;
  readonly skipEndEncounterEffects?: boolean;
  readonly blocksKeepsakeSelectionKeys?: readonly string[];
  readonly requirements?: RequirementExpression;
  readonly sequenceEffect?: { readonly kind: 'terminateSuffix' };
  readonly npcPresentationKey?: string;
  readonly traitOfferProducer?: {
    readonly kind: 'traitOffer';
    readonly giverKey: string;
  };
}

export interface RawEncounterSetDeclaration {
  readonly key: string;
  readonly encounterDefinitionKeys: readonly string[];
  readonly defaultEncounterDefinitionKey: string;
}

export type RawEncounterSlotBinding =
  | {
      readonly slotKey: string;
      readonly kind: 'set';
      readonly encounterSetKey: string;
    }
  | {
      readonly slotKey: string;
      readonly kind: 'fixed';
      readonly encounterDefinitionKey: string;
    };

export interface RawRoomLifecycleProfileDeclaration {
  readonly key: string;
  readonly encounterEnvelopeKeys: readonly string[];
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

export interface RawExitTypeDeclaration {
  readonly key: string;
  readonly compatibilityPolicyKey: string;
  readonly behavior?: ExitBehavior;
}

export interface RawZagreusContractAdditionalExitDeclaration {
  readonly kind: 'zagreusContract';
  readonly key: 'zagreusContract';
  readonly exitType: string;
  readonly targetRoomGameName: string;
  readonly maxEnteredThisRoute: number;
}

export interface RawNaturalChaosAdditionalExitDeclaration {
  readonly kind: 'naturalChaos';
  readonly key: 'naturalChaos';
  readonly exitType: string;
  readonly requirement?: RequirementExpression;
}

export type RawAdditionalExitDeclaration =
  RawZagreusContractAdditionalExitDeclaration | RawNaturalChaosAdditionalExitDeclaration;

export interface RawRoomDeclaration {
  readonly gameName: string;
  readonly label: string;
  readonly roomSetKey: string;
  readonly kind: RoomKind;
  readonly mode: RoomMode;
  readonly lifecycleProfileKey?: string;
  readonly structuralTags: readonly RoomStructuralTag[];
  readonly exits: readonly RawRoomExitDeclaration[];
  readonly additionalExits?: readonly RawAdditionalExitDeclaration[];
  readonly incomingReward: RawRewardProducerBinding;
  /** The game room flag that suppresses Gift trait offers in this room. */
  readonly blockGiftBoons?: boolean;
  readonly prebossBatchPolicy?: RawPrebossBatchPolicy;
  readonly forcedRewardStoreKey?: string;
  readonly individualRewardStoreKey?: string;
  readonly enteredRewardStoreHistory: EnteredRewardStoreHistoryPolicy;
  readonly encounterEnvelopeKey: string;
  /** Exact room-level policy for temporary Hammer encounter uses. */
  readonly advancesExperimentalHammerUses: boolean;
  readonly encounterSlotBindings: readonly RawEncounterSlotBinding[];
  readonly counters: RoomCounterEffects;
  readonly caps: RoomCaps;
  readonly eligibility?: RequirementExpression;
  readonly force?: RoomForce;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly localChildren?: readonly RawLocalChildDescriptor[];
}

export interface RawGeneratedProgressionDeclaration {
  readonly kind: 'generated';
  readonly anomalyReplacement?: OceanusAnomalyReplacementDescriptor;
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
  readonly naturalChaos?: {
    readonly roomGameNames: readonly [string, ...string[]];
    readonly defaultRoomGameName: string;
    readonly offerSpacingWindow: number;
  };
  readonly completion: CompletionDescriptor;
  readonly fields?: readonly AuthoredFieldDescriptor[];
}

export interface RawCatalogInput {
  readonly version: string;
  readonly biomes: readonly BiomeDeclaration[];
  readonly routes: readonly RouteDeclaration[];
  readonly arcanaCards: readonly RawArcanaCardDeclaration[];
  readonly fearVows: readonly RawFearVowDeclaration[];
  readonly keepsakes: readonly RawKeepsakeDeclaration[];
  readonly rewardKernel: RawRewardKernelInput;
  readonly encounterEnvelopes: readonly RawEncounterEnvelopeDeclaration[];
  readonly encounterDefinitions: readonly RawEncounterDefinitionDeclaration[];
  readonly encounterSets: readonly RawEncounterSetDeclaration[];
  readonly roomLifecycleProfiles: readonly RawRoomLifecycleProfileDeclaration[];
  readonly exitCompatibilityPolicies: readonly ExitCompatibilityPolicy[];
  readonly exitTypes: readonly RawExitTypeDeclaration[];
  readonly rooms: readonly RawRoomDeclaration[];
  readonly biomeLayouts: readonly RawBiomeLayoutDeclaration[];
  readonly traitCatalog: RawTraitCatalogInput;
}

export type { RawTraitCatalogInput } from './traits';
