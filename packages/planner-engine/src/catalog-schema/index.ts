import type {
  CountedRewardBinding,
  EnteredRewardStoreHistoryPolicy,
  RewardProducerBinding,
} from '../reward-kernel/bindings';
import type { RewardKernelCatalog } from '../reward-kernel/model';
import type { CounterAxis, RequirementExpression, RoomStructuralTag } from '../requirements/model';
import type { ProducerLifecyclePointKey } from '../reward-kernel/model';
import type { CatalogCollection } from '../normalized/collection';

export type {
  AspectDeclaration,
  BoonRarityCheck,
  BoonRarityContribution,
  BoonRarityOverride,
  BoonRarityValues,
  HammerCompatibility,
  TraitCatalog,
  ChaosTraitCatalog,
  ChaosCurseDeclaration,
  ChaosBlessingDeclaration,
  ChaosDerivedOutcome,
  ChaosNumericOperand,
  ChaosOfferRequirement,
  ChaosClockKind,
  ChaosSemanticTag,
  TraitDeclaration,
  TraitElement,
  EchoLastRunBoonCatalog,
  EchoLastRunBoonVariantDeclaration,
  TraitGiverDeclaration,
  TraitOfferContextDeclaration,
  TraitOfferContextKey,
  TraitOrdinaryBoonSlot,
  TraitProviderKind,
  TraitRarity,
  InRunTraitRarity,
  TraitRequirementExpression,
  ScalableGodTraitRarityFloorEffect,
  ProperUpbringingEffect,
  TargetedTraitAcquisition,
  TraitSelectedDisposition,
  DirectTraitSetDeclaration,
  DirectTraitSetKey,
  TraitPickupDeclaration,
  HexDeclaration,
  HexGodSentDeclaration,
  HexLayoutDeclaration,
  HexLayoutKey,
  HexTalentCandidateDeclaration,
  WeaponDeclaration,
} from './traits';
import type {
  AspectDeclaration,
  TraitDeclaration,
  TraitElement,
  TraitGiverDeclaration,
  TraitOfferContextDeclaration,
  InRunTraitRarity,
  WeaponDeclaration,
} from './traits';

export type { CatalogCollection } from '../normalized/collection';
export type { RoomStructuralTag } from '../requirements/model';

export interface BiomeDeclaration {
  readonly key: string;
  readonly label: string;
}

export interface RouteDeclaration {
  readonly key: string;
  readonly label: string;
  readonly biomeKeys: readonly string[];
}

export type ArcanaActivationRule =
  | { readonly kind: 'adjacentActive' }
  | { readonly kind: 'manualCostsOneThroughFive' }
  | { readonly kind: 'manualCostMultiplicityAtMost'; readonly maximum: number }
  | { readonly kind: 'surroundingCellsActive' }
  | { readonly kind: 'completeOtherRowOrColumn' }
  | { readonly kind: 'manualCardCount'; readonly minimum: number; readonly maximum: number };

export interface ArcanaCardDeclaration {
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
  /** Source-declared Fated incompatibility, consumed by Arcana candidate authority. */
  readonly fatedIncompatible: boolean;
  /** Judgment's rank-scaled post-Boss activation counts. */
  readonly postBossActivationCounts?: Readonly<{
    readonly Common: number;
    readonly Rare: number;
    readonly Epic: number;
    readonly Heroic: number;
  }>;
  /** The Artificer's exact run-local capacity; absent from every other card. */
  readonly artificerCapacityByRarity?: Readonly<{
    readonly Common: number;
    readonly Rare: number;
    readonly Epic: number;
    readonly Heroic: number;
  }>;
  readonly boonRarityContributions?: Readonly<
    Record<'Common' | 'Rare' | 'Epic' | 'Heroic', import('./traits').BoonRarityContribution>
  >;
}

export interface FearVowDeclaration {
  readonly key: string;
  readonly label: string;
  readonly incrementalFear: readonly number[];
  readonly circeRemovable: boolean;
  readonly effect?:
    | { readonly kind: 'banUnselectedTraits'; readonly count: 2 }
    | {
        readonly kind: 'substituteRoomReward';
        readonly maximumPerBiome: 1;
        readonly qualifyingRewardTypes: readonly ['Boon', 'HermesUpgrade'];
        readonly replacementRewardType: 'RoomRewardConsolationPrize';
      }
    | {
        readonly kind: 'limitStartingGrasp';
        readonly baseCapacity: 30;
        readonly availablePercentByRank: readonly [60, 40, 20, 0];
      };
}

