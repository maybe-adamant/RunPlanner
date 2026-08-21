import {
  semanticAddressKey,
  type AcquisitionSiteAddress,
  type AcquisitionRoleAddress,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredLevelResolution,
  type AuthoredBatchState,
  type AdditionalExitAddress,
  type BiomeAddress,
  type BiomeFieldAddress,
  type EncounterPhaseAddress,
  type ExitDecisionAddress,
  type ExitDecisionSourceAddress,
  type HubDecisionAddress,
  type HubOpenSetAddress,
  type HubSlotAddress,
  type HubVisitAddress,
  type LocalVisitDecisionAddress,
  type LocalVisitOrderAddress,
  type LocalVisitSlotAddress,
  type RoomActionAddress,
  type RoomActionReference,
  type ShopOfferAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type ProjectCommand,
  type RewardWheelAddress,
  type SemanticAddress,
  type SideRoomGeneration,
  type AcquisitionEntryAddress,
  type TargetAddress,
  type TraitOfferAddress,
  type TraitAcquisitionTargetAddress,
  type CirceResolutionAddress,
  type EchoPomTargetAddress,
  type EchoLastRunBoonAddress,
  type EchoLastRewardAddress,
  type AllTogetherSetAddress,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredEchoLastRunBoonOption,
  type AuthoredCirceResolution,
  type LevelResolutionAddress,
  type BossCompletionArcanaAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type TraitOptionKey,
} from '@run-planner/engine/authored-project';
import type {
  CompletionRoomDescriptor,
  RoomDeclaration,
  TraitGiverDeclaration,
  TraitRarity,
} from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type {
  ArcanaActivationOrigin,
  CanonicalBatch,
  ProjectEvaluationAssembly,
  RunStateOwner,
  RoomActionWindow,
} from '@run-planner/engine/simulation';
import type { LevelResolutionCandidateProjection } from '../candidateProjection';

