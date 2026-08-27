import type { ResolvedRewardOffer } from '../reward-kernel/model';
import type {
  AuthoredGorgonAthenaOffer,
  AuthoredLevelResolution,
  AuthoredHexTreeConfiguration,
  AuthoredTraitOffer,
} from './traits';

export const PROJECT_DOCUMENT_SCHEMA_VERSION = 65 as const;
export type ResourceFamily = import('../catalog-schema').ResourceFamily;
/** Route ownership supplies the route key; the selected host is exact and durable. */
export interface ResourcePlacement {
  readonly biomeKey: string;
  readonly occurrenceId: OccurrenceId;
}
export type ResourcePlacements = Readonly<Record<ResourceFamily, ResourcePlacement | null>>;

declare const occurrenceIdBrand: unique symbol;

export type OccurrenceId = string & {
  readonly [occurrenceIdBrand]: 'OccurrenceId';
};

export interface ShopOfferState {
  readonly reward: AuthoredRewardState | null;
}

export type TraitOffersByAcquisitionRole = Readonly<Record<string, AuthoredTraitOffer | null>>;
export type LevelResolutionsByAcquisitionRole = Readonly<Record<string, AuthoredLevelResolution>>;

export type AcquisitionDisposition =
  { readonly kind: 'normal' } | { readonly kind: 'timePiece' } | { readonly kind: 'artificer' };

export interface AuthoredRewardState {
  readonly offer: ResolvedRewardOffer;
  readonly traitOffersByAcquisitionRole: TraitOffersByAcquisitionRole;
  readonly levelResolutionsByAcquisitionRole?: LevelResolutionsByAcquisitionRole | undefined;
  /** Exact player disposition for every declared concrete acquisition role. */
  readonly dispositionByAcquisitionRole: Readonly<Record<string, AcquisitionDisposition>>;
}

/** The narrow loadout surface consumed by room/reward materialization. */
export interface RouteWeaponAspectLoadout {
  readonly weaponKey: string;
  readonly aspectKey: string;
}

/** Complete persisted route configuration. */
export interface RouteLoadout extends RouteWeaponAspectLoadout {
  readonly manualArcanaKeys: readonly string[];
  readonly fearRanks: Readonly<Record<string, number>>;
  /** Mandatory ordinary rack selection established before the route begins. */
  readonly startingKeepsakeKey: string;
  /** Dormant unless the route-start selection equips a supported keepsake. */
  readonly keepsakeEquipResults?: AuthoredKeepsakeEquipResults;
  /** Complete fixed Sky Fall Hex tree, present only for Aspect of Selene. */
  readonly aspectHexTree?: AuthoredHexTreeConfiguration;
}

/** Exact immediate products owned by one keepsake-selection frontier. */
export interface AuthoredKeepsakeEquipResults {
  readonly jeweledPom?: {
    readonly traitKey: string;
    readonly rarity?: import('../catalog-schema').TraitRarity;
  };
  readonly experimentalHammer?: AuthoredExperimentalHammerEquipResult;
  /** Exact Chaos blessing granted by Transcendent Embryo at this frontier. */
  readonly transcendentEmbryo?: { readonly blessingKey: string };
}

/** Sparse choice for the exact next fountain use owned by one occurrence. */
export interface AuthoredFountainRarityResult {
  readonly targetTraitKey: string;
}

export type AuthoredExperimentalHammerEquipResult =
  { readonly kind: 'selected'; readonly traitKey: string } | { readonly kind: 'exhausted' };

export type PostbossKeepsakeDisposition =
  { readonly kind: 'retain' } | { readonly kind: 'replace'; readonly keepsakeKey: string };

export interface ShopState {
  readonly profileKey: string;
  readonly offers: Readonly<Record<string, ShopOfferState>>;
}