export type KeepsakeRank = 'Common' | 'Rare' | 'Epic' | 'Heroic';

export type KeepsakeRankProfile<
  Common extends number,
  Rare extends number,
  Epic extends number,
  Heroic extends number,
> = Readonly<{
  readonly Common: Common;
  readonly Rare: Rare;
  readonly Epic: Epic;
  readonly Heroic: Heroic;
}>;

/** A rank-III ordinary keepsake. Effects are deliberately introduced by their owning gates. */
export interface KeepsakeDeclaration {
  readonly key: string;
  readonly label: string;
  readonly rank: 'Epic';
  readonly fatedDisposition: 'neutral' | 'enabling' | 'opposing';
  /** Closed planner disposition for Echo's captured-keepsake replay. */
  readonly echoGift:
    | { readonly availability: 'excluded' }
    | {
        readonly availability: 'eligible';
        readonly effect:
          | { readonly kind: 'figLeaf'; readonly schedule: 'oneShot' }
          | {
              readonly kind: 'experimentalHammer';
              readonly schedule: 'oneShotAfterUnequipped';
            }
          | { readonly kind: 'crystalFigurine'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'concaveStone'; readonly schedule: 'oneShot' }
          | { readonly kind: 'transcendentEmbryo'; readonly schedule: 'oneShot' }
          | { readonly kind: 'callingCard'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'timePiece'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'olympianRewardPressure'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'moonBeam'; readonly schedule: 'oneShotAfterUnequipped' }
          | { readonly kind: 'modeledNeutral'; readonly schedule: 'noModeledEffect' };
      };
  /** Closed, source-backed rank data consumed by supported effect transitions. */
  readonly effect?:
    | {
        readonly kind: 'jeweledPom';
        readonly giverKey: string;
        readonly subsequentEligibleTraitLevelsByRank: KeepsakeRankProfile<1, 2, 3, 4>;
      }
    | {
        readonly kind: 'experimentalHammer';
        readonly giverKey: string;
        readonly qualifyingEncounterUsesByRank: KeepsakeRankProfile<10, 15, 20, 30>;
      }
    | {
        readonly kind: 'callingCard';
        readonly rarificationChargesByRank: KeepsakeRankProfile<2, 4, 6, 8>;
      }
    | {
        readonly kind: 'timePiece';
        readonly conversionChargesByRank: KeepsakeRankProfile<2, 3, 4, 5>;
      }
    | {
        readonly kind: 'figLeaf';
        readonly biomeUsesByRank: KeepsakeRankProfile<1, 2, 3, 4>;
      }
    | {
        readonly kind: 'gorgonAmulet';
        readonly uses: 1;
        readonly minimumBiomeDepth: 2;
        readonly providerKey: 'Athena';
        readonly rarityLevelByRank: KeepsakeRankProfile<1, 2, 3, 4>;
        readonly naturalEncounterKey: string;
      }
    | {
        readonly kind: 'fountainRarity';
        readonly uses: 1;
        readonly targetRarityLevelByRank: Readonly<{
          readonly Common: 2;
          readonly Rare: 3;
          readonly Epic: 4;
        }>;
        readonly sourceMaxRarityLevel: 1;
      }
    | {
        readonly kind: 'crystalFigurine';
        readonly uses: 1;
        readonly requestedCards: 2;
        readonly rarityLevelByRank: KeepsakeRankProfile<1, 2, 3, 4>;
      }
    | {
        readonly kind: 'concaveStone';
        readonly uses: 1;
        readonly procSupportByRank: KeepsakeRankProfile<25, 50, 75, 100>;
      }
    | {
        readonly kind: 'transcendentEmbryo';
        readonly source: 'Chaos';
        readonly interval: 8;
        readonly blessingRarityByRank: Readonly<Record<KeepsakeRank, InRunTraitRarity>>;
      }
    | {
        /** The nine provider keepsakes share one exact reward-pressure contract. */
        readonly kind: 'olympianRewardPressure';
        readonly priorityRewardType: 'Boon';
        readonly providerKey: string;
        readonly providerForceUses: 1;
        readonly providerRarificationUses: 1;
        /** These declarations intentionally have no Heroic source row. */
        readonly maximumSourceRarityLevelByRank: Readonly<{ Common: 1; Rare: 2; Epic: 3 }>;
      }
    | {
        readonly kind: 'moonBeam';
        readonly pathPointsByRank: KeepsakeRankProfile<3, 4, 5, 7>;
        readonly priorityRewardTypes: readonly ['SpellDrop', 'TalentDrop', 'TalentBigDrop'];
      };
}