import type {
  CandidateOptionProjection,
  CandidateProjectionEvaluation,
  CandidateSessionFactory,
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '../candidateProjection';
import type { ContextualPickerModel, ContextualPickerProjectionService } from '../contextualPicker';
import type { ProjectedRewardDomain } from '../rewardDomainProjection';
import type { RewardPickerProjectionService, RewardPickerStep } from '../rewardPicker';
import type {
  TraitDomainProjectionService,
  TraitOptionDomainProjection,
} from '../traitDomainProjection';
import type { TakeoverBatchCommand } from '@planner/workspace/takeoverBatchInteraction';

/**
 * Public structured-workspace vocabulary. The projector constructs these
 * immutable products; application and React consumers import them only from
 * the `structured-workspace` entry point.
 */
export type WorkspaceAssessment = 'assessed' | 'blocked' | 'unassessed';
export type WorkspaceProjectionSource = 'authored' | 'canonical' | 'progressive';
export type WorkspaceStatus = 'blocked' | 'empty' | 'incomplete' | 'invalid' | 'valid';

/** Transient destination for an entered-room workbench. */
export type WorkspaceRoomTab =
  | 'overview'
  | 'actions'
  | 'doors'
  | 'shipIntroActions'
  | 'shipCombat1Actions'
  | 'shipCombat2Actions'
  | 'shipInactiveRepair';

export type WorkspacePayloadEditIntent<Command extends ProjectCommand> = WorkspaceCommandIntent<
  | Command
  | Extract<
      ProjectCommand,
      { readonly kind: 'EditDerivedShopEntry' | 'ReplaceAcquisitionDisposition' }
    >
>;

export interface WorkspaceMarker {
  readonly address: SemanticAddress;
  readonly assessment: WorkspaceAssessment;
  readonly findingCount: number;
  readonly focusKey: string;
}

/** A renderable inspector subject identified without rediscovering containment. */
export type WorkspaceInspectorSubject =
  | {
      readonly frontierFocusKey: string;
      readonly kind: 'frontier';
    }
  | {
      readonly kind: 'node';
      readonly nodeKey: string;
    };

export interface WorkspaceInspectorDestination {
  readonly biomeKey?: string;
  readonly focusAddress: SemanticAddress;
  readonly focusKey: string;
  /** Present for trait owners that must open the transient shared dialog. */
  readonly traitDialogTarget?: TraitOfferAddress;
  /** Present for exact Pom owners that must open the transient Pom dialog. */
  readonly levelResolutionDialogTarget?: LevelResolutionAddress;
  /**
   * Final presentation binding for an exact semantic owner. Omitted only when
   * the owning workspace has no renderable inspector subject.
   */
  readonly inspectorSubject?: WorkspaceInspectorSubject;
  /**
   * Assembly-time containing-node route. It may be a non-node marker for a
   * frontier or coarse owner; React resolves `inspectorSubject` instead.
   */
  readonly nodeKey: string;
  readonly ownerAddress: SemanticAddress;
  /** Present when this owner belongs to a specific room-workbench tab. */
  readonly roomTab?: WorkspaceRoomTab;
  readonly region: 'inspector' | 'routeRail' | 'structure';
  readonly routeKey?: string;
  /**
   * The selected rendered rail marker key for this exact focus. Absence is
   * intentional for coarse fallback owners and hidden structural sources.
   */
  readonly selectedRailKey?: string;
}

/**
 * The presentation-selected inspector subject when no semantic owner is
 * explicitly focused. This is deliberately distinct from `focusByOwner`:
 * exact owner navigation may redirect a leaf into its containing workbench,
 * while a default may be the active authoring frontier itself.
 */
export type WorkspaceDefaultInspectorDestination =
  | (Extract<WorkspaceInspectorSubject, { readonly kind: 'frontier' }> & {
      readonly selectedRailKey: string;
    })
  | (Extract<WorkspaceInspectorSubject, { readonly kind: 'node' }> & {
      /** Omitted only when the chosen structural node has no rail entry. */
      readonly selectedRailKey?: string;
    });

export interface WorkspaceInteractionChoice<T> {
  readonly label: string;
  readonly value: T;
}

export interface WorkspaceCandidateInteraction<T> {
  readonly choices: readonly WorkspaceInteractionChoice<T>[];
  readonly key: string;
  readonly load: () => readonly CandidateOptionProjection<T, CandidateProjectionEvaluation>[];
  readonly owner: SemanticAddress;
  readonly selected?: T;
}

export interface WorkspaceBatchRewardStoreInteraction extends WorkspaceCandidateInteraction<string> {
  readonly intentFor: (
    storeKey: string,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceBatchRewardStore' | 'InitializeExitDecision' }>
  >;
}

export interface WorkspaceFieldsCageOutcomeInteraction extends WorkspaceCandidateInteraction<
  'min' | 'max'
> {
  readonly intentFor: (
    cageOutcome: 'min' | 'max',
  ) => WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      { readonly kind: 'ReplaceFieldsCageOutcome' | 'InitializeExitDecision' }
    >
  >;
}

export interface WorkspaceLocalVisitGenerationInteraction extends WorkspaceCandidateInteraction<SideRoomGeneration> {
  readonly intentFor: (
    generation: SideRoomGeneration,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetLocalVisitGeneration' }>
  >;
  readonly owner: LocalVisitSlotAddress;
}

export interface WorkspaceLocalVisitOrderInteraction extends WorkspaceCandidateInteraction<
  readonly OccurrenceId[]
> {
  readonly intentFor: (
    occurrenceIds: readonly OccurrenceId[],
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceLocalVisitOrder' }>>;
  readonly owner: LocalVisitOrderAddress;
}

/**
 * One exact, pool-backed encounter phase. The interaction owns the complete
 * semantic mutation because the phase address—not a rendered ordinal or room
 * name—identifies the persisted selection.
 */
export interface WorkspaceEncounterInteraction {
  readonly intentFor: (
    encounterKey: string,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'SelectEncounter' }>>;
  readonly key: string;
  /**
   * The one lazy candidate contact returns the application-owned contextual
   * picker model rather than exposing raw encounter evidence to React.
   */
  readonly load: () => ContextualPickerModel<string>;
  readonly owner: EncounterPhaseAddress;
  readonly resetIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ResetEncounter' }>
  >;
  readonly selected: string;
}

/** Phase-local Fig Leaf choice; eligibility is supplied by the engine. */
export interface WorkspaceFigLeafInteraction {
  readonly intentFor: (
    value: boolean,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceFigLeafSkip' }>>;
  readonly key: string;
  readonly owner: EncounterPhaseAddress;
  readonly selected: boolean;
  readonly supported: boolean;
}

export interface WorkspaceGorgonConditionInteraction {
  readonly intentFor: (
    value: boolean,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceGorgonDeathDefianceCondition' }>
  >;
  readonly key: string;
  readonly owner: EncounterPhaseAddress;
  readonly selected: boolean;
  readonly supported: boolean;
}

export interface WorkspaceRewardInteraction {
  readonly authoredRewardTypes: readonly string[];
  readonly intentFor: (offer: ResolvedRewardOffer) => WorkspaceRewardCommandIntent;
  readonly key: string;
  readonly owner: RewardCandidateOwner['address'];
  readonly choiceLabel: (step: RewardPickerStep, offer?: ResolvedRewardOffer) => string;
  readonly load: () => Promise<ProjectedRewardDomain>;
  readonly model: (
    domain: ProjectedRewardDomain,
    step: RewardPickerStep,
    selected?: ResolvedRewardOffer,
  ) => ContextualPickerModel<ResolvedRewardOffer>;
  readonly selected: ResolvedRewardOffer | null;
  readonly summary: (offer: ResolvedRewardOffer) => string;
}

/** One exact authored trait child beneath a reward owner. */
export interface WorkspaceTraitOfferControl {
  /** Player-facing acquisition role (for example, Chosen God or Spurned God). */
  readonly acquisitionRoleLabel: string;
  readonly address: TraitOfferAddress;
  readonly giver: TraitGiverDeclaration;
  readonly marker: WorkspaceMarker;
  readonly offer: AuthoredTraitOffer | null;
  /** False for a declaration/chronology-resolved rarity such as Gorgon Athena. */
  readonly rarityEditable?: boolean;
  readonly rewardOwner: SemanticAddress;
  /** Present only for this offer's currently selected targeted acquisition. */
  readonly traitAcquisitionTarget?: WorkspaceTraitAcquisitionTargetControl;
  /** Present only for this offer's currently selected Circe special option. */
  readonly circeResolution?: WorkspaceCirceResolutionControl;
  /** Present only for the currently selected Echo Pom row. */
  readonly echoPomTarget?: WorkspaceEchoPomTargetControl;
  readonly echoLastRunBoon?: WorkspaceEchoLastRunBoonControl;
  readonly echoLastReward?: WorkspaceEchoLastRewardControl;
  readonly allTogetherSets?: readonly WorkspaceAllTogetherSetControl[];
  readonly deathDefianceCondition?: {
    readonly value: boolean;
  };
}

/** One exact Time Piece choice, independent of whether this role has a trait child. */
export interface WorkspaceAcquisitionConversionControl {
  readonly acquisitionRoleLabel: string;
  readonly address: AcquisitionRoleAddress;
  readonly marker: WorkspaceMarker;
  readonly rewardOwner: SemanticAddress;
  readonly value: import('@run-planner/engine/authored-project').AcquisitionDisposition;
}

/** Exact selected Circe outcome owner; its domain is supplied by the candidate session. */
export interface WorkspaceCirceResolutionControl {
  readonly address: CirceResolutionAddress;
  readonly marker: WorkspaceMarker;
  readonly optionKey: TraitOptionKey;
  readonly value?: AuthoredCirceResolution;
}

export interface WorkspaceTraitAcquisitionTargetControl {
  readonly address: TraitAcquisitionTargetAddress;
  readonly marker: WorkspaceMarker;
  readonly optionKey: TraitOptionKey;
  readonly value?: string | null;
}

export interface WorkspaceEchoPomTargetControl {
  readonly address: EchoPomTargetAddress;
  readonly marker: WorkspaceMarker;
  readonly optionKey: TraitOptionKey;
  readonly value?: string | null;
}

export interface WorkspaceEchoLastRunBoonControl {
  readonly address: EchoLastRunBoonAddress;
  readonly marker: WorkspaceMarker;
  readonly optionKey: TraitOptionKey;
  readonly value?: AuthoredEchoLastRunBoonOffer;
}

export interface WorkspaceEchoLastRewardControl {
  readonly address: EchoLastRewardAddress;
  readonly acquisitionEntry: AcquisitionEntryAddress;
  readonly marker: WorkspaceMarker;
  readonly optionKey: TraitOptionKey;
  readonly spawnLabel?: string;
}

export interface WorkspaceAllTogetherSetControl {
  readonly address: AllTogetherSetAddress;
  readonly marker: WorkspaceMarker;
  readonly optionKey: TraitOptionKey;
  readonly setKey: import('@run-planner/engine/catalog-schema').DirectTraitSetKey;
  readonly value?: string | null;
  readonly valueLabel?: string;
}

/** One exact declaration-owned Pom child beneath an active reward owner. */
export interface WorkspaceLevelResolutionControl {
  readonly acquisitionRoleLabel: string;
  readonly address: LevelResolutionAddress;
  readonly levelCount: number;
  readonly settledEmptyNoOp: boolean;
  readonly marker: WorkspaceMarker;
  readonly rewardOwner: SemanticAddress;
  readonly value: AuthoredLevelResolution;
}

/** One lazy focused-option domain bound to a complete local trait-offer draft. */
export interface WorkspaceTraitOptionDomainInteraction {
  /** Whether this exact selected option owns a downstream acquisition-target step. */
  readonly hasTargetPicker: boolean;
  readonly traitAcquisitionTarget?: WorkspaceTraitAcquisitionTargetControl;
  readonly load: () => TraitOptionDomainProjection | Promise<TraitOptionDomainProjection>;
  /** Candidate-backed exact outcome editor for a selected Circe option only. */
  readonly circeResolution?: WorkspaceCirceResolutionInteraction;
  readonly echoPomTarget?: WorkspaceEchoPomTargetInteraction;
  readonly echoLastRunBoon?: WorkspaceEchoLastRunBoonInteraction;
  readonly allTogetherSets?: readonly WorkspaceAllTogetherSetInteraction[];
}

export interface WorkspaceAllTogetherSetDomain {
  readonly picker: ContextualPickerModel<string | null>;
}

export interface WorkspaceAllTogetherSetInteraction {
  readonly control: WorkspaceAllTogetherSetControl;
  readonly forOffer: (offer: AuthoredTraitOfferTraits) => {
    readonly load: () => WorkspaceAllTogetherSetDomain | undefined;
  };
}

export interface WorkspaceCirceResolutionDomain {
  readonly arcanaPicker: ContextualPickerModel<string>;
  readonly arcanaPickerFor: (selectedKeys: readonly string[]) => ContextualPickerModel<string>;
  readonly branchAgreement: boolean;
  readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear';
  readonly outerAvailable: boolean;
  readonly requiredCount: number;
  readonly vowPicker: ContextualPickerModel<string>;
}

export interface WorkspaceCirceResolutionInteraction {
  readonly control: WorkspaceCirceResolutionControl;
  readonly intentFor: (
    offer: AuthoredTraitOfferTraits,
    resolution: AuthoredCirceResolution,
  ) => WorkspacePayloadEditIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceTraitOffer' }>>;
  /** Binds the current draft before handing its loader to the sole React adapter. */
  readonly forOffer: (offer: AuthoredTraitOfferTraits) => {
    readonly load: () => WorkspaceCirceResolutionDomain | undefined;
  };
}

export interface WorkspaceEchoPomTargetDomain {
  readonly emptyNoOpAllowed: boolean;
  readonly picker: ContextualPickerModel<string | null>;
}

export interface WorkspaceEchoPomTargetInteraction {
  readonly control: WorkspaceEchoPomTargetControl;
  readonly intentFor: (
    offer: AuthoredTraitOfferTraits,
    targetTraitKey: string | null,
  ) => WorkspacePayloadEditIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceTraitOffer' }>>;
  readonly forOffer: (offer: AuthoredTraitOfferTraits) => {
    readonly load: () => WorkspaceEchoPomTargetDomain | undefined;
  };
}

export interface WorkspaceEchoLastRunBoonTraitIdentity {
  readonly giverKey: string;
  readonly traitKey: string;
}

export interface WorkspaceEchoLastRunBoonDraftRow {
  readonly identity?: WorkspaceEchoLastRunBoonTraitIdentity;
  readonly rarity?: TraitRarity;
  readonly targetTraitKey?: string;
}

export interface WorkspaceEchoLastRunBoonDraftSupport {
  readonly rowSupport: readonly boolean[];
  readonly selectedTargetSupported: boolean;
  readonly complete: boolean;
  readonly remainingTraitIdentities: readonly WorkspaceEchoLastRunBoonTraitIdentity[];
  readonly canAppend: boolean;
}

export interface WorkspaceEchoLastRunBoonDomain {
  readonly draftSupportFor: (
    rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
    selectedIndex: number,
  ) => WorkspaceEchoLastRunBoonDraftSupport;
  readonly effectiveRarityFor: (option: AuthoredEchoLastRunBoonOption) => TraitRarity | undefined;
  readonly labelFor: (identity: WorkspaceEchoLastRunBoonTraitIdentity) => string;
  readonly summaryFor: (value: AuthoredEchoLastRunBoonOffer) => string;
  readonly rarityPickerFor: (
    identity: WorkspaceEchoLastRunBoonTraitIdentity,
    selected?: TraitRarity,
  ) => ContextualPickerModel<TraitRarity>;
  readonly targetPickerFor: (
    option: AuthoredEchoLastRunBoonOption,
  ) => ContextualPickerModel<string>;
  readonly targetRequiredFor: (identity: WorkspaceEchoLastRunBoonTraitIdentity) => boolean;
  /** Engine-owned trait distinctness for one transient compound-draft row. */
  readonly traitPickerFor: (
    occupiedTraitKeys: readonly string[],
    selected?: WorkspaceEchoLastRunBoonTraitIdentity,
  ) => ContextualPickerModel<WorkspaceEchoLastRunBoonTraitIdentity>;
}

export interface WorkspaceEchoLastRunBoonInteraction {
  readonly control: WorkspaceEchoLastRunBoonControl;
  readonly intentFor: (
    offer: AuthoredTraitOfferTraits,
    value: AuthoredEchoLastRunBoonOffer,
  ) => WorkspacePayloadEditIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceTraitOffer' }>>;
  readonly forOffer: (offer: AuthoredTraitOfferTraits) => {
    readonly load: () => WorkspaceEchoLastRunBoonDomain | undefined;
  };
}

export interface WorkspaceTraitOfferInteraction {
  readonly acquisitionRoleLabel: string;
  readonly choices: readonly WorkspaceInteractionChoice<string>[];
  /** Read-only summary of the generated pickup owned by the Room Timeline. */
  readonly echoLastReward?: WorkspaceEchoLastRewardControl;
  readonly giver: TraitGiverDeclaration;
  readonly intentFor: (value: AuthoredTraitOffer) => WorkspacePayloadEditIntent<
    Extract<
      ProjectCommand,
      {
        readonly kind:
          'ReplaceTraitOffer' | 'ReplaceGorgonAthenaOffer' | 'ReplaceAcquisitionDisposition';
      }
    >
  >;
  readonly key: string;
  readonly load: (
    value?: AuthoredTraitOffer,
  ) => readonly CandidateOptionProjection<AuthoredTraitOffer>[];
  readonly owner: TraitOfferAddress;
  readonly rarityEditable: boolean;
  /** Declaration-backed editability for the currently selected trait's rarity. */
  readonly rarityEditableFor: (traitKey: string) => boolean;
  readonly resetIntent?: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ResetEncounterTraitOffer' }>
  >;
  readonly optionDomain: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => WorkspaceTraitOptionDomainInteraction;
  /** Application-owned labels for trait keys carried by engine evidence. */
  readonly traitLabel: (traitKey: string) => string;
  readonly selectedIntent: (
    selectedOptionKey: AuthoredTraitOfferTraits['selectedOptionKey'],
  ) => WorkspacePayloadEditIntent<
    Extract<
      ProjectCommand,
      { readonly kind: 'ReplaceTraitSelection' | 'ReplaceAcquisitionDisposition' }
    >
  >;
  readonly value: AuthoredTraitOffer | null;
  /** Exact engine-backed traits draft for returning from Fallback Gold. */
  readonly traitsStartingDraft?: () => AuthoredTraitOfferTraits | undefined;
  readonly nextOptionalHighTierDraft?: (
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly previousOptionalHighTierDraft?: (
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly deathDefianceCondition?: {
    readonly value: boolean;
  };
}

export interface WorkspaceLevelResolutionInteraction {
  readonly acquisitionRoleLabel: string;
  readonly intentFor: (
    value: AuthoredLevelResolution,
  ) => WorkspacePayloadEditIntent<
    Extract<
      ProjectCommand,
      { readonly kind: 'ReplaceLevelResolution' | 'ReplaceAcquisitionDisposition' }
    >
  >;
  readonly key: string;
  /** Declaration-owned increment displayed beside the exact Pom control. */
  readonly levelCount?: number;
  readonly load: (
    value?: AuthoredLevelResolution,
  ) => LevelResolutionCandidateProjection | undefined;
  readonly owner: LevelResolutionAddress;
  readonly traitLabel: (traitKey: string) => string;
  readonly value: AuthoredLevelResolution;
}

/** Atomic exact-set authoring at one reached Boss completion. */
export interface WorkspaceBossCompletionArcanaInteraction {
  readonly choices: readonly WorkspaceInteractionChoice<string>[];
  readonly intentFor: (
    arcanaKeys: readonly string[],
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceBossCompletionArcana' }>
  >;
  readonly key: string;
  readonly load: (arcanaKeys?: readonly string[]) => CandidateProjectionEvaluation;
  readonly owner: BossCompletionArcanaAddress;
  readonly value: readonly string[];
}

/** One exact route-start or Postboss rack selection, with engine-backed option support. */
export interface WorkspaceKeepsakeSelectionInteraction {
  readonly choices: readonly WorkspaceInteractionChoice<string>[];
  readonly key: string;
  readonly load: () => readonly CandidateOptionProjection<string, CandidateProjectionEvaluation>[];
  readonly owner: KeepsakeSelectionAddress;
  readonly value:
    | { readonly kind: 'retain' }
    | { readonly kind: 'replace'; readonly keepsakeKey: string }
    | string;
  readonly replaceIntent: (
    keepsakeKey: string,
  ) => WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      { readonly kind: 'ReplaceStartingKeepsake' | 'ReplacePostbossKeepsake' }
    >
  >;
  readonly retainIntent?: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplacePostbossKeepsake' }>
  >;
}

/** Closed immediate acquisitions beneath their exact rack selection. */
export type WorkspaceKeepsakeEquipResultInteraction =
  WorkspaceJeweledPomEquipResultInteraction | WorkspaceExperimentalHammerEquipResultInteraction;

export interface WorkspaceJeweledPomEquipResultInteraction {
  readonly choices: readonly WorkspaceInteractionChoice<string>[];
  readonly key: string;
  readonly owner: KeepsakeEquipResultAddress & { readonly resultKind: 'jeweledPom' };
  readonly value?: import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['jeweledPom'];
  readonly supportsDeathDefianceCondition: boolean;
  readonly load: (
    value?: import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['jeweledPom'],
  ) => readonly CandidateOptionProjection<string>[];
  readonly intentFor: (
    value: NonNullable<
      import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['jeweledPom']
    >,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceJeweledPomEquipResult' }>
  >;
}

export interface WorkspaceExperimentalHammerEquipResultInteraction {
  readonly choices: readonly WorkspaceInteractionChoice<string>[];
  readonly key: string;
  readonly owner: KeepsakeEquipResultAddress & { readonly resultKind: 'experimentalHammer' };
  readonly value?: import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['experimentalHammer'];
  readonly load: (
    value?: import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['experimentalHammer'],
  ) => readonly CandidateOptionProjection<string>[];
  readonly intentFor: (
    value: NonNullable<
      import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['experimentalHammer']
    >,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceExperimentalHammerEquipResult' }>
  >;
}

interface WorkspaceRoomInteractionBase {
  readonly choices: readonly {
    readonly category: string;
    readonly gameName: string;
    readonly label: string;
  }[];
  readonly key: string;
  readonly owner: TargetAddress | OccurrenceAddress;
  readonly load: () => ContextualPickerModel<RoomDeclaration>;
  readonly selected?: RoomDeclaration;
}

export type WorkspaceRoomInteraction =
  | (WorkspaceRoomInteractionBase & {
      readonly kind: 'startRoom';
      readonly owner: OccurrenceAddress;
    })
  | (WorkspaceRoomInteractionBase & {
      /**
       * Door 1 of an authored empty generated decision can author either its
       * ordinary target or the decision-owned atomic takeover batch. The
       * visible control remains target-addressed; the takeover evidence and
       * bound mutation retain the exact decision owner.
       */
      readonly decisionOwner: ExitDecisionAddress;
      readonly intentFor: (gameName: string) => WorkspaceDecisionEntryRoomCommandIntent;
      readonly kind: 'decisionEntryRoom';
      readonly owner: TargetAddress;
    })
  | (WorkspaceRoomInteractionBase & {
      readonly intentFor: (gameName: string) => WorkspaceTargetRoomCommandIntent;
      readonly kind: 'targetRoom';
      readonly owner: TargetAddress;
    });

/** One complete authored command plus navigation behavior owned by its interaction. */
export interface WorkspaceCommandIntent<Command extends ProjectCommand = ProjectCommand> {
  readonly command: Command;
  readonly focus?: {
    readonly owner: SemanticAddress;
    readonly timing: 'after' | 'before';
  };
}

type WorkspaceCreateStartIntent = WorkspaceCommandIntent<
  Extract<ProjectCommand, { readonly kind: 'CreateStart' }>
>;

type WorkspaceRewardCommandIntent = WorkspaceCommandIntent<
  Extract<
    ProjectCommand,
    {
      readonly kind:
        | 'ReplaceIncomingReward'
        | 'ReplaceLocalReward'
        | 'ReplaceRewardWheelOffer'
        | 'ReplaceShopOffer'
        | 'ReplaceAcquisitionEntryOffer'
        | 'ReplaceAcquisitionDisposition'
        | 'EditDerivedShopEntry';
    }
  >
>;

type WorkspaceTargetRoomCommandIntent = WorkspaceCommandIntent<
  Extract<ProjectCommand, { readonly kind: 'CreateTarget' | 'ReplaceOccurrenceRoom' }>
>;

type WorkspaceDecisionEntryRoomCommandIntent = WorkspaceCommandIntent<
  Extract<
    ProjectCommand,
    {
      readonly kind:
        | 'CreateTarget'
        | 'ReplaceWithTakeoverBatch'
        | 'InitializeExitDecision'
        | 'CreateTakeoverBatch'
        | 'ReplaceWithHubDecision';
    }
  >
>;

/** A start remains an authored action even when its declaration fixes the room. */
export type WorkspaceStartInteraction =
  | {
      readonly fixedLabel: string;
      readonly intent: () => WorkspaceCreateStartIntent;
      readonly key: string;
      readonly kind: 'fixed';
      readonly load: () => ContextualPickerModel<RoomDeclaration>;
      readonly owner: BiomeAddress;
    }
  | {
      readonly key: string;
      readonly kind: 'choice';
      readonly intentFor: (room: RoomDeclaration) => WorkspaceCreateStartIntent;
      readonly load: () => ContextualPickerModel<RoomDeclaration>;
      readonly owner: BiomeAddress;
    };

export interface WorkspaceTopologyRemovalInteraction {
  readonly intent: WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      { readonly kind: 'ClearTopology' | 'RemoveExitDecision' | 'RemoveHubDecision' }
    >
  >;
  readonly key: string;
  readonly owner: BiomeAddress | ExitDecisionAddress | HubDecisionAddress;
}

/** A visible stage can carry removal for its hidden source decision. */
export interface WorkspaceStageDecisionRemoval {
  readonly interactionKey: string;
  readonly label: string;
}

export interface WorkspaceExitSelectionInteraction {
  readonly key: string;
  readonly owner: ExitDecisionAddress;
  readonly selectedExitKey?: string;
  readonly targets: readonly WorkspaceInteractionChoice<string>[];
}

/** One explicitly activated opening attempt owns its provisional occurrence identity. */
export interface WorkspaceHubSlotOpeningAttempt extends WorkspaceCandidateInteraction<boolean> {
  readonly intentFor: (
    open: true,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'OpenHubSlot' }>>;
}

export interface WorkspaceHubSlotCloseInteraction extends WorkspaceCandidateInteraction<boolean> {
  readonly intentFor: (
    open: false,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'CloseHubSlot' }>>;
}

export type WorkspaceHubSlotInteraction =
  | {
      readonly beginOpeningAttempt: () => WorkspaceHubSlotOpeningAttempt;
      readonly key: string;
      readonly owner: HubSlotAddress;
      readonly selected: false;
    }
  | {
      readonly close?: WorkspaceHubSlotCloseInteraction;
      readonly key: string;
      readonly owner: HubSlotAddress;
      readonly selected: true;
    };

/** One lazily-evaluated complete Hub traversal proposal. */
export interface WorkspaceHubVisitOrderProposal extends WorkspaceCandidateInteraction<
  readonly string[]
> {
  readonly intent: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceHubVisitOrder' }>
  >;
}

/**
 * The Hub decision owns one aggregate traversal interaction. Room cards may
 * request a complete proposed prefix, but individual rendered positions never
 * become command owners.
 */
export interface WorkspaceHubVisitOrderInteraction {
  readonly key: string;
  readonly owner: HubDecisionAddress;
  readonly proposalFor: (hubSlotKeys: readonly string[]) => WorkspaceHubVisitOrderProposal;
  readonly selectedHubSlotKeys: readonly string[];
}

interface WorkspaceTakeoverBatchInteractionBase {
  readonly key: string;
  readonly owner: ExitDecisionAddress;
}

export interface WorkspaceCompletedHubHandoffInteraction extends WorkspaceTakeoverBatchInteractionBase {
  readonly action: 'create';
  readonly intent: () => WorkspaceTakeoverCommandIntent;
  readonly label: string;
  readonly presentation: 'completedHubHandoff';
}

export interface WorkspaceTakeoverRepairInteraction extends WorkspaceTakeoverBatchInteractionBase {
  readonly action: 'reconcile';
  readonly intent: () => WorkspaceTakeoverCommandIntent;
  readonly label: string;
  readonly presentation: 'repair';
}

export type WorkspaceTakeoverBatchInteraction =
  WorkspaceCompletedHubHandoffInteraction | WorkspaceTakeoverRepairInteraction;

type WorkspaceTakeoverCommandIntent = WorkspaceCommandIntent<TakeoverBatchCommand>;

export interface WorkspaceInteractionCatalog {
  readonly naturalChaosExits: ReadonlyMap<string, WorkspaceNaturalChaosExitInteraction>;
  readonly naturalChaosSpawns: ReadonlyMap<string, WorkspaceNaturalChaosSpawnInteraction>;
  readonly zagreusContracts: ReadonlyMap<string, WorkspaceZagreusContractInteraction>;
  readonly zagreusSpawns: ReadonlyMap<string, WorkspaceZagreusSpawnInteraction>;
  readonly batchRewardStores: ReadonlyMap<string, WorkspaceBatchRewardStoreInteraction>;
  readonly encounterPhases: ReadonlyMap<string, WorkspaceEncounterInteraction>;
  readonly figLeafSkips: ReadonlyMap<string, WorkspaceFigLeafInteraction>;
  readonly gorgonConditions: ReadonlyMap<string, WorkspaceGorgonConditionInteraction>;
  readonly exitSelections: ReadonlyMap<string, WorkspaceExitSelectionInteraction>;
  readonly fieldsCageOutcomes: ReadonlyMap<string, WorkspaceFieldsCageOutcomeInteraction>;
  readonly roomActions: ReadonlyMap<string, WorkspaceRoomActionInteraction>;
  readonly hubSlots: ReadonlyMap<string, WorkspaceHubSlotInteraction>;
  readonly hubVisitOrders: ReadonlyMap<string, WorkspaceHubVisitOrderInteraction>;
  readonly rewards: ReadonlyMap<string, WorkspaceRewardInteraction>;
  readonly acquisitionConversions: ReadonlyMap<string, WorkspaceAcquisitionConversionInteraction>;
  readonly traitOffers: ReadonlyMap<string, WorkspaceTraitOfferInteraction>;
  readonly levelResolutions: ReadonlyMap<string, WorkspaceLevelResolutionInteraction>;
  readonly bossCompletionArcana: ReadonlyMap<string, WorkspaceBossCompletionArcanaInteraction>;
  readonly keepsakeSelections: ReadonlyMap<string, WorkspaceKeepsakeSelectionInteraction>;
  readonly keepsakeEquipResults: ReadonlyMap<string, WorkspaceKeepsakeEquipResultInteraction>;
  readonly rewardWheelOfferCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelPicks: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly rooms: ReadonlyMap<string, WorkspaceRoomInteraction>;
  /** O-specific authored structure: whether the optional third Ship phase is active. */
  readonly shipCombatPhaseCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<2 | 3>>;
  readonly shopDeathDefianceConditions: ReadonlyMap<
    string,
    WorkspaceShopDeathDefianceConditionInteraction
  >;
  readonly shopPurchaseParticipations: ReadonlyMap<
    string,
    WorkspaceShopPurchaseParticipationInteraction
  >;
  readonly localVisitOrders: ReadonlyMap<string, WorkspaceLocalVisitOrderInteraction>;
  readonly localVisitGenerations: ReadonlyMap<string, WorkspaceLocalVisitGenerationInteraction>;
  readonly starts: ReadonlyMap<string, WorkspaceStartInteraction>;
  readonly takeoverBatches: ReadonlyMap<string, WorkspaceTakeoverBatchInteraction>;
  readonly topologyRemovals: ReadonlyMap<string, WorkspaceTopologyRemovalInteraction>;
}

export interface WorkspaceAcquisitionConversionInteraction {
  readonly visible: boolean;
  /** Gold is enabled only when every reached engine branch supports it. */
  readonly timePieceSupported: boolean;
  readonly artificerSupported: boolean;
  readonly intentFor: (
    value: import('@run-planner/engine/authored-project').AcquisitionDisposition,
  ) => WorkspacePayloadEditIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
  >;
  readonly key: string;
  readonly owner: AcquisitionRoleAddress;
  readonly value: import('@run-planner/engine/authored-project').AcquisitionDisposition;
}

export interface WorkspaceShopDeathDefianceConditionInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly value: boolean;
  readonly intentFor: (
    value: boolean,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceShopDeathDefianceCondition' }>
  >;
}

export interface WorkspaceShopPurchaseParticipationInteraction {
  readonly key: string;
  readonly owner: ShopOfferAddress;
  readonly purchased: boolean;
  readonly intentFor: (
    purchased: boolean,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceShopPurchaseParticipation' }>
  >;
}

/** The Midshop workbench presents the declared additional door without making it a normal target. */
export interface WorkspaceZagreusContractInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly removeIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'RemoveZagreusContract' }>
  >;
  readonly selectIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetExitSelection' }>
  >;
}

/** Source-room availability binds only the creation command. */
export interface WorkspaceZagreusSpawnInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly spawnIntent: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'AddZagreusContract' }>
  >;
}

/** A natural Chaos gate is authored at its source and selected at its outgoing decision. */
export interface WorkspaceNaturalChaosExitInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly mapIntent: (
    gameName: string,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceNaturalChaosMap' }>>;
  readonly removeIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'RemoveNaturalChaos' }>
  >;
  readonly selectIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetExitSelection' }>
  >;
}

/** Availability belongs to the active source room; the authored gate remains occurrence-owned. */
export interface WorkspaceNaturalChaosSpawnInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly spawnIntent: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'AddNaturalChaos' }>
  >;
}

export class StructuredWorkspaceProjectionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'StructuredWorkspaceProjectionContractError';
  }
}

export function workspaceInteractionKey(owner: SemanticAddress): string {
  return semanticAddressKey(owner);
}

export function workspaceLocalVisitOrderKey(owner: LocalVisitSlotAddress): string {
  return `${semanticAddressKey(owner)}:visit-order`;
}

export function requireWorkspaceInteraction<T>(
  interactions: ReadonlyMap<string, T>,
  key: string,
): T {
  const interaction = interactions.get(key);
  if (interaction === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`interaction ${key} is missing`);
  }
  return interaction;
}

export type WorkspaceRoomPickerControl =
  | {
      readonly address: TargetAddress;
      readonly kind: 'targetRoomPicker';
      readonly target:
        | {
            readonly kind: 'existing';
            readonly occurrence: OccurrenceAddress;
            readonly selectedGameName: string;
          }
        | { readonly kind: 'missing' };
    }
  | {
      /**
       * The first physical target remains the visible, marker-owning control,
       * while takeover candidates and commands retain their decision owner.
       */
      readonly address: TargetAddress;
      readonly decisionOwner: ExitDecisionAddress;
      readonly kind: 'decisionEntryRoomPicker';
      /**
       * The decision assembly, rather than candidate availability, owns whether
       * an ordinary first target is locally ready to mutate.
       */
      readonly ordinaryTargetAuthoring: WorkspaceMissingTargetAuthoring;
      readonly persistence: 'authored' | 'uncommitted';
      /**
       * The engine-owned static `CreateTarget` domain for this exact target.
       * It remains independent of evaluated candidate reachability, so an
       * incomplete retained prefix can be editable without allowing a room
       * beyond a terminal or staged progression bound.
       */
      readonly ordinaryTargetGameNames: readonly string[];
      /** The declaration-owned terminal Hub candidate, when this is the bounded N frontier. */
      readonly hub?: {
        readonly decision: import('@run-planner/engine/authored-project').HubDecisionAddress;
        readonly gameName: string;
      };
      readonly takeoverGameNames: readonly string[];
    }
  | {
      readonly address: OccurrenceAddress;
      readonly candidateGameNames: readonly string[];
      readonly kind: 'startRoomPicker';
      readonly selectedGameName: string;
    };

interface WorkspaceRewardControlBase {
  /** Evaluated automatic outcome for this exact reward acquisition. */
  readonly acquisitionOutcome?: 'forfeitedByVow';
  /** Direct payload authoring for a declaration-fixed type whose payload remains unresolved. */
  readonly authoringStartStep?: Exclude<RewardPickerStep, 'type' | 'spurned'>;
  /** Transient factual type seed for that unresolved payload; never persisted independently. */
  readonly authoringSeed?: ResolvedRewardOffer;
  readonly marker: WorkspaceMarker;
  readonly offer: ResolvedRewardOffer | null;
  /** Application-owned picker entry point for this exact visible edit surface. */
  readonly offerEditStartStep?: RewardPickerStep;
  /** Application-owned presentation fact; React does not infer identity authoring from offer shape. */
  readonly offerEditVisibility: 'hidden' | 'visible';
  /** Engine-attested retained identity disagreement requiring a visible repair path. */
  readonly retainedSourceMismatch: boolean;
  readonly owner: RewardCandidateOwner;
  readonly traitOffers?: readonly WorkspaceTraitOfferControl[];
  readonly levelResolutions?: readonly WorkspaceLevelResolutionControl[];
  readonly conversions?: readonly WorkspaceAcquisitionConversionControl[];
  readonly derivedShopEntryEdit?: {
    readonly site: AcquisitionSiteAddress;
    readonly entryKey: 'travelDealRefill' | 'echoDoubleShopReward';
    readonly sourceOfferKey: string;
  };
}

export interface WorkspaceCountedRewardControl extends WorkspaceRewardControlBase {
  readonly binding: CountedRewardBinding;
  readonly kind: 'countedReward';
  readonly owner: CountedRewardCandidateOwner;
}

export interface WorkspaceExplicitRewardControl extends WorkspaceRewardControlBase {
  readonly kind: 'explicitReward';
  readonly rewardTypes: readonly string[];
}

export type WorkspaceRewardControl = WorkspaceCountedRewardControl | WorkspaceExplicitRewardControl;

export interface WorkspaceFieldsCageDescriptor {
  readonly control: WorkspaceCountedRewardControl;
  readonly key: string;
  readonly label: string;
  readonly summary: string;
}

export interface WorkspaceFieldsOptionalRewardDescriptor {
  readonly control: WorkspaceCountedRewardControl;
  readonly key: string;
  readonly label: string;
}

export interface WorkspaceRoomActionProposal {
  readonly kind: 'insert' | 'move' | 'remove';
  readonly key: string;
  readonly label: string;
  readonly reference: RoomActionReference;
  readonly structurallyAuthorable: boolean;
  readonly toIndex?: number;
}

export interface WorkspaceRoomActionRow {
  readonly address: RoomActionAddress;
  /** Engine-owned dependency/window evidence adapted into concise row copy. */
  readonly issues: readonly string[];
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly proposalKeys: readonly string[];
  readonly reference: RoomActionReference;
  readonly participation: 'required' | 'optional';
  readonly rank: number | null;
  /** Exact action-owned reward payload, never rediscovered from a rendered key. */
  readonly rewardPayload?: {
    readonly control: WorkspaceRewardControl;
    readonly showOffer: boolean;
  };
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
  /** Exact wheel whose picked offer is chosen by this action. */
  readonly wheelPick?: RewardWheelAddress;
  readonly executable: boolean;
}

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
  /** Retained stale/unranked rows rendered once outside active lifecycle order. */
  readonly repairRows: readonly WorkspaceRoomActionRow[];
}

export type WorkspaceRoomLifecycleBoundary =
  | { readonly kind: 'roomEntered'; readonly key: 'roomEntered' }
  | { readonly kind: 'encounterStart'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'encounterEnd'; readonly key: string; readonly phaseKey: string }
  | { readonly kind: 'nextPhase'; readonly key: string; readonly wheelKey: string }
  | { readonly kind: 'outgoingGeneration'; readonly key: 'outgoingGeneration' }
  | { readonly kind: 'cleanup'; readonly key: 'cleanup' };

export type WorkspaceRoomLifecycleTimelineEntry =
  | {
      readonly kind: 'boundary';
      readonly boundary: WorkspaceRoomLifecycleBoundary;
      readonly rank: number;
      readonly placement: 'before' | 'after';
      readonly runState?: WorkspaceRunStateLauncher;
    }
  | {
      readonly kind: 'action';
      readonly actionKey: string;
      readonly rank: number;
      /** Engine-owned phase grouping for multi-encounter room workbenches. */
      readonly phaseKey?: string;
    };

export interface WorkspaceRoomLifecycleTimeline {
  readonly entries: readonly WorkspaceRoomLifecycleTimelineEntry[];
  readonly boundaries: readonly WorkspaceRoomLifecycleBoundary[];
}

export interface WorkspaceRoomActionInteraction {
  readonly intentFor: (
    proposalKey: string,
  ) => WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      { readonly kind: 'InsertRoomAction' | 'RemoveRoomAction' | 'MoveRoomAction' }
    >
  >;
  readonly key: string;
  readonly owner: OccurrenceAddress;
  readonly proposals: readonly WorkspaceRoomActionProposal[];
}

export interface WorkspaceRewardWheelOfferDescriptor {
  readonly active: boolean;
  readonly control: WorkspaceCountedRewardControl;
  readonly key: string;
  readonly label: string;
}

export interface WorkspaceRewardWheelDescriptor {
  readonly active: boolean;
  readonly address: RewardWheelAddress;
  /** Declaration-owned combat phase whose completion settles this wheel. */
  readonly encounterPhaseKey: string;
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly offerCount: number;
  readonly offers: readonly WorkspaceRewardWheelOfferDescriptor[];
  readonly pickedOfferIndex: number;
  readonly storeKey: string;
}

export interface WorkspaceShopPurchaseDescriptor {
  readonly address: AcquisitionEntryAddress;
  readonly marker: WorkspaceMarker;
}

export interface WorkspaceShopOfferDescriptor {
  readonly key: string;
  readonly label: string;
  readonly purchase: WorkspaceShopPurchaseDescriptor;
  readonly participation: {
    readonly interactionKey: string;
    readonly owner: ShopOfferAddress;
    readonly purchased: boolean;
  };
  readonly rewardControl: WorkspaceExplicitRewardControl;
}

export type WorkspaceShopSupplementalDescriptor =
  | {
      readonly kind: 'travelDealPlaceholder' | 'echoDoubleShopPlaceholder';
      readonly key: 'travelDealRefill' | 'echoDoubleShopReward';
      readonly label: string;
      readonly explanation: string;
    }
  | {
      readonly kind: 'travelDealInvalid' | 'echoDoubleShopInvalid';
      readonly key: 'travelDealRefill' | 'echoDoubleShopReward';
      readonly label: string;
      readonly explanation: string;
      readonly purchase: WorkspaceShopPurchaseDescriptor;
    }
  | {
      readonly kind: 'infernalContractReward';
      readonly key: string;
      readonly label: string;
      readonly purchase: WorkspaceShopPurchaseDescriptor;
      readonly rewardControl: WorkspaceExplicitRewardControl;
      readonly materialized: boolean;
    }
  | {
      readonly kind: 'travelDealRefill';
      readonly key: string;
      readonly label: string;
      readonly purchase: WorkspaceShopPurchaseDescriptor;
      readonly rewardControl: WorkspaceExplicitRewardControl;
      readonly materialized: boolean;
      readonly sourceOfferKey: string;
    }
  | {
      readonly kind: 'echoDoubleShopReward';
      readonly key: 'echoDoubleShopReward';
      readonly label: string;
      readonly purchase: WorkspaceShopPurchaseDescriptor;
      readonly rewardControl: WorkspaceExplicitRewardControl;
      readonly materialized: boolean;
      readonly sourceOfferKey: string;
      readonly eligibleSourceOfferKeys: readonly string[];
    };

export interface WorkspaceShopConditionControl {
  readonly value: boolean;
}

export interface WorkspaceLocalVisitOrderOption {
  readonly key: string;
  readonly label: string;
  readonly position: number | null;
  readonly proposedOccurrenceIds: readonly OccurrenceId[];
}

export interface WorkspaceLocalVisitOrderControl {
  readonly interactionKey: string;
  readonly options: readonly WorkspaceLocalVisitOrderOption[];
  readonly selectedKey: string;
}

/**
 * Render-ready data for one active, pool-backed phase. Catalog resolution and
 * candidate support happened before this product reaches React.
 */
export interface WorkspaceEncounterPhase {
  readonly address: EncounterPhaseAddress;
  readonly candidateChoices: readonly WorkspaceInteractionChoice<string>[];
  /**
   * Declaration-owned selector affordance. Singleton pools remain semantic
   * phase owners, but cannot create a meaningful encounter selection UI.
   */
  readonly customizable: boolean;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly figLeaf?: {
    readonly interactionKey: string;
    readonly selected: boolean;
    readonly supported: boolean;
  };
  /** Selected encounter-local trait offer, when this phase owns one. */
  readonly traitOffer?: WorkspaceTraitOfferControl;
  readonly gorgonCondition?: {
    readonly interactionKey: string;
    readonly selected: boolean;
    readonly supported: boolean;
  };
  readonly gorgonAthena?: WorkspaceTraitOfferControl;
  /** A reset is useful only after the authored selection diverges from its static default. */
  readonly resettable: boolean;
  readonly selectedEncounter: {
    readonly key: string;
    readonly label: string;
  };
}

interface WorkspaceLocalVisitSlotBase {
  readonly address: LocalVisitSlotAddress;
  /** Declared physical availability order for the parent-local pressure rule. */
  readonly availabilityRank: number;
  readonly entered: boolean;
  readonly enteredOrdinal: number | null;
  readonly occurrenceId: OccurrenceId;
  readonly order: WorkspaceLocalVisitOrderControl;
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly physicalDoorId: number;
}

/** A generated local target publishes its retained ordinary occurrence workbench. */
export type WorkspaceLocalVisitSlot =
  | (WorkspaceLocalVisitSlotBase & {
      readonly door: WorkspaceDoorContract;
      readonly generation: 'generated';
      readonly room: WorkspaceRoomSummary;
    })
  | (WorkspaceLocalVisitSlotBase & {
      readonly generation: 'notGenerated';
    });

export interface WorkspaceLocalVisitDecision {
  readonly address: LocalVisitDecisionAddress;
  readonly marker: WorkspaceMarker;
  readonly order: LocalVisitOrderAddress;
  readonly orderMarker: WorkspaceMarker;
  readonly slots: readonly WorkspaceLocalVisitSlot[];
  readonly visitOrder: readonly OccurrenceId[];
}

export type WorkspaceRoomLocal =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'fixed';
      readonly marker: WorkspaceMarker;
      readonly offer: ResolvedRewardOffer | null;
      readonly summary: string;
      readonly control?: WorkspaceExplicitRewardControl;
    }
  | {
      readonly kind: 'incomingReward';
      readonly control: WorkspaceCountedRewardControl;
      readonly clockworkReward?: 'goal' | 'nonGoal';
      readonly summary: string;
    }
  | {
      readonly kind: 'fields';
      readonly cages: readonly WorkspaceFieldsCageDescriptor[];
      readonly optionalRewardCount: number;
      readonly optionalRewardCapacity: number;
      readonly optionalRewardCountValues: readonly number[];
      readonly optionalRewards: readonly WorkspaceFieldsOptionalRewardDescriptor[];
      readonly owner: OccurrenceAddress;
      readonly groupKey: string;
    }
  | {
      readonly kind: 'ship';
      /** Authored structural activation for Ship Combat2, distinct from encounter identity. */
      readonly combatPhaseCount: 2 | 3;
      /** Active declaration-owned encounter slots in their envelope order. */
      readonly phases: readonly WorkspaceShipStructurePhase[];
      readonly wheels: readonly WorkspaceRewardWheelDescriptor[];
    }
  | {
      readonly kind: 'shop';
      readonly materialized: boolean;
      readonly offers: readonly WorkspaceShopOfferDescriptor[];
      readonly supplementalOffers: readonly WorkspaceShopSupplementalDescriptor[];
      readonly deathDefianceCondition?: WorkspaceShopConditionControl;
    };

