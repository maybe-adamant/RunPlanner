export type {
  WorkspaceShopOfferDescriptor,
  WorkspaceShopPurchaseDescriptor,
  WorkspaceShopSupplementalDescriptor,
  WorkspaceShopSupplementalPurchaseDescriptor,
} from './contracts/commerce';
export type {
  WorkspaceChaosExitControl,
  WorkspaceChaosSpawnControl,
  WorkspaceRoomFeature,
  WorkspaceZagreusContractControl,
  WorkspaceZagreusSpawnControl,
} from './contracts/features';
export type {
  WorkspaceEncounterInteraction,
  WorkspaceEncounterCustomizationInteraction,
  WorkspaceEncounterPhase,
  WorkspaceGeneratedEncounterAssessment,
  WorkspaceGeneratedWaveDraftChoice,
  WorkspaceGeneratedFangsDraftChoice,
  WorkspaceInfiniteRosterDraftChoice,
  WorkspaceFieldsCageDescriptor,
  WorkspaceFieldsCageOutcomeInteraction,
  WorkspaceFieldsOptionalRewardDescriptor,
  WorkspaceFieldsSpatialControl,
  WorkspaceFieldsSpatialPointInteraction,
  WorkspaceFigLeafInteraction,
  WorkspaceGorgonConditionInteraction,
  WorkspaceLocalVisitDecision,
  WorkspaceLocalVisitGenerationInteraction,
  WorkspaceLocalVisitOrderControl,
  WorkspaceLocalVisitOrderInteraction,
  WorkspaceLocalVisitOrderOption,
  WorkspaceLocalVisitSlot,
  WorkspaceNemesisEventDomain,
  WorkspaceNemesisEventInteraction,
  WorkspaceNemesisFeatureInteraction,
  WorkspaceRewardWheelDescriptor,
  WorkspaceRewardWheelOfferDescriptor,
  WorkspaceRoomLocal,
} from './contracts/locals';
export type {
  WorkspaceCountedRewardControl,
  WorkspaceExplicitRewardControl,
  WorkspaceRewardControl,
} from './contracts/rewards';
export type {
  WorkspaceBatchRewardStoreInteraction,
  WorkspaceCompletedHubHandoffInteraction,
  WorkspaceExitSelectionInteraction,
  WorkspaceHubBoardResetInteraction,
  WorkspaceHubSlotCloseInteraction,
  WorkspaceHubSlotInteraction,
  WorkspaceHubSlotOpeningAttempt,
  WorkspaceHubActionOrderInteraction,
  WorkspaceHubActionOrderProposal,
  WorkspaceStageDecisionRemoval,
  WorkspaceStartInteraction,
  WorkspaceTakeoverBatchInteraction,
  WorkspaceTakeoverRepairInteraction,
  WorkspaceTopologyRemovalInteraction,
} from './contracts/structure';
export type {
  WorkspaceFieldsCageSlotControl,
  WorkspaceFigurineArcanaInteraction,
  WorkspaceFountainRarityControl,
  WorkspaceFountainRarityDomain,
  WorkspaceFountainRarityInteraction,
  WorkspaceJudgmentArcanaInteraction,
  WorkspaceRoomActionInteraction,
  WorkspaceRoomActionProposal,
  WorkspaceRoomActionRow,
  WorkspaceRoomActions,
  WorkspaceRoomLifecycleBoundary,
  WorkspaceRoomLifecycleTimeline,
  WorkspaceRoomLifecycleTimelineEntry,
  WorkspaceSteadyGrowthControl,
  WorkspaceSteadyGrowthDomain,
  WorkspaceSteadyGrowthInteraction,
  WorkspaceTranscendentEmbryoControl,
  WorkspaceTranscendentEmbryoDomain,
  WorkspaceTranscendentEmbryoInteraction,
} from './contracts/timeline';
import {
  semanticAddressKey,
  type BatchRewardStoreAddress,
  type ExitDecisionAddress,
  type FigurineArcanaAddress,
  type JudgmentArcanaAddress,
  type KeepsakeEquipResultAddress,
  type KeepsakeSelectionAddress,
  type LocalVisitSlotAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type ProjectCommand,
  type RoomFeatureAddress,
  type SemanticAddress,
  type TargetAddress,
} from '@run-planner/engine/authored-project';
import type { RoomDeclaration, TraitRarity } from '@run-planner/engine/catalog-schema';
import type {
  CandidateOptionProjection,
  CandidateProjectionEvaluation,
  CandidateSessionFactory,
} from '../candidates/candidateProjection';
import type {
  ContextualPickerModel,
  ContextualPickerProjectionService,
} from '../contextual/contextualPicker';
import type { RewardPickerProjectionService } from '../rewards/rewardPicker';
import type { TraitDomainProjectionService } from '../rewards/traitDomainProjection';
import type {
  WorkspaceHermesShrineOfferInteraction,
  WorkspaceHermesShrinePresenceInteraction,
  WorkspaceHermesShrinePurchaseInteraction,
  WorkspacePurgingPoolInteraction,
  WorkspacePurgingPoolSlotInteraction,
  WorkspaceShopOfferInteraction,
  WorkspaceShopPurchaseParticipationInteraction,
  WorkspaceStygianWellInteraction,
  WorkspaceStygianWellOfferInteraction,
  WorkspaceStygianWellPresenceInteraction,
  WorkspaceStygianWellPurchaseInteraction,
  WorkspaceStygianWellTwistResultInteraction,
} from './contracts/commerce';
import type {
  WorkspaceChaosExitInteraction,
  WorkspaceChaosSpawnControl,
  WorkspaceChaosSpawnInteraction,
  WorkspaceResourcePlacementInteraction,
  WorkspaceRoomFeature,
  WorkspaceZagreusContractInteraction,
  WorkspaceZagreusSpawnControl,
  WorkspaceZagreusSpawnInteraction,
} from './contracts/features';
import type {
  WorkspaceEncounterCustomizationInteraction,
  WorkspaceEncounterInteraction,
  WorkspaceEncounterPhase,
  WorkspaceFieldsCageOutcomeInteraction,
  WorkspaceFieldsSpatialPointInteraction,
  WorkspaceFigLeafInteraction,
  WorkspaceGorgonConditionInteraction,
  WorkspaceLocalVisitGenerationInteraction,
  WorkspaceLocalVisitOrderInteraction,
  WorkspaceNemesisEventInteraction,
  WorkspaceNemesisFeatureInteraction,
  WorkspaceRewardWheelDescriptor,
  WorkspaceRoomLocal,
} from './contracts/locals';
import type { WorkspaceMarker, WorkspaceRoomTab } from './contracts/navigation';
import type { WorkspaceRewardControl, WorkspaceRewardInteraction } from './contracts/rewards';
import type { WorkspaceRunStateLauncher } from './contracts/run-state';
import type {
  WorkspaceBatchRewardStoreInteraction,
  WorkspaceExitSelectionInteraction,
  WorkspaceHubBoardResetInteraction,
  WorkspaceHubSlotInteraction,
  WorkspaceHubActionOrderInteraction,
  WorkspaceStartInteraction,
  WorkspaceTakeoverBatchInteraction,
  WorkspaceTopologyRemovalInteraction,
} from './contracts/structure';
import type {
  WorkspaceFigurineArcanaInteraction,
  WorkspaceFountainRarityInteraction,
  WorkspaceJudgmentArcanaInteraction,
  WorkspaceRoomActionInteraction,
  WorkspaceRoomActionRow,
  WorkspaceRoomActions,
  WorkspaceRoomLifecycleTimelineEntry,
  WorkspaceSteadyGrowthInteraction,
  WorkspaceTranscendentEmbryoInteraction,
} from './contracts/timeline';
import type {
  WorkspaceAcquisitionConversionInteraction,
  WorkspaceLevelResolutionInteraction,
  WorkspaceTraitOfferInteraction,
} from './contracts/traits';

