import type {
  AuthoredTranscendentEmbryoOutcome,
  FigurineArcanaAddress,
  FountainRarityOutcomeAddress,
  JudgmentArcanaAddress,
  OccurrenceAddress,
  ProjectCommand,
  RoomActionAddress,
  RoomActionReference,
  ShopOfferAddress,
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
import type { WorkspaceEncounterPhase, WorkspaceRewardWheelDescriptor } from './locals';
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

export interface WorkspaceRoomActionRow {
  readonly address: import('@run-planner/engine/authored-project').RoomActionSemanticAddress;
  readonly key: string;
  readonly label: string;
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
  readonly stale: boolean;
  /** Specialized removal authority for a retained stale base Shop purchase. */
  readonly shopParticipation?: {
    readonly interactionKey: string;
    readonly owner: ShopOfferAddress;
  };
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
  /** Rush authored on this Shrine purchase action. */
  readonly hermesShrinePurchase?: {
    readonly purchaseInteractionKey: string;
    readonly rushed: boolean;
  };
  /** Refill authoring under the purchase that triggers Travel Deal. */
  readonly travelDealLine?: WorkspaceTravelDealLine;
  /** Removes a purchased refill that no Travel Deal line currently hosts. */
  readonly refillPurchaseRemoval?: WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      {
        readonly kind: 'SetHermesShrinePurchase' | 'SetStygianWellPurchase' | 'RemoveRoomAction';
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
  readonly steadyGrowth?: readonly WorkspaceSteadyGrowthControl[];
  readonly transcendentEmbryo?: readonly WorkspaceTranscendentEmbryoControl[];
}

export type WorkspaceRoomLifecycleBoundary =
  | { readonly kind: 'roomEntered'; readonly key: 'roomEntered' }
  | { readonly kind: 'encounterStart'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'bossDefeated'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'encounterEnd'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'nextPhase'; readonly key: string; readonly wheelKey: string }
  | { readonly kind: 'cleanup'; readonly key: 'cleanup' };

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
      /** Exact projected child placed at this lifecycle seam. */
      readonly supplement?:
        | { readonly kind: 'encounter'; readonly phase: WorkspaceEncounterPhase }
        | { readonly kind: 'rewardWheel'; readonly wheel: WorkspaceRewardWheelDescriptor };
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
   * `noTargetRequired` when it has and no boon can be targeted. The picker waits.
   */
  readonly pending?: 'unreached' | 'noTargetRequired';
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
  readonly owner: RoomActionAddress;
}

export interface WorkspaceFieldsCageOrderControl {
  readonly choices: readonly { readonly phaseKey: string; readonly label: string }[];
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