export type WorkspaceRoomFeature =
  | {
      readonly kind: 'zagreusContract';
      readonly action: 'add';
      readonly control: WorkspaceZagreusSpawnControl;
    }
  | {
      readonly kind: 'zagreusContract';
      readonly action: 'remove';
      readonly owner: AdditionalExitAddress;
    }
  | {
      readonly kind: 'naturalChaos';
      readonly action: 'add';
      readonly control: WorkspaceNaturalChaosSpawnControl;
    }
  | {
      readonly kind: 'naturalChaos';
      readonly action: 'remove';
      readonly owner: AdditionalExitAddress;
    };

export interface WorkspaceShipStructurePhase {
  readonly key: string;
  readonly label: string;
  readonly rewardWheelKey?: string;
}

export interface WorkspaceShipPhasePresentation {
  readonly actionRows: readonly WorkspaceRoomActionRow[];
  readonly checkpoints: WorkspaceRoomActions['checkpoints'];
  readonly encounter?: WorkspaceEncounterPhase;
  readonly key: string;
  readonly label: string;
  readonly wheel?: WorkspaceRewardWheelDescriptor;
}

/** Closed, render-ready composition for one direct occurrence workbench. */
export type WorkspaceRoomWorkbenchPresentation =
  | {
      readonly kind: 'standard';
      readonly encounterPhases: readonly WorkspaceEncounterPhase[];
      readonly features: readonly WorkspaceRoomFeature[];
      readonly roomActions?: WorkspaceRoomActions;
    }
  | {
      readonly kind: 'fields';
      readonly encounterPhases: readonly WorkspaceEncounterPhase[];
      readonly features: readonly WorkspaceRoomFeature[];
      readonly fields: Extract<WorkspaceRoomLocal, { readonly kind: 'fields' }>;
      readonly roomActions?: WorkspaceRoomActions;
    }
  | {
      readonly kind: 'ship';
      readonly combatPhaseCount: 2 | 3;
      readonly features: readonly WorkspaceRoomFeature[];
      readonly phases: readonly WorkspaceShipPhasePresentation[];
      /** Retained inactive/obsolete rows remain visible once, outside active phases. */
      readonly repairRows: readonly WorkspaceRoomActionRow[];
      readonly roomActions?: WorkspaceRoomActions;
    }
  | {
      readonly kind: 'shop';
      readonly features: readonly WorkspaceRoomFeature[];
      readonly roomActions?: WorkspaceRoomActions;
      readonly shop: Extract<WorkspaceRoomLocal, { readonly kind: 'shop' }>;
    };

