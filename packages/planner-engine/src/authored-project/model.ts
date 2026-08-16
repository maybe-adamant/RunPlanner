import type { ResolvedRewardOffer } from '../reward-kernel/model';
import type {
  AuthoredGorgonAthenaOffer,
  AuthoredLevelResolution,
  AuthoredTraitOffer,
} from './traits';

export const PROJECT_DOCUMENT_SCHEMA_VERSION = 39 as const;

declare const occurrenceIdBrand: unique symbol;

export type OccurrenceId = string & {
  readonly [occurrenceIdBrand]: 'OccurrenceId';
};

export interface ShopOfferState {
  readonly reward: AuthoredRewardState;
}

export type TraitOffersByAcquisitionRole = Readonly<Record<string, AuthoredTraitOffer>>;
export type LevelResolutionsByAcquisitionRole = Readonly<Record<string, AuthoredLevelResolution>>;

export interface AuthoredRewardState {
  readonly offer: ResolvedRewardOffer;
  readonly traitOffersByAcquisitionRole: TraitOffersByAcquisitionRole;
  readonly levelResolutionsByAcquisitionRole?: LevelResolutionsByAcquisitionRole | undefined;
  /** Exact player disposition for every declared concrete acquisition role. */
  readonly conversionByAcquisitionRole: Readonly<Record<string, 'normal' | 'gold'>>;
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
}

/** Exact immediate products owned by one keepsake-selection frontier. */
export interface AuthoredKeepsakeEquipResults {
  readonly jeweledPom?: {
    readonly traitKey: string;
    readonly rarity?: import('../catalog-schema').TraitRarity;
    readonly deathDefianceConditionMet?: boolean;
  };
  readonly experimentalHammer?: AuthoredExperimentalHammerEquipResult;
}

export type AuthoredExperimentalHammerEquipResult =
  { readonly kind: 'selected'; readonly traitKey: string } | { readonly kind: 'exhausted' };

export type PostbossKeepsakeDisposition =
  { readonly kind: 'retain' } | { readonly kind: 'replace'; readonly keepsakeKey: string };

export interface ShopState {
  readonly profileKey: string;
  /** Present only when the normalized Shop profile owns this condition. */
  readonly deathDefianceConditionMet?: boolean;
  readonly offers: Readonly<Record<string, ShopOfferState>>;
}

/**
 * Occurrence-owned authoring for one exact acquisition point.  Its one order
 * is both optional-entry membership and chronology; producer state never
 * carries a second purchase order.
 */
export interface AuthoredAcquisitionSiteState {
  readonly order: readonly string[];
  /** Site-materialized optional pickups only. Shop offers remain producer-owned. */
  readonly pickupEntries?: Readonly<Record<string, AuthoredRewardState>>;
}

export interface FieldsCombatState {
  readonly kind: 'fieldsCombat';
  readonly cages: Readonly<Record<string, AuthoredRewardState>>;
  readonly actionOrder: readonly FieldsCombatAction[];
}

export type FieldsCombatAction =
  | { readonly kind: 'completeCage'; readonly phaseKey: string }
  | { readonly kind: 'interactCageReward'; readonly slotKey: string };

export interface RewardWheelState {
  readonly storeKey: string;
  readonly offerCount: number;
  readonly offers: Readonly<Record<string, AuthoredRewardState>>;
  readonly pickedOfferIndex: number;
}

export interface ShipCombatState {
  readonly kind: 'shipCombat';
  readonly encounterCount: 2 | 3;
  readonly wheels: Readonly<Record<string, RewardWheelState>>;
}

export interface AuthoredGorgonPhaseResult {
  readonly deathDefianceConditionMet: boolean;
  /** Conditional ordinary Athena offer; omitted while dormant. */
  readonly athenaOffer?: AuthoredGorgonAthenaOffer;
}

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
  /** Complete declaration-owned Gorgon condition/result for each phase. */
  /** Schema-29 documents always encode this map; optional keeps hand-built legacy fixtures decodable. */
  readonly gorgonResultByPhase?: Readonly<Record<string, AuthoredGorgonPhaseResult>>;
  /** Sparse authored offers keyed by stable phase and concrete encounter. */
  readonly traitOffersByPhase?: Readonly<
    Record<string, Readonly<Record<string, AuthoredTraitOffer>>>
  >;
}

export interface EphyraSideRoomState {
  readonly generation: SideRoomGeneration;
  readonly enteredOrdinal: number | null;
  readonly reward: AuthoredRewardState;
  readonly encounters: RoomEncounterState;
}

export interface EphyraCombatState {
  readonly kind: 'ephyraCombat';
  readonly reward: AuthoredRewardState;
  readonly sideRooms: Readonly<Record<string, EphyraSideRoomState>>;
}

/**
 * An Anomaly retains the normal-door offer it displaced, even when that offer
 * is not presently admitted by the Anomaly declaration. Evaluation owns the
 * resulting finding; persistence must never silently reroll or discard it.
 */
export interface AnomalyRoomState {
  readonly kind: 'anomaly';
  readonly reward: AuthoredRewardState;
  readonly success: boolean;
}

export type AuthoredRoomState =
  | { readonly kind: 'none' }
  | { readonly kind: 'fixed'; readonly reward: AuthoredRewardState }
  | { readonly kind: 'counted'; readonly reward: AuthoredRewardState }
  | AnomalyRoomState
  | EphyraCombatState
  | FieldsCombatState
  | ShipCombatState
  | { readonly kind: 'shop'; readonly shop?: ShopState }
  | { readonly kind: 'freeReward'; readonly reward: AuthoredRewardState };

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
  /** Source-owned closed sibling continuations emitted by this occurrence. */
  readonly additionalExits: readonly AuthoredAdditionalExit[];
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

export type AuthoredAdditionalExit = ZagreusContractAdditionalExit | NaturalChaosAdditionalExit;

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

export type NextRoomDecision = ExitDecision | HubDecision;

export interface BiomeTopology {
  readonly startOccurrenceId: OccurrenceId;
  readonly occurrences: readonly RoomOccurrence[];
  readonly decisions: readonly NextRoomDecision[];
}

export interface AuthoredBiomePlan {
  readonly biomeKey: string;
  readonly state: AuthoredBiomeState;
  readonly topology: BiomeTopology | null;
  /** Dormant unless Judgment is active at this biome's Boss completion. */
  readonly bossCompletionArcanaKeys?: readonly string[];
  /** Present on physical ordinary-rack biomes, including a dormant final configured biome. */
  readonly postbossKeepsakeDisposition?: PostbossKeepsakeDisposition;
  /** Dormant unless this Postboss selection replaces with a supported keepsake. */
  readonly keepsakeEquipResults?: AuthoredKeepsakeEquipResults;
  /** Dormant until Gift Gift Gift reaches a Hammer replay at this biome start. */
  readonly echoKeepsakeReplayResults?: Pick<AuthoredKeepsakeEquipResults, 'experimentalHammer'>;
}

export interface AuthoredRoutePlan {
  readonly routeKey: string;
  readonly loadout: RouteLoadout;
  readonly biomes: readonly AuthoredBiomePlan[];
}

export interface ProjectDocument {
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION;
  readonly projectId: string;
  readonly name: string;
  readonly catalogVersion: string;
  readonly routes: readonly AuthoredRoutePlan[];
}