export type EncounterPhaseKind = 'boss' | 'combat' | 'miniboss' | 'nonCombat' | 'story';

/**
 * Only these phase kinds create a player-facing combat interval. Story and
 * other noncombat encounters still retain their game encounter identity for
 * history and provider ownership, but never expose Start/End encounter UI.
 */
export function isCombatBearingEncounterPhaseKind(
  kind: EncounterPhaseKind,
): kind is 'boss' | 'combat' | 'miniboss' {
  return kind === 'boss' || kind === 'combat' || kind === 'miniboss';
}

/**
 * The envelope declares that a slot is potentially present. The owning room
 * template evaluates its current structural activation from authored state;
 * lifecycle execution never uses this disposition as a second evaluator.
 */
export type EncounterSlotActivation = 'always' | 'templateControlled';

export interface EncounterRewardWheelAttachment {
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
}

/** A Fields-style local reward owned by an exact local-child slot. */
export interface EncounterLocalRewardAttachment {
  readonly kind: 'localReward';
  readonly groupKey: string;
  readonly slotKey: string;
}

export type EncounterSlotRewardAttachment =
  EncounterLocalRewardAttachment | EncounterRewardWheelAttachment;

/** A stable authored position in a room-local encounter envelope. */
export interface EncounterEnvelopeSlot {
  readonly key: string;
  readonly activation: EncounterSlotActivation;
  /**
   * A structural gate for a template-controlled potential slot. It is read
   * from the predecessor preparation checkpoint, before any phase in this
   * room can start or advance encounter counters.
   */
  readonly activationRequirement?: RequirementExpression;
  readonly rewardAttachment?: EncounterSlotRewardAttachment;
}

/**
 * Reusable room-local encounter topology. It owns neither selected identity,
 * requirement policy, effective kind, nor counter effects.
 */
export interface EncounterEnvelope {
  readonly key: string;
  readonly slots: readonly EncounterEnvelopeSlot[];
}

/** One concrete normalized game encounter selected by a fixed or pool slot. */
export interface EncounterDefinition {
  readonly key: string;
  readonly label: string;
  readonly kind: EncounterPhaseKind;
  readonly countsEncounterDepth: boolean;
  /** Source-declared positive Fig Leaf support for this exact encounter. */
  readonly canEncounterSkip: boolean;
  /** Source-declared room-wide blocker carried by this encounter. */
  readonly blocksFigLeaf: boolean;
  /** Source-declared active-encounter blocker for Gorgon Amulet. */
  readonly blocksGorgon: boolean;
  readonly hostsGorgon: boolean;
  /** A successful skip suppresses the remainder of this room envelope. */
  readonly skipEndEncounterEffects: boolean;
  /** Keepsakes whose ordinary rack selection is unavailable after this encounter. */
  readonly blocksKeepsakeSelectionKeys?: readonly string[];
  readonly requirements?: RequirementExpression;
  readonly sequenceEffect?: { readonly kind: 'terminateSuffix' };
  /** Presentation-only grouping for the later read-only NPC route index. */
  readonly npcPresentationKey?: string;
  /** Explicit declaration-owned producer for an encounter-local trait offer. */
  readonly traitOfferProducer?: {
    readonly kind: 'traitOffer';
    readonly giverKey: string;
  };
  readonly requiresInteraction?: boolean;
  readonly suppressesIncomingReward?: boolean;
  readonly nemesisRandomEvent?: {
    readonly freeItem: {
      readonly resultRewardTypes: readonly [
        'EmptyMaxHealthDrop',
        'HealDrop',
        'LastStandDrop',
        'ArmorBoost',
      ];
      readonly conditionalResultRewardType: 'LastStandDrop';
      readonly runtimeOfferRequirement: 'missingLastStand';
      readonly runtimeOfferFallbacks: readonly [
        {
          readonly preferredRewardType: 'LastStandDrop';
          readonly fallbackRewardType: 'ArmorBoost';
        },
        {
          readonly preferredRewardType: 'ArmorBoost';
          readonly fallbackRewardType: 'EmptyMaxHealthDrop';
        },
      ];
      readonly response: 'none';
      readonly pickupRequired: false;
    };
    readonly goldTrade: {
      readonly variants: readonly {
        readonly rewardType: string;
        readonly enteredBiome: { readonly min?: number; readonly max?: number };
        readonly requirement: 'none' | 'pomLegal' | 'hammerEarlyOrLate';
      }[];
      readonly response: readonly ['accept', 'decline'];
      readonly pickupRequiredOnAccept: true;
    };
    readonly damageTrade: {
      readonly variants: readonly {
        readonly rewardType: string;
        readonly enteredBiome: { readonly min?: number; readonly max?: number };
        readonly requirement: 'none' | 'pomLegal' | 'talentLegal';
      }[];
      readonly response: readonly ['accept', 'decline'];
      readonly pickupRequiredOnAccept: true;
    };
    readonly traitTrade: {
      readonly response: readonly ['accept', 'decline'];
      readonly pickupRequiredOnAccept: true;
      readonly fixedResultRewardType: 'RoomMoneyTripleDrop';
      readonly traitSelection: 'eligibleGodTraitCommonPriority';
    };
    readonly damageContest: {
      readonly successResultRewardTypes: readonly [
        'MaxHealthDrop',
        'MaxManaDrop',
        'StackUpgrade',
        'RoomMoneyDrop',
        'TalentDrop',
      ];
      readonly failureResultRewardType: 'RoomRewardConsolationPrize';
      readonly response: 'none';
      readonly pickupRequired: false;
    };
    readonly hOptionalCapacityReservation: 1;
  };
}

