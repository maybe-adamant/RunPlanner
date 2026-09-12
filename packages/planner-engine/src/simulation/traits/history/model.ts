import type { TraitElement, TraitRarity } from '../../../catalog-schema';
import type {
  EchoKeepsakeReplayAddress,
  SemanticAddress,
} from '../../../authored-project/addresses';
import type {
  AuthoredTraitOfferTraits,
  AuthoredChaosTraitOffer,
  EquippedTrait,
  TraitOptionKey,
} from '../../../authored-project/traits';
import type { TraitAssessmentFinding } from '../offer-domain';
export type { TraitFindingCode } from '../../model';

export interface TraitOfferEvent {
  readonly kind: 'traitOffer';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly giverKey: string;
  readonly options: AuthoredTraitOfferTraits['options'];
  readonly selectedOptionKey: TraitOptionKey;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity?: string;
  readonly echoRepeatedKeepsakeKey?: string;
  /** Exact unselected materialized keys banned by an effective Vow of Denial. */
  readonly bannedTraitKeys?: readonly string[];
  /** Derived from the pre-offer state; never persisted in authored state. */
  readonly replacementTransition?: TraitReplacementTransition;
  /** Exact declaration-owned acquisition mutation derived from pre-offer state. */
  readonly targetedAcquisitionTransition?: TraitTargetedAcquisitionTransition;
  /** Derived selected-row level from the frozen offer frontier. */
  readonly selectedEffectiveLevel?: number;
}

/** A frozen Concave Stone pickup, distinct from the original generated offer. */
export interface ConcaveStoneSecondaryEvent {
  readonly kind: 'concaveStoneSecondary';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'concaveStoneSecondary';
  readonly sequence: number;
  readonly giverKey: string;
  readonly options: AuthoredTraitOfferTraits['options'];
  readonly selectedOptionKey: TraitOptionKey;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity?: string;
  readonly echoRepeatedKeepsakeKey?: string;
  readonly bannedTraitKeys?: readonly string[];
  readonly replacementTransition?: TraitReplacementTransition;
  readonly targetedAcquisitionTransition?: TraitTargetedAcquisitionTransition;
  /** Derived selected-row level from the frozen offer frontier. */
  readonly selectedEffectiveLevel?: number;
}

/** A closed derived mutation of an already-equipped Pom-eligible trait. */
export interface TraitLevelMutationEvent {
  readonly kind: 'levelMutation';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly sourceTraitKey?: string;
  readonly targetTraitKey: string;
  readonly oldLevel: number;
  readonly newLevel: number;
  readonly giverKey?: never;
  readonly options?: never;
  readonly selectedOptionKey?: never;
  readonly replacementTransition?: never;
  readonly targetedAcquisitionTransition?: never;
}
export interface SteadyGrowthProgressEvent {
  readonly kind: 'steadyGrowthProgress';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'steadyGrowth';
  readonly sequence: number;
  readonly acquisitionPoint: 'encounterEndEffectsApplied';
  readonly traitKey: string;
  readonly acquisitionIdentity: string;
  readonly oldProgress: number;
  readonly newProgress: number;
  readonly requiredInterval: number;
}
export interface PickupProducerProgressEvent {
  readonly kind: 'pickupProducerProgress';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'pickupProducer';
  readonly sequence: number;
  readonly acquisitionPoint: 'encounterEndEffectsApplied';
  readonly traitKey: string;
  readonly acquisitionIdentity: string;
  readonly oldProgress: number;
  readonly newProgress: number;
  readonly requiredInterval: number;
  readonly matured: boolean;
}
/** One automatic Steady Growth promotion at its owning end-effects checkpoint. */
interface TraitRarityMutationEventBase {
  readonly kind: 'rarityMutation';
  readonly owner: SemanticAddress;
  readonly sequence: number;
  readonly targetTraitKey: string;
  readonly oldRarity: TraitRarity;
  readonly newRarity: TraitRarity;
}

