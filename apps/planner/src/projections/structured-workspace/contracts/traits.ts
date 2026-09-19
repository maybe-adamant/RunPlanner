import type { SemanticAddress } from '@run-planner/engine/authored-project';
import type { CandidateOptionProjection } from '@planner/projections/candidates/candidateProjection';
import type { WorkspaceInteractionChoice } from '../contract';
import type {
  AcquisitionEntryAddress,
  AcquisitionRoleAddress,
  AuthoredAllTogetherResult,
  AuthoredChaosTraitOffer,
  AuthoredCirceResolution,
  AuthoredConcaveStoneResult,
  AuthoredEchoLastRunBoonDraftRow,
  AuthoredEchoLastRunBoonOffer,
  AuthoredEchoLastRunBoonOption,
  AuthoredHexTreeConfiguration,
  AuthoredLevelResolution,
  AuthoredTraitCarrierChild,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  AuthoredTraitOption,
  EchoLastRewardAddress,
  LevelResolutionAddress,
  ProjectCommand,
  RouteAddress,
  TraitOfferAddress,
  TraitOptionKey,
} from '@run-planner/engine/authored-project';
import type {
  ChaosNumericOperand,
  HexDeclaration,
  HexLayoutKey,
  TraitGiverDeclaration,
  TraitRarity,
} from '@run-planner/engine/catalog-schema';
import type { LevelResolutionCandidateProjection } from '@planner/projections/candidates/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { TraitOptionDomainProjection } from '@planner/projections/rewards/traitDomainProjection';
import type { WorkspaceMarker } from './navigation';
import type { WorkspaceCommandIntent, WorkspacePayloadEditIntent } from '../contract';