export interface WorkspaceRoomSummary {
  readonly address: OccurrenceAddress;
  /** Authored detail activation is deliberately separate from evaluated entry. */
  readonly detailsActive: boolean;
  /**
   * The no-predecessor reward owned by an authored start occurrence. Ordinary
   * entered rooms keep their predecessor-owned door reward read-only.
   */
  readonly entryReward?: WorkspaceRewardControl;
  /** Active pool-backed encounter phases in declaration/lifecycle order. */
  readonly encounterPhases: readonly WorkspaceEncounterPhase[];
  readonly entered: boolean;
  readonly gameName: string;
  readonly kind: RoomDeclaration['kind'];
  readonly label: string;
  /** All room-local owners used for inspector and rail containment routing. */
  readonly localDetailMarkers: readonly WorkspaceMarker[];
  readonly marker: WorkspaceMarker;
  readonly occurrenceId: OccurrenceId;
  readonly roomLocal: WorkspaceRoomLocal;
  readonly workbench: WorkspaceRoomWorkbenchPresentation;
  /** Closed tab placement for engine-owned lifecycle snapshots. */
  readonly runStateByTab: Readonly<Partial<Record<WorkspaceRoomTab, WorkspaceRunStateLauncher>>>;
  /** One shared entered-room chronology across every semantic participant. */
  readonly roomActions?: WorkspaceRoomActions;
  /**
   * Closed Anomaly takeover controls. The semantic assembly derives this from
   * the containing generated-host declaration; React never evaluates the source
   * gate, replacement cap, or reward legality.
   */
  readonly anomaly?: WorkspaceAnomalyControl;
  /** Declared Midshop spawn capability; the authored door remains occurrence-owned. */
  readonly zagreusSpawn?: WorkspaceZagreusSpawnControl;
  /** Declared natural Chaos spawn capability; the authored door remains occurrence-owned. */
  readonly naturalChaosSpawn?: WorkspaceNaturalChaosSpawnControl;
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly roomPicker?: WorkspaceRoomPickerControl;
}