export type TraitRarityMutationEvent =
  | (TraitRarityMutationEventBase & {
      readonly acquisitionRole: 'steadyGrowth';
      readonly acquisitionPoint: 'encounterEndEffectsApplied';
      readonly sourceTraitKey: string;
      readonly resetSteadyGrowthProgress?: true;
    })
  | (TraitRarityMutationEventBase & {
      readonly acquisitionRole: 'fountainRarity';
      readonly acquisitionPoint: 'fountainUsed';
      readonly sourceTraitKey?: never;
      readonly resetSteadyGrowthProgress?: never;
    });

/** Concrete non-trait acquisition contribution, retained in the same ordered
 * trait facts ledger so later offer requirements see it. */
export interface TraitElementContributionEvent {
  readonly kind: 'elementContribution';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly contributions: Readonly<Partial<Record<TraitElement, number>>>;
}

/** One fixed rarityless trait installed directly by another acquired trait. */
export interface DirectTraitGrantEvent {
  readonly kind: 'directTraitGrant';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'directTraitGrant';
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly sourceTraitKey: string;
  readonly traitKey: string;
  /** Absent only for a fixed non-offer acquisition such as Infernal Contract. */
  readonly giverKey?: string;
}
/** A closed lifecycle removal (currently Jeweled Pom's Fated cleanup). */
export interface TraitRemovalEvent {
  readonly kind: 'traitRemoval';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly traitKey: string;
  readonly acquisitionIdentity?: string;
  /** Existing lifecycle cleanup is identity-owned; Ransom removes current key membership. */
  readonly match: 'acquisitionIdentity' | 'currentTraitKey';
}

/** One atomic Anvil of Fates transformation: remove one permanent Hammer, then add two. */
export interface AnvilTransformationEvent {
  readonly kind: 'anvilTransformation';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly removedTraitKey: string | null;
  readonly addedTraitKeys: readonly [string, string];
}

export interface ChaosCurseInstance {
  readonly acquisitionIdentity: string;
  readonly owner: SemanticAddress;
  readonly curseKey: string;
  readonly duration: number;
  readonly remaining: number;
  readonly clock: import('../../../catalog-schema').ChaosClockKind;
  readonly semanticTag?: import('../../../catalog-schema').ChaosSemanticTag;
  readonly curseValues: Readonly<Record<string, number>>;
  readonly blessingKey: string;
  readonly rarity: AuthoredChaosTraitOffer['rarity'];
  readonly blessingValues: Readonly<Record<string, number>>;
}

export interface ChaosBlessingInstance {
  readonly acquisitionIdentity: string;
  readonly blessingKey: string;
  readonly rarity: AuthoredChaosTraitOffer['rarity'];
  readonly blessingValues: Readonly<Record<string, number>>;
}

export interface ChaosPairEvent {
  readonly kind: 'chaosPair';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity: string;
  readonly offer: AuthoredChaosTraitOffer;
  /** Exact distinct unselected curse identities banned by Vow of Denial. */
  readonly bannedCurseKeys?: readonly string[];
}

/** A direct, already-matured Chaos blessing (Transcendent Embryo). */
export interface DirectChaosBlessingEvent {
  readonly kind: 'directChaosBlessing';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'transcendentEmbryoEquip' | 'transcendentEmbryoTransformation';
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity: string;
  readonly blessingKey: string;
  readonly rarity: Extract<TraitRarity, 'Common' | 'Rare' | 'Epic' | 'Heroic'>;
  readonly blessingValues: Readonly<Record<string, number>>;
}

/** Removes one exact direct Chaos blessing instance owned by Embryo. */
export interface DirectChaosBlessingRemovalEvent {
  readonly kind: 'directChaosBlessingRemoval';
  readonly owner: SemanticAddress;
  readonly acquisitionRole:
    'transcendentEmbryoTransformation' | 'transcendentEmbryoRackReplacement';
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity: string;
}