import type {
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceKeepsakeSelectionInteraction,
} from './contracts/keepsake';
import type {
  WorkspaceAnomalyControl,
  WorkspaceDoorReward,
  WorkspaceMissingTargetAuthoring,
} from './contracts/structure';

export type {
  WorkspaceHermesShrineOfferInteraction,
  WorkspaceHermesShrinePresenceInteraction,
  WorkspaceHermesShrinePurchaseInteraction,
  WorkspacePurgingPoolInteraction,
  WorkspacePurgingPoolSlotInteraction,
  WorkspaceShopOfferInteraction,
  WorkspaceShopPurchaseParticipationInteraction,
  WorkspaceStygianWellInteraction,
  WorkspaceStygianWellOfferInteraction,
  WorkspaceStygianWellPresenceInteraction,
  WorkspaceStygianWellPurchaseInteraction,
  WorkspaceStygianWellTwistResultInteraction,
} from './contracts/commerce';
export type {
  WorkspaceChaosExitInteraction,
  WorkspaceChaosSpawnInteraction,
  WorkspaceResourcePlacementInteraction,
  WorkspaceZagreusContractInteraction,
  WorkspaceZagreusSpawnInteraction,
} from './contracts/features';
export type {
  WorkspaceExperimentalHammerEquipResultInteraction,
  WorkspaceJeweledPomEquipResultInteraction,
  WorkspaceKeepsakeEquipResultDomain,
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceKeepsakeSelectionInteraction,
  WorkspaceTranscendentEmbryoEquipResultInteraction,
} from './contracts/keepsake';
export type { WorkspaceRewardInteraction } from './contracts/rewards';
export type { WorkspaceAcquisitionConversionInteraction } from './contracts/traits';

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
  Command | Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
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