/** Unique possibility support for one selectable slot, with a static default. */
export interface EncounterSet {
  readonly key: string;
  readonly encounterDefinitionKeys: readonly string[];
  readonly defaultEncounterDefinitionKey: string;
}

/** Complete room-declaration binding for one stable envelope slot. */
export type EncounterSlotBinding =
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

export type RoomLifecycleEffectKind =
  | 'advanceEncounterDepth'
  | 'advanceRoomCounters'
  | 'recordAppearance'
  | 'recordCommit'
  | 'recordEncounter'
  | 'recordEncounterCompletion'
  | 'recordEncounterStart'
  | 'recordEnteredRewardStore'
  | 'recordExit'
  | 'recordOfferPoint'
  | 'recordPhaseOfferPoint'
  | 'recordOutgoingGeneration'
  | 'recordPreparation'
  | 'recordProducerPoint'
  | 'recordRequiredObjectCompletions'
  | 'recordRequiredObjectSpawns'
  | 'recordAcquisitionPoint';

export interface OnlyEncounterSlotSelector {
  readonly kind: 'only';
}

export type EncounterSlotSelector = OnlyEncounterSlotSelector;

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
      readonly encounter: EncounterSlotSelector;
    })
  | (RoomLifecycleOperationBase & {
      readonly kind: 'completeEncounter';
      readonly encounter: EncounterSlotSelector;
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
      readonly kind: 'settleAcquisitionPoint';
      readonly point: string;
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
  readonly encounterEnvelopeKeys: readonly string[];
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
  | 'Anomaly'
  | 'Chaos'
  | 'ContractBoss'
  | 'Devotion'
  | 'EphyraCombat'
  | 'EphyraSideRoom'
  | 'FixedIntro'
  | 'FixedOpening'
  | 'FixedPreHub'
  | 'FieldsCombat'
  | 'ClockworkCombat'
  | 'Fountain'
  | 'Miniboss'
  | 'Preboss'
  | 'RewardlessCombat'
  | 'Shop'
  | 'ShipCombat'
  | 'StandardCombat'
  | 'Story';

export type DerivedRoomClassification = 'hub';

export type RoomMode =
  | { readonly kind: 'authored'; readonly templateKey: RoomTemplateKey }
  /** A declaration-fixed physical room persisted as an automatic occurrence. */
  | { readonly kind: 'automatic'; readonly role: 'boss' | 'postboss' }
  | { readonly kind: 'derived'; readonly classification: DerivedRoomClassification };

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
  readonly behavior: ExitBehavior;
}

export type ExitBehavior =
  | {
      readonly kind: 'playerSelected';
      readonly rewardPreview: 'visible' | 'hidden';
    }
  | {
      readonly kind: 'automaticHostContinuation';
      readonly rewardPreview: 'hidden';
    };

export interface RoomExit {
  readonly index: number;
  readonly type: string;
  readonly compatibilityPolicyKey: string;
  readonly behavior: ExitBehavior;
}

export interface ZagreusContractAdditionalExitDeclaration {
  readonly kind: 'zagreusContract';
  readonly key: 'zagreusContract';
  readonly physicalExit: Omit<RoomExit, 'index'>;
  readonly targetRoomGameName: string;
  readonly maxEnteredThisRoute: number;
}

export interface NaturalChaosAdditionalExitDeclaration {
  readonly kind: 'naturalChaos';
  readonly key: 'naturalChaos';
  readonly physicalExit: Omit<RoomExit, 'index'>;
  /** A source-local prerequisite; host spacing remains evaluator-owned. */
  readonly requirement?: RequirementExpression;
}
export interface SparkChaosAdditionalExitDeclaration {
  readonly kind: 'sparkChaos';
  readonly key: 'sparkChaos';
  readonly physicalExit: Omit<RoomExit, 'index'>;
}

export type AdditionalExitDeclaration =
  | ZagreusContractAdditionalExitDeclaration
  | NaturalChaosAdditionalExitDeclaration
  | SparkChaosAdditionalExitDeclaration;

export interface RoomCounterEffects {
  readonly biomeDepthCache: number;
  readonly roomHistoryOrdinal: number;
}

export interface RoomCaps {
  readonly maxAppearancesThisBiome?: number;
  readonly maxCreationsThisRun?: number;
  readonly maxCreationsPerRoom?: number;
}
export type ResourceFamily = 'Pickaxe' | 'Exorcism' | 'Shovel' | 'Fishing';
export interface ResourcePointSupport {
  readonly families: readonly ResourceFamily[];
  readonly capacity: 'simpleComplex' | 'allTools';
  readonly ignoresBiomeLimit?: boolean;
  readonly rules: Readonly<
    Record<
      ResourceFamily,
      {
        readonly grantedTraitKey: string;
        readonly element: 'Fire' | 'Air' | 'Earth' | 'Water';
        readonly sameFamilyLookback: number;
        readonly crossFamilyLookback: Readonly<Record<ResourceFamily, number>>;
      }
    >
  >;
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

export type RemainingPrebossOfferPolicy =
  { readonly kind: 'none' } | { readonly kind: 'counted'; readonly reward: CountedRewardBinding };

export type PrebossBatchPolicy =
  | {
      readonly kind: 'takeOverNormalDoors';
      readonly remainingOffers: RemainingPrebossOfferPolicy;
    }
  | { readonly kind: 'retainNormalPeers' };

export interface RoomDeclaration {
  readonly gameName: string;
  readonly label: string;
  /** Exact game RoomSet identity; authored topology supplies the host route biome. */
  readonly roomSetKey: string;
  readonly kind: RoomKind;
  readonly mode: RoomMode;
  /** Optional declaration-owned lifecycle specialization for this room. */
  readonly lifecycleProfileKey?: string;
  readonly structuralTags: readonly RoomStructuralTag[];
  readonly exits: readonly RoomExit[];
  readonly additionalExits: readonly AdditionalExitDeclaration[];
  readonly incomingReward: RewardProducerBinding;
  /** The normalized room declaration flag that suppresses Gift trait offers. */
  readonly blockGiftBoons: boolean;
  /** Source-declared room-owned blocker for Gorgon Amulet. */
  readonly blocksGorgon: boolean;
  /** Exact physical Postboss rack presence, independent of route position. */
  readonly hasKeepsakeRack: boolean;
  /** Exact physical fountain requirement for this room. */
  readonly hasRequiredFountain: boolean;
  /** Declaration-owned stable physical Pool slots at this exact host. */
  readonly purgingPool?: { readonly slotKeys: readonly ['left', 'middle', 'right'] };
  /** Exact installed `ChallengeSwitchBase` anchors available to competing secret spawns. */
  readonly challengeSwitchAnchorCount?: number;
  /** Exact installed `SecretPoint` anchors for forced Chaos gates. */
  readonly secretPointAnchorCount?: number;
  /** Exact Surface Shop chance and forced status; inventory is always authored when present. */
  readonly surfaceShop?: {
    readonly profileKey: 'SurfaceShop';
    readonly spawnChance: number;
    readonly forced: boolean;
  };
  /** Exact RoomShop placement facts. Unlike SurfaceShop, inventory is optional authoring. */
  readonly roomShop?: {
    readonly profileKey: 'RoomShop';
    readonly spawnChance: number;
    readonly forced: boolean;
  };
  readonly boonRarityOverride?: import('./traits').BoonRarityOverride;
  readonly prebossBatchPolicy?: PrebossBatchPolicy;
  readonly forcedRewardStoreKey?: string;
  readonly individualRewardStoreKey?: string;
  readonly enteredRewardStoreHistory: EnteredRewardStoreHistoryPolicy;
  readonly encounterEnvelopeKey: string;
  readonly advancesExperimentalHammerUses: boolean;
  /** Source `SkipRoomsPerUpgrade`; suppresses Steady Growth's end-effects clock. */
  readonly skipRoomsPerUpgrade: boolean;
  readonly encounterSlotBindings: readonly EncounterSlotBinding[];
  readonly counters: RoomCounterEffects;
  readonly caps: RoomCaps;
  readonly resourcePointSupport: ResourcePointSupport;
  readonly eligibility?: RequirementExpression;
  readonly force?: RoomForce;
  readonly requiredObjects?: readonly RequiredRoomObjectDescriptor[];
  readonly localChildren: readonly LocalChildDescriptor[];
  /** Entry-generated, optional Fields pickups and their exact map capacity. */
  readonly fieldsOptionalRewards?: FieldsOptionalRewardDescriptor;
  /** Source-owned zero-cost Infernal Contract pedestal at qualifying Preboss rooms. */
  readonly infernalContractReward?: {
    readonly entryKey: 'infernalContractReward';
    readonly producerLifecycleKey: string;
    readonly rewardTypes: readonly [string, string, string, string, string];
  };
}

export interface FieldsOptionalRewardDescriptor {
  readonly key: 'optionalRewards';
  readonly optionalRewardCapacity: number;
  readonly slotKeys: readonly string[];
  readonly reward: CountedRewardBinding;
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

export type StartDescriptor =
  | {
      readonly kind: 'authoredChoice';
      readonly roomGameNames: readonly [string, ...string[]];
    }
  | { readonly kind: 'fixedAuthored'; readonly roomGameName: string };

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
  readonly sourceRoomTemplateKey: RoomTemplateKey;
  readonly policy: RewardStorePolicy;
}

export interface StagedCandidatePoolDescriptor {
  readonly key: string;
  readonly roomGameNames: readonly string[];
}

export type GeneratedProgressionPolicy =
  | { readonly kind: 'eligibilityDriven' }
  | { readonly kind: 'fixedCount'; readonly continuationCount: number }
  | {
      readonly kind: 'staged';
      readonly stages: readonly StagedCandidatePoolDescriptor[];
    };

export type NormalDoorBatchPolicy =
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

/**
 * The declaration-owned policy for a normal exit decision. A Hub can carry a
 * bounded entry decision without becoming a second general progression family.
 */
export interface NormalDecisionProgressionDescriptor {
  readonly progressionPolicy: GeneratedProgressionPolicy;
  readonly batchPolicy: NormalDoorBatchPolicy;
  readonly rewardStorePolicy: RewardStorePolicy;
  readonly rewardStoreOverrides: readonly SourceRewardStorePolicyOverride[];
  readonly bounds: {
    readonly maxBatches: number;
    readonly maxTargets: number;
  };
}

export interface GeneratedProgressionDescriptor extends NormalDecisionProgressionDescriptor {
  readonly kind: 'generated';
  readonly anomalyReplacement?: OceanusAnomalyReplacementDescriptor;
}

export interface OceanusAnomalyReplacementDescriptor {
  readonly kind: 'oceanusAnomaly';
  readonly source: {
    readonly minimumBiomeDepthCache: number;
    readonly excludedRoomGameNames: readonly string[];
    readonly excludedSourceEncounterGameNames: readonly string[];
    readonly maxEnteredReplacementsThisRoute: number;
  };
  readonly replaceableTargetRoomGameNames: readonly string[];
  readonly replacementRoomGameNames: readonly string[];
  readonly defaultReplacementRoomGameName: string;
}

export interface HubEntryNormalDecisionDescriptor extends NormalDecisionProgressionDescriptor {
  /** Stable physical identity for the bounded normal exit from the Opening. */
  readonly exitKey: string;
}

/**
 * The only terminal resolution admitted after a bounded Hub entry. It is
 * deliberately closed: the terminal belongs to this Hub progression rather
 * than to a generic source rule.
 */
export interface HubTerminalTakeoverDescriptor {
  readonly roomGameName: string;
  readonly eligibility: RequirementExpression;
  readonly force: 'required';
}

/**
 * A completed Hub has no authored room declaration as its source, so its
 * width-one exit carries its own fixed target and normalized physical metadata.
 */
export interface CompletedHubExitDescriptor {
  readonly exitKey: string;
  readonly roomGameName: string;
  readonly physicalExit: RoomExit;
}

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

export interface HubDecisionDescriptor {
  readonly kind: 'hub';
  readonly hubKey: string;
  readonly entry: HubEntryNormalDecisionDescriptor;
  readonly terminal: HubTerminalTakeoverDescriptor;
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
  readonly completedExit: CompletedHubExitDescriptor;
}

export type ProgressionDescriptor = GeneratedProgressionDescriptor | HubDecisionDescriptor;

export interface BiomeLayout {
  readonly biomeKey: string;
  readonly initialCounters: {
    readonly biomeDepthCache: number;
    readonly biomeEncounterDepth: number;
  };
  readonly start: StartDescriptor;
  readonly progression: ProgressionDescriptor;
  /** Closed target domain and default for authored natural-Chaos exits in this host. */
  readonly naturalChaos?: {
    readonly roomGameNames: readonly [string, ...string[]];
    readonly defaultRoomGameName: string;
    readonly offerSpacingWindow: number;
  };
  readonly sparkChaos?: {
    readonly roomGameNames: readonly [string, ...string[]];
    readonly defaultRoomGameName: string;
  };
  readonly completion: CompletionDescriptor;
  readonly fields: readonly AuthoredFieldDescriptor[];
}

export interface Catalog {
  readonly version: string;
  readonly biomes: CatalogCollection<BiomeDeclaration>;
  readonly routes: CatalogCollection<RouteDeclaration>;
  readonly arcanaCards: CatalogCollection<ArcanaCardDeclaration>;
  readonly fearVows: CatalogCollection<FearVowDeclaration>;
  readonly keepsakes: CatalogCollection<KeepsakeDeclaration>;
  readonly defaultStartingKeepsakeKey: string;
  readonly rewards: RewardKernelCatalog;
  readonly encounterEnvelopes: CatalogCollection<EncounterEnvelope>;
  readonly encounterDefinitions: CatalogCollection<EncounterDefinition>;
  readonly encounterSets: CatalogCollection<EncounterSet>;
  readonly roomLifecycleProfiles: CatalogCollection<RoomLifecycleProfile>;
  readonly exitCompatibilityPolicies: CatalogCollection<ExitCompatibilityPolicy>;
  readonly exitTypes: CatalogCollection<ExitTypeDeclaration>;
  readonly rooms: CatalogCollection<RoomDeclaration>;
  readonly biomeLayouts: CatalogCollection<BiomeLayout>;
  readonly weapons: CatalogCollection<WeaponDeclaration>;
  readonly aspects: CatalogCollection<AspectDeclaration>;
  readonly traits: CatalogCollection<TraitDeclaration>;
  /** Complete normalized Chaos declarations. */
  readonly chaos: import('./traits').ChaosTraitCatalog;
  readonly traitGivers: CatalogCollection<TraitGiverDeclaration>;
  /** Catalog-normalized source game names used by payload-source acquisition roles. */
  readonly traitGiverByAcquisitionGameName: Readonly<Record<string, string>>;
  readonly boonRarityBases: Readonly<
    Record<'olympian' | 'hermes', import('./traits').BoonRarityValues>
  >;
  readonly echoLastRunBoon: import('./traits').EchoLastRunBoonCatalog;
  /** Complete normalized frozen Hex layout declarations. */
  readonly hexes: CatalogCollection<import('./traits').HexDeclaration>;
  readonly traitOfferContexts: CatalogCollection<TraitOfferContextDeclaration>;
  readonly traitRarityOrder: readonly ['Common', 'Rare', 'Epic', 'Heroic'];
  readonly traitElements: readonly TraitElement[];
  readonly traitBaseElements: readonly ['Earth', 'Air', 'Fire', 'Water'];
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
