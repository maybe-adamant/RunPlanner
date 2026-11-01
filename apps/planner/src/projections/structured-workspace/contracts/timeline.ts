import type {
  AuthoredTranscendentEmbryoOutcome,
  FigurineArcanaAddress,
  FountainRarityOutcomeAddress,
  JudgmentArcanaAddress,
  OccurrenceAddress,
  ProjectCommand,
  RoomActionAddress,
  RoomActionReference,
  SteadyGrowthOutcomeAddress,
  TranscendentEmbryoOutcomeAddress,
} from '@run-planner/engine/authored-project';
import type { ChaosNumericOperand } from '@run-planner/engine/catalog-schema';
import type { RoomActionWindow } from '@run-planner/engine/simulation';
import type { CandidateProjectionEvaluation } from '@planner/projections/candidates/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { WorkspaceMarker } from './navigation';
import type { WorkspaceRunStateLauncher } from './run-state';
import type { WorkspaceLevelResolutionControl, WorkspaceTraitOfferControl } from './traits';
import type { WorkspaceRewardControl } from './rewards';
import type { WorkspaceEncounterPhase } from './locals';
import type { NemesisRandomEventAddress } from '@run-planner/engine/authored-project';
import type { WorkspaceCommandIntent, WorkspaceInteractionChoice } from '../contract';
import type { WorkspaceShopSupplementalDescriptor } from './commerce';
import type {
  WorkspaceHermesShrineTravelDealRefill,
  WorkspaceStygianWellTravelDealRefill,
} from './features';

