import type {
  AuthoredFieldDescriptor,
  ExitBehavior,
  FieldsSpatialDeclaration,
  RequiredRoomObjectDescriptor,
  RoomCaps,
  RoomCounterEffects,
  RoomForce,
  RoomKind,
  RoomMode,
  RoomStructuralTag,
} from '@run-planner/engine/catalog-schema';
import type { EnteredRewardStoreHistoryPolicy } from '@run-planner/engine/reward-kernel';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type { RawEncounterSlotBinding } from '../encounters/types';

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
  readonly additionalOptionRequirements?: Readonly<Record<string, RequirementExpression>>;
}

/** Raw declaration override for a room-owned non-incoming reward group. */
export interface RawRoomOfferRewardBinding {
  readonly kind: 'localRewardGroup';
  readonly groupKey: string;
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
      /** Optional declaration-owned capability for a projected offer surface. */
      readonly offerRewardCapability?: 'fieldsCages';
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

export interface RawChaosAdditionalExitDeclaration {
  readonly kind: 'chaos';
  readonly key: 'chaos';
  readonly exitType: string;
  readonly canHost: boolean;
  readonly canSpawn: boolean;
  readonly requirement?: RequirementExpression;
}

export type RawAdditionalExitDeclaration =
  RawZagreusContractAdditionalExitDeclaration | RawChaosAdditionalExitDeclaration;

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
  /** A real required pickup whose payload is intentionally outside simulated state. */
  readonly effectNeutralRequiredReward?: boolean;
  /** Optional override for a bounded local reward group exposed by this room. */
  readonly offerRewardBinding?: RawRoomOfferRewardBinding;
  /** The game room flag that suppresses Gift trait offers in this room. */
  readonly blockGiftBoons?: boolean;
  /** The game room flag that suppresses Gorgon Amulet in this room. */
  readonly blocksGorgon?: boolean;
  readonly hasKeepsakeRack?: boolean;
  readonly hasRequiredFountain?: boolean;
  readonly purgingPool?: { readonly slotKeys: readonly ['left', 'middle', 'right'] };
  /** Exact installed `ChallengeSwitchBase` anchors available to competing secret spawns. */
  readonly challengeSwitchAnchorCount?: number;
  /** Exact installed `SecretPoint` anchors for forced Chaos gates. */
  readonly secretPointAnchorCount?: number;
  /** Exact declaration-owned Surface Shop chance and forced status. */
  readonly surfaceShop?: {
    readonly profileKey: 'SurfaceShop';
    readonly spawnChance: number;
    readonly forced?: true;
  };
  readonly roomShop?: {
    readonly profileKey: 'RoomShop';
    readonly spawnChance: number;
    readonly forced?: true;
  };
  readonly boonRarityOverride?: import('@run-planner/engine/catalog-schema').BoonRarityOverride;
  readonly prebossBatchPolicy?: RawPrebossBatchPolicy;
  readonly forcedRewardStoreKey?: string;
  readonly individualRewardStoreKey?: string;
  readonly enteredRewardStoreHistory: EnteredRewardStoreHistoryPolicy;
  readonly encounterEnvelopeKey: string;
  /** Exact native carriers for a zero-slot envelope; they have no planner lifecycle effects. */
  readonly unmodeledEncounterKeys?: readonly string[];
  /** Exact room-level policy for temporary Hammer encounter uses. */
  readonly advancesExperimentalHammerUses: boolean;
  /** Source `IgnoreEncounterUses`; suppresses encounter-counted end effects. */
  readonly ignoreEncounterUses?: boolean;
  /** Exact room-level policy for advancing delayed Hermes Shrine delivery uses. */
  readonly advancesHermesShrineDeliveryUses?: boolean;
  /** Source `SkipRoomsPerUpgrade`, used by Steady Growth at end effects. */
  readonly skipRoomsPerUpgrade?: boolean;
  /** Source `SkipTimedDropResources`, used by declaration-clocked timed pickups. */
  readonly skipTimedDropResources?: boolean;
  readonly encounterSlotBindings: readonly RawEncounterSlotBinding[];
  readonly counters: RoomCounterEffects;
  readonly caps: RoomCaps;
  /** Exact source-backed point support, declared beside this room literal. */
  readonly resourcePointSupport: import('@run-planner/engine/catalog-schema').ResourcePointSupport;
  readonly eligibility?: RequirementExpression;
  readonly force?: RoomForce;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly localChildren?: readonly RawLocalChildDescriptor[];
  readonly fieldsOptionalRewards?: {
    readonly key: 'optionalRewards';
    readonly optionalRewardCapacity: number;
    readonly reward: RawCountedRewardBinding;
  };
  readonly fieldsSpatial?: FieldsSpatialDeclaration;
  readonly infernalContractReward?: {
    readonly entryKey: 'infernalContractReward';
    readonly producerLifecycleKey: string;
    readonly rewardTypes: readonly [string, string, string, string, string];
  };
}