/** The final realized Pool list; null is unresolved authoring, never a reroll request. */
export interface PurgingPoolState {
  /** Whether the player opens this physical Pool and authors its realized inventory. */
  readonly interacted: boolean;
  readonly traitKeyBySlot: Readonly<Record<'left' | 'middle' | 'right', string | null>>;
}

export type HermesShrineSlotKey = 'first' | 'secondLeft' | 'secondRight';
export type HermesShrineGenerationKey =
  'initial:first' | 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill';

export function hermesShrineInitialGenerationKey(
  slotKey: HermesShrineSlotKey,
): HermesShrineGenerationKey {
  return `initial:${slotKey}`;
}

export function hermesShrineInitialSlotKey(
  generationKey: HermesShrineGenerationKey,
): HermesShrineSlotKey | undefined {
  if (!generationKey.startsWith('initial:')) return undefined;
  const slotKey = generationKey.slice('initial:'.length);
  return slotKey === 'first' || slotKey === 'secondLeft' || slotKey === 'secondRight'
    ? slotKey
    : undefined;
}

export interface HermesShrinePurchase {
  readonly delay: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  readonly rushed: boolean;
}

/** A Travel Deal child is a fourth generation, never a replacement initial slot. */
export interface HermesShrineTravelDealRefill {
  readonly offer: AuthoredRewardState | null;
  readonly purchase?: HermesShrinePurchase;
}

/** Complete entry-time Shrine inventory; purchase-owned detail is deliberately sparse. */
export interface HermesShrineState {
  readonly offerBySlot: Readonly<Record<HermesShrineSlotKey, AuthoredRewardState | null>>;
  readonly purchaseBySlot?: Readonly<Partial<Record<HermesShrineSlotKey, HermesShrinePurchase>>>;
  /** Retained for repair even when its qualifying Travel Deal prefix changes. */
  readonly travelDealRefill?: HermesShrineTravelDealRefill;
}

/** A RoomShop is runtime-random until the player elects to model this visit. */
export type StygianWellSlotKey = 'healing' | 'secondLeft' | 'secondRight';
export type StygianWellGenerationKey =
  'initial:healing' | 'initial:secondLeft' | 'initial:secondRight' | 'travelDealRefill';
export interface StygianWellState {
  readonly interacted: boolean;
  readonly offerKeyBySlot: Readonly<Record<StygianWellSlotKey, string | null>>;
  readonly twistResultKeyBySlot?: Readonly<
    Partial<Record<StygianWellSlotKey | 'travelDealRefill', string | null>>
  >;
  readonly purchasedGenerationKeys?: readonly StygianWellGenerationKey[];
  readonly travelDealRefillKey?: string | null;
}

/** Occurrence-owned payloads for one exact acquisition point. */
export interface AuthoredAcquisitionSiteState {
  /** Site-materialized optional pickups only. Shop offers remain producer-owned. */
  readonly pickupEntries?: Readonly<Record<string, AuthoredRewardState | null>>;
}

export interface FieldsCombatState {
  readonly kind: 'fieldsCombat';
  readonly cages: Readonly<Record<string, AuthoredRewardState | null>>;
  readonly optionalRewardCount: number;
  readonly optionalRewards: Readonly<Record<string, AuthoredRewardState | null>>;
}

/**
 * One stable reference to a player-triggered interaction owned by a room
 * occurrence. Payload remains on the referenced semantic owner; this union
 * stores chronology identity only.
 */