/** Atomic exact-set authoring at one reached Boss-defeated occurrence seam. */
export interface WorkspaceJudgmentArcanaInteraction {
  readonly choices: readonly WorkspaceInteractionChoice<string>[];
  readonly intentFor: (
    arcanaKeys: readonly string[],
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceJudgmentArcana' }>>;
  readonly key: string;
  readonly load: (arcanaKeys?: readonly string[]) => CandidateProjectionEvaluation;
  readonly owner: JudgmentArcanaAddress;
  readonly value: readonly string[];
}

/** Atomic exact-set authoring for Crystal Figurine after Judgment at one Boss seam. */
export interface WorkspaceFigurineArcanaInteraction {
  readonly choices: readonly WorkspaceInteractionChoice<string>[];
  readonly intentFor: (
    arcanaKeys: readonly string[],
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceFigurineArcana' }>>;
  readonly key: string;
  readonly load: (arcanaKeys?: readonly string[]) => CandidateProjectionEvaluation;
  readonly owner: FigurineArcanaAddress;
  readonly value: readonly string[];
}

export interface WorkspaceRoomActionProposal {
  readonly kind: 'insert' | 'move' | 'remove' | 'unplace';
  readonly key: string;
  readonly label: string;
  readonly reference: RoomActionReference;
  readonly structurallyAuthorable: boolean;
  /** One relevant placement explanation, or none for an authorable proposal. */
  readonly explanations: readonly string[];
  readonly toIndex?: number;
}

/** A gold amount as shown: one number, or the range of a rolled price. */
export interface WorkspaceGoldAmount {
  readonly label: string;
}

/** The chance the gold held covers a purchase, as a whole percent. */
export interface WorkspacePurchaseAffordability {
  readonly label: string;
  /** How likely the gold held covers the price, by the percent shown. */
  readonly tone: 'high' | 'medium' | 'low';
}

export interface WorkspaceRoomActionRow {
  readonly address: import('@run-planner/engine/authored-project').RoomActionSemanticAddress;
  readonly key: string;
  readonly label: string;
  /** Where the room's Add area offers this action while it is optional and unplaced. */
  readonly addGroup?: {
    readonly key: string;
    readonly label: string;
    readonly object?: 'worldShop' | 'hermesShrine';
  };
  /** Engine-published source of a generated pickup; absent for every other action. */
  readonly sourceFamily?: import('@run-planner/engine/authored-project').AcquisitionEntrySourceFamily;
  /** The inventory slot bought from, shown as a badge on the row icon. */
  readonly slot?: number;
  /** A Travel Deal refill purchase, marked on its icon; `shownLabel` drops the offer name. */
  readonly travelDeal?: true;
  readonly shownLabel?: string;
  /**
   * The label in parts: its verb, the name an inline source picker can replace,
   * a tag naming where in the room it happens, and what produced the pickup.
   */
  readonly labelParts?: {
    readonly verb?: string;
    readonly name: string;
    readonly tag?: string;
    readonly origin?: string;
    /** The reward the name stands for; the row shows it as an icon with the name as its title. */
    readonly reward?: {
      readonly offer: import('@run-planner/engine/reward-kernel').ResolvedRewardOffer;
      /** A quality variant (Boosted), marked on the icon. */
      readonly boosted: boolean;
      /** A Stygian Well item's own key: the row shows that item, not its reward type. */
      readonly itemKey?: string;
    };
  };
  readonly marker: WorkspaceMarker;
  readonly proposalKeys: readonly string[];
  readonly reference: RoomActionReference;
  readonly participation: 'required' | 'optional';
  readonly requiredScope?: import('@run-planner/engine/simulation').RoomActionRow['requiredScope'];
  /** Participation is authored by an inventory control (Overview or a Travel Deal line). */
  readonly participationOwnedByOverview: boolean;
  /** Engine-published exact materialization command for one derived acquisition entry. */
  readonly placement?: WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      {
        readonly kind:
          'PlaceHermesShrineDelivery' | 'PlaceClockedTraitPickup' | 'PlaceEchoGoldPickup';
      }
    >
  >;
  readonly rank: number | null;
  /** Artificer output identity authored at this source transformation checkpoint. */
  readonly artificerOutput?: {
    readonly control: WorkspaceRewardControl;
    readonly label: 'Item';
  };
  /** Exact action-owned reward payload, never rediscovered from a rendered key. */
  readonly rewardPayload?: {
    readonly control: WorkspaceRewardControl;
    /** Trait/Pom editing shown beside the action only while this role is actually acquired. */
    readonly inlineLevelResolutions: readonly WorkspaceLevelResolutionControl[];
    readonly inlineTraitOffers: readonly WorkspaceTraitOfferControl[];
    readonly showOffer: boolean;
  };
  readonly placementAssessment?: import('@run-planner/engine/simulation').RoomActionRow['placementAssessment'];
  /** The room's assessment stops at the product this row belongs to: its repair region. */
  readonly blockingProduct?: true;
  readonly stale: boolean;