export interface WorkspaceZagreusContractControl {
  readonly door: WorkspaceDoorContract;
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
  readonly selected: boolean;
}

/** Availability is source-room-local; the additional exit remains decision-owned. */
export interface WorkspaceZagreusSpawnControl {
  readonly marker: WorkspaceMarker;
  readonly materialized: boolean;
  readonly owner: AdditionalExitAddress;
}

export interface WorkspaceNaturalChaosExitControl {
  readonly door: WorkspaceDoorContract;
  readonly mapChoices: readonly WorkspaceInteractionChoice<string>[];
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
  readonly selected: boolean;
}

export interface WorkspaceNaturalChaosSpawnControl {
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
}

export interface WorkspaceAnomalyControl {
  readonly mapChoices: readonly WorkspaceInteractionChoice<string>[];
  readonly rememberedRoomLabel: string;
  readonly success: boolean;
}

export interface WorkspaceDoorReward {
  readonly control?: WorkspaceRewardControl;
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly offer: ResolvedRewardOffer | null;
  readonly summary: string;
}

/** One immutable predecessor-owned physical-door handoff product. */
export interface WorkspaceDoorContract {
  readonly rewardPreview:
    | {
        readonly kind: 'hidden';
        /** Planner-owned reward controls that remain authorable despite the hidden game preview. */
        readonly authoringRewards: readonly WorkspaceDoorReward[];
      }
    | { readonly kind: 'none' }
    | {
        readonly kind: 'visible';
        readonly rewards: readonly WorkspaceDoorReward[];
      };
  readonly room: WorkspaceRoomSummary;
}

