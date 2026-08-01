import {
  semanticAddressKey,
  type AuthoredBatchState,
  type BiomeAddress,
  type BiomeFieldAddress,
  type ExitDecisionAddress,
  type ExitDecisionSourceAddress,
  type HubDecisionAddress,
  type HubOpenSetAddress,
  type HubSlotAddress,
  type HubVisitAddress,
  type LocalChildAddress,
  type LocalChildGroupAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type ProjectCommand,
  type RewardWheelAddress,
  type SemanticAddress,
  type SideRoomGeneration,
  type ShopPurchaseAddress,
  type TargetAddress,
} from '@run-planner/engine/authored-project';
import type { CompletionRoomDescriptor, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { CanonicalBatch, ProjectEvaluationAssembly } from '@run-planner/engine/simulation';

import type {
  CandidateOptionProjection,
  CandidateSessionFactory,
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '../candidateProjection';
import type { ContextualPickerModel, ContextualPickerProjectionService } from '../contextualPicker';
import type { ProjectedRewardDomain } from '../rewardDomainProjection';
import type { RewardPickerProjectionService, RewardPickerStep } from '../rewardPicker';
import type { TakeoverBatchCommand } from '@planner/workspace/takeoverBatchInteraction';

/**
 * Public structured-workspace vocabulary. The projector constructs these
 * immutable products; application and React consumers import them only from
 * the `structured-workspace` entry point.
 */
export type WorkspaceAssessment = 'assessed' | 'blocked' | 'unassessed';
export type WorkspaceProjectionSource = 'authored' | 'canonical' | 'progressive';
export type WorkspaceStatus = 'blocked' | 'empty' | 'incomplete' | 'invalid' | 'valid';

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
  readonly load: () => readonly CandidateOptionProjection<T>[];
  readonly owner: SemanticAddress;
  readonly selected?: T;
}

export interface WorkspaceRewardInteraction {
  readonly authoredRewardTypes: readonly string[];
  readonly intentFor: (offer: ResolvedRewardOffer) => WorkspaceRewardCommandIntent;
  readonly key: string;
  readonly owner: RewardCandidateOwner['address'];
  readonly choiceLabel: (step: RewardPickerStep, offer: ResolvedRewardOffer) => string;
  readonly load: () => Promise<ProjectedRewardDomain>;
  readonly model: (
    domain: ProjectedRewardDomain,
    step: RewardPickerStep,
    selected: ResolvedRewardOffer,
  ) => ContextualPickerModel<ResolvedRewardOffer>;
  readonly selected: ResolvedRewardOffer;
  readonly summary: (offer: ResolvedRewardOffer) => string;
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
        | 'ReplaceShopOffer';
    }
  >
>;

type WorkspaceTargetRoomCommandIntent = WorkspaceCommandIntent<
  Extract<ProjectCommand, { readonly kind: 'CreateTarget' | 'ReplaceOccurrenceRoom' }>
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

/** Structural creation supplies the exact catalog-owned command facts React needs. */
export type WorkspaceStructuralInteraction =
  | {
      readonly action: 'createBatch';
      readonly intent: WorkspaceCommandIntent<
        Extract<ProjectCommand, { readonly kind: 'CreateBatch' }>
      >;
      readonly key: string;
      readonly owner: ExitDecisionAddress;
    }
  | {
      readonly action: 'createLinkedExit';
      readonly intent: () => WorkspaceCommandIntent<
        Extract<ProjectCommand, { readonly kind: 'CreateLinkedExit' }>
      >;
      readonly key: string;
      readonly owner: ExitDecisionAddress;
    }
  | {
      readonly action: 'createHubDecision';
      readonly intent: WorkspaceCommandIntent<
        Extract<ProjectCommand, { readonly kind: 'CreateHubDecision' }>
      >;
      readonly key: string;
      readonly owner: HubDecisionAddress;
    };

/** Visible exit frontiers can expose independent structural and takeover actions. */
export interface WorkspaceExitFrontierCapabilities {
  readonly structural?: Extract<
    WorkspaceStructuralInteraction,
    { readonly owner: ExitDecisionAddress }
  >['action'];
  readonly takeover?: true;
}

export interface WorkspaceTopologyRemovalInteraction {
  readonly intent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ClearTopology' | 'RemoveExitDecision' }>
  >;
  readonly key: string;
  readonly owner: BiomeAddress | ExitDecisionAddress;
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

export type WorkspaceHubVisitInteraction = WorkspaceCandidateInteraction<string> & {
  readonly intentFor: (
    hubSlotKey: string,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'AppendHubVisit' | 'ReplaceHubVisit' }>
  >;
  readonly removal?: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'RemoveHubVisitsFrom' }>
  >;
};

interface WorkspaceTakeoverBatchInteractionBase {
  readonly action: 'create' | 'replace' | 'reconcile';
  readonly key: string;
  readonly owner: ExitDecisionAddress;
}

export interface WorkspaceCandidateTakeoverBatchInteraction extends WorkspaceTakeoverBatchInteractionBase {
  readonly presentation: 'candidate';
  readonly intentFor: (candidate: WorkspaceTakeoverCandidate) => WorkspaceTakeoverCommandIntent;
  readonly selected?: WorkspaceTakeoverCandidate;
  readonly load: () => readonly CandidateOptionProjection<WorkspaceTakeoverCandidate>[];
}

export type WorkspaceFixedWidthOneTakeoverActionResult =
  | { readonly kind: 'intent'; readonly intent: WorkspaceTakeoverCommandIntent }
  | { readonly kind: 'unavailable'; readonly message: string };

export interface WorkspaceFixedWidthOneTakeoverInteraction extends WorkspaceTakeoverBatchInteractionBase {
  readonly action: 'create';
  readonly execute: () => WorkspaceFixedWidthOneTakeoverActionResult;
  readonly label: string;
  readonly presentation: 'fixedWidthOneTakeover';
  readonly summary: string;
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
  | WorkspaceCandidateTakeoverBatchInteraction
  | WorkspaceFixedWidthOneTakeoverInteraction
  | WorkspaceCompletedHubHandoffInteraction
  | WorkspaceTakeoverRepairInteraction;

type WorkspaceTakeoverCommandIntent = WorkspaceCommandIntent<TakeoverBatchCommand>;

export interface WorkspaceTakeoverCandidate {
  readonly gameName: string;
  readonly label: string;
}

export interface WorkspaceInteractionCatalog {
  readonly batchRewardStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly exitFrontierCapabilities: ReadonlyMap<string, WorkspaceExitFrontierCapabilities>;
  readonly exitSelections: ReadonlyMap<string, WorkspaceExitSelectionInteraction>;
  readonly fieldsCageOutcomes: ReadonlyMap<string, WorkspaceCandidateInteraction<'min' | 'max'>>;
  readonly hubSlots: ReadonlyMap<string, WorkspaceHubSlotInteraction>;
  readonly hubVisits: ReadonlyMap<string, WorkspaceHubVisitInteraction>;
  readonly rewards: ReadonlyMap<string, WorkspaceRewardInteraction>;
  readonly rewardWheelOfferCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelPicks: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly rooms: ReadonlyMap<string, WorkspaceRoomInteraction>;
  readonly shipEncounterCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<2 | 3>>;
  readonly shopPurchases: ReadonlyMap<string, WorkspaceCandidateInteraction<boolean>>;
  readonly sideRoomEntryOrders: ReadonlyMap<
    string,
    WorkspaceCandidateInteraction<readonly string[]>
  >;
  readonly sideRoomGenerations: ReadonlyMap<
    string,
    WorkspaceCandidateInteraction<SideRoomGeneration>
  >;
  readonly starts: ReadonlyMap<string, WorkspaceStartInteraction>;
  readonly structural: ReadonlyMap<string, WorkspaceStructuralInteraction>;
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

export function workspaceSideRoomEntryOrderKey(owner: LocalChildAddress): string {
  return `${semanticAddressKey(owner)}:entry-order`;
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
      readonly address: OccurrenceAddress;
      readonly candidateGameNames: readonly string[];
      readonly kind: 'startRoomPicker';
      readonly selectedGameName: string;
    };

interface WorkspaceRewardControlBase {
  readonly marker: WorkspaceMarker;
  readonly offer: ResolvedRewardOffer;
  readonly owner: RewardCandidateOwner;
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
  readonly active: boolean;
  readonly control: WorkspaceCountedRewardControl;
  readonly key: string;
  readonly label: string;
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
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly offerCount: number;
  readonly offers: readonly WorkspaceRewardWheelOfferDescriptor[];
  readonly pickedOfferIndex: number;
  readonly storeKey: string;
}

export interface WorkspaceShopPurchaseDescriptor {
  readonly address: ShopPurchaseAddress;
  readonly marker: WorkspaceMarker;
  readonly purchased: boolean;
}

export interface WorkspaceShopOfferDescriptor {
  readonly key: string;
  readonly label: string;
  readonly purchase: WorkspaceShopPurchaseDescriptor;
  readonly rewardControl: WorkspaceExplicitRewardControl;
}

export interface WorkspaceEphyraSideRoomEntryOption {
  readonly key: string;
  readonly label: string;
  readonly position: number | null;
  readonly proposedEnteredSlotKeys: readonly string[];
}

export interface WorkspaceEphyraSideRoomEntryOrderControl {
  readonly interactionKey: string;
  readonly options: readonly WorkspaceEphyraSideRoomEntryOption[];
  readonly selectedKey: string;
}

export interface WorkspaceEphyraSideRoomDescriptor {
  readonly address: LocalChildAddress;
  readonly entered: boolean;
  readonly enteredOrdinal: number | null;
  readonly entryOrder: WorkspaceEphyraSideRoomEntryOrderControl;
  readonly generation: SideRoomGeneration;
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly physicalDoorId: number;
  readonly rewardControl: WorkspaceCountedRewardControl;
}

export interface WorkspaceEphyraSideRoomGroup {
  readonly address: LocalChildGroupAddress;
  readonly enteredSlotKeys: readonly string[];
  readonly marker: WorkspaceMarker;
  readonly slots: readonly WorkspaceEphyraSideRoomDescriptor[];
}

/**
 * Side rooms are optional picked-room detail. A dormant authored occurrence
 * retains its values but does not publish child owners, controls, or
 * interactions until its authored visit activates it.
 */
export type WorkspaceEphyraSideRoomSurface =
  | { readonly kind: 'withheld' }
  | {
      readonly group: WorkspaceEphyraSideRoomGroup;
      readonly kind: 'published';
    };

export type WorkspaceRoomLocal =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'fixed';
      readonly marker: WorkspaceMarker;
      readonly summary: string;
      readonly control?: WorkspaceExplicitRewardControl;
    }
  | {
      readonly kind: 'incomingReward';
      readonly control: WorkspaceCountedRewardControl;
      readonly clockworkReward?: 'goal' | 'nonGoal';
    }
  | {
      readonly kind: 'ephyra';
      readonly incomingReward: WorkspaceCountedRewardControl;
      readonly sideRooms: WorkspaceEphyraSideRoomSurface;
    }
  | {
      readonly kind: 'fields';
      readonly cages: readonly WorkspaceFieldsCageDescriptor[];
      readonly groupKey: string;
    }
  | {
      readonly kind: 'ship';
      readonly encounterCount: 2 | 3;
      readonly wheels: readonly WorkspaceRewardWheelDescriptor[];
    }
  | {
      readonly kind: 'shop';
      readonly materialized: boolean;
      readonly offers: readonly WorkspaceShopOfferDescriptor[];
    };

export interface WorkspaceRoomSummary {
  readonly address: OccurrenceAddress;
  /** Authored detail activation is deliberately separate from evaluated entry. */
  readonly detailsActive: boolean;
  readonly entered: boolean;
  readonly gameName: string;
  readonly kind: RoomDeclaration['kind'];
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly occurrenceId: OccurrenceId;
  readonly roomLocal: WorkspaceRoomLocal;
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly rewardSummary?: string;
  readonly roomPicker?: WorkspaceRoomPickerControl;
}

export interface WorkspacePhysicalTarget {
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly exitKey: string;
  readonly index: number;
  readonly marker: WorkspaceMarker;
  readonly physicalState: 'available' | 'unavailable';
  readonly selected: boolean;
  readonly retained: boolean;
  readonly nextPath: 'continuesSpine' | 'deadLeaf' | 'startsCompletion';
  readonly room: WorkspaceRoomSummary;
}

export type WorkspaceMissingTargetAuthoring =
  | { readonly kind: 'ready' }
  | {
      readonly kind: 'awaitingPriorExit';
      readonly message: string;
      readonly prerequisiteExitKey: string;
    }
  | {
      readonly kind: 'awaitingBatchRewardStore';
      readonly message: string;
    }
  | {
      readonly kind: 'awaitingFieldsCageOutcome';
      readonly message: string;
    };

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

export interface WorkspaceLinkedExitNode {
  readonly kind: 'linkedExit';
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly owner: ExitDecisionAddress;
  readonly source: ExitDecisionSourceAddress;
  readonly target: WorkspacePhysicalTarget;
}

interface WorkspaceBatchNodeBase {
  readonly batchState: CanonicalBatch['batchState'] | AuthoredBatchState;
  readonly fields?: WorkspaceFieldsBatchContext;
  readonly fieldsCageOutcome?: WorkspaceMarker;
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly missingTargets: readonly WorkspaceMissingPhysicalTarget[];
  readonly owner: ExitDecisionAddress;
  readonly repairIntent?: WorkspaceBatchRepairIntent;
  readonly rewardStore?: WorkspaceMarker;
  readonly selection: WorkspaceMarker;
  readonly source: ExitDecisionSourceAddress;
  readonly targets: readonly WorkspacePhysicalTarget[];
  readonly topologyState: 'complete' | 'partial' | 'retained';
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
    }
  | {
      readonly kind: 'hubDecision';
      readonly interactionKey: string;
      readonly marker: WorkspaceMarker;
      readonly owner: HubDecisionAddress;
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
  readonly open: boolean;
  readonly physicalDoorId: number;
  readonly room?: WorkspaceRoomSummary;
  readonly roomKind: RoomDeclaration['kind'];
  readonly visited: boolean;
}

export type WorkspaceHubVisitState = 'authored' | 'next' | 'locked';

export interface WorkspaceHubVisit {
  readonly authoring: WorkspaceHubVisitState;
  readonly marker: WorkspaceMarker;
  readonly room?: WorkspaceRoomSummary;
  readonly hubSlotKey?: string;
  readonly visitIndex: number;
}

export interface WorkspaceHubDecisionNode {
  readonly authoring: 'authored' | 'outline';
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
}

export interface WorkspaceOccurrenceWorkbenchNode {
  readonly kind: 'occurrenceWorkbench';
  readonly key: string;
  readonly localDetailMarkers: readonly WorkspaceMarker[];
  readonly marker: WorkspaceMarker;
  readonly inspectorPresentation: 'full' | 'hubRoomLocal';
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
  | WorkspaceLinkedExitNode
  | WorkspaceOrdinaryBatchNode
  | WorkspaceTakeoverBatchNode
  | WorkspaceMixedBatchNode
  | WorkspaceHubDecisionNode
  | WorkspaceOccurrenceWorkbenchNode
  | WorkspaceCompletionNode;

export interface WorkspaceHubVisitRailEntry {
  readonly key: string;
  readonly label: string;
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

export type WorkspaceRailEntry =
  | {
      readonly kind: 'node';
      readonly key: string;
      readonly label: string;
      readonly marker: WorkspaceMarker;
      readonly node: WorkspaceNode;
      readonly summary?: string;
    }
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
  readonly fields: readonly WorkspaceBiomeField[];
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly nodes: readonly WorkspaceNode[];
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
}
