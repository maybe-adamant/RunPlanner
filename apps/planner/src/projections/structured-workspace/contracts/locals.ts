import type {
  AuthoredEncounterCustomization,
  AuthoredNemesisRandomEventKind,
  AuthoredNemesisRandomEventOutcome,
  EncounterPhaseAddress,
  FieldsSpatialAddress,
  FieldsSpatialTarget,
  LocalVisitDecisionAddress,
  LocalVisitOrderAddress,
  LocalVisitSlotAddress,
  NemesisRandomEventAddress,
  OccurrenceAddress,
  OccurrenceId,
  ProjectCommand,
  RewardWheelAddress,
  RoomFeatureAddress,
  SideRoomGeneration,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { CandidateOptionProjection } from '@planner/projections/candidates/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { WorkspaceMarker } from './navigation';
import type { WorkspaceDoorContract } from './structure';
import type { WorkspaceTraitOfferControl } from './traits';
import type { WorkspaceCountedRewardControl, WorkspaceExplicitRewardControl } from './rewards';
import type { WorkspaceShopOfferDescriptor, WorkspaceShopSupplementalDescriptor } from './commerce';
import type {
  WorkspaceCandidateInteraction,
  WorkspaceCommandIntent,
  WorkspacePickerCandidateInteraction,
  WorkspaceInteractionChoice,
  WorkspaceRoomSummary,
  WorkspaceShipStructurePhase,
} from '../contract';

export interface WorkspaceFieldsCageOutcomeInteraction extends WorkspacePickerCandidateInteraction<
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
  readonly disabledReason?: string;
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
  readonly nemesisEvent?: WorkspaceNemesisEventSelection;
  readonly owner: EncounterPhaseAddress;
  readonly selected: string;
}