export interface WorkspaceAcquisitionConversionInteraction {
  readonly visible: boolean;
  /** Gold is enabled only when every reached engine branch supports it. */
  readonly timePieceSupported: boolean;
  readonly artificerSupported: boolean;
  readonly seaStarSupported: boolean;
  readonly seaStarProcced: boolean;
  /** Exact acquisition-owned Anvil editor, present only on the purchased Anvil role. */
  readonly anvil?: {
    readonly value: import('@run-planner/engine/authored-project').AuthoredAnvilResult | null;
    readonly removableTraitKeys: readonly string[];
    readonly addedTraitKeysFor: (
      removedTraitKey: string | null,
      priorAddedTraitKeys: readonly string[],
    ) => readonly string[];
    readonly traitLabel: (traitKey: string) => string;
    readonly intentFor: (
      value: import('@run-planner/engine/authored-project').AuthoredAnvilResult,
    ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceAnvilResult' }>>;
  };
  readonly intentFor: (
    value: import('@run-planner/engine/authored-project').AcquisitionDisposition,
  ) => WorkspacePayloadEditIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
  >;
  readonly seaStarIntentFor: (
    procced: boolean,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceSeaStarResult' }>>;
  readonly key: string;
  readonly owner: AcquisitionRoleAddress;
  readonly value: import('@run-planner/engine/authored-project').AcquisitionDisposition;
}

/** One exact authored trait child beneath a reward owner. */
export type WorkspaceTraitOfferStatus = 'unspecified' | 'invalid' | 'valid';

export interface WorkspaceTraitOfferControl {
  /** Player-facing acquisition role (for example, Chosen God or Spurned God). */
  readonly acquisitionRoleLabel: string;
  readonly address: TraitOfferAddress;
  readonly giver: TraitGiverDeclaration;
  readonly marker: WorkspaceMarker;
  readonly offer: AuthoredTraitOffer | null;
  /** Projection-owned compact state for the trait launcher presentation. */
  readonly status: WorkspaceTraitOfferStatus;
  /** False for a declaration/chronology-resolved rarity such as Gorgon Athena. */
  readonly rarityEditable?: boolean;
  readonly rewardOwner: SemanticAddress;
  /** Structurally discovered selected-outcome children. */
  readonly children: readonly WorkspaceTraitCarrierChildControl[];
  /** Evaluated-only consequences; they never add an authored completion burden. */
  readonly feedback: readonly WorkspaceTraitOfferFeedback[];
}

/** One exact Time Piece choice, independent of whether this role has a trait child. */
export interface WorkspaceAcquisitionConversionControl {
  readonly acquisitionRoleLabel: string;
  readonly address: AcquisitionRoleAddress;
  readonly marker: WorkspaceMarker;
  readonly rewardOwner: SemanticAddress;
  readonly value: import('@run-planner/engine/authored-project').AcquisitionDisposition;
}

export type WorkspaceTraitCarrierChildControl = AuthoredTraitCarrierChild & {
  readonly marker: WorkspaceMarker;
};

export interface WorkspaceEchoLastRewardControl {
  readonly address: EchoLastRewardAddress;
  readonly acquisitionEntry: AcquisitionEntryAddress;
  readonly marker: WorkspaceMarker;
  readonly optionKey: TraitOptionKey;
  readonly spawnLabel?: string;
}

export type WorkspaceTraitOfferFeedback =
  | { readonly kind: 'echoLastReward'; readonly control: WorkspaceEchoLastRewardControl }
  | { readonly kind: 'ransom'; readonly assessment: WorkspaceRansomAssessment };

/** One exact declaration-owned Pom child beneath an active reward owner. */
export interface WorkspaceLevelResolutionControl {
  readonly acquisitionRoleLabel: string;
  readonly address: LevelResolutionAddress;
  readonly levelCount: number;
  readonly settledEmptyNoOp: boolean;
  readonly marker: WorkspaceMarker;
  readonly rewardOwner: SemanticAddress;
  /** The same compact unspecified/invalid/valid presentation used by trait launchers. */
  readonly status: WorkspaceTraitOfferStatus;
  readonly value: AuthoredLevelResolution;
}

/** One lazy focused-option domain bound to a complete local trait-offer draft. */
export interface WorkspaceTraitOptionDomainInteraction {
  readonly children: readonly WorkspaceTraitCarrierChildInteraction[];
  readonly load: () => TraitOptionDomainProjection | Promise<TraitOptionDomainProjection>;
}

export interface WorkspaceHexTreeDomain {
  readonly value: AuthoredHexTreeConfiguration;
  readonly layoutPicker: ContextualPickerModel<HexLayoutKey>;
  readonly rarePickerFor: (
    selectedKeys: readonly string[],
    selected?: string,
  ) => ContextualPickerModel<string>;
  readonly epicPickerFor: (
    selectedKeys: readonly string[],
    selected?: string,
  ) => ContextualPickerModel<string>;
  readonly godSent: HexDeclaration['godSent'];
}

export interface WorkspaceHexTreeInteraction {
  readonly child: Extract<WorkspaceTraitCarrierChildControl, { readonly kind: 'hexTree' }>;
  readonly update: (
    offer: AuthoredTraitOfferTraits,
    value: AuthoredHexTreeConfiguration,
  ) => AuthoredTraitOfferTraits;
  /** Complete declaration-owned default for the offer's currently selected spell. */
  readonly defaultFor: (offer: AuthoredTraitOfferTraits) => AuthoredHexTreeConfiguration;
  readonly transitionFor: (
    offer: AuthoredTraitOfferTraits,
    layoutKey: HexLayoutKey,
  ) => AuthoredHexTreeConfiguration;
  readonly forOffer: (offer: AuthoredTraitOfferTraits) => {
    readonly load: () => WorkspaceHexTreeDomain | undefined;
  };
}

/** Route-loadout-owned Hex controls for Aspect of Selene's fixed Sky Fall. */
export interface WorkspaceAspectHexTreeControl {
  readonly address: RouteAddress;
  readonly declaration: HexDeclaration;
  readonly marker: WorkspaceMarker;
  readonly value: AuthoredHexTreeConfiguration;
  readonly domain: WorkspaceHexTreeDomain;
  readonly transitionFor: (layoutKey: HexLayoutKey) => AuthoredHexTreeConfiguration;
  readonly intentFor: (
    value: AuthoredHexTreeConfiguration,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceAspectHexTree' }>>;
}

export interface WorkspaceAllTogetherSetDomain {
  readonly picker: ContextualPickerModel<string | null>;
}

export interface WorkspaceNaturalSelectionDomain {
  readonly complete: boolean;
  readonly picker: ContextualPickerModel<string>;
}

export type WorkspaceTraitCarrierChildInteraction =
  | {
      readonly child: Extract<
        WorkspaceTraitCarrierChildControl,
        { readonly kind: 'traitAcquisitionTarget' }
      >;
      readonly forOffer: (offer: AuthoredTraitOfferTraits) => {
        readonly load: () => WorkspaceTraitAcquisitionTargetDomain | undefined;
      };
      readonly update: (
        offer: AuthoredTraitOfferTraits,
        targetTraitKey: string,
      ) => AuthoredTraitOfferTraits;
    }
  | {
      readonly child: Extract<
        WorkspaceTraitCarrierChildControl,
        { readonly kind: 'allTogetherSet' }
      >;
      readonly forOffer: (offer: AuthoredTraitOfferTraits) => {
        readonly load: () => WorkspaceAllTogetherSetDomain | undefined;
      };
      readonly update: (
        offer: AuthoredTraitOfferTraits,
        result: AuthoredAllTogetherResult,
      ) => AuthoredTraitOfferTraits;
    }
  | {
      readonly child: Extract<
        WorkspaceTraitCarrierChildControl,
        { readonly kind: 'naturalSelectionResult' }
      >;
      readonly forOffer: (
        offer: AuthoredTraitOfferTraits,
        retainedTargetKey?: string,
      ) => {
        readonly load: () => WorkspaceNaturalSelectionDomain | undefined;
      };
      readonly update: (
        offer: AuthoredTraitOfferTraits,
        targets: NonNullable<AuthoredTraitOption['naturalSelectionTargets']>,
      ) => AuthoredTraitOfferTraits;
      readonly traitLabel: (traitKey: string) => string;
    }
  | WorkspaceCirceResolutionInteraction
  | WorkspaceEchoPomTargetInteraction
  | WorkspaceEchoLastRunBoonInteraction
  | WorkspaceConcaveStoneInteraction
  | WorkspaceHexTreeInteraction;

export interface WorkspaceTraitAcquisitionTargetDomain {
  readonly targetPicker: ContextualPickerModel<string>;
}

export interface WorkspaceConcaveStoneDomain {
  readonly procSupport: number;
  readonly required: boolean;
  readonly residualOptionKeys: readonly TraitOptionKey[];
  readonly resultSupport: 'forced' | 'possible' | 'impossible';
}

export interface WorkspaceConcaveStoneInteraction {
  readonly child: Extract<WorkspaceTraitCarrierChildControl, { readonly kind: 'concaveStone' }>;
  readonly update: (
    offer: AuthoredTraitOfferTraits,
    value: AuthoredConcaveStoneResult | null,
  ) => AuthoredTraitOfferTraits;
  /** Candidate-owned requiredness is distinct from the child's authored structure. */
  readonly completeFor: (offer: AuthoredTraitOfferTraits) => boolean;
  readonly forOffer: (offer: AuthoredTraitOfferTraits) => {
    readonly load: () => WorkspaceConcaveStoneDomain | undefined;
  };
}

export type WorkspaceRansomAssessment =
  | { readonly branchAgreement: false }
  | {
      readonly branchAgreement: true;
      readonly buffedTraitKeys: readonly string[];
      readonly levelBonus: number;
      readonly removedCount: number;
      readonly removedTraitKeys: readonly string[];
    };

export interface WorkspaceCirceResolutionDomain {
  readonly arcanaPicker: ContextualPickerModel<string>;
  readonly arcanaPickerFor: (selectedKeys: readonly string[]) => ContextualPickerModel<string>;
  readonly branchAgreement: boolean;
  readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear';
  readonly outerAvailable: boolean;
  readonly requiredCount: number;
  readonly vowPicker: ContextualPickerModel<string>;
  readonly vowPickerFor: (selectedKeys: readonly string[]) => ContextualPickerModel<string>;
}

export interface WorkspaceCirceResolutionInteraction {
  readonly child: Extract<WorkspaceTraitCarrierChildControl, { readonly kind: 'circeResolution' }>;
  readonly update: (
    offer: AuthoredTraitOfferTraits,
    value: AuthoredCirceResolution,
  ) => AuthoredTraitOfferTraits;
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
  readonly child: Extract<WorkspaceTraitCarrierChildControl, { readonly kind: 'echoPomTarget' }>;
  readonly update: (
    offer: AuthoredTraitOfferTraits,
    value: string | null,
  ) => AuthoredTraitOfferTraits;
  readonly forOffer: (offer: AuthoredTraitOfferTraits) => {
    readonly load: () => WorkspaceEchoPomTargetDomain | undefined;
  };
}

export interface WorkspaceEchoLastRunBoonTraitIdentity {
  readonly giverKey: string;
  readonly traitKey: string;
}

export type WorkspaceEchoLastRunBoonDraftRow = Omit<
  AuthoredEchoLastRunBoonDraftRow,
  'giverKey' | 'traitKey'
> & {
  readonly identity?: WorkspaceEchoLastRunBoonTraitIdentity;
};

export type WorkspaceEchoLastRunBoonCarrierDomain =
  | {
      readonly kind: 'allTogether';
      readonly complete: boolean;
      readonly sets: readonly {
        readonly setKey: import('@run-planner/engine/catalog-schema').DirectTraitSetKey;
        readonly picker: ContextualPickerModel<string | null>;
      }[];
    }
  | {
      readonly kind: 'naturalSelection';
      readonly slotCount: number;
      readonly complete: boolean;
      readonly supported: boolean;
      readonly picker: ContextualPickerModel<string>;
      readonly traitLabel: (traitKey: string) => string;
    };

export interface WorkspaceEchoLastRunBoonDraftSupport {
  readonly rowSupport: readonly boolean[];
  readonly selectedTargetSupported: boolean;
  readonly complete: boolean;
  readonly remainingTraitIdentities: readonly WorkspaceEchoLastRunBoonTraitIdentity[];
  readonly canAppend: boolean;
}

export interface WorkspaceEchoLastRunBoonDomain {
  readonly completeDraft: (
    rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
    selectedIndex: number,
  ) => AuthoredEchoLastRunBoonOffer | undefined;
  readonly draftSupportFor: (
    rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
    selectedIndex: number,
  ) => WorkspaceEchoLastRunBoonDraftSupport;
  readonly nextDraft: (
    rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
    selectedIndex: number,
  ) =>
    | { readonly rows: readonly WorkspaceEchoLastRunBoonDraftRow[]; readonly selectedIndex: number }
    | undefined;
  readonly previousDraft: (
    rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
    selectedIndex: number,
  ) =>
    | { readonly rows: readonly WorkspaceEchoLastRunBoonDraftRow[]; readonly selectedIndex: number }
    | undefined;
  readonly effectiveRarityFor: (option: AuthoredEchoLastRunBoonOption) => TraitRarity | undefined;
  readonly effectiveLevelFor: (
    identity: WorkspaceEchoLastRunBoonTraitIdentity,
  ) => number | undefined;
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
  readonly carrierKindFor: (
    identity: WorkspaceEchoLastRunBoonTraitIdentity,
  ) => WorkspaceEchoLastRunBoonCarrierDomain['kind'] | undefined;
  readonly carrierForDraft: (
    rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
    selectedIndex: number,
    retainedTargetKey?: string,
  ) => {
    readonly load: () => WorkspaceEchoLastRunBoonCarrierDomain | undefined;
  };
  readonly naturalSelectionForDraft: (
    rows: readonly WorkspaceEchoLastRunBoonDraftRow[],
    selectedIndex: number,
    retainedTargetKey?: string,
  ) => { readonly load: () => WorkspaceNaturalSelectionDomain | undefined };
  /** Engine-owned trait distinctness for one transient compound-draft row. */
  readonly traitPickerFor: (
    occupiedTraitKeys: readonly string[],
    selected?: WorkspaceEchoLastRunBoonTraitIdentity,
  ) => ContextualPickerModel<WorkspaceEchoLastRunBoonTraitIdentity>;
}

export interface WorkspaceEchoLastRunBoonInteraction {
  readonly child: Extract<WorkspaceTraitCarrierChildControl, { readonly kind: 'echoLastRunBoon' }>;
  readonly update: (
    offer: AuthoredTraitOfferTraits,
    value: AuthoredEchoLastRunBoonOffer,
  ) => AuthoredTraitOfferTraits;
  readonly forOffer: (offer: AuthoredTraitOfferTraits) => {
    readonly load: () => WorkspaceEchoLastRunBoonDomain | undefined;
  };
}

export interface WorkspaceTraitOfferInteraction {
  readonly acquisitionRoleLabel: string;
  readonly choices: readonly WorkspaceInteractionChoice<string>[];
  /** Dedicated Chaos envelope interaction; ordinary trait choices remain above. */
  readonly chaos?: WorkspaceChaosOfferInteraction;
  /** Derived replay and settlement consequences, never authored outcomes. */
  readonly feedbackFor: (value: AuthoredTraitOffer) => readonly WorkspaceTraitOfferFeedback[];
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
  readonly showPersephoneBonus: boolean;
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
  /** Conservative Rejected domain from the editor's complete candidate result. */
  readonly rejectedBlockDomain?: (
    rules: readonly WorkspaceRejectedBlockRule[],
  ) => WorkspaceRejectedBlockDomain | undefined;
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
  /** Exact engine-backed native traits-or-Gold initial outcome. */
  readonly traitOfferStartingOutcome?: () => AuthoredTraitOffer | undefined;
  readonly appendTraitOfferDraft?: (
    value: AuthoredTraitOffer,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly removeTraitOfferDraft?: (
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOffer | undefined;
}

export interface WorkspaceRejectedBlockDomain {
  readonly required: boolean;
  /** True only when every surviving branch permits clearing the retained block. */
  readonly canClear: boolean;
  readonly needsRepair: boolean;
  readonly optionKeys: readonly TraitOptionKey[];
}

/** Engine facts from one surviving ordinary-offer branch. */
export interface WorkspaceRejectedBlockRule {
  readonly rejectedBlockRequired: boolean;
  readonly rejectedBlockableOptionKeys: readonly TraitOptionKey[];
  readonly rejectedBlockNeedsRepair: boolean;
}

export interface WorkspaceChaosOfferOptionDomain {
  readonly optionKey: TraitOptionKey;
  readonly cursePicker: ContextualPickerModel<string>;
  readonly requirements: Readonly<
    Record<
      string,
      {
        readonly minimum: number;
        readonly maximum: number;
        readonly step: number;
        readonly authoringDefault: number;
        readonly unit: string;
      }
    >
  >;
}

export interface WorkspaceChaosOfferDomain {
  readonly curseOptions: readonly [
    WorkspaceChaosOfferOptionDomain,
    WorkspaceChaosOfferOptionDomain,
    WorkspaceChaosOfferOptionDomain,
  ];
  readonly selectedCurseKey?: string;
  readonly selectedCurseOperands: readonly ChaosNumericOperand[];
  readonly blessingPicker: ContextualPickerModel<string>;
  readonly rarities: readonly Exclude<TraitRarity, 'Duo'>[];
  readonly blessingOperands: Readonly<Record<string, readonly ChaosNumericOperand[]>>;
}

export interface WorkspaceChaosOfferInteraction {
  readonly blessingLabel: (blessingKey: string) => string;
  readonly curseLabel: (curseKey: string) => string;
  readonly domainFor: (value: AuthoredChaosTraitOffer) => WorkspaceChaosOfferDomain | undefined;
  readonly startingDraft: () => AuthoredChaosTraitOffer | undefined;
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