export type RoomActionReference =
  | { readonly kind: 'completeFieldsCage'; readonly phaseKey: string }
  | {
      readonly kind: 'interactIncomingReward';
      readonly producerPoint: string;
      readonly acquisitionRole: string;
    }
  | {
      readonly kind: 'interactLocalReward';
      readonly groupKey: string;
      readonly slotKey: string;
    }
  | { readonly kind: 'chooseRewardWheel'; readonly wheelKey: string }
  | { readonly kind: 'interactWheelReward'; readonly wheelKey: string }
  | { readonly kind: 'interactShopOffer'; readonly offerKey: string }
  | {
      readonly kind: 'purchaseHermesShrineOffer';
      readonly generationKey: HermesShrineGenerationKey;
    }
  | { readonly kind: 'purchaseStygianWellOffer'; readonly generationKey: StygianWellGenerationKey }
  | { readonly kind: 'sellPurgingPoolTrait'; readonly slotKey: 'left' | 'middle' | 'right' }
  | { readonly kind: 'interactEncounter'; readonly phaseKey: string }
  | { readonly kind: 'interactGorgon'; readonly phaseKey: string }
  | {
      readonly kind: 'interactAcquisitionEntry';
      readonly siteKey: string;
      readonly entryKey: string;
    }
  | { readonly kind: 'useFountain' }
  | { readonly kind: 'interactKeepsakeRack' };

export interface RoomActionState {
  readonly order: readonly RoomActionReference[];
}

export interface RewardWheelState {
  readonly storeKey: string;
  readonly offerCount: number;
  readonly offers: Readonly<Record<string, AuthoredRewardState | null>>;
  readonly pickedOfferIndex: number;
}

export interface ShipCombatState {
  readonly kind: 'shipCombat';
  readonly encounterCount: 2 | 3;
  readonly wheels: Readonly<Record<string, RewardWheelState>>;
}

export interface AuthoredGorgonPhaseResult {
  /** Gorgon-only phase trigger; never a general offer eligibility condition. */
  readonly athenaTriggerConditionMet: boolean;
  /** Conditional ordinary Athena offer; omitted while dormant. */
  readonly athenaOffer?: AuthoredGorgonAthenaOffer | null;
}

/** Closed, phase-local realization of the single Nemesis random-event encounter. */
export type AuthoredNemesisRandomEventOutcome =
  | { readonly kind: 'freeItem' }
  | { readonly kind: 'goldTrade'; readonly response: 'accept' | 'decline' }
  | { readonly kind: 'damageTrade'; readonly response: 'accept' | 'decline' }
  | {
      readonly kind: 'traitTrade';
      readonly traitKey: string;
      readonly response: 'accept' | 'decline';
    }
  | { readonly kind: 'damageContest'; readonly result: 'success' | 'failure' };

export type SideRoomGeneration = 'generated' | 'notGenerated';

/**
 * Concrete authored encounter selections belong to the room instance that
 * owns the envelope slots. Fixed slots have no selection entry; a fixed
 * encounter may still own an authored trait offer when its declaration
 * publishes one.
 */
export interface RoomEncounterState {
  readonly encounterKeyByPhase: Readonly<Record<string, string>>;
  /** Complete declaration-owned phase-local Fig Leaf dispositions, including fixed slots. */
  readonly figLeafSkipByPhase: Readonly<Record<string, boolean>>;
  /** Sparse automatic Steady Growth targets keyed to a reached end-effects phase. */
  readonly steadyGrowthTargetByPhase?: Readonly<Record<string, string>>;
  /** Sparse Boss-defeated Judgment selections keyed by their exact Boss phase. */
  readonly judgmentArcanaKeysByPhase?: Readonly<Record<string, readonly string[]>>;
  /** Sparse Boss-defeated Crystal Figurine selections keyed by their exact Boss phase. */
  readonly figurineArcanaKeysByPhase?: Readonly<Record<string, readonly string[]>>;
  /** Sparse reached eight-room Transcendent Embryo transformations. */
  readonly transcendentEmbryoBlessingByPhase?: Readonly<Record<string, string>>;
  /** Complete declaration-owned Gorgon condition/result for each phase. */
  /** Schema-29 documents always encode this map; optional keeps hand-built legacy fixtures decodable. */
  readonly gorgonResultByPhase?: Readonly<Record<string, AuthoredGorgonPhaseResult>>;
  /** Sparse authored offers keyed by stable phase and concrete encounter. */
  readonly traitOffersByPhase?: Readonly<
    Record<string, Readonly<Record<string, AuthoredTraitOffer | null>>>
  >;
  /** Sparse phase-owned event detail; null is unresolved. */
  readonly nemesisRandomEventByPhase?: Readonly<
    Record<string, AuthoredNemesisRandomEventOutcome | null>
  >;
}