/** One declared encounter decision bound to its exact phase owner. */
export interface WorkspaceEncounterCustomizationInteraction {
  readonly intentFor: (
    decisionKey: string,
    value: AuthoredEncounterCustomization | null,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceEncounterCustomization' }>
  >;
  readonly key: string;
  readonly owner: EncounterPhaseAddress;
  /**
   * Current exact-assembly assessment, published atomically with the bound
   * intent and authored choices. Absent only when context is genuinely unavailable.
   */
  readonly generatedAssessment?: WorkspaceGeneratedEncounterAssessment;
  /** Contextual generated-highlight domain, including the explicit Default value. */
  readonly generatedHighlightPicker?: ContextualPickerModel<string>;
  /**
   * Assesses a local whole-wave draft against this exact phase without
   * publishing intermediate authored state.
   */
  readonly generatedWaveDraftFor?: (
    waveIndex: number,
    confirmedSeedCount: number,
    typeKeys: readonly string[],
  ) => WorkspaceGeneratedWaveDraft;
}

export type WorkspaceGeneratedWaveDraftChoice =
  | { readonly kind: 'finish' }
  | { readonly kind: 'confirmSeed'; readonly key: string }
  | { readonly kind: 'enemy'; readonly key: string };

export interface WorkspaceGeneratedWaveDraft {
  readonly picker: ContextualPickerModel<WorkspaceGeneratedWaveDraftChoice>;
  readonly stepLabel: string;
}

export interface WorkspaceGeneratedEncounterAssessment {
  readonly issues: readonly {
    readonly message: string;
    readonly waveIndex?: number;
    readonly field?: 'waveCount' | 'highlight';
  }[];
  readonly composition: 'active' | 'nativeWaveCount' | 'nativeHighlight';
  readonly budget?: {
    readonly kind: 'exact' | 'range';
    readonly baseRoll?: { readonly min: number; readonly max: number };
    readonly waveBudgets:
      readonly number[] | readonly { readonly min: number; readonly max: number }[];
  };
  readonly waves: readonly {
    readonly waveIndex: number;
    readonly additionalTypeCount: { readonly min: number; readonly max: number };
    readonly seeds: readonly { readonly key: string; readonly kind: 'fixed' | 'highlight' }[];
    /** Complete generated members when the explicit row is valid. */
    readonly generatedMemberKeys?: readonly string[];
    readonly countPreview?: readonly {
      readonly key: string;
      readonly requested?: number;
      readonly effective?: number;
      readonly count?: number;
    }[];
  }[];
}

export interface WorkspaceNemesisEventSelection {
  /** Persisted authored choice key that selects the native Nemesis event. */
  readonly encounterKey: string;
  readonly owner: NemesisRandomEventAddress;
  readonly familyPicker: ContextualPickerModel<AuthoredNemesisRandomEventKind>;
  readonly familyIntentFor: (
    family: AuthoredNemesisRandomEventKind,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SelectNemesisRandomEventFamily' }>
  >;
}

export interface WorkspaceNemesisEventInteraction extends WorkspaceNemesisEventSelection {
  readonly detailIntentFor: (
    value: AuthoredNemesisRandomEventOutcome & { readonly reward: ResolvedRewardOffer | null },
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceNemesisRandomEventInteraction' }>
  >;
  readonly key: string;
  readonly load: () => WorkspaceNemesisEventDomain | undefined;
  readonly reward: ResolvedRewardOffer | null;
  readonly value: AuthoredNemesisRandomEventOutcome | null;
  readonly fixedResultLabel?: string;
  readonly selectedRewardLabel?: string;
  readonly selectedTraitLabel?: string;
}

/** One concrete family-owned editor domain at the exact Nemesis interaction. */
export interface WorkspaceNemesisEventDomain {
  readonly rewardPicker?: ContextualPickerModel<string>;
  readonly traitPicker?: ContextualPickerModel<string>;
}

/** Complete application-owned mapping for H's binary Passive-slot feature. */
export interface WorkspaceNemesisFeatureInteraction {
  readonly key: string;
  readonly owner: EncounterPhaseAddress;
  readonly disabledReason?: string;
  readonly intent: WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      {
        readonly kind: 'SelectEncounter' | 'ResetEncounter';
      }
    >
  >;
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
  readonly summary: string;
}

/** One occurrence-owned physical placement row for an H Fields combat room. */
export interface WorkspaceFieldsSpatialControl {
  readonly address: FieldsSpatialAddress;
  readonly interactionKey: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly pointId: number | null;
  readonly pointChoices: readonly { readonly label: string; readonly value: number | null }[];
  readonly target: FieldsSpatialTarget;
}

export interface WorkspaceFieldsSpatialPointInteraction {
  readonly key: string;
  readonly owner: FieldsSpatialAddress;
  readonly selected: number | null;
  readonly choices: readonly { readonly label: string; readonly value: number | null }[];
  readonly load: () => readonly CandidateOptionProjection<number | null>[];
  readonly intentFor: (
    pointId: number | null,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceFieldsSpatialPoint' }>
  >;
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
  readonly candidateChoices: readonly (WorkspaceInteractionChoice<string> & {
    /** Exact native identity for a directly mapped encounter choice. */
    readonly nativeEncounterDefinitionKey?: string;
  })[];
  /**
   * Declaration-owned selector affordance. Singleton pools remain semantic
   * phase owners, but cannot create a meaningful encounter selection UI.
   */
  readonly customizable: boolean;
  /** Concrete encounter-owned behavior decisions; absent means no customization capability. */
  readonly customization?: readonly WorkspaceEncounterCustomizationDecision[];
  /** H Passive selection is presented by the room-feature control, not a second picker. */
  readonly nemesisFeature?: {
    readonly encounterKey: string;
    readonly selected: boolean;
  };
  readonly label: string;
  readonly marker: WorkspaceMarker;
  /** Application-owned placement for the phase editor in the room timeline. */
  readonly timelineAnchor: 'roomEntered' | 'encounterStart';
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
  readonly selectedEncounter: {
    readonly key: string;
    readonly label: string;
    /** Resolved declaration identity when this phase maps to a native encounter. */
    readonly nativeEncounterDefinitionKey?: string;
  };
  readonly nemesisEvent?: {
    readonly marker: WorkspaceMarker;
    readonly owner: NemesisRandomEventAddress;
    readonly reward: ResolvedRewardOffer | null;
    readonly value: AuthoredNemesisRandomEventOutcome | null;
  };
}

type WorkspaceEncounterCustomizationDecisionBase = {
  readonly key: string;
  readonly label: string;
  readonly value?: AuthoredEncounterCustomization;
  readonly valueSupported: boolean;
  readonly retainedChoiceLabels?: readonly { readonly key: string; readonly label: string }[];
};

export type WorkspaceEncounterCustomizationDecision =
  | (WorkspaceEncounterCustomizationDecisionBase & {
      readonly selection: {
        readonly kind: 'single';
        readonly choices: readonly { readonly key: string; readonly label: string }[];
      };
    })
  | (WorkspaceEncounterCustomizationDecisionBase & {
      readonly selection: {
        readonly kind: 'orderedPrefix';
        readonly choices: readonly { readonly key: string; readonly label: string }[];
        readonly maximumLength: 2;
      };
    })
  | (WorkspaceEncounterCustomizationDecisionBase & {
      readonly selection: {
        readonly kind: 'generated';
        readonly choices: readonly {
          readonly key: string;
          readonly label: string;
        }[];
        readonly fixedEnemies: readonly { readonly key: string; readonly label: string }[];
        readonly waveCount: { readonly min: number; readonly max: number };
      };
    });

interface WorkspaceLocalVisitSlotBase {
  readonly address: LocalVisitSlotAddress;
  /** Declared physical availability order for the parent-local pressure rule. */
  readonly availabilityRank: number;
  readonly entered: boolean;
  readonly enteredOrdinal: number | null;
  /** Fixed side-room declaration identity, including ungenerated slots. */
  readonly gameName: string;
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
      readonly spatial: readonly WorkspaceFieldsSpatialControl[];
      readonly optionalRewardCount: number;
      readonly optionalRewardCapacity: number;
      readonly optionalRewardCountValues: readonly number[];
      readonly optionalRewardCountAddress: RoomFeatureAddress;
      readonly optionalRewardCountMarker: WorkspaceMarker;
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
    };