export interface WorkspacePhysicalTarget {
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly door: WorkspaceDoorContract;
  readonly exitKey: string;
  readonly index: number;
  readonly marker: WorkspaceMarker;
  readonly physicalState: 'available' | 'unavailable';
  readonly selected: boolean;
  readonly retained: boolean;
  readonly nextPath: 'continuesSpine' | 'deadLeaf' | 'startsCompletion';
  /** Occurrence workbench identity; door UI and decision rails consume `door`. */
  readonly room: WorkspaceRoomSummary;
  /** A declaration-owned target capability, not a React eligibility result. */
  readonly anomalyTakeover?: {
    readonly label: string;
  };
}

/** One selected door continuation, shared by rail and decision navigation. */
export interface WorkspaceSelectedContinuationNavigation {
  readonly door: WorkspaceDoorContract;
  readonly marker: WorkspaceMarker;
}

export type WorkspaceMissingTargetAuthoring =
  | { readonly kind: 'ready' }
  | {
      readonly kind: 'awaitingPriorExit';
      readonly prerequisiteExitKey: string;
    }
  | { readonly kind: 'awaitingBatchRewardStore' }
  | { readonly kind: 'awaitingFieldsCageOutcome' };

export type WorkspaceBatchRepairIntent = WorkspaceCommandIntent<
  Extract<ProjectCommand, { readonly kind: 'ReconcileBatchExitCapacity' }>