  /** Engine-owned lifecycle window used by closed presentation groupings. */
  readonly window: RoomActionWindow;
  /** Exact encounter/Gorgon payload settled by this action. */
  readonly traitOffer?: WorkspaceTraitOfferControl;
  /** Exact Phial target control nested under this occurrence-owned fountain action. */
  readonly fountainRarity?: WorkspaceFountainRarityControl;
  /** Exact Fateful Twist result control at this purchased Well action. */
  readonly stygianWellTwist?: {
    readonly address: import('@run-planner/engine/authored-project').RoomFeatureAddress;
    readonly generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey;
    readonly marker: WorkspaceMarker;
    readonly itemKey: string | null;
    /** Catalog-derived presentation for the authored result when the picker is closed. */
    readonly itemLabel?: string;
    readonly candidateItemKeys: readonly string[];
    readonly candidateItems: readonly { readonly key: string; readonly label: string }[];
    readonly interactionKey: string;
  };
  /** The restocked slots of this Well or Pool reroll. */
  readonly featureRoll?: {
    readonly feature: import('@run-planner/engine/authored-project').RollFeature;
    readonly slots: readonly import('./features').WorkspaceFeatureRollSlot[];
  };
  /** Refill authoring under the purchase that triggers Travel Deal. */
  readonly travelDealLine?: WorkspaceTravelDealLine;
  /** What this purchase costs; absent for a free item or where the plan is not evaluated. */
  readonly price?: WorkspaceGoldAmount;
  /** Gold this row gains or loses, from the ledger. */
  readonly goldGained?: WorkspaceGoldAmount & { readonly loss?: true };
  /** The chance the gold held covers the price; absent where the gold held is unknown. */
  readonly affordability?: WorkspacePurchaseAffordability;
  /** Undoes this purchase or collect with its own command. */
  readonly purchaseRemoval?: WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      {
        readonly kind:
          | 'ReplaceShopPurchaseParticipation'
          | 'SetInfernalContractPedestalCollected'
          | 'SetHermesShrinePurchase'
          | 'SetStygianWellPurchase'
          | 'RemoveRoomAction';
      }
    >
  >;
  readonly executable: boolean;
}

export type WorkspaceTravelDealLine =
  | {
      readonly kind: 'worldShop';
      readonly offer: Extract<
        WorkspaceShopSupplementalDescriptor,
        { readonly kind: 'travelDealRefill' }
      >;
    }
  | { readonly kind: 'hermesShrine'; readonly refill: WorkspaceHermesShrineTravelDealRefill }
  | { readonly kind: 'stygianWell'; readonly refill: WorkspaceStygianWellTravelDealRefill };

export interface WorkspaceRoomActions {
  readonly timeline: WorkspaceRoomLifecycleTimeline;
  readonly checkpoints: readonly {
    readonly key: string;
    readonly label: string;
    readonly afterRank: number;
    /** Engine-owned lifecycle window used by closed presentation groupings. */
    readonly window: RoomActionWindow;
  }[];
  readonly interactionKey: string;
  readonly owner: OccurrenceAddress;
  readonly proposals: readonly WorkspaceRoomActionProposal[];
  readonly rows: readonly WorkspaceRoomActionRow[];
  /** Active optional actions that have not been inserted into the lifecycle order. */
  readonly optionalRows: readonly WorkspaceRoomActionRow[];
  /** Missing required or retained stale rows rendered once outside active lifecycle order. */
  readonly repairRows: readonly WorkspaceRoomActionRow[];
  /** Each present Well and Pool's next purchase, sale or reroll, opened above the optional actions. */
  readonly featureRolls?: readonly import('./features').WorkspaceFeatureRollActions[];
  /** Each present World Shop, Hermes Shrine and Pedestal's next action, opened above the optional actions. */
  readonly objectEntries?: readonly import('./features').WorkspaceRoomObjectEntry[];
  readonly steadyGrowth?: readonly WorkspaceSteadyGrowthControl[];
  readonly transcendentEmbryo?: readonly WorkspaceTranscendentEmbryoControl[];
  /** Gold held when the doors open; absent when the ledger cannot say. */
  readonly current?: WorkspaceGoldAmount;
  /** Gold an encounter phase itself settles (a Nemesis bet), shown on its encounter line. */
  readonly phaseGold?: readonly {
    readonly phaseKey: string;
    readonly gold: WorkspaceGoldAmount & { readonly loss?: true };
  }[];
}

export type WorkspaceRoomLifecycleBoundary =
  | { readonly kind: 'roomEntered'; readonly key: 'roomEntered' }
  | { readonly kind: 'encounterStart'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'bossDefeated'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'encounterEnd'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'nextPhase'; readonly key: string; readonly wheelKey: string }
  | { readonly kind: 'cleanup'; readonly key: 'cleanup' };

/**
 * The encounter controls of one phase banner. Its start hosts the identity and what
 * is settled as the encounter starts (Fig Leaf, Aetos, Gorgon); its end hosts what the
 * finished encounter settled (the kill race, an Anomaly's capture point).
 */
export type WorkspaceEncounterBannerSupplement =
  | {
      readonly kind: 'encounterStart';
      readonly phase: WorkspaceEncounterPhase;
      /**
       * Phase role (when the room has several and no cage names it) and encounter name
       * of a definitional encounter start; absent for an encounter settled on entry by
       * interaction (Nemesis event, Empty).
       */
      readonly identityLabel?: string;
      /** The phase has no end banner, so its start banner also hosts its end controls. */
      readonly endControls?: true;
    }
  | {
      readonly kind: 'encounterEnd';
      /** Present when the phase has a kill-race outcome. */
      readonly phase?: WorkspaceEncounterPhase;
      /** The Anomaly's capture-point outcome, decided before its reward. */
      readonly anomalyCleared?: true;
    };

export type WorkspaceRoomLifecycleTimelineEntry =
  | {
      readonly kind: 'boundary';
      readonly boundary: WorkspaceRoomLifecycleBoundary;
      /** Projection-owned text; React does not reconstruct boundary wording. */
      readonly label: string;
      /** Projection-owned lifecycle checkpoint identity for suppression and placement. */
      readonly checkpointKey: string;
      /** Projection-owned insertion position immediately adjacent to this boundary. */
      readonly dropIndex: number;
      readonly rank: number;
      readonly placement: 'before' | 'after';
      readonly runState?: WorkspaceRunStateLauncher;
      /** Exact projected encounter controls this banner hosts. */
      readonly supplement?: WorkspaceEncounterBannerSupplement;
      /** Read-only identity of the cage assigned to this encounter cycle. */
      readonly fieldsCage?: WorkspaceFieldsCageLabel;
    }
  | {
      readonly kind: 'action';
      readonly actionKey: string;
      readonly rank: number;
      /** Closed application presentation for rows represented by a lifecycle-boundary control. */
      readonly presentation: 'row' | 'fieldsCageAnchor' | 'rewardWheelAnchor';
      /** Engine-owned phase grouping for multi-encounter room workbenches. */
      readonly phaseKey?: string;
      /** Exact family-specific Nemesis interaction placed on its required action row. */
      readonly supplement?: {
        readonly kind: 'nemesisInteraction';
        readonly owner: NemesisRandomEventAddress;
        /** Read-only selected family, carried by the movable interaction row. */
        readonly familyLabel?: string;
      };
    }
  | {
      readonly kind: 'automaticEffect';
      readonly effect: 'steadyGrowth' | 'transcendentEmbryo';
      readonly address: SteadyGrowthOutcomeAddress | TranscendentEmbryoOutcomeAddress;
      readonly rank: number;
      readonly phaseKey: string;
    };

export interface WorkspaceSteadyGrowthControl {
  readonly address: SteadyGrowthOutcomeAddress;
  readonly marker: WorkspaceMarker;
  readonly phaseKey: string;
  readonly targetTraitKey?: string;
}

export interface WorkspaceSteadyGrowthDomain {
  readonly emptyNoOp: boolean;
  readonly picker: ContextualPickerModel<string>;
  readonly selectedPossible: boolean;
}

export interface WorkspaceSteadyGrowthInteraction {
  readonly key: string;
  readonly owner: SteadyGrowthOutcomeAddress;
  readonly intentFor: (
    targetTraitKey: string | null,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceSteadyGrowthTarget' }>
  >;
  readonly forTarget: (targetTraitKey?: string | null) => {
    readonly load: () => WorkspaceSteadyGrowthDomain | undefined;
  };
  readonly traitLabel: (traitKey: string) => string;
}

export interface WorkspaceTranscendentEmbryoControl {
  readonly address: TranscendentEmbryoOutcomeAddress;
  readonly marker: WorkspaceMarker;
  readonly phaseKey: string;
  readonly value?: AuthoredTranscendentEmbryoOutcome | undefined;
}

export interface WorkspaceTranscendentEmbryoDomain {
  readonly emptyNoOp: boolean;
  readonly picker: ContextualPickerModel<string>;
  readonly selectedPossible: boolean;
  readonly rarity?: import('@run-planner/engine/catalog-schema').InRunTraitRarity;
  readonly operands?: readonly ChaosNumericOperand[];
}

export interface WorkspaceTranscendentEmbryoInteraction {
  readonly key: string;
  readonly owner: TranscendentEmbryoOutcomeAddress;
  readonly intentFor: (
    value: AuthoredTranscendentEmbryoOutcome | null,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceTranscendentEmbryoTransformation' }>
  >;
  readonly forBlessing: (value?: AuthoredTranscendentEmbryoOutcome | null) => {
    readonly load: () => WorkspaceTranscendentEmbryoDomain | undefined;
  };
  readonly outcomeFor: (blessingKey: string) => AuthoredTranscendentEmbryoOutcome;
  readonly blessingLabel: (blessingKey: string) => string;
}

export interface WorkspaceFountainRarityControl {
  readonly address: FountainRarityOutcomeAddress;
  readonly marker: WorkspaceMarker;
  readonly targetTraitKey?: string;
  /**
   * `unreached` while the engine has not evaluated this fountain use;
   * `noPhial` when no unused Phial reaches it; `noTargetRequired` when one
   * does and no boon can be targeted. The picker waits.
   */
  readonly pending?: 'unreached' | 'noPhial' | 'noTargetRequired';
}

export interface WorkspaceFountainRarityDomain {
  readonly picker: ContextualPickerModel<string>;
  readonly selectedPossible: boolean;
  readonly targetRequired: boolean;
}

export interface WorkspaceFountainRarityInteraction {
  readonly key: string;
  readonly owner: FountainRarityOutcomeAddress;
  readonly intentFor: (
    targetTraitKey: string | null,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceFountainRarityTarget' }>
  >;
  readonly forTarget: (targetTraitKey?: string | null) => {
    readonly load: () => WorkspaceFountainRarityDomain | undefined;
  };
  readonly traitLabel: (traitKey: string) => string;
}

export interface WorkspaceFieldsCageLabel {
  readonly label: string;
  /** The cage's own name ("Cage 1"), shown as a tag. */
  readonly cage: string;
  /** The cage's reward, shown as an icon beside its tag. */
  readonly offer?: import('@run-planner/engine/reward-kernel').ResolvedRewardOffer;
  /** The cage action the label stands for; absent while that action is its own row. */
  readonly owner?: RoomActionAddress;
}

export interface WorkspaceFieldsCageOrderControl {
  readonly choices: readonly {
    readonly phaseKey: string;
    /** The cage's name ("Cage 1"); its reward shows as an icon beside it. */
    readonly label: string;
    /** The cage with its reward named, for the accessible name. */
    readonly fullLabel: string;
    readonly offer?: import('@run-planner/engine/reward-kernel').ResolvedRewardOffer;
  }[];
  readonly phaseKeys: readonly string[];
  readonly unavailableReason?: string;
}

export interface WorkspaceRoomLifecycleTimeline {
  readonly fieldsCageOrder?: WorkspaceFieldsCageOrderControl;
  readonly entries: readonly WorkspaceRoomLifecycleTimelineEntry[];
  readonly boundaries: readonly WorkspaceRoomLifecycleBoundary[];
  /** Checkpoints represented by lifecycle boundary rows rather than duplicate list items. */
  readonly suppressedCheckpointKeys: readonly string[];
}

export interface WorkspaceRoomActionInteraction {
  readonly fieldsCageOrderIntentFor?: (
    phaseKeys: readonly string[],
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceFieldsCageOrder' }>>;
  readonly intentFor: (proposalKey: string) => WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      {
        readonly kind:
          'InsertRoomAction' | 'RemoveRoomAction' | 'MoveRoomAction' | 'UnplaceGeneratedDelivery';
      }
    >
  >;
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly proposals: readonly WorkspaceRoomActionProposal[];
}

export type WorkspaceGeneratedPickupPlacementRepair = ReturnType<
  typeof import('@run-planner/engine/authored-project').structurallyInvalidGeneratedPickupPlacements
>[number] & { readonly label: string; readonly proposalKey: string };
