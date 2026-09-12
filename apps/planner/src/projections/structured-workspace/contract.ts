import type { WorkspaceRewardInteraction } from './contracts/rewards';
import type {
  WorkspaceAcquisitionConversionControl,
  WorkspaceLevelResolutionControl,
  WorkspaceLevelResolutionInteraction,
  WorkspaceTraitOfferControl,
  WorkspaceTraitOfferInteraction,
} from './contracts/traits';
import {
  semanticAddressKey,
  type AcquisitionSiteAddress,
  type AuthoredTranscendentEmbryoOutcome,
  type AdditionalExitAddress,
  type BiomeAddress,
  type EncounterPhaseAddress,
  type NemesisRandomEventAddress,
  type ExitDecisionAddress,
  type HubDecisionAddress,
  type HubSlotAddress,
  type LocalVisitDecisionAddress,
  type LocalVisitOrderAddress,
  type LocalVisitSlotAddress,
  type RoomActionAddress,
  type RoomFeatureAddress,
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
  type SteadyGrowthOutcomeAddress,
  type TranscendentEmbryoOutcomeAddress,
  type FountainRarityOutcomeAddress,
  type JudgmentArcanaAddress,
  type FigurineArcanaAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type AuthoredNemesisRandomEventOutcome,
  type FieldsSpatialAddress,
  type FieldsSpatialTarget,
} from '@run-planner/engine/authored-project';
import type {
  RoomDeclaration,
  TraitRarity,
  ChaosNumericOperand,
} from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { RoomActionWindow } from '@run-planner/engine/simulation';
import type {
  CandidateOptionProjection,
  CandidateProjectionEvaluation,
  CandidateSessionFactory,
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '../candidates/candidateProjection';
import type {
  ContextualPickerModel,
  ContextualPickerProjectionService,
} from '../contextual/contextualPicker';
import type { RewardPickerProjectionService, RewardPickerStep } from '../rewards/rewardPicker';
import type { TraitDomainProjectionService } from '../rewards/traitDomainProjection';
import type { TakeoverBatchCommand } from '@planner/workspace/takeoverBatchInteraction';
import type { WorkspaceMarker, WorkspaceRoomTab } from './contracts/navigation';
import type { WorkspaceRunStateLauncher } from './contracts/run-state';
import type {
  WorkspaceAcquisitionConversionInteraction,
  WorkspaceChaosExitInteraction,
  WorkspaceChaosSpawnInteraction,
  WorkspaceHermesShrineOfferInteraction,
  WorkspaceHermesShrinePresenceInteraction,
  WorkspaceHermesShrinePurchaseInteraction,
  WorkspacePurgingPoolInteraction,
  WorkspacePurgingPoolSlotInteraction,
  WorkspaceResourcePlacementInteraction,
  WorkspaceShopOfferInteraction,
  WorkspaceShopPurchaseParticipationInteraction,
  WorkspaceStygianWellInteraction,
  WorkspaceStygianWellOfferInteraction,
  WorkspaceStygianWellPresenceInteraction,
  WorkspaceStygianWellPurchaseInteraction,
  WorkspaceStygianWellTwistResultInteraction,
  WorkspaceZagreusContractInteraction,
  WorkspaceZagreusSpawnInteraction,
} from './contracts/commerce';
import type {
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceKeepsakeSelectionInteraction,
} from './contracts/keepsake';
import type {
  WorkspaceAnomalyControl,
  WorkspaceDoorContract,
  WorkspaceDoorReward,
  WorkspaceMissingTargetAuthoring,
} from './contracts/structure';

export type {
  WorkspaceExperimentalHammerEquipResultInteraction,
  WorkspaceJeweledPomEquipResultInteraction,
  WorkspaceKeepsakeEquipResultDomain,
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceKeepsakeSelectionInteraction,
  WorkspaceTranscendentEmbryoEquipResultInteraction,
} from './contracts/keepsake';
export type {
  WorkspaceAcquisitionConversionInteraction,
  WorkspaceChaosExitInteraction,
  WorkspaceChaosSpawnInteraction,
  WorkspaceHermesShrineOfferInteraction,
  WorkspaceHermesShrinePresenceInteraction,
  WorkspaceHermesShrinePurchaseInteraction,
  WorkspacePurgingPoolInteraction,
  WorkspacePurgingPoolSlotInteraction,
  WorkspaceResourcePlacementInteraction,
  WorkspaceShopOfferInteraction,
  WorkspaceShopPurchaseParticipationInteraction,
  WorkspaceStygianWellInteraction,
  WorkspaceStygianWellOfferInteraction,
  WorkspaceStygianWellPresenceInteraction,
  WorkspaceStygianWellPurchaseInteraction,
  WorkspaceStygianWellTwistResultInteraction,
  WorkspaceZagreusContractInteraction,
  WorkspaceZagreusSpawnInteraction,
} from './contracts/commerce';

/**
 * Public structured-workspace vocabulary. The projector constructs these
 * immutable products; application and React consumers import them only from
 * the `structured-workspace` entry point.
 */
export type WorkspaceAssessment = 'assessed' | 'blocked' | 'unassessed';
/** Whether an occurrence room-feature domain has reached engine assessment. */
export type WorkspaceFeatureAssessment = 'assessed' | 'unassessed';

/** Closed application state for a structurally supported room feature. */
export type WorkspaceFeaturePresence =
  | { readonly kind: 'optionalAbsent'; readonly enabled: boolean }
  | { readonly kind: 'optionalPresent' }
  | { readonly kind: 'forcedPresent' };
export type WorkspaceProjectionSource = 'authored' | 'canonical' | 'progressive';
export type WorkspaceStatus = 'blocked' | 'empty' | 'incomplete' | 'invalid' | 'valid';

export type WorkspacePayloadEditIntent<Command extends ProjectCommand> = WorkspaceCommandIntent<
  | Command
  | Extract<
      ProjectCommand,
      { readonly kind: 'EditDerivedShopEntry' | 'ReplaceAcquisitionDisposition' }
    >
>;

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
export interface WorkspaceNemesisEventInteraction {
  readonly intentFor: (
    value: AuthoredNemesisRandomEventOutcome | null,
    reward: ResolvedRewardOffer | null,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceNemesisRandomEventOutcome' }>
  >;
  readonly key: string;
  readonly owner: NemesisRandomEventAddress;
  readonly load: () => WorkspaceNemesisEventDomain | undefined;
  readonly reward: ResolvedRewardOffer | null;
  /** Player-facing catalog label for a persisted or candidate result identity. */
  readonly rewardLabelFor: (rewardType: string) => string;
  readonly value: AuthoredNemesisRandomEventOutcome | null;
}

/** Application adaptation of the engine's branch-correlated Nemesis capability. */
export interface WorkspaceNemesisEventDomain {
  readonly familyKeys: readonly AuthoredNemesisRandomEventOutcome['kind'][];
  readonly goldTradeResponses: readonly ('accept' | 'decline')[];
  readonly damageTradeResponses: readonly ('accept' | 'decline')[];
  readonly traitTradeResponses: readonly ('accept' | 'decline')[];
  readonly damageContestResults: readonly ('success' | 'failure')[];
  readonly freeItemRewardTypes: readonly string[];
  readonly goldTradeRewardTypes: readonly string[];
  readonly damageTradeRewardTypes: readonly string[];
  readonly traitTradeTraitKeys: readonly string[];
  /** Application-owned identity model for the trait-trade target. */
  readonly traitTradePicker: (selected?: string) => ContextualPickerModel<string>;
  readonly damageContestSuccessRewardTypes: readonly string[];
  readonly traitTradeRewardType: string;
  readonly damageContestFailureRewardType: string;
}

/** Complete application-owned mapping for H's binary Passive-slot feature. */
export interface WorkspaceNemesisFeatureInteraction {
  readonly key: string;
  readonly owner: EncounterPhaseAddress;
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

/** One exact route-start or Postboss rack selection, with engine-backed option support. */

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
      /** A terminal Hub choice authors the Hub, while feedback retains the visible target owner. */
      readonly readinessOwner: SemanticAddress;
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

/** Generic topology creation; the resulting occurrence owns all room authoring. */
export interface WorkspaceStartInteraction {
  readonly intent: () => WorkspaceCreateStartIntent;
  readonly key: string;
  readonly owner: BiomeAddress;
}

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
  readonly chaosExits: ReadonlyMap<string, WorkspaceChaosExitInteraction>;
  readonly chaosSpawns: ReadonlyMap<string, WorkspaceChaosSpawnInteraction>;
  readonly zagreusContracts: ReadonlyMap<string, WorkspaceZagreusContractInteraction>;
  readonly zagreusSpawns: ReadonlyMap<string, WorkspaceZagreusSpawnInteraction>;
  readonly batchRewardStores: ReadonlyMap<string, WorkspaceBatchRewardStoreInteraction>;
  readonly encounterPhases: ReadonlyMap<string, WorkspaceEncounterInteraction>;
  readonly nemesisEvents: ReadonlyMap<string, WorkspaceNemesisEventInteraction>;
  readonly nemesisFeatures: ReadonlyMap<string, WorkspaceNemesisFeatureInteraction>;
  readonly figLeafSkips: ReadonlyMap<string, WorkspaceFigLeafInteraction>;
  readonly gorgonConditions: ReadonlyMap<string, WorkspaceGorgonConditionInteraction>;
  readonly exitSelections: ReadonlyMap<string, WorkspaceExitSelectionInteraction>;
  readonly fieldsCageOutcomes: ReadonlyMap<string, WorkspaceFieldsCageOutcomeInteraction>;
  readonly fieldsSpatialPoints: ReadonlyMap<string, WorkspaceFieldsSpatialPointInteraction>;
  readonly roomActions: ReadonlyMap<string, WorkspaceRoomActionInteraction>;
  readonly hubSlots: ReadonlyMap<string, WorkspaceHubSlotInteraction>;
  readonly hubVisitOrders: ReadonlyMap<string, WorkspaceHubVisitOrderInteraction>;
  readonly rewards: ReadonlyMap<string, WorkspaceRewardInteraction>;
  readonly acquisitionConversions: ReadonlyMap<string, WorkspaceAcquisitionConversionInteraction>;
  readonly traitOffers: ReadonlyMap<string, WorkspaceTraitOfferInteraction>;
  readonly levelResolutions: ReadonlyMap<string, WorkspaceLevelResolutionInteraction>;
  readonly steadyGrowth: ReadonlyMap<string, WorkspaceSteadyGrowthInteraction>;
  readonly transcendentEmbryo: ReadonlyMap<string, WorkspaceTranscendentEmbryoInteraction>;
  readonly fountainRarity: ReadonlyMap<string, WorkspaceFountainRarityInteraction>;
  readonly judgmentArcana: ReadonlyMap<string, WorkspaceJudgmentArcanaInteraction>;
  readonly figurineArcana: ReadonlyMap<string, WorkspaceFigurineArcanaInteraction>;
  readonly keepsakeSelections: ReadonlyMap<string, WorkspaceKeepsakeSelectionInteraction>;
  readonly keepsakeEquipResults: ReadonlyMap<string, WorkspaceKeepsakeEquipResultInteraction>;
  readonly rewardWheelOfferCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelPicks: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly rooms: ReadonlyMap<string, WorkspaceRoomInteraction>;
  /** O-specific authored structure: whether the optional third Ship phase is active. */
  readonly shipCombatPhaseCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<2 | 3>>;
  readonly shopPurchaseParticipations: ReadonlyMap<
    string,
    WorkspaceShopPurchaseParticipationInteraction
  >;
  readonly shopOffers: ReadonlyMap<string, WorkspaceShopOfferInteraction>;
  readonly purgingPoolInteractions: ReadonlyMap<string, WorkspacePurgingPoolInteraction>;
  /** One declaration-keyed Pool slot, with engine-derived contextual candidates. */
  readonly purgingPoolSlots: ReadonlyMap<string, WorkspacePurgingPoolSlotInteraction>;
  readonly hermesShrineOffers: ReadonlyMap<string, WorkspaceHermesShrineOfferInteraction>;
  readonly hermesShrinePurchases: ReadonlyMap<string, WorkspaceHermesShrinePurchaseInteraction>;
  readonly hermesShrinePresences: ReadonlyMap<string, WorkspaceHermesShrinePresenceInteraction>;
  readonly stygianWellPresences: ReadonlyMap<string, WorkspaceStygianWellPresenceInteraction>;
  readonly stygianWellInteractions: ReadonlyMap<string, WorkspaceStygianWellInteraction>;
  readonly stygianWellOffers: ReadonlyMap<string, WorkspaceStygianWellOfferInteraction>;
  readonly stygianWellPurchases: ReadonlyMap<string, WorkspaceStygianWellPurchaseInteraction>;
  readonly stygianWellTwistResults: ReadonlyMap<string, WorkspaceStygianWellTwistResultInteraction>;
  readonly resourcePlacements: ReadonlyMap<string, WorkspaceResourcePlacementInteraction>;
  readonly localVisitOrders: ReadonlyMap<string, WorkspaceLocalVisitOrderInteraction>;
  readonly localVisitGenerations: ReadonlyMap<string, WorkspaceLocalVisitGenerationInteraction>;
  readonly starts: ReadonlyMap<string, WorkspaceStartInteraction>;
  readonly takeoverBatches: ReadonlyMap<string, WorkspaceTakeoverBatchInteraction>;
  readonly topologyRemovals: ReadonlyMap<string, WorkspaceTopologyRemovalInteraction>;
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
  /** Evaluated concrete acquisition replacing the authored RoomReward offer. */
  readonly realizedAcquisition?: {
    readonly rewardType: string;
    readonly label: string;
  };
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
  /** One exact engine-derived offer repair that replaces a misleading open-ended picker. */
  readonly fixedOfferEdit?: {
    readonly actionLabel: string;
    readonly offer: ResolvedRewardOffer;
  };
  /** Engine-attested retained identity disagreement requiring a visible repair path. */
  readonly retainedSourceMismatch: boolean;
  /** Exact declaration-owned item identity for a materialized World Shop slot. */
  readonly shopOption?: {
    readonly selectedOptionKey: string | null;
    readonly options: readonly {
      readonly key: string;
      readonly label: string;
      readonly rewardType: string;
    }[];
  };
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

export interface WorkspaceRoomActionProposal {
  readonly kind: 'insert' | 'move' | 'remove';
  readonly key: string;
  readonly label: string;
  readonly reference: RoomActionReference;
  readonly structurallyAuthorable: boolean;
  readonly toIndex?: number;
}

export interface WorkspaceRoomActionRow {
  readonly address: import('@run-planner/engine/authored-project').RoomActionSemanticAddress;
  /** Engine-owned dependency/window evidence adapted into concise row copy. */
  readonly issues: readonly string[];
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly proposalKeys: readonly string[];
  readonly reference: RoomActionReference;
  readonly participation: 'required' | 'optional';
  /** Participation is authored by a room Overview control; Timeline owns ordering only. */
  readonly participationOwnedByOverview: boolean;
  /** Engine-published exact materialization command for one derived acquisition entry. */
  readonly placement?: WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      { readonly kind: 'PlaceHermesShrineDelivery' | 'PlaceClockedTraitPickup' }
    >
  >;
  readonly rank: number | null;
  /** Artificer output identity authored at this source transformation checkpoint. */
  readonly artificerOutput?: {
    readonly control: WorkspaceRewardControl;
    readonly label: 'Artificer item';
  };
  /** Exact action-owned reward payload, never rediscovered from a rendered key. */
  readonly rewardPayload?: {
    readonly control: WorkspaceRewardControl;
    /** Trait/Pom editing shown beside the action only while this role is actually acquired. */
    readonly inlineLevelResolutions: readonly WorkspaceLevelResolutionControl[];
    readonly inlineTraitOffers: readonly WorkspaceTraitOfferControl[];
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
  /** Exact Phial target control nested under this occurrence-owned fountain action. */
  readonly fountainRarity?: WorkspaceFountainRarityControl;
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
      /** Fields-only assignment of one hidden cage-completion anchor to this rigid cycle. */
      readonly fieldsCageSlot?: WorkspaceFieldsCageSlotControl;
    }
  | {
      readonly kind: 'action';
      readonly actionKey: string;
      readonly rank: number;
      /** Closed application presentation for rows represented by a lifecycle-boundary control. */
      readonly presentation: 'row' | 'fieldsCageAnchor';
      /** Engine-owned phase grouping for multi-encounter room workbenches. */
      readonly phaseKey?: string;
      /** Exact projected encounter child placed on this action row. */
      readonly supplement?: { readonly kind: 'encounter'; readonly phase: WorkspaceEncounterPhase };
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

export interface WorkspaceFieldsCageSlotControl {
  readonly choices: readonly {
    readonly label: string;
    /** Absent for the selected no-op choice. */
    readonly proposalKey?: string;
    readonly value: string;
  }[];
  readonly marker: WorkspaceMarker;
  readonly owner: RoomActionAddress;
  readonly selected: string;
  readonly slotOrdinal: number;
}

export interface WorkspaceRoomLifecycleTimeline {
  readonly entries: readonly WorkspaceRoomLifecycleTimelineEntry[];
  readonly boundaries: readonly WorkspaceRoomLifecycleBoundary[];
  /** Checkpoints represented by lifecycle boundary rows rather than duplicate list items. */
  readonly suppressedCheckpointKeys: readonly string[];
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

export interface WorkspaceShopSupplementalPurchaseDescriptor extends WorkspaceShopPurchaseDescriptor {
  readonly purchased: boolean;
  readonly reference: Extract<RoomActionReference, { readonly kind: 'interactAcquisitionEntry' }>;
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
      readonly purchase: WorkspaceShopSupplementalPurchaseDescriptor;
    }
  | {
      readonly kind: 'infernalContractReward';
      readonly key: string;
      readonly label: string;
      readonly purchase: WorkspaceShopSupplementalPurchaseDescriptor;
      readonly rewardControl: WorkspaceExplicitRewardControl;
      readonly materialized: boolean;
    }
  | {
      readonly kind: 'travelDealRefill';
      readonly key: string;
      readonly label: string;
      readonly purchase: WorkspaceShopSupplementalPurchaseDescriptor;
      readonly rewardControl: WorkspaceExplicitRewardControl;
      readonly materialized: boolean;
      readonly sourceOfferKey: string;
    }
  | {
      readonly kind: 'echoDoubleShopReward';
      readonly key: 'echoDoubleShopReward';
      readonly label: string;
      readonly purchase: WorkspaceShopSupplementalPurchaseDescriptor;
      readonly rewardControl: WorkspaceExplicitRewardControl;
      readonly materialized: boolean;
      readonly sourceOfferKey: string;
      readonly eligibleSourceOfferKeys: readonly string[];
    };

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
  /** H Passive selection is presented by the room-feature control, not a second picker. */
  readonly nemesisFeature?: {
    readonly encounterKey: string;
    readonly selected: boolean;
  };
  readonly label: string;
  readonly marker: WorkspaceMarker;
  /** Application-owned placement for the phase editor in the room timeline. */
  readonly timelineAnchor: 'roomEntered' | 'encounterStart' | 'action';
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
  readonly nemesisEvent?: {
    readonly marker: WorkspaceMarker;
    readonly owner: NemesisRandomEventAddress;
    readonly reward: ResolvedRewardOffer | null;
    readonly value: AuthoredNemesisRandomEventOutcome | null;
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

export type WorkspaceRoomFeature =
  | {
      readonly kind: 'nemesisEvent';
      readonly action: 'add' | 'remove';
      readonly interactionKey: string;
    }
  | {
      readonly kind: 'zagreusContract';
      readonly action: 'add';
      readonly presence: Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalAbsent' }>;
      readonly control: WorkspaceZagreusSpawnControl;
    }
  | {
      readonly kind: 'zagreusContract';
      readonly action: 'remove';
      readonly presence: Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalPresent' }>;
      readonly owner: AdditionalExitAddress;
    }
  | {
      readonly kind: 'chaos';
      readonly action: 'add';
      readonly presence: Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalAbsent' }>;
      readonly control: WorkspaceChaosSpawnControl;
    }
  | {
      readonly kind: 'chaos';
      readonly action: 'remove';
      readonly marker: WorkspaceMarker;
      readonly presence:
        | Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalPresent' }>
        | Extract<WorkspaceFeaturePresence, { readonly kind: 'forcedPresent' }>;
      readonly owner: AdditionalExitAddress;
    }
  | {
      /** Fixed Postboss inventory; candidates are produced by the engine assessment. */
      readonly kind: 'purgingPool';
      readonly assessment: WorkspaceFeatureAssessment;
      readonly inventoryAddress: RoomFeatureAddress;
      readonly inventoryMarker: WorkspaceMarker;
      readonly interactionKey: string;
      readonly interacted: boolean;
      readonly slots: readonly {
        readonly candidateTraitKeys: readonly string[];
        readonly candidateTraits: readonly { readonly key: string; readonly label: string }[];
        readonly interactionKey: string;
        readonly key: 'left' | 'middle' | 'right';
        readonly label: string;
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly sale?: { readonly sold: boolean };
        readonly traitLabel?: string;
        readonly traitKey: string | null;
      }[];
    }
  | {
      /** Shrine inventory is always visible and authored once present. */
      readonly kind: 'hermesShrine';
      readonly assessment: WorkspaceFeatureAssessment;
      readonly presence: WorkspaceFeaturePresence;
      readonly presenceAddress: RoomFeatureAddress;
      readonly presenceMarker: WorkspaceMarker;
      readonly inventoryAddress?: RoomFeatureAddress;
      readonly inventoryMarker?: WorkspaceMarker;
      readonly presenceInteractionKey?: string;
      readonly slots: readonly {
        readonly key: import('@run-planner/engine/authored-project').HermesShrineSlotKey;
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly label: string;
        readonly rewardType: string | null;
        readonly rewardLabel?: string;
        readonly candidateRewardTypes: readonly string[];
        readonly candidateRewards: readonly {
          readonly rewardType: string;
          readonly label: string;
        }[];
        readonly offerInteractionKey: string;
        readonly purchaseInteractionKey: string;
        readonly purchase:
          import('@run-planner/engine/authored-project').HermesShrinePurchase | null;
      }[];
      readonly travelDealRefill?: {
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly rewardType: string | null;
        readonly rewardLabel?: string;
        readonly candidateRewardTypes: readonly string[];
        readonly candidateRewards: readonly {
          readonly rewardType: string;
          readonly label: string;
        }[];
        readonly offerInteractionKey: string;
        readonly purchaseInteractionKey: string;
        readonly purchase:
          import('@run-planner/engine/authored-project').HermesShrinePurchase | null;
      };
    }
  | {
      readonly kind: 'stygianWell';
      readonly assessment: WorkspaceFeatureAssessment;
      readonly presence: WorkspaceFeaturePresence;
      readonly presenceAddress: RoomFeatureAddress;
      readonly presenceMarker: WorkspaceMarker;
      readonly inventoryAddress?: RoomFeatureAddress;
      readonly inventoryMarker?: WorkspaceMarker;
      readonly presenceInteractionKey?: string;
      readonly interactionKey?: string;
      readonly interacted: boolean;
      readonly slots: readonly {
        readonly key:
          import('@run-planner/engine/authored-project').StygianWellSlotKey | 'travelDealRefill';
        readonly generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey;
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly label: string;
        readonly itemKey: string | null;
        readonly itemLabel?: string;
        readonly candidateItemKeys: readonly string[];
        readonly candidateItems: readonly { readonly key: string; readonly label: string }[];
        readonly offerInteractionKey: string;
        readonly purchaseInteractionKey: string;
        readonly purchased: boolean;
        readonly twist?: {
          readonly address: RoomFeatureAddress;
          readonly marker: WorkspaceMarker;
          readonly itemKey: string | null;
          readonly itemLabel?: string;
          readonly candidateItemKeys: readonly string[];
          readonly candidateItems: readonly { readonly key: string; readonly label: string }[];
          readonly interactionKey: string;
        };
      }[];
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
  /** Engine-ordered lifecycle entries owned by this phase, including automatic effects. */
  readonly timeline: readonly WorkspaceRoomLifecycleTimelineEntry[];
  /** Active optional actions owned by this phase but not yet inserted. */
  readonly optionalRows: readonly WorkspaceRoomActionRow[];
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
  /** Complete reward surface exposed by this room's selected-offer binding. */
  readonly offerRewardRewards: readonly WorkspaceDoorReward[];
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
  /** Declared Chaos spawn capability; the authored door remains occurrence-owned. */
  readonly chaosSpawn?: WorkspaceChaosSpawnControl;
  readonly rewardControls: readonly WorkspaceRewardControl[];
  /** Route-owned selected successful tool interactions, presented at their exact room. */
  readonly resources?: readonly {
    readonly address: RoomFeatureAddress;
    readonly family: import('@run-planner/engine/catalog-schema').ResourceFamily;
    readonly label: string;
    readonly marker: WorkspaceMarker;
    readonly action: 'add' | 'move' | 'remove';
    readonly interactionKey: string;
    readonly legal: boolean;
    /** Only present when selecting this room would replace another placement. */
    readonly currentPlacement?: {
      readonly address: import('@run-planner/engine/authored-project').OccurrenceAddress;
      readonly biomeKey: string;
      readonly locationLabel: string;
    };
  }[];
  readonly roomPicker?: WorkspaceRoomPickerControl;
  /** A Boss-only fixed effect at its ordinary Boss-defeated lifecycle seam. */
  readonly judgment?: {
    readonly address: JudgmentArcanaAddress;
    readonly inactiveArcanaKeys: readonly string[];
    readonly marker: WorkspaceMarker;
    readonly requiredCount: number;
    readonly value: readonly string[];
  };
  /** A second, independent Boss-only draw immediately after Judgment. */
  readonly figurine?: {
    readonly address: FigurineArcanaAddress;
    readonly inactiveArcanaKeys: readonly string[];
    readonly marker: WorkspaceMarker;
    readonly requiredCount: number;
    readonly rarity: TraitRarity;
    readonly value: readonly string[];
  };
  /** A Postboss-only ordinary room-local rack selection. */
  readonly keepsakeSelection?: {
    readonly address: KeepsakeSelectionAddress;
    readonly equipResult?: {
      readonly address: KeepsakeEquipResultAddress;
      readonly marker: WorkspaceMarker;
    };
    readonly marker: WorkspaceMarker;
    readonly selectedKeepsakeKey?: string;
  };
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

export interface WorkspaceChaosExitControl {
  readonly door: WorkspaceDoorContract;
  readonly forced: boolean;
  readonly kind: 'chaos';
  readonly mapChoices: readonly WorkspaceInteractionChoice<string>[];
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
  readonly selected: boolean;
}

export interface WorkspaceChaosSpawnControl {
  readonly authorable: boolean;
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
}

export interface StructuredWorkspaceContextualServices {
  readonly candidateSessions: CandidateSessionFactory;
  readonly contextualPicker: ContextualPickerProjectionService;
  readonly rewardPicker: RewardPickerProjectionService;
  readonly traitDomain: TraitDomainProjectionService;
}