>;

export interface WorkspaceMissingPhysicalTarget {
  readonly authoring: WorkspaceMissingTargetAuthoring;
  readonly exitKey: string;
  readonly index: number;
  readonly marker: WorkspaceMarker;
}

export interface WorkspaceFieldsBatchContext {
  readonly cageOutcome: 'min' | 'max';
  readonly cageTargetCount: number;
  readonly doorCageRewardCount: number;
  readonly priorMaxOutcomes?: {
    readonly fieldsMaxDoorsRolled: number;
    readonly maxDoorCageCeiling: number;
  };
}

export interface WorkspaceEffectiveRewardStore {
  readonly label: string;
  readonly storeKey: string;
}

interface WorkspaceBatchNodeBase {
  readonly batchState: CanonicalBatch['batchState'] | AuthoredBatchState;
  /** Present only when a forced room changes an evaluated authored base store. */
  readonly effectiveRewardStore?: WorkspaceEffectiveRewardStore;
  readonly fields?: WorkspaceFieldsBatchContext;
  /** An authored additional exit is a sibling of normal targets, never a target row. */
  readonly naturalChaos?: WorkspaceNaturalChaosExitControl;
  readonly zagreusContract?: WorkspaceZagreusContractControl;
  readonly fieldsCageOutcome?: WorkspaceMarker;
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly missingTargets: readonly WorkspaceMissingPhysicalTarget[];
  readonly owner: ExitDecisionAddress;
  readonly persistence: 'authored' | 'uncommitted';
  readonly repairIntent?: WorkspaceBatchRepairIntent;
  readonly rewardStore?: WorkspaceMarker;
  readonly selection: WorkspaceMarker;
  /** Present only when exactly one normal or additional occurrence is selected. */
  readonly selectedContinuation?: WorkspaceSelectedContinuationNavigation;
  readonly source: ExitDecisionSourceAddress;
  readonly targets: readonly WorkspacePhysicalTarget[];
  readonly topologyState: 'complete' | 'partial' | 'retained';
  readonly runState?: WorkspaceRunStateLauncher;
}

export type WorkspaceAuthoringFrontier =
  | {
      readonly kind: 'start';
      readonly interactionKey: string;
      readonly marker: WorkspaceMarker;
      readonly owner: BiomeAddress;
    }
  | {
      readonly kind: 'exitDecision';
      readonly interactionKey: string;
      readonly marker: WorkspaceMarker;
      readonly owner: ExitDecisionAddress;
      readonly predecessorNodeKey?: string;
      readonly provisionalBatch?:
        WorkspaceOrdinaryBatchNode | WorkspaceTakeoverBatchNode | WorkspaceMixedBatchNode;
    }
  | {
      readonly kind: 'hubVisit';
      readonly interactionKey: string;
      readonly marker: WorkspaceMarker;
      readonly owner: HubVisitAddress;
    }
  | {
      readonly kind: 'hubOpenSet';
      readonly marker: WorkspaceMarker;
      readonly owner: HubOpenSetAddress;
    };

export interface WorkspaceOrdinaryBatchNode extends WorkspaceBatchNodeBase {
  readonly kind: 'ordinaryBatch';
  readonly targetInteraction: 'replaceable';
}

export interface WorkspaceTakeoverBatchNode extends WorkspaceBatchNodeBase {
  readonly kind: 'takeoverBatch';
  readonly targetInteraction: 'readOnly';
  readonly takeoverInteractionKey: string;
}

export interface WorkspaceMixedBatchNode extends WorkspaceBatchNodeBase {
  readonly kind: 'mixedBatch';
  readonly targetInteraction: 'replaceable';
}

export interface WorkspaceHubSlot {
  readonly canClose: boolean;
  readonly canOpen: boolean;
  readonly hubSlotKey: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly open: boolean;
  readonly physicalDoorId: number;
  /** Exact immutable main-door handoff owned by the Hub slot. */
  readonly door?: WorkspaceDoorContract;
  readonly room?: WorkspaceRoomSummary;
  readonly roomKind: RoomDeclaration['kind'];
  readonly visited: boolean;
}

export type WorkspaceHubVisitState = 'authored' | 'next' | 'locked';

export interface WorkspaceHubVisit {
  readonly authoring: WorkspaceHubVisitState;
  readonly marker: WorkspaceMarker;
  /** The authored visit carries its slot-owned door without reconstructing reward identity. */
  readonly door?: WorkspaceDoorContract;
  readonly room?: WorkspaceRoomSummary;
  readonly hubSlotKey?: string;
  readonly visitIndex: number;
}

export interface WorkspaceHubDecisionNode {
  readonly authoring: 'authored';
  readonly kind: 'hubDecision';
  readonly key: string;
  readonly hubKey: string;
  readonly marker: WorkspaceMarker;
  readonly openSet: WorkspaceMarker;
  readonly openSlotCount: { readonly current: number; readonly min: number; readonly max: number };
  readonly owner: HubDecisionAddress;
  readonly requiredVisitCount: number;
  readonly slots: readonly WorkspaceHubSlot[];
  readonly visits: readonly WorkspaceHubVisit[];
  readonly runState?: WorkspaceRunStateLauncher;
}

/** A read-only checkpoint published by the engine for one outer decision. */
export type WorkspaceRunStateLauncher =
  | {
      readonly availability: 'available';
      readonly owner: RunStateOwner;
      readonly state: WorkspaceRunStatePresentation;
      /** Final structured-stage title, never reconstructed by React. */
      readonly title: string;
    }
  | {
      readonly availability: 'unavailable';
      readonly owner: RunStateOwner;
      readonly title: string;
    };

export interface WorkspaceRunStatePresentation {
  readonly keepsakes: {
    readonly currentLabel: string;
    readonly chronology: readonly {
      readonly biomeNumber: number;
      readonly label: string;
      readonly retained: boolean;
    }[];
    readonly fatedStatus: 'Unknown' | 'Fated' | 'Unfated';
    readonly jeweledPomStatus: 'inactive' | 'active' | 'invalidated';
    readonly experimentalHammers: readonly {
      readonly status: 'active' | 'expired';
      readonly traitLabel: string;
      readonly remainingUses: number;
      readonly acquisitionIdentity: string;
    }[];
    readonly echoGift?: {
      readonly capturedKeepsakeLabel: string;
      readonly status: 'pending' | 'oneShotApplied' | 'everyBiome' | 'effectNeutral';
      readonly replayCount: number;
    };
    readonly callingCardRemainingCharges?: number;
    readonly timePieceRemainingCharges?: number;
    readonly figLeafRemainingUses?: number;
    readonly figLeafActivatedThisBiome?: boolean;
    readonly gorgonStatus?: 'pending' | 'consumed' | 'expired';
    readonly gorgonRarity?: import('@run-planner/engine/catalog-schema').TraitRarity;
  };
  readonly arcana: readonly {
    readonly key: string;
    readonly label: string;
    readonly origin: ArcanaActivationOrigin;
    readonly rarity: TraitRarity;
  }[];
  readonly artificer?: {
    readonly rarity: Extract<TraitRarity, 'Epic' | 'Heroic'>;
    readonly spent: number;
    readonly capacity: 3 | 4;
    readonly remaining: number;
  };
  readonly bags: readonly WorkspaceRunStateBagPresentation[];
  readonly counters: readonly { readonly key: string; readonly value: number }[];
  readonly elements: readonly { readonly key: string; readonly value: number }[];
  readonly godPool: {
    readonly inPool: readonly WorkspaceRunStateSource[];
  };
  readonly fear: {
    readonly configuredTotal: number;
    readonly active: readonly {
      readonly key: string;
      readonly label: string;
      readonly rank: number;
    }[];
    readonly disabled: readonly {
      readonly key: string;
      readonly label: string;
      readonly rank: number;
    }[];
    readonly forfeitStatus: 'inactive' | 'available' | 'consumed';
  };
  readonly traits: {
    readonly activeMinimumScalableRarity?: TraitRarity;
    readonly coreSlots: readonly WorkspaceRunStateCoreTraitSlot[];
    readonly other: readonly WorkspaceRunStateTrait[];
    readonly banned: readonly WorkspaceRunStateSource[];
    readonly echoShopDuplicateStatus?: 'pending' | 'consumed';
  };
}

export interface WorkspaceRunStateSource {
  readonly key: string;
  readonly label: string;
}

export interface WorkspaceRunStateTrait {
  readonly label: string;
  readonly rarity?: TraitRarity;
  readonly level?: number;
  readonly hammerRank?: 'RankI' | 'RankII';
  readonly traitKey: string;
}

export interface WorkspaceRunStateCoreTraitSlot {
  readonly label: string;
  readonly slotKey: string;
  readonly trait?: WorkspaceRunStateTrait;
}