/**
 * A scalar setting whose support rests on route-wide math. Beside the raw
 * candidate domain it publishes the contextual-picker model, so its control
 * can state per-option support and the evidence behind it. The picker loads
 * separately and just as lazily as the domain it projects.
 */
export interface WorkspacePickerCandidateInteraction<T> extends WorkspaceCandidateInteraction<T> {
  readonly picker: { readonly load: () => ContextualPickerModel<T> };
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

export interface WorkspaceInteractionCatalog {
  readonly chaosExits: ReadonlyMap<string, WorkspaceChaosExitInteraction>;
  readonly chaosSpawns: ReadonlyMap<string, WorkspaceChaosSpawnInteraction>;
  readonly zagreusContracts: ReadonlyMap<string, WorkspaceZagreusContractInteraction>;
  readonly zagreusSpawns: ReadonlyMap<string, WorkspaceZagreusSpawnInteraction>;
  readonly batchRewardStores: ReadonlyMap<string, WorkspaceBatchRewardStoreInteraction>;
  readonly encounterPhases: ReadonlyMap<string, WorkspaceEncounterInteraction>;
  readonly encounterCustomizations: ReadonlyMap<string, WorkspaceEncounterCustomizationInteraction>;
  readonly nemesisEvents: ReadonlyMap<string, WorkspaceNemesisEventInteraction>;
  readonly nemesisFeatures: ReadonlyMap<string, WorkspaceNemesisFeatureInteraction>;
  readonly figLeafSkips: ReadonlyMap<string, WorkspaceFigLeafInteraction>;
  readonly gorgonConditions: ReadonlyMap<string, WorkspaceGorgonConditionInteraction>;
  readonly exitSelections: ReadonlyMap<string, WorkspaceExitSelectionInteraction>;
  readonly fieldsCageOutcomes: ReadonlyMap<string, WorkspaceFieldsCageOutcomeInteraction>;
  readonly fieldsSpatialPoints: ReadonlyMap<string, WorkspaceFieldsSpatialPointInteraction>;
  readonly roomActions: ReadonlyMap<string, WorkspaceRoomActionInteraction>;
  readonly hubSlots: ReadonlyMap<string, WorkspaceHubSlotInteraction>;
  readonly hubBoardResets: ReadonlyMap<string, WorkspaceHubBoardResetInteraction>;
  readonly hubActionOrders: ReadonlyMap<string, WorkspaceHubActionOrderInteraction>;
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
  readonly rewardWheelStores: ReadonlyMap<string, WorkspacePickerCandidateInteraction<string>>;
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

/**
 * This room's boss-door pool, selected by the target boss's own declaration —
 * no biome or room-name test participates. A boss that resolves its entered
 * store from the chosen offer needs one authored, so it gets the editor; a
 * pinned boss reports its fixed pool; a boss excluded from the store count
 * reports that the pool is ignored. Absent entirely on a room with no boss door.
 *
 * The editor is addressed by an ordinary `BatchRewardStoreAddress` and bound
 * into the ordinary batch reward-store interaction catalog, so its presentation
 * is the batch selector unchanged. The read-only variants carry no address,
 * interaction or marker: they raise no findings and nothing navigates to them.
 */
export type WorkspaceBossDoorRewardStoreControl =
  | {
      readonly kind: 'editor';
      readonly address: BatchRewardStoreAddress;
      readonly label: string;
      readonly marker: WorkspaceMarker;
      readonly selected?: string;
      readonly storeChoices: readonly WorkspaceInteractionChoice<string>[];
    }
  | {
      readonly kind: 'fixed';
      readonly summary: string;
    }
  | {
      readonly kind: 'ignored';
      readonly summary: string;
    };

export interface WorkspaceRoomSummary {
  readonly address: OccurrenceAddress;
  readonly bossDoorRewardStore?: WorkspaceBossDoorRewardStoreControl;
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

export interface StructuredWorkspaceContextualServices {
  readonly candidateSessions: CandidateSessionFactory;
  readonly contextualPicker: ContextualPickerProjectionService;
  readonly rewardPicker: RewardPickerProjectionService;
  readonly traitDomain: TraitDomainProjectionService;
}