export interface EphyraCombatState {
  readonly kind: 'ephyraCombat';
  readonly reward: AuthoredRewardState | null;
}

/**
 * An Anomaly retains the normal-door offer it displaced, even when that offer
 * is not presently admitted by the Anomaly declaration. Evaluation owns the
 * resulting finding; persistence must never silently reroll or discard it.
 */
export interface AnomalyRoomState {
  readonly kind: 'anomaly';
  readonly reward: AuthoredRewardState | null;
  readonly success: boolean;
}

export type AuthoredRoomState =
  | { readonly kind: 'none' }
  | { readonly kind: 'fixed'; readonly reward: AuthoredRewardState | null }
  | { readonly kind: 'counted'; readonly reward: AuthoredRewardState | null }
  | AnomalyRoomState
  | EphyraCombatState
  | FieldsCombatState
  | ShipCombatState
  | { readonly kind: 'shop'; readonly shop?: ShopState }
  | { readonly kind: 'freeReward'; readonly reward: AuthoredRewardState | null };

export type BatchRewardStoreState =
  | { readonly kind: 'authoredBaseStore'; readonly baseRewardStoreKey: string | null }
  | { readonly kind: 'sourceOfferPoint' }
  | { readonly kind: 'none' };

export interface FieldsCageBatchState {
  readonly cageOutcome: 'min' | 'max';
}

export type AuthoredBatchState = FieldsCageBatchState | null;

export type AuthoredFieldValue = boolean | number | string;

export type AuthoredBiomeState = Readonly<Record<string, AuthoredFieldValue | null>>;

export interface RoomOccurrence {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  /**
   * Present only on an Anomaly room occupying a normal G target. The owning
   * target remains the topology identity; this remembers the displaced G
   * declaration for semantic revert without creating a shadow occurrence.
   */
  readonly anomalyReplacement?: AnomalyReplacementProvenance;
  readonly state: AuthoredRoomState;
  /** Sparse because ordinary mandatory singleton points need no authored state. */
  readonly acquisitionSites?: Readonly<Record<string, AuthoredAcquisitionSiteState>>;
  readonly encounters: RoomEncounterState;
  /** One explicit occurrence-local chronology; fixed checkpoints stay derived. */
  readonly roomActions: RoomActionState;
  /** Source-owned closed sibling continuations emitted by this occurrence. */
  readonly additionalExits: readonly AuthoredAdditionalExit[];
  /** Present only where this exact room declaration exposes the keepsake rack. */
  readonly keepsakeRack?: {
    readonly disposition: PostbossKeepsakeDisposition;
    readonly equipResults?: AuthoredKeepsakeEquipResults;
  };
  /** Present only when this exact occurrence owns a realized Phial target. */
  readonly fountainRarityResult?: AuthoredFountainRarityResult;
  /** Present only at declaration-owned F/G/H automatic Postboss Pool hosts. */
  readonly purgingPool?: PurgingPoolState;
  /** Present at declaration-owned Shrine hosts; never guarded by a global interaction flag. */
  readonly hermesShrine?: HermesShrineState;
  readonly stygianWell?: StygianWellState;
}

export interface AnomalyReplacementProvenance {
  readonly replacedRoomGameName: string;
}

export interface ExitTargetReference {
  readonly exitKey: string;
  readonly occurrenceId: OccurrenceId;
}

export type ExitDecisionSource =
  | { readonly kind: 'occurrence'; readonly occurrenceId: OccurrenceId }
  | { readonly kind: 'hubDecision'; readonly decisionKey: string };