export interface WorkspaceRunStateBagPresentation {
  readonly eligible: WorkspaceRunStateBagSection;
  readonly ineligible: WorkspaceRunStateBagSection;
  readonly label: string;
  readonly remaining: string;
  readonly technicalKey: string;
}

export interface WorkspaceRunStateBagSection {
  readonly entries: readonly WorkspaceRunStateBagEntry[];
  readonly total: string;
}

export interface WorkspaceRunStateBagEntry {
  readonly conditions: readonly WorkspaceRunStateBagCondition[];
  readonly count: string;
  readonly label: string;
  readonly technicalKey: string;
}

export interface WorkspaceRunStateBagCondition {
  readonly count: string;
  readonly explanation: string;
  readonly technicalKey: string;
}

export interface WorkspaceOccurrenceWorkbenchNode {
  readonly kind: 'occurrenceWorkbench';
  readonly key: string;
  readonly localDetailMarkers: readonly WorkspaceMarker[];
  /** Parent-owned local topology; local payloads remain ordinary occurrence workbenches. */
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly marker: WorkspaceMarker;
  /** A completed-Hub outer decision rendered through its visible Preboss room. */
  readonly runState?: WorkspaceRunStateLauncher;
  readonly inspectorPresentation: 'doorTarget' | 'full' | 'hubRoomLocal';
  /** Predecessor-owned door context. The occurrence may only render this read-only. */
  readonly incomingDoor?: WorkspaceDoorContract;
  readonly sourceDecisionRemoval?: WorkspaceStageDecisionRemoval;
  readonly railMarker?: WorkspaceMarker;
  readonly railVisibility?: 'inspectorOnly';
  readonly room: WorkspaceRoomSummary;
}

export interface WorkspaceCompletionNode {
  readonly kind: 'completion';
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly role: CompletionRoomDescriptor['role'];
  readonly gameName: string;
  readonly label: string;
  readonly judgment?: {
    readonly address: BossCompletionArcanaAddress;
    readonly inactiveArcanaKeys: readonly string[];
    readonly marker: WorkspaceMarker;
    readonly requiredCount: number;
    readonly value: readonly string[];
  };
  readonly keepsakeSelection?: {
    readonly address: KeepsakeSelectionAddress;
    readonly equipResult?: {
      readonly address: KeepsakeEquipResultAddress;
      readonly marker: WorkspaceMarker;
    };
    readonly marker: WorkspaceMarker;
    readonly value:
      { readonly kind: 'retain' } | { readonly kind: 'replace'; readonly keepsakeKey: string };
  };
}

export type WorkspaceBiomeField =
  | {
      readonly address: BiomeFieldAddress;
      readonly key: string;
      readonly kind: 'boolean';
      readonly label: string;
      readonly marker: WorkspaceMarker;
      readonly value: boolean | null;
      readonly values: readonly boolean[];
    }
  | {
      readonly address: BiomeFieldAddress;
      readonly key: string;
      readonly kind: 'boundedInteger';
      readonly label: string;
      readonly marker: WorkspaceMarker;
      readonly value: number | null;
      readonly values: readonly number[];
    }
  | {
      readonly address: BiomeFieldAddress;
      readonly key: string;
      readonly kind: 'enum';
      readonly label: string;
      readonly marker: WorkspaceMarker;
      readonly value: string | null;
      readonly values: readonly string[];
    };

export type WorkspaceNode =
  | WorkspaceOrdinaryBatchNode
  | WorkspaceTakeoverBatchNode
  | WorkspaceMixedBatchNode
  | WorkspaceHubDecisionNode
  | WorkspaceOccurrenceWorkbenchNode
  | WorkspaceCompletionNode;

export type WorkspaceOccurrenceStageOutgoing =
  | {
      readonly kind: 'authoredDecision';
      readonly decisionNodeKey: string;
    }
  | {
      readonly kind: 'frontier';
      readonly frontier: Extract<WorkspaceAuthoringFrontier, { readonly kind: 'exitDecision' }>;
    }
  | {
      readonly kind: 'blockedOrUnentered';
      readonly marker: WorkspaceMarker;
      readonly message: string;
    }
  | {
      readonly kind: 'topologyOwned';
      readonly label: string;
      readonly marker: WorkspaceMarker;
    }
  | {
      readonly kind: 'terminal';
      readonly label: string;
      readonly marker: WorkspaceMarker;
    };

/** Projection-owned occurrence/decision composition consumed by React as a keyed stage. */
export interface WorkspaceOccurrenceStage {
  readonly outgoing: WorkspaceOccurrenceStageOutgoing;
  readonly sourceOccurrenceNodeKey: string;
}

export interface WorkspaceHubVisitRailEntry {
  readonly key: string;
  readonly label: string;
  /** The visited room's one primary reward, never an aggregate of local detail rewards. */
  readonly mainReward?: WorkspaceRailReward;
  readonly marker: WorkspaceMarker;
  readonly node: WorkspaceOccurrenceWorkbenchNode;
  readonly visitMarker: WorkspaceMarker;
  readonly visitIndex: number;
}

export interface WorkspaceHubRailEntry {
  readonly kind: 'hubGroup';
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly node: WorkspaceHubDecisionNode;
  readonly visits: readonly WorkspaceHubVisitRailEntry[];
}

/**
 * One resolved primary room reward retained as a presentation-ready token.
 * The current rail renders `label`; a later compact token can render `offer`
 * without changing workspace policy. It never represents an aggregate of
 * room-local rewards.
 */
export interface WorkspaceRailReward {
  readonly label: string;
  readonly offer: ResolvedRewardOffer;
}

/**
 * Progressive authored context for one numbered decision. A selected room is
 * useful independently of whether its reward surface can be represented as
 * one unambiguous compact reward.
 */
export interface WorkspaceRailSelectedTarget {
  readonly reward?: WorkspaceRailReward;
  readonly roomLabel: string;
}

export interface WorkspaceDecisionRailEntry {
  readonly kind: 'node';
  /**
   * A selected decision continues into its target occurrence stage. The rail
   * keeps the decision marker for assessment while navigation uses this exact
   * occurrence marker.
   */
  readonly focusMarker: WorkspaceMarker;
  readonly key: string;
  readonly label: string;
  /** Only direct room stages and Hub visits expose primary-reward context. */
  readonly mainReward?: never;
  readonly marker: WorkspaceMarker;
  readonly node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode;
  readonly selectedTarget?: WorkspaceRailSelectedTarget;
}

export interface WorkspaceStageRailEntry {
  readonly kind: 'node';
  /** Exact occurrence or stage owner opened by this presentation stop. */
  readonly focusMarker: WorkspaceMarker;
  readonly key: string;
  readonly label: string;
  /** Optional primary reward context for a directly rendered room stage. */
  readonly mainReward?: WorkspaceRailReward;
  readonly marker: WorkspaceMarker;
  readonly node: Exclude<WorkspaceNode, WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode>;
  /** Only numbered decision rail entries may expose selected-target context. */
  readonly selectedTarget?: never;
}

export type WorkspaceRailEntry =
  | WorkspaceDecisionRailEntry
  | WorkspaceStageRailEntry
  | WorkspaceHubRailEntry
  | {
      readonly kind: 'frontier';
      readonly frontier: Extract<
        WorkspaceAuthoringFrontier,
        { readonly kind: 'start' | 'exitDecision' }
      >;
      readonly key: string;
      readonly marker: WorkspaceMarker;
    };

export interface WorkspaceBiome {
  readonly biomeKey: string;
  readonly completion: readonly WorkspaceCompletionNode[];
  readonly completionOutline: readonly WorkspaceCompletionNode[];
  /** Explicitly null only when this workspace has no renderable subject. */
  readonly defaultInspectorDestination: WorkspaceDefaultInspectorDestination | null;
  readonly entry?: WorkspaceOccurrenceWorkbenchNode;
  readonly echoKeepsakeReplay?: {
    readonly address: KeepsakeEquipResultAddress & { readonly resultKind: 'experimentalHammer' };
    readonly marker: WorkspaceMarker;
  };
  readonly fields: readonly WorkspaceBiomeField[];
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly nodes: readonly WorkspaceNode[];
  readonly occurrenceStages: readonly WorkspaceOccurrenceStage[];
  readonly owner: BiomeAddress;
  readonly rail: readonly WorkspaceRailEntry[];
  readonly source: WorkspaceProjectionSource;
  readonly status: WorkspaceStatus;
}

export interface WorkspaceRouteRailBiome {
  readonly biomeKey: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly source: WorkspaceProjectionSource;
  readonly status: WorkspaceStatus;
}

export interface WorkspaceRoute {
  readonly biomes: readonly WorkspaceBiome[];
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly rail: readonly WorkspaceRouteRailBiome[];
  readonly routeKey: string;
  readonly status: WorkspaceStatus;
}

export interface StructuredWorkspaceProjection {
  readonly focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly marker: WorkspaceMarker;
  readonly runStateLaunchers: ReadonlyMap<string, WorkspaceRunStateLauncher>;
  readonly routes: readonly WorkspaceRoute[];
  readonly status: WorkspaceStatus;
}

export interface StructuredWorkspaceProjectionService {
  project(assembly: ProjectEvaluationAssembly): StructuredWorkspaceProjection;
}

export interface StructuredWorkspaceContextualServices {
  readonly candidateSessions: CandidateSessionFactory;
  readonly contextualPicker: ContextualPickerProjectionService;
  readonly rewardPicker: RewardPickerProjectionService;
  readonly traitDomain: TraitDomainProjectionService;
}