export interface ChaosClockEvent {
  readonly kind: 'chaosClock';
  readonly sequence: number;
  readonly clock: import('../../../catalog-schema').ChaosClockKind;
  /** The originating selected pair provides stable chronology ownership. */
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'chaosClock';
}

/** One declaration-owned Gift Gift Gift attempt at a succeeding biome start. */
export interface EchoKeepsakeReplayEvent {
  readonly kind: 'echoKeepsakeReplay';
  readonly owner: EchoKeepsakeReplayAddress;
  readonly acquisitionRole: 'echoKeepsakeReplay';
  readonly sequence: number;
  readonly acquisitionPoint: 'biomeStart';
  readonly traitKey: 'EchoRepeatKeepsakeBoon';
  readonly acquisitionIdentity: string;
  readonly capturedKeepsakeKey: string;
}

export type TraitHistoryEvent =
  | TraitOfferEvent
  | ConcaveStoneSecondaryEvent
  | TraitLevelMutationEvent
  | SteadyGrowthProgressEvent
  | PickupProducerProgressEvent
  | TraitRarityMutationEvent
  | TraitElementContributionEvent
  | DirectTraitGrantEvent
  | TraitRemovalEvent
  | AnvilTransformationEvent
  | EchoKeepsakeReplayEvent
  | ChaosPairEvent
  | DirectChaosBlessingEvent
  | DirectChaosBlessingRemovalEvent
  | ChaosClockEvent;

export interface TraitReplacementTransition {
  readonly slot: string;
  readonly replacedTraitKey: string;
  readonly oldRarity: TraitRarity;
  readonly newTraitKey: string;
  readonly requiredRarity: TraitRarity;
  /** Sacrificial Hymn adds levels only to its one forced replacement row. */
  readonly levelBonus?: number;
}

interface TraitTargetedAcquisitionTransitionBase {
  readonly sourceTraitKey: string;
  readonly targetTraitKey: string;
}

export type TraitTargetedAcquisitionTransition =
  | (TraitTargetedAcquisitionTransitionBase & {
      readonly kind: 'promoteGodTraitToHeroic';
      readonly oldRarity: TraitRarity;
      readonly newRarity: 'Heroic';
      readonly oldLevel: number;
      readonly newLevel: number;
    })
  | (TraitTargetedAcquisitionTransitionBase & {
      readonly kind: 'upgradeHammerToRank2';
      readonly oldHammerRank: 'RankI';
      readonly newHammerRank: 'RankII';
    });

export interface TraitTargetedAcquisitionAssessment {
  readonly applies: boolean;
  readonly legal: boolean;
  readonly sourceTraitKey?: string;
  readonly targetTraitKey?: string;
  readonly findings: readonly TraitAssessmentFinding[];
  readonly transition?: TraitTargetedAcquisitionTransition;
}

export interface TraitHistoryState {
  readonly events: readonly TraitHistoryEvent[];
  readonly equippedTraits: Readonly<Record<string, EquippedTrait>>;
  /** All six declaration-owned equipment slots. */
  readonly equippedSlots: Readonly<Record<string, EquippedTrait>>;
  readonly elementCounts: Readonly<Record<TraitElement, number>>;
  readonly highestBaseElementCount: number;
  readonly godBoonRarityCounts: Readonly<Record<string, number>>;
  readonly upgradableTraitCount: number;
  /** Route-wide exact trait keys excluded from later offer eligibility. */
  readonly bannedTraitKeys: readonly string[];
  /** Exact traits selected from prior offer screens, including traits later removed. */
  readonly previouslyPickedTraitKeys: readonly string[];
  /** Exact activation fact for Proper Upbringing's promotion and future offers. */
  readonly properUpbringingActive?: true;
  readonly activeChaosCurses: readonly ChaosCurseInstance[];
  readonly maturedChaosBlessings: readonly ChaosBlessingInstance[];
}