export type ExitSelection =
  | { readonly kind: 'derived' }
  | { readonly kind: 'unresolved' }
  | { readonly kind: 'normal'; readonly exitKey: string }
  | { readonly kind: 'additional'; readonly additionalExitKey: string };

export interface NormalDoorBatch {
  readonly kind: 'batch';
  readonly rewardStore: BatchRewardStoreState;
  readonly batchState: AuthoredBatchState;
  readonly targets: readonly ExitTargetReference[];
}

/**
 * Persisted additional exits are source-occurrence owned. They are not normal
 * targets and an exit decision never duplicates their ownership.
 */
export interface ZagreusContractAdditionalExit {
  readonly kind: 'zagreusContract';
  readonly key: 'zagreusContract';
  readonly occurrenceId: OccurrenceId;
}

export interface NaturalChaosAdditionalExit {
  readonly kind: 'naturalChaos';
  readonly key: 'naturalChaos';
  readonly occurrenceId: OccurrenceId;
}

export interface SparkChaosAdditionalExit {
  readonly kind: 'sparkChaos';
  readonly key: 'sparkChaos';
  readonly occurrenceId: OccurrenceId;
}

export type AuthoredAdditionalExit =
  ZagreusContractAdditionalExit | NaturalChaosAdditionalExit | SparkChaosAdditionalExit;

export interface ExitDecision {
  readonly kind: 'exit';
  readonly source: ExitDecisionSource;
  readonly normal: NormalDoorBatch;
  readonly selection: ExitSelection;
}

export interface HubTargetReference {
  readonly hubSlotKey: string;
  readonly occurrenceId: OccurrenceId;
}

export interface HubDecision {
  readonly kind: 'hub';
  readonly hubKey: string;
  readonly source: Extract<ExitDecisionSource, { readonly kind: 'occurrence' }>;
  readonly openTargets: readonly HubTargetReference[];
  readonly visitOrder: readonly string[];
}

export interface LocalVisitTargetReference {
  readonly occurrenceId: OccurrenceId;
  readonly generation: SideRoomGeneration;
}

/**
 * Parent-occurrence-owned topology for one declaration-fixed local room group.
 * Payload and encounter state live on the referenced ordinary occurrences.
 */
export interface LocalVisitDecision {
  readonly kind: 'localVisit';
  readonly sourceOccurrenceId: OccurrenceId;
  readonly groupKey: string;
  readonly targetsBySlot: Readonly<Record<string, LocalVisitTargetReference>>;
  readonly visitOrder: readonly OccurrenceId[];
}

export type NextRoomDecision = ExitDecision | HubDecision | LocalVisitDecision;

export interface BiomeTopology {
  readonly startOccurrenceId: OccurrenceId;
  readonly occurrences: readonly RoomOccurrence[];
  readonly decisions: readonly NextRoomDecision[];
}

export interface AuthoredBiomePlan {
  readonly biomeKey: string;
  readonly state: AuthoredBiomeState;
  readonly topology: BiomeTopology | null;
  /** Declaration-fixed Boss/Postboss rooms; never editable topology targets. */
  readonly completionOccurrences: readonly RoomOccurrence[];
  /** Dormant until Gift Gift Gift reaches a Hammer replay at this biome start. */
  readonly echoKeepsakeReplayResults?: Pick<
    AuthoredKeepsakeEquipResults,
    'experimentalHammer' | 'transcendentEmbryo'
  >;
}

export interface AuthoredRoutePlan {
  readonly routeKey: string;
  readonly loadout: RouteLoadout;
  readonly resourcePlacements: ResourcePlacements;
  readonly biomes: readonly AuthoredBiomePlan[];
}

export interface ProjectDocument {
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION;
  readonly projectId: string;
  readonly catalogVersion: string;
  readonly routes: readonly AuthoredRoutePlan[];
}
